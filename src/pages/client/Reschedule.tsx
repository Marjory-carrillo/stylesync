import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { format, addDays, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { getSmartSlots, type Appointment as SlotAppointment, type BlockedInterval } from '../../lib/smartSlots';
import {
    Calendar, Clock, CheckCircle, AlertTriangle, Phone,
    ChevronRight, ArrowLeft, Loader2, User, Scissors, Sparkles, RefreshCw
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
        phone: string | null;
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

type Step = 'phone' | 'details' | 'select' | 'success' | 'error';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string;
const ANON_KEY      = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

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

    const [step, setStep]           = useState<Step>('phone');
    const [phone, setPhone]         = useState('');
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [appt, setAppt]           = useState<AppointmentData | null>(null);
    const [schedule, setSchedule]   = useState<Record<string, ScheduleDay>>({});
    const [existingAppts, setExistingAppts] = useState<any[]>([]);
    const [blockedSlots, setBlockedSlots]   = useState<any[]>([]);
    const [errorMsg, setErrorMsg]   = useState('');

    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

    const brandColor = appt?.tenants?.primary_color ?? '#7c3aed';

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
                .select(`
                    id, client_name, client_phone, date, time, status,
                    service_id, stylist_id, tenant_id,
                    tenants(name, slug, logo_url, primary_color, timezone, sms_provider, phone),
                    services(name, duration, price),
                    stylists(name)
                `)
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
                supabase.from('schedule_config').select('schedule').eq('tenant_id', data.tenant_id).maybeSingle(),
                supabase.from('appointments')
                    .select('id, date, time, service_id, stylist_id, status')
                    .eq('tenant_id', data.tenant_id)
                    .neq('status', 'cancelada')
                    .neq('id', appointmentId!),
                supabase.from('blocked_slots')
                    .select('date, start_time, end_time')
                    .eq('tenant_id', data.tenant_id),
            ]);

            if (schedRes.data?.schedule) {
                setSchedule(schedRes.data.schedule as Record<string, ScheduleDay>);
            } else {
                setSchedule({
                    monday:    { open: true,  start: '09:00', end: '18:00' },
                    tuesday:   { open: true,  start: '09:00', end: '18:00' },
                    wednesday: { open: true,  start: '09:00', end: '18:00' },
                    thursday:  { open: true,  start: '09:00', end: '18:00' },
                    friday:    { open: true,  start: '09:00', end: '18:00' },
                    saturday:  { open: true,  start: '09:00', end: '14:00' },
                    sunday:    { open: false, start: '09:00', end: '14:00' },
                });
            }

            setExistingAppts(apptsRes.data ?? []);
            setBlockedSlots(blockedRes.data ?? []);
            setSelectedDate('');
            setSelectedTime(null);
            setStep('details');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Available dates ───────────────────────────────────────────────────────
    const availableDates = useMemo(() => {
        const dates: { dateStr: string; label: string; dayName: string; isToday: boolean }[] = [];
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
                isToday: i === 0,
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

    // ── Confirm reschedule + notify ───────────────────────────────────────────
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

            // ── Notificar al admin y al cliente vía WhatsApp ──────────────────
            fetch(`${SUPABASE_URL}/functions/v1/notify-admin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ANON_KEY}`,
                    'apikey': ANON_KEY,
                },
                body: JSON.stringify({
                    tenant_id:     appt.tenant_id,
                    event_type:    'reschedule',
                    admin_phone:   appt.tenants.phone ?? undefined,
                    business_name: appt.tenants.name,
                    appointment: {
                        client_name:  appt.client_name,
                        client_phone: appt.client_phone,
                        service_name: appt.services?.name ?? 'Servicio',
                        date:         selectedDate,
                        time:         selectedTime,
                    },
                }),
            }).catch(() => { /* fire-and-forget */ });

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
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '2rem 1rem 5rem',
            fontFamily: "'Inter', 'system-ui', sans-serif",
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(14px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.93); }
                    to   { opacity: 1; transform: scale(1); }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes glowPulse {
                    0%, 100% { box-shadow: 0 0 20px -6px var(--glow); }
                    50%      { box-shadow: 0 0 40px -4px var(--glow); }
                }
                * { box-sizing: border-box; }
                input::placeholder { color: #475569; }
                button { transition: transform 0.15s ease, opacity 0.2s; }
                button:active { transform: scale(0.96); }
            `}</style>

            <div style={{ width: '100%', maxWidth: '460px' }}>

                {/* ── Header ── */}
                <div style={{ textAlign: 'center', marginBottom: '1.75rem', animation: 'fadeUp 0.4s ease' }}>
                    {appt?.tenants?.logo_url ? (
                        <div style={{
                            width: '72px', height: '72px', borderRadius: '18px',
                            overflow: 'hidden', margin: '0 auto 0.9rem',
                            border: '2px solid rgba(255,255,255,0.1)',
                            boxShadow: `0 0 36px -8px ${brandColor}66`,
                        }}>
                            <img src={appt.tenants.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                    ) : (
                        <div style={{
                            width: '52px', height: '52px', borderRadius: '14px',
                            background: `${brandColor}1a`, border: `1.5px solid ${brandColor}40`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 0.9rem',
                        }}>
                            <Sparkles size={22} color={brandColor} />
                        </div>
                    )}
                    <h1 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 900, margin: '0 0 0.2rem', letterSpacing: '-0.02em' }}>
                        {appt?.tenants?.name ?? 'CitaLink'}
                    </h1>
                    <p style={{ color: '#475569', fontSize: '0.72rem', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
                        Reagendar Cita
                    </p>
                </div>

                {/* ── Progress bar ── */}
                {step !== 'success' && step !== 'error' && (
                    <div style={{ marginBottom: '1.5rem', animation: 'fadeUp 0.3s ease' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {(['phone', 'details', 'select'] as Step[]).map((s, i) => {
                                const stepIdx = ['phone', 'details', 'select'].indexOf(step);
                                const done = i < stepIdx;
                                const active = s === step;
                                return (
                                    <div key={s} style={{
                                        flex: 1, height: '3px', borderRadius: '999px',
                                        background: done || active
                                            ? `linear-gradient(90deg, ${brandColor}, ${brandColor}99)`
                                            : 'rgba(255,255,255,0.06)',
                                        transition: 'background 0.4s ease',
                                    }} />
                                );
                            })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                            {['Verificar', 'Cita actual', 'Reagendar'].map((label, i) => {
                                const stepIdx = ['phone', 'details', 'select'].indexOf(step);
                                return (
                                    <span key={label} style={{
                                        fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                                        letterSpacing: '0.06em',
                                        color: i <= stepIdx ? brandColor : '#334155',
                                        transition: 'color 0.3s ease',
                                    }}>{label}</span>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ══ STEP: phone ══ */}
                {step === 'phone' && (
                    <div style={{ ...card, animation: 'fadeUp 0.35s ease' }}>
                        <div style={{
                            width: '46px', height: '46px', borderRadius: '13px',
                            background: `${brandColor}18`, border: `1.5px solid ${brandColor}30`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '1.1rem',
                        }}>
                            <Phone size={20} color={brandColor} />
                        </div>

                        <p style={{ color: '#fff', fontWeight: 800, fontSize: '1rem', margin: '0 0 0.25rem' }}>
                            Verifica tu identidad
                        </p>
                        <p style={{ color: '#475569', fontSize: '0.83rem', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
                            Ingresa el número con el que hiciste tu reserva
                        </p>

                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#475569' }}>
                                <Phone size={15} />
                            </span>
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => { setPhone(e.target.value); setPhoneError(null); }}
                                onKeyDown={e => e.key === 'Enter' && handleVerifyPhone()}
                                placeholder="Ej: 6641234567"
                                maxLength={15}
                                autoFocus
                                style={{
                                    width: '100%', padding: '0.875rem 1rem 0.875rem 2.75rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: `1.5px solid ${phoneError ? '#f87171' : 'rgba(255,255,255,0.1)'}`,
                                    borderRadius: '13px', color: '#fff', fontSize: '1rem',
                                    fontFamily: 'inherit', letterSpacing: '0.08em', outline: 'none',
                                    transition: 'border-color 0.2s',
                                }}
                            />
                        </div>

                        {phoneError && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                color: '#f87171', fontSize: '0.78rem', marginTop: '0.5rem',
                                padding: '0.5rem 0.75rem', borderRadius: '8px',
                                background: 'rgba(248,113,113,0.08)',
                                border: '1px solid rgba(248,113,113,0.2)',
                            }}>
                                <AlertTriangle size={13} /> {phoneError}
                            </div>
                        )}

                        <button
                            onClick={handleVerifyPhone}
                            disabled={isLoading || phone.replace(/\D/g, '').length < 10}
                            style={{ ...primaryBtn(brandColor), marginTop: '1.1rem' }}
                        >
                            {isLoading
                                ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Verificando...</>
                                : <>Continuar <ChevronRight size={17} /></>
                            }
                        </button>
                    </div>
                )}

                {/* ══ STEP: details ══ */}
                {step === 'details' && appt && (
                    <div style={{ ...card, animation: 'fadeUp 0.35s ease' }}>
                        <p style={sectionLabel}>Tu cita actual</p>

                        <div style={{
                            background: 'rgba(255,255,255,0.025)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '14px', padding: '1.1rem',
                            marginBottom: '1.5rem',
                            display: 'flex', flexDirection: 'column', gap: '0.85rem',
                        }}>
                            <InfoRow icon={<User size={14} />}     label="Cliente"     value={appt.client_name}               color={brandColor} />
                            <InfoRow icon={<Scissors size={14} />} label="Servicio"    value={appt.services?.name ?? '—'}     color={brandColor} />
                            {appt.stylists && <InfoRow icon={<User size={14} />} label="Profesional" value={appt.stylists.name} color={brandColor} />}
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                            <InfoRow icon={<Calendar size={14} />} label="Fecha"       value={formatDateNice(appt.date)}      color={brandColor} />
                            <InfoRow icon={<Clock size={14} />}    label="Hora"        value={format12h(appt.time.slice(0, 5))} color={brandColor} />
                        </div>

                        <button onClick={() => setStep('select')} style={primaryBtn(brandColor)}>
                            Elegir nueva fecha <ChevronRight size={17} />
                        </button>
                    </div>
                )}

                {/* ══ STEP: select (date + time + confirm — todo en uno) ══ */}
                {step === 'select' && appt && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'fadeUp 0.35s ease' }}>

                        {/* Back button */}
                        <button onClick={() => { setStep('details'); setSelectedDate(''); setSelectedTime(null); }}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                                background: 'none', border: 'none', color: '#475569',
                                cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                                padding: '0', fontFamily: 'inherit',
                            }}
                        >
                            <ArrowLeft size={14} /> Volver a detalles
                        </button>

                        {/* ── Date card ── */}
                        <div style={card}>
                            <p style={sectionLabel}>Elige una fecha</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                {availableDates.length === 0 ? (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1.5rem 0', color: '#334155' }}>
                                        <Calendar size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                                        <p style={{ margin: 0, fontSize: '0.85rem' }}>No hay fechas disponibles</p>
                                    </div>
                                ) : (
                                    availableDates.map(({ dateStr, label, dayName, isToday }) => {
                                        const isSelected = selectedDate === dateStr;
                                        return (
                                            <button
                                                key={dateStr}
                                                onClick={() => { setSelectedDate(dateStr); setSelectedTime(null); }}
                                                style={{
                                                    display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', justifyContent: 'center',
                                                    gap: '0.1rem', padding: '0.75rem 0.4rem',
                                                    borderRadius: '13px', cursor: 'pointer',
                                                    fontFamily: 'inherit',
                                                    border: `1.5px solid ${isSelected ? brandColor : 'rgba(255,255,255,0.07)'}`,
                                                    background: isSelected ? `${brandColor}20` : 'rgba(255,255,255,0.03)',
                                                    boxShadow: isSelected ? `0 0 18px -6px ${brandColor}88` : 'none',
                                                    transition: 'all 0.18s ease',
                                                }}
                                            >
                                                <span style={{
                                                    fontSize: '0.6rem', fontWeight: 800,
                                                    letterSpacing: '0.07em', textTransform: 'uppercase',
                                                    color: isSelected ? brandColor : '#475569',
                                                }}>
                                                    {dayName}
                                                </span>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: isSelected ? '#fff' : '#94a3b8' }}>
                                                    {label}
                                                </span>
                                                {isToday && (
                                                    <span style={{ fontSize: '0.55rem', fontWeight: 900, color: isSelected ? '#fff' : brandColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        HOY
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* ── Time card — aparece al seleccionar fecha ── */}
                        {selectedDate && (
                            <div style={{ ...card, animation: 'slideDown 0.25s ease' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
                                    <p style={{ ...sectionLabel, marginBottom: 0 }}>Horarios disponibles</p>
                                    <span style={{
                                        fontSize: '0.7rem', fontWeight: 700, color: brandColor,
                                        background: `${brandColor}15`, borderRadius: '999px',
                                        padding: '0.2rem 0.6rem', textTransform: 'capitalize',
                                    }}>
                                        {formatDateNice(selectedDate).split(' ').slice(0, 3).join(' ')}
                                    </span>
                                </div>

                                {availableSlots.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                                        <div style={{
                                            width: '48px', height: '48px', borderRadius: '50%',
                                            background: 'rgba(255,255,255,0.04)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            margin: '0 auto 0.75rem',
                                        }}>
                                            <Clock size={22} color="#334155" />
                                        </div>
                                        <p style={{ color: '#475569', margin: '0 0 1rem', fontSize: '0.85rem' }}>
                                            Sin horarios disponibles este día
                                        </p>
                                        <button
                                            onClick={() => { setSelectedDate(''); setSelectedTime(null); }}
                                            style={ghostBtn}
                                        >
                                            <RefreshCw size={13} /> Cambiar fecha
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                        {availableSlots.map(slot => {
                                            const isSelected = selectedTime === slot;
                                            return (
                                                <button
                                                    key={slot}
                                                    onClick={() => setSelectedTime(isSelected ? null : slot)}
                                                    style={{
                                                        padding: '0.7rem 0.4rem',
                                                        borderRadius: '11px', cursor: 'pointer',
                                                        border: `1.5px solid ${isSelected ? brandColor : 'rgba(255,255,255,0.07)'}`,
                                                        background: isSelected ? `${brandColor}20` : 'rgba(255,255,255,0.02)',
                                                        color: isSelected ? '#fff' : '#94a3b8',
                                                        fontWeight: isSelected ? 800 : 500,
                                                        fontSize: '0.875rem', fontFamily: 'inherit',
                                                        boxShadow: isSelected ? `0 0 16px -6px ${brandColor}88` : 'none',
                                                        transition: 'all 0.18s ease',
                                                    }}
                                                >
                                                    {format12h(slot)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Confirm panel — aparece al seleccionar hora ── */}
                        {selectedDate && selectedTime && (
                            <div style={{ ...card, animation: 'slideDown 0.25s ease', border: `1.5px solid ${brandColor}33` }}>
                                <p style={{ ...sectionLabel, color: brandColor, marginBottom: '1rem' }}>✦ Nuevo horario</p>

                                {/* Antes → Después */}
                                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                    {/* Antes */}
                                    <div style={{
                                        flex: 1, background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.07)',
                                        borderRadius: '12px', padding: '0.85rem 0.75rem',
                                    }}>
                                        <p style={{ color: '#334155', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 0.5rem' }}>
                                            Antes
                                        </p>
                                        <p style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: 700, margin: '0 0 0.15rem' }}>
                                            {format12h(appt!.time.slice(0, 5))}
                                        </p>
                                        <p style={{ color: '#334155', fontSize: '0.72rem', margin: 0, textTransform: 'capitalize', lineHeight: 1.4 }}>
                                            {formatDateNice(appt!.date)}
                                        </p>
                                    </div>

                                    {/* Arrow */}
                                    <div style={{ display: 'flex', alignItems: 'center', color: brandColor, paddingBottom: '0.5rem' }}>
                                        <ChevronRight size={18} />
                                    </div>

                                    {/* Después */}
                                    <div style={{
                                        flex: 1, background: `${brandColor}0d`,
                                        border: `1.5px solid ${brandColor}33`,
                                        borderRadius: '12px', padding: '0.85rem 0.75rem',
                                    }}>
                                        <p style={{ color: brandColor, fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 0.5rem' }}>
                                            Nuevo
                                        </p>
                                        <p style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 800, margin: '0 0 0.15rem' }}>
                                            {format12h(selectedTime)}
                                        </p>
                                        <p style={{ color: '#94a3b8', fontSize: '0.72rem', margin: 0, textTransform: 'capitalize', lineHeight: 1.4 }}>
                                            {formatDateNice(selectedDate)}
                                        </p>
                                    </div>
                                </div>

                                <button onClick={handleConfirm} disabled={isConfirming} style={primaryBtn(brandColor)}>
                                    {isConfirming
                                        ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Procesando...</>
                                        : <><CheckCircle size={17} /> Confirmar cambio</>
                                    }
                                </button>
                                <button onClick={() => setSelectedTime(null)} style={{ ...ghostBtn, marginTop: '0.5rem' }}>
                                    Elegir otra hora
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ══ STEP: success ══ */}
                {step === 'success' && appt && (
                    <div style={{ ...card, textAlign: 'center', animation: 'scaleIn 0.4s ease' }}>
                        <div style={{
                            width: '78px', height: '78px', borderRadius: '50%',
                            background: `${brandColor}18`, border: `2px solid ${brandColor}44`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem',
                            animation: 'glowPulse 2.5s infinite',
                        } as React.CSSProperties}>
                            <CheckCircle size={38} color={brandColor} />
                        </div>

                        <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.4rem', letterSpacing: '-0.02em' }}>
                            ¡Reagendado!
                        </h2>
                        <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
                            Tu cita fue cambiada exitosamente.<br />Recibirás un mensaje de confirmación.
                        </p>

                        <div style={{
                            background: `${brandColor}0d`, border: `1.5px solid ${brandColor}2a`,
                            borderRadius: '15px', padding: '1.25rem', marginBottom: '1.25rem',
                        }}>
                            <p style={{ color: '#fff', fontWeight: 900, margin: '0 0 0.3rem', fontSize: '1.2rem', letterSpacing: '-0.01em' }}>
                                {selectedTime && format12h(selectedTime)}
                            </p>
                            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.875rem', textTransform: 'capitalize' }}>
                                {selectedDate && formatDateNice(selectedDate)}
                            </p>
                            {appt.services && (
                                <p style={{ color: '#475569', margin: '0.5rem 0 0', fontSize: '0.78rem' }}>
                                    {appt.services.name}
                                </p>
                            )}
                        </div>

                        <p style={{ color: '#1e293b', fontSize: '0.75rem' }}>
                            Se enviará un recordatorio antes de tu cita.
                        </p>
                    </div>
                )}

                {/* ══ STEP: error ══ */}
                {step === 'error' && (
                    <div style={{ ...card, textAlign: 'center', animation: 'scaleIn 0.4s ease' }}>
                        <div style={{
                            width: '70px', height: '70px', borderRadius: '50%',
                            background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem',
                        }}>
                            <AlertTriangle size={32} color="#f87171" />
                        </div>
                        <h2 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                            Algo salió mal
                        </h2>
                        <p style={{ color: '#475569', marginBottom: '1.75rem', lineHeight: 1.6, fontSize: '0.875rem' }}>
                            {errorMsg}
                        </p>
                        <button
                            onClick={() => { setStep('phone'); setErrorMsg(''); setPhone(''); }}
                            style={primaryBtn('#7c3aed')}
                        >
                            Intentar de nuevo
                        </button>
                    </div>
                )}

                {/* Footer */}
                <p style={{ textAlign: 'center', color: '#1e293b', fontSize: '0.7rem', marginTop: '2rem', letterSpacing: '0.04em' }}>
                    Powered by <span style={{ color: '#334155', fontWeight: 700 }}>CitaLink</span>
                </p>
            </div>
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ color, flexShrink: 0 }}>{icon}</span>
            {label && <span style={{ color: '#475569', fontSize: '0.8rem', minWidth: '72px', fontWeight: 500 }}>{label}</span>}
            <span style={{ color: '#e2e8f0', fontSize: '0.875rem', fontWeight: 700 }}>{value}</span>
        </div>
    );
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '20px',
    padding: '1.5rem 1.35rem',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 4px 40px rgba(0,0,0,0.35)',
};

const sectionLabel: React.CSSProperties = {
    color: '#475569', fontSize: '0.68rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.1em',
    marginBottom: '0.9rem', marginTop: 0,
};

const primaryBtn = (color: string): React.CSSProperties => ({
    width: '100%', padding: '0.9rem',
    background: `linear-gradient(135deg, ${color} 0%, ${color}bb 100%)`,
    color: '#fff', border: 'none', borderRadius: '13px',
    fontSize: '0.92rem', fontWeight: 800,
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
    fontFamily: 'inherit',
    boxShadow: `0 4px 18px -4px ${color}55`,
    letterSpacing: '0.01em',
});

const ghostBtn: React.CSSProperties = {
    width: '100%', padding: '0.8rem',
    background: 'rgba(255,255,255,0.04)',
    color: '#475569', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '13px', fontSize: '0.85rem', fontWeight: 600,
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
    fontFamily: 'inherit',
};
