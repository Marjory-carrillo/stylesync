import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { format, addDays, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { getSmartSlots, type Appointment as SlotAppointment, type BlockedInterval } from '../../lib/smartSlots';
import {
    Calendar, Clock, CheckCircle, AlertTriangle, Phone,
    ChevronRight, ArrowLeft, Loader2, User, Scissors
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
    services: {
        name: string;
        duration: number;
        price: number;
    } | null;
    stylists: {
        name: string;
    } | null;
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

    // Scroll to top on step change
    useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

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
                    tenants(name, slug, logo_url, primary_color, timezone, sms_provider),
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

            // Normalize phone for comparison (last 10 digits)
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

            // Load schedule, existing appointments, and blocked slots
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
                        open:       raw[`${d}_open`]         ?? false,
                        start:      raw[`${d}_start`]        ?? '09:00',
                        end:        raw[`${d}_end`]          ?? '18:00',
                        breakStart: raw[`${d}_break_start`]  ?? undefined,
                        breakEnd:   raw[`${d}_break_end`]    ?? undefined,
                    };
                });
                setSchedule(days);
            }

            setExistingAppts(apptsRes.data ?? []);
            setBlockedSlots(blockedRes.data ?? []);

            // Initialize selected date to appointment's date
            setSelectedDate(data.date);
            setStep('details');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Available dates (next 14 days) ───────────────────────────────────────
    const availableDates = useMemo(() => {
        const dates: { dateStr: string; label: string; dayName: string }[] = [];
        const today = format(new Date(), 'yyyy-MM-dd');
        for (let i = 0; i < 28 && dates.length < 14; i++) {
            const d = addDays(new Date(), i);
            const dateStr = format(d, 'yyyy-MM-dd');
            if (dateStr < today) continue;
            const dayKey = DAY_KEYS[d.getDay()];
            const daySchedule = schedule[dayKey];
            if (!daySchedule?.open) continue;
            dates.push({
                dateStr,
                label: i === 0 ? 'Hoy' : format(d, 'd MMM', { locale: es }),
                dayName: { sunday: 'Dom', monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié', thursday: 'Jue', friday: 'Vie', saturday: 'Sáb' }[dayKey] ?? dayKey,
            });
        }
        return dates;
    }, [schedule]);

    // ── Available time slots for selected date ───────────────────────────────
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
                const end = new Date(start.getTime() + (duration) * 60000);
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

    // ── Step final: call RPC to reschedule ───────────────────────────────────
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

    // ── Brand color ──────────────────────────────────────────────────────────
    const brandColor = appt?.tenants?.primary_color ?? '#7c3aed';

    // ────────────────────────────────────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────────────────────────────────────
    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(ellipse at 20% 0%, #0f1729 0%, #050c15 60%, #000 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '2rem 1rem 4rem',
            fontFamily: "'Inter', 'system-ui', sans-serif",
        }}>
            <div style={{ width: '100%', maxWidth: '480px' }}>

                {/* ── Header ── */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    {appt?.tenants?.logo_url && (
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '18px',
                            overflow: 'hidden', margin: '0 auto 1rem',
                            border: '2px solid rgba(255,255,255,0.1)',
                            boxShadow: `0 0 40px -8px ${brandColor}66`,
                        }}>
                            <img src={appt.tenants.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                    )}
                    <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.25rem' }}>
                        {appt?.tenants?.name ?? 'CitaLink'}
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>Reagendar tu cita</p>
                </div>

                {/* ── STEP: phone ── */}
                {step === 'phone' && (
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <div style={{ ...iconCircle, background: `${brandColor}22`, color: brandColor }}>
                                <Phone size={20} />
                            </div>
                            <div>
                                <p style={{ color: '#fff', fontWeight: 700, margin: 0 }}>Verifica tu número</p>
                                <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>Ingresa el teléfono con el que reservaste</p>
                            </div>
                        </div>

                        <input
                            type="tel"
                            value={phone}
                            onChange={e => { setPhone(e.target.value); setPhoneError(null); }}
                            onKeyDown={e => e.key === 'Enter' && handleVerifyPhone()}
                            placeholder="Ej: 6641234567"
                            maxLength={15}
                            style={inputStyle}
                            autoFocus
                        />
                        {phoneError && (
                            <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <AlertTriangle size={14} /> {phoneError}
                            </p>
                        )}

                        <button
                            onClick={handleVerifyPhone}
                            disabled={isLoading || phone.length < 10}
                            style={{ ...btnPrimary(brandColor), marginTop: '1.25rem' }}
                        >
                            {isLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Continuar'}
                            {!isLoading && <ChevronRight size={18} />}
                        </button>
                    </div>
                )}

                {/* ── STEP: details ── */}
                {step === 'details' && appt && (
                    <div style={cardStyle}>
                        <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                            Tu cita actual
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <InfoRow icon={<User size={16} />} label="Cliente" value={appt.client_name} color={brandColor} />
                            <InfoRow icon={<Scissors size={16} />} label="Servicio" value={appt.services?.name ?? '—'} color={brandColor} />
                            {appt.stylists && <InfoRow icon={<User size={16} />} label="Profesional" value={appt.stylists.name} color={brandColor} />}
                            <InfoRow icon={<Calendar size={16} />} label="Fecha" value={formatDateNice(appt.date)} color={brandColor} />
                            <InfoRow icon={<Clock size={16} />} label="Hora" value={format12h(appt.time.slice(0, 5))} color={brandColor} />
                        </div>

                        <button onClick={() => setStep('date')} style={btnPrimary(brandColor)}>
                            Elegir nueva fecha <ChevronRight size={18} />
                        </button>
                    </div>
                )}

                {/* ── STEP: date ── */}
                {step === 'date' && appt && (
                    <div style={cardStyle}>
                        <BackBtn onClick={() => setStep('details')} />
                        <p style={sectionLabel}>Selecciona una fecha</p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1.5rem' }}>
                            {availableDates.map(({ dateStr, label, dayName }) => {
                                const isSelected = selectedDate === dateStr;
                                return (
                                    <button
                                        key={dateStr}
                                        onClick={() => { setSelectedDate(dateStr); setSelectedTime(null); }}
                                        style={{
                                            ...datePill,
                                            background: isSelected ? brandColor : 'rgba(255,255,255,0.04)',
                                            border: `1px solid ${isSelected ? brandColor : 'rgba(255,255,255,0.08)'}`,
                                            color: isSelected ? '#fff' : '#94a3b8',
                                            transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                                            boxShadow: isSelected ? `0 0 20px -4px ${brandColor}88` : 'none',
                                        }}
                                    >
                                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{dayName}</span>
                                        <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>{label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => setStep('time')}
                            disabled={!selectedDate}
                            style={btnPrimary(brandColor)}
                        >
                            Ver horarios <ChevronRight size={18} />
                        </button>
                    </div>
                )}

                {/* ── STEP: time ── */}
                {step === 'time' && appt && (
                    <div style={cardStyle}>
                        <BackBtn onClick={() => setStep('date')} />
                        <p style={sectionLabel}>
                            Horarios disponibles · {formatDateNice(selectedDate)}
                        </p>

                        {availableSlots.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b' }}>
                                <Calendar size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                                <p style={{ margin: 0 }}>No hay horarios disponibles este día.</p>
                                <button onClick={() => setStep('date')} style={{ ...btnSecondary, marginTop: '1rem' }}>
                                    Elegir otro día
                                </button>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1.5rem' }}>
                                    {availableSlots.map(slot => {
                                        const isSelected = selectedTime === slot;
                                        return (
                                            <button
                                                key={slot}
                                                onClick={() => setSelectedTime(slot)}
                                                style={{
                                                    ...timePill,
                                                    background: isSelected ? brandColor : 'rgba(255,255,255,0.04)',
                                                    border: `1px solid ${isSelected ? brandColor : 'rgba(255,255,255,0.08)'}`,
                                                    color: isSelected ? '#fff' : '#cbd5e1',
                                                    fontWeight: isSelected ? 700 : 500,
                                                    boxShadow: isSelected ? `0 0 16px -4px ${brandColor}88` : 'none',
                                                    transform: isSelected ? 'scale(1.04)' : 'scale(1)',
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
                                    style={btnPrimary(brandColor)}
                                >
                                    Confirmar hora <ChevronRight size={18} />
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* ── STEP: confirm ── */}
                {step === 'confirm' && appt && (
                    <div style={cardStyle}>
                        <BackBtn onClick={() => setStep('time')} />
                        <p style={sectionLabel}>Confirma tu nuevo horario</p>

                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '12px',
                            padding: '1.25rem',
                            marginBottom: '1.5rem',
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                <InfoRow icon={<Scissors size={15} />} label="Servicio" value={appt.services?.name ?? '—'} color={brandColor} />
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem', marginTop: '0.2rem' }}>
                                    <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0 0 0.5rem', fontWeight: 600, textTransform: 'uppercase' }}>Antes</p>
                                    <InfoRow icon={<Calendar size={15} />} label="" value={`${formatDateNice(appt.date)} · ${format12h(appt.time.slice(0,5))}`} color="#64748b" />
                                </div>
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem' }}>
                                    <p style={{ color: brandColor, fontSize: '0.75rem', margin: '0 0 0.5rem', fontWeight: 700, textTransform: 'uppercase' }}>Nuevo horario</p>
                                    <InfoRow icon={<Calendar size={15} />} label="" value={`${formatDateNice(selectedDate)} · ${format12h(selectedTime!)}`} color="#fff" />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleConfirm}
                            disabled={isConfirming}
                            style={btnPrimary(brandColor)}
                        >
                            {isConfirming
                                ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Procesando...</>
                                : <><CheckCircle size={18} /> Confirmar cambio</>}
                        </button>
                        <button onClick={() => setStep('details')} style={{ ...btnSecondary, marginTop: '0.75rem' }}>
                            Cancelar
                        </button>
                    </div>
                )}

                {/* ── STEP: success ── */}
                {step === 'success' && appt && (
                    <div style={{ ...cardStyle, textAlign: 'center' }}>
                        <div style={{
                            width: '72px', height: '72px', borderRadius: '50%',
                            background: `${brandColor}22`, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', margin: '0 auto 1.25rem',
                            boxShadow: `0 0 40px -8px ${brandColor}88`,
                        }}>
                            <CheckCircle size={36} color={brandColor} />
                        </div>
                        <h2 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 900, margin: '0 0 0.5rem' }}>
                            ¡Cita reagendada!
                        </h2>
                        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
                            Tu cita fue cambiada exitosamente.
                        </p>
                        <div style={{
                            background: `${brandColor}11`,
                            border: `1px solid ${brandColor}33`,
                            borderRadius: '12px',
                            padding: '1rem',
                            marginBottom: '1.5rem',
                        }}>
                            <p style={{ color: '#fff', fontWeight: 700, margin: '0 0 0.25rem', fontSize: '1.1rem' }}>
                                {selectedTime && format12h(selectedTime)}
                            </p>
                            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
                                {selectedDate && formatDateNice(selectedDate)}
                            </p>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.8rem' }}>
                            Recibirás un recordatorio antes de tu cita.
                        </p>
                    </div>
                )}

                {/* ── STEP: error ── */}
                {step === 'error' && (
                    <div style={{ ...cardStyle, textAlign: 'center' }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%',
                            background: 'rgba(239,68,68,0.15)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.25rem',
                        }}>
                            <AlertTriangle size={30} color="#f87171" />
                        </div>
                        <h2 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                            Algo salió mal
                        </h2>
                        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>{errorMsg}</p>
                        <button
                            onClick={() => { setStep('phone'); setErrorMsg(''); }}
                            style={{ ...btnSecondary }}
                        >
                            Intentar de nuevo
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                * { box-sizing: border-box; }
            `}</style>
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ color, flexShrink: 0 }}>{icon}</span>
            {label && <span style={{ color: '#64748b', fontSize: '0.85rem', minWidth: '70px' }}>{label}</span>}
            <span style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600 }}>{value}</span>
        </div>
    );
}

function BackBtn({ onClick }: { onClick: () => void }) {
    return (
        <button onClick={onClick} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'none', border: 'none', color: '#64748b',
            cursor: 'pointer', fontSize: '0.85rem', padding: '0 0 1rem',
            fontFamily: 'inherit',
        }}>
            <ArrowLeft size={15} /> Volver
        </button>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '1.5rem',
    backdropFilter: 'blur(12px)',
    animation: 'fadeIn 0.3s ease',
};

const iconCircle: React.CSSProperties = {
    width: '44px', height: '44px', borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.85rem 1rem',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px', color: '#fff', fontSize: '1rem',
    fontFamily: 'inherit', outline: 'none',
    letterSpacing: '0.05em',
};

const btnPrimary = (color: string): React.CSSProperties => ({
    width: '100%', padding: '0.9rem',
    background: color, color: '#fff',
    border: 'none', borderRadius: '12px',
    fontSize: '0.95rem', fontWeight: 700,
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    fontFamily: 'inherit',
    transition: 'opacity 0.2s, transform 0.15s',
    opacity: 1,
});

const btnSecondary: React.CSSProperties = {
    width: '100%', padding: '0.85rem',
    background: 'rgba(255,255,255,0.05)',
    color: '#94a3b8',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600,
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    fontFamily: 'inherit',
};

const datePill: React.CSSProperties = {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '0.2rem', padding: '0.75rem 0.5rem',
    borderRadius: '12px', cursor: 'pointer',
    border: 'none', fontFamily: 'inherit',
    transition: 'all 0.2s ease',
};

const timePill: React.CSSProperties = {
    padding: '0.7rem 0.5rem',
    borderRadius: '10px', cursor: 'pointer',
    border: 'none', fontFamily: 'inherit',
    fontSize: '0.9rem',
    transition: 'all 0.2s ease',
};

const sectionLabel: React.CSSProperties = {
    color: '#94a3b8', fontSize: '0.8rem',
    fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.05em', marginBottom: '1rem',
    marginTop: 0,
};
