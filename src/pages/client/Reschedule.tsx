import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { format, addDays, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { getSmartSlots, type Appointment as SlotAppointment, type BlockedInterval } from '../../lib/smartSlots';
import {
    Calendar, Clock, CheckCircle, AlertTriangle, Phone,
    ChevronRight, ArrowLeft, Loader2, User, Scissors, Sparkles
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface AppointmentData {
    id: string;
    client_name: string;
    client_phone: string;
    date: string;
    time: string;
    status: string;
    service_id: number;
    stylist_id: number | null;
    tenant_id: string;
    tenants: {
        name: string;
        slug: string;
        logo_url: string | null;
        primary_color: string | null;
        timezone: string;
        sms_provider: string;
    };
    services: { name: string; duration: number; price: number } | null;
    stylists: { name: string } | null;
}

interface ScheduleDay {
    open: boolean;
    start: string;
    end: string;
    breakStart?: string;
    breakEnd?: string;
}

type Step = 'phone' | 'details' | 'date' | 'time' | 'confirm' | 'success' | 'error';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const STEP_ORDER: Step[] = ['phone', 'details', 'date', 'time', 'confirm', 'success'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function format12h(timeStr: string) {
    const [h, m] = timeStr.split(':');
    let hh = parseInt(h);
    const ampm = hh >= 12 ? 'pm' : 'am';
    hh = hh % 12 || 12;
    return `${hh}:${m} ${ampm}`;
}

function formatDateNice(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return format(d, "EEEE d 'de' MMMM", { locale: es });
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Reschedule() {
    const { id: appointmentId } = useParams<{ id: string }>();

    const [step, setStep] = useState<Step>('phone');
    const [phone, setPhone] = useState('');
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [appt, setAppt] = useState<AppointmentData | null>(null);
    const [schedule, setSchedule] = useState<Record<string, ScheduleDay>>({});
    const [existingAppts, setExistingAppts] = useState<any[]>([]);
    const [blockedSlots, setBlockedSlots] = useState<any[]>([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

    const brandColor = appt?.tenants?.primary_color ?? '#7c3aed';
    const stepIndex = STEP_ORDER.indexOf(step);

    // ── Step 1: Verify phone ─────────────────────────────────────────────────
    const handleVerifyPhone = async () => {
        const cleanPhone = phone.replace(/\s+/g, '').replace(/^0+/, '');
        if (cleanPhone.length < 10) {
            setPhoneError('Ingresa un número de 10 dígitos válido');
            return;
        }
        setPhoneError(null);
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select(`id, client_name, client_phone, date, time, status,
                    service_id, stylist_id, tenant_id,
                    tenants(name, slug, logo_url, primary_color, timezone, sms_provider),
                    services(name, duration, price),
                    stylists(name)`)
                .eq('id', appointmentId!)
                .single();

            if (error || !data) {
                setErrorMsg('No encontramos esta cita. El enlace puede ser inválido o la cita ya fue eliminada.');
                setStep('error');
                return;
            }

            const normalize = (p: string) => p.replace(/\D/g, '').slice(-10);
            if (normalize(data.client_phone) !== normalize(cleanPhone)) {
                setPhoneError('El número no coincide con el registrado en esta cita.');
                return;
            }

            if (data.status === 'cancelada') {
                setErrorMsg('Esta cita ya fue cancelada y no puede ser reagendada.');
                setStep('error');
                return;
            }
            if (data.status === 'completada') {
                setErrorMsg('Esta cita ya fue completada.');
                setStep('error');
                return;
            }

            setAppt(data as any);

            const [schedRes, apptsRes, blockedRes] = await Promise.all([
                supabase.from('schedule').select('*').eq('tenant_id', data.tenant_id).single(),
                supabase.from('appointments')
                    .select('id, date, time, service_id, stylist_id, status')
                    .eq('tenant_id', data.tenant_id)
                    .neq('status', 'cancelada')
                    .neq('id', appointmentId!),
                supabase.from('blocked_slots')
                    .select('date, start_time, end_time')
                    .eq('tenant_id', data.tenant_id),
            ]);

            if (schedRes.data) {
                const raw = schedRes.data;
                const days: Record<string, ScheduleDay> = {};
                DAY_KEYS.forEach(d => {
                    days[d] = {
                        open:       raw[`${d}_open`]        ?? false,
                        start:      raw[`${d}_start`]       ?? '09:00',
                        end:        raw[`${d}_end`]         ?? '18:00',
                        breakStart: raw[`${d}_break_start`] ?? undefined,
                        breakEnd:   raw[`${d}_break_end`]   ?? undefined,
                    };
                });
                setSchedule(days);
            }

            setExistingAppts(apptsRes.data ?? []);
            setBlockedSlots(blockedRes.data ?? []);
            setSelectedDate(data.date);
            setStep('details');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Available dates ───────────────────────────────────────────────────────
    const availableDates = useMemo(() => {
        const dates: { dateStr: string; label: string; dayName: string }[] = [];
        const today = format(new Date(), 'yyyy-MM-dd');
        for (let i = 0; i < 28 && dates.length < 14; i++) {
            const d = addDays(new Date(), i);
            const dateStr = format(d, 'yyyy-MM-dd');
            if (dateStr < today) continue;
            const dayKey = DAY_KEYS[d.getDay()];
            if (!schedule[dayKey]?.open) continue;
            dates.push({
                dateStr,
                label: i === 0 ? 'Hoy' : format(d, 'd MMM', { locale: es }),
                dayName: { sunday: 'Dom', monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié', thursday: 'Jue', friday: 'Vie', saturday: 'Sáb' }[dayKey] ?? dayKey,
            });
        }
        return dates;
    }, [schedule]);

    // ── Available slots ───────────────────────────────────────────────────────
    const availableSlots = useMemo(() => {
        if (!selectedDate || !appt?.services) return [];
        const dayKey = DAY_KEYS[new Date(selectedDate + 'T00:00:00').getDay()];
        const daySchedule = schedule[dayKey];
        if (!daySchedule?.open) return [];

        const baseDate = new Date(selectedDate + 'T00:00:00');
        const duration = appt.services.duration ?? 30;

        const dayAppts: SlotAppointment[] = existingAppts
            .filter(a => a.date === selectedDate && (!appt.stylist_id || String(a.stylist_id) === String(appt.stylist_id)))
            .map(a => {
                const start = parse((a.time ?? '09:00').slice(0, 5), 'HH:mm', baseDate);
                const end = new Date(start.getTime() + duration * 60000);
                return { id: a.id, stylistId: String(a.stylist_id ?? '0'), start, end };
            });

        const dayBlocked: BlockedInterval[] = blockedSlots
            .filter(b => b.date === selectedDate)
            .map(b => ({
                start: parse(b.start_time.slice(0, 5), 'HH:mm', baseDate),
                end:   parse(b.end_time.slice(0, 5),   'HH:mm', baseDate),
            }));

        if (daySchedule.breakStart && daySchedule.breakEnd) {
            dayBlocked.push({
                start: parse(daySchedule.breakStart, 'HH:mm', baseDate),
                end:   parse(daySchedule.breakEnd,   'HH:mm', baseDate),
            });
        }

        return getSmartSlots(baseDate, duration, daySchedule.start, daySchedule.end, dayAppts, dayBlocked, 10);
    }, [selectedDate, appt, schedule, existingAppts, blockedSlots]);

    // ── Confirm reschedule ────────────────────────────────────────────────────
    const handleConfirm = async () => {
        if (!appt || !selectedDate || !selectedTime) return;
        setIsConfirming(true);
        try {
            const { data, error } = await supabase.rpc('reschedule_appointment_v1', {
                p_appointment_id: appt.id,
                p_client_phone:   phone.replace(/\D/g, '').slice(-10),
                p_new_date:       selectedDate,
                p_new_time:       selectedTime,
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error ?? 'Error al reagendar');
            setStep('success');
        } catch (err: any) {
            setErrorMsg(err.message ?? 'Ocurrió un error. Intenta de nuevo.');
            setStep('error');
        } finally {
            setIsConfirming(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(ellipse at 30% 0%, #0f1729 0%, #050c15 55%, #000 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '2rem 1rem 5rem',
            fontFamily: "'Inter', 'system-ui', sans-serif",
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 20px -4px var(--brand); }
                    50%      { box-shadow: 0 0 40px -4px var(--brand); }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.92); }
                    to   { opacity: 1; transform: scale(1); }
                }
                * { box-sizing: border-box; }
                input:focus { outline: none; }
                input::placeholder { color: #475569; }
                button:active { transform: scale(0.97) !important; }
            `}</style>

            <div style={{ width: '100%', maxWidth: '460px' }}>

                {/* ── Header ── */}
                <div style={{ textAlign: 'center', marginBottom: '2rem', animation: 'fadeSlideUp 0.4s ease' }}>
                    {appt?.tenants?.logo_url ? (
                        <div style={{
                            width: '76px', height: '76px', borderRadius: '20px',
                            overflow: 'hidden', margin: '0 auto 1rem',
                            border: '2px solid rgba(255,255,255,0.12)',
                            boxShadow: `0 0 40px -8px ${brandColor}66`,
                        }}>
                            <img src={appt.tenants.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                    ) : (
                        <div style={{
                            width: '56px', height: '56px', borderRadius: '16px',
                            background: `${brandColor}22`, border: `1.5px solid ${brandColor}44`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1rem',
                        }}>
                            <Sparkles size={24} color={brandColor} />
                        </div>
                    )}
                    <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 900, margin: '0 0 0.2rem', letterSpacing: '-0.02em' }}>
                        {appt?.tenants?.name ?? 'CitaLink'}
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
                        Reagendar Cita
                    </p>
                </div>

                {/* ── Step Indicator (only steps 2-5) ── */}
                {step !== 'phone' && step !== 'success' && step !== 'error' && (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: '0', marginBottom: '1.75rem',
                        animation: 'fadeSlideUp 0.3s ease',
                    }}>
                        {(['details', 'date', 'time', 'confirm'] as Step[]).map((s, i) => {
                            const idx = STEP_ORDER.indexOf(s);
                            const isDone = stepIndex > idx;
                            const isCurrent = step === s;
                            const labels = ['Cita', 'Fecha', 'Hora', 'Confirmar'];
                            return (
                                <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '50%',
                                            background: isDone ? brandColor : isCurrent ? `${brandColor}33` : 'rgba(255,255,255,0.05)',
                                            border: `2px solid ${isDone || isCurrent ? brandColor : 'rgba(255,255,255,0.1)'}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.3s ease',
                                        }}>
                                            {isDone
                                                ? <CheckCircle size={14} color="#fff" />
                                                : <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isCurrent ? brandColor : '#475569' }}>{i + 1}</span>
                                            }
                                        </div>
                                        <span style={{
                                            fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            color: isCurrent ? brandColor : isDone ? '#94a3b8' : '#334155',
                                            transition: 'color 0.3s ease',
                                        }}>{labels[i]}</span>
                                    </div>
                                    {i < 3 && (
                                        <div style={{
                                            width: '40px', height: '2px', margin: '0 2px 16px',
                                            background: isDone ? brandColor : 'rgba(255,255,255,0.06)',
                                            transition: 'background 0.3s ease',
                                        }} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── STEP: phone ── */}
                {step === 'phone' && (
                    <div style={{ ...card, animation: 'fadeSlideUp 0.35s ease' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '14px',
                            background: `${brandColor}18`, border: `1.5px solid ${brandColor}33`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '1.25rem',
                        }}>
                            <Phone size={22} color={brandColor} />
                        </div>

                        <p style={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem', margin: '0 0 0.3rem' }}>
                            Verifica tu identidad
                        </p>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
                            Ingresa el número con el que hiciste tu reserva
                        </p>

                        <div style={{ position: 'relative' }}>
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => { setPhone(e.target.value); setPhoneError(null); }}
                                onKeyDown={e => e.key === 'Enter' && handleVerifyPhone()}
                                placeholder="Ej: 6641234567"
                                maxLength={15}
                                autoFocus
                                style={{
                                    width: '100%', padding: '0.9rem 1rem 0.9rem 3rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: `1.5px solid ${phoneError ? '#f87171' : 'rgba(255,255,255,0.1)'}`,
                                    borderRadius: '14px', color: '#fff', fontSize: '1.05rem',
                                    fontFamily: 'inherit', letterSpacing: '0.1em',
                                    transition: 'border-color 0.2s',
                                }}
                            />
                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#475569' }}>
                                <Phone size={16} />
                            </span>
                        </div>

                        {phoneError && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                color: '#f87171', fontSize: '0.8rem', marginTop: '0.6rem',
                                padding: '0.5rem 0.75rem',
                                background: 'rgba(248,113,113,0.08)', borderRadius: '8px',
                                border: '1px solid rgba(248,113,113,0.2)',
                            }}>
                                <AlertTriangle size={13} /> {phoneError}
                            </div>
                        )}

                        <button
                            onClick={handleVerifyPhone}
                            disabled={isLoading || phone.replace(/\D/g, '').length < 10}
                            style={{ ...primaryBtn(brandColor), marginTop: '1.25rem' }}
                        >
                            {isLoading
                                ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Verificando...</>
                                : <>Continuar <ChevronRight size={18} /></>
                            }
                        </button>
                    </div>
                )}

                {/* ── STEP: details ── */}
                {step === 'details' && appt && (
                    <div style={{ ...card, animation: 'fadeSlideUp 0.35s ease' }}>
                        <p style={stepTitle}>Tu cita actual</p>

                        <div style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '14px', padding: '1.1rem',
                            marginBottom: '1.5rem',
                            display: 'flex', flexDirection: 'column', gap: '0.9rem',
                        }}>
                            <InfoRow icon={<User size={15} />}     label="Cliente"     value={appt.client_name}             color={brandColor} />
                            <InfoRow icon={<Scissors size={15} />} label="Servicio"    value={appt.services?.name ?? '—'}   color={brandColor} />
                            {appt.stylists && <InfoRow icon={<User size={15} />} label="Profesional" value={appt.stylists.name} color={brandColor} />}
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                            <InfoRow icon={<Calendar size={15} />} label="Fecha"       value={formatDateNice(appt.date)}    color={brandColor} />
                            <InfoRow icon={<Clock size={15} />}    label="Hora"        value={format12h(appt.time.slice(0, 5))} color={brandColor} />
                        </div>

                        <button onClick={() => setStep('date')} style={primaryBtn(brandColor)}>
                            Elegir nueva fecha <ChevronRight size={18} />
                        </button>
                    </div>
                )}

                {/* ── STEP: date ── */}
                {step === 'date' && appt && (
                    <div style={{ ...card, animation: 'fadeSlideUp 0.35s ease' }}>
                        <BackBtn onClick={() => setStep('details')} color={brandColor} />
                        <p style={stepTitle}>Elige una fecha</p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem', marginBottom: '1.5rem' }}>
                            {availableDates.map(({ dateStr, label, dayName }) => {
                                const isSelected = selectedDate === dateStr;
                                return (
                                    <button
                                        key={dateStr}
                                        onClick={() => { setSelectedDate(dateStr); setSelectedTime(null); }}
                                        style={{
                                            display: 'flex', flexDirection: 'column',
                                            alignItems: 'center', justifyContent: 'center',
                                            gap: '0.15rem', padding: '0.85rem 0.5rem',
                                            borderRadius: '14px', cursor: 'pointer',
                                            border: `1.5px solid ${isSelected ? brandColor : 'rgba(255,255,255,0.07)'}`,
                                            background: isSelected ? `${brandColor}22` : 'rgba(255,255,255,0.03)',
                                            transition: 'all 0.2s ease',
                                            boxShadow: isSelected ? `0 0 20px -6px ${brandColor}88` : 'none',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        <span style={{ fontSize: '0.65rem', color: isSelected ? brandColor : '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                            {dayName}
                                        </span>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: isSelected ? '#fff' : '#94a3b8' }}>
                                            {label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <button onClick={() => setStep('time')} disabled={!selectedDate} style={primaryBtn(brandColor)}>
                            Ver horarios <ChevronRight size={18} />
                        </button>
                    </div>
                )}

                {/* ── STEP: time ── */}
                {step === 'time' && appt && (
                    <div style={{ ...card, animation: 'fadeSlideUp 0.35s ease' }}>
                        <BackBtn onClick={() => setStep('date')} color={brandColor} />
                        <p style={stepTitle}>
                            Horarios · <span style={{ color: brandColor, textTransform: 'capitalize' }}>
                                {formatDateNice(selectedDate)}
                            </span>
                        </p>

                        {availableSlots.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
                                <div style={{
                                    width: '56px', height: '56px', borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.04)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 1rem',
                                }}>
                                    <Calendar size={24} color="#334155" />
                                </div>
                                <p style={{ color: '#475569', margin: '0 0 1.25rem', fontSize: '0.9rem' }}>
                                    No hay horarios disponibles este día
                                </p>
                                <button onClick={() => setStep('date')} style={ghostBtn}>
                                    <ArrowLeft size={15} /> Elegir otro día
                                </button>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem', marginBottom: '1.5rem' }}>
                                    {availableSlots.map(slot => {
                                        const isSelected = selectedTime === slot;
                                        return (
                                            <button
                                                key={slot}
                                                onClick={() => setSelectedTime(slot)}
                                                style={{
                                                    padding: '0.75rem 0.5rem',
                                                    borderRadius: '12px', cursor: 'pointer',
                                                    border: `1.5px solid ${isSelected ? brandColor : 'rgba(255,255,255,0.07)'}`,
                                                    background: isSelected ? `${brandColor}22` : 'rgba(255,255,255,0.03)',
                                                    color: isSelected ? '#fff' : '#94a3b8',
                                                    fontWeight: isSelected ? 800 : 500,
                                                    fontSize: '0.9rem', fontFamily: 'inherit',
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: isSelected ? `0 0 18px -6px ${brandColor}88` : 'none',
                                                }}
                                            >
                                                {format12h(slot)}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={() => setStep('confirm')}
                                    disabled={!selectedTime}
                                    style={primaryBtn(brandColor)}
                                >
                                    Confirmar hora <ChevronRight size={18} />
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* ── STEP: confirm ── */}
                {step === 'confirm' && appt && (
                    <div style={{ ...card, animation: 'fadeSlideUp 0.35s ease' }}>
                        <BackBtn onClick={() => setStep('time')} color={brandColor} />
                        <p style={stepTitle}>Confirma el cambio</p>

                        {/* Before */}
                        <div style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '14px', padding: '1rem',
                            marginBottom: '0.75rem',
                        }}>
                            <p style={{ color: '#475569', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem' }}>
                                Cita actual
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                <InfoRow icon={<Scissors size={14} />} label="Servicio" value={appt.services?.name ?? '—'} color="#475569" />
                                <InfoRow icon={<Calendar size={14} />} label="Fecha"    value={formatDateNice(appt.date)}   color="#475569" />
                                <InfoRow icon={<Clock size={14} />}    label="Hora"     value={format12h(appt.time.slice(0,5))} color="#475569" />
                            </div>
                        </div>

                        {/* After */}
                        <div style={{
                            background: `${brandColor}0d`,
                            border: `1.5px solid ${brandColor}33`,
                            borderRadius: '14px', padding: '1rem',
                            marginBottom: '1.5rem',
                        }}>
                            <p style={{ color: brandColor, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.75rem' }}>
                                ✦ Nuevo horario
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                <InfoRow icon={<Calendar size={14} />} label="Fecha" value={formatDateNice(selectedDate)}     color={brandColor} />
                                <InfoRow icon={<Clock size={14} />}    label="Hora"  value={format12h(selectedTime!)}         color={brandColor} />
                            </div>
                        </div>

                        <button onClick={handleConfirm} disabled={isConfirming} style={primaryBtn(brandColor)}>
                            {isConfirming
                                ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Procesando...</>
                                : <><CheckCircle size={18} /> Confirmar cambio</>
                            }
                        </button>
                        <button onClick={() => setStep('details')} style={{ ...ghostBtn, marginTop: '0.6rem' }}>
                            Cancelar
                        </button>
                    </div>
                )}

                {/* ── STEP: success ── */}
                {step === 'success' && appt && (
                    <div style={{ ...card, textAlign: 'center', animation: 'scaleIn 0.4s ease' }}>
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '50%',
                            background: `${brandColor}18`,
                            border: `2px solid ${brandColor}44`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem',
                            animation: 'pulse-glow 2s infinite',
                        } as any}>
                            <CheckCircle size={40} color={brandColor} />
                        </div>

                        <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
                            ¡Reagendado!
                        </h2>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
                            Tu cita fue cambiada exitosamente.
                        </p>

                        <div style={{
                            background: `${brandColor}0d`,
                            border: `1.5px solid ${brandColor}2a`,
                            borderRadius: '16px', padding: '1.25rem',
                            marginBottom: '1.5rem',
                        }}>
                            <p style={{ color: '#fff', fontWeight: 800, margin: '0 0 0.3rem', fontSize: '1.15rem', letterSpacing: '-0.01em' }}>
                                {selectedTime && format12h(selectedTime)}
                            </p>
                            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem', textTransform: 'capitalize' }}>
                                {selectedDate && formatDateNice(selectedDate)}
                            </p>
                        </div>

                        <p style={{ color: '#334155', fontSize: '0.8rem' }}>
                            Recibirás un recordatorio antes de tu cita.
                        </p>
                    </div>
                )}

                {/* ── STEP: error ── */}
                {step === 'error' && (
                    <div style={{ ...card, textAlign: 'center', animation: 'scaleIn 0.4s ease' }}>
                        <div style={{
                            width: '72px', height: '72px', borderRadius: '50%',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1.5px solid rgba(239,68,68,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem',
                        }}>
                            <AlertTriangle size={34} color="#f87171" />
                        </div>
                        <h2 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                            Algo salió mal
                        </h2>
                        <p style={{ color: '#64748b', marginBottom: '1.75rem', lineHeight: 1.6, fontSize: '0.9rem' }}>
                            {errorMsg}
                        </p>
                        <button onClick={() => { setStep('phone'); setErrorMsg(''); }} style={primaryBtn('#7c3aed')}>
                            Intentar de nuevo
                        </button>
                    </div>
                )}

                {/* Footer */}
                <p style={{ textAlign: 'center', color: '#1e293b', fontSize: '0.72rem', marginTop: '2rem', letterSpacing: '0.05em' }}>
                    Powered by <span style={{ color: '#334155', fontWeight: 700 }}>CitaLink</span>
                </p>
            </div>
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ color, flexShrink: 0, opacity: 0.9 }}>{icon}</span>
            {label && <span style={{ color: '#475569', fontSize: '0.82rem', minWidth: '72px', fontWeight: 500 }}>{label}</span>}
            <span style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 700 }}>{value}</span>
        </div>
    );
}

function BackBtn({ onClick, color }: { onClick: () => void; color: string }) {
    return (
        <button onClick={onClick} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', color: '#64748b',
            cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
            padding: '0.4rem 0.75rem', marginBottom: '1.25rem',
            fontFamily: 'inherit', transition: 'color 0.2s, border-color 0.2s',
        }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = color; (e.currentTarget as HTMLButtonElement).style.borderColor = `${color}44`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#64748b'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
        >
            <ArrowLeft size={14} /> Volver
        </button>
    );
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '22px',
    padding: '1.75rem 1.5rem',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 4px 40px rgba(0,0,0,0.4)',
};

const stepTitle: React.CSSProperties = {
    color: '#94a3b8',
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '1.1rem',
    marginTop: 0,
};

const primaryBtn = (color: string): React.CSSProperties => ({
    width: '100%', padding: '0.95rem',
    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
    color: '#fff',
    border: 'none', borderRadius: '14px',
    fontSize: '0.95rem', fontWeight: 800,
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    fontFamily: 'inherit',
    boxShadow: `0 4px 20px -4px ${color}66`,
    letterSpacing: '0.01em',
    transition: 'opacity 0.2s, box-shadow 0.2s',
});

const ghostBtn: React.CSSProperties = {
    width: '100%', padding: '0.85rem',
    background: 'rgba(255,255,255,0.04)',
    color: '#475569',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px', fontSize: '0.88rem', fontWeight: 600,
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
    fontFamily: 'inherit',
    transition: 'background 0.2s',
};
