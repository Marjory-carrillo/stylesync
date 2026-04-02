import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { parse, format, addDays, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { type Announcement, type Service, type Stylist } from '../../lib/types/store.types';
import { appointmentSchema } from '../../lib/schemas';
import { useTenantBySlug } from '../../lib/store/queries/useTenantBySlug';
import { useServices } from '../../lib/store/queries/useServices';
import { useStylists } from '../../lib/store/queries/useStylists';
import { useAppointments } from '../../lib/store/queries/useAppointments';
import { useSchedule } from '../../lib/store/queries/useSchedule';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useBlockedSlots } from '../../lib/store/queries/useBlockedSlots';
import { useBlockedPhones } from '../../lib/store/queries/useBlockedPhones';
import { useAnnouncements } from '../../lib/store/queries/useAnnouncements';
import { useWaitingList } from '../../lib/store/queries/useWaitingList';

export const DAY_NAMES: Record<string, string> = {
    monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
    thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
};

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

import SplashScreen from '../../components/SplashScreen';
import { getSmartSlots, type Appointment as SlotAppointment, type BlockedInterval } from '../../lib/smartSlots';
import { CheckCircle, AlertTriangle, Calendar, Clock, MapPin, XCircle, RefreshCw, Info, AlertOctagon, Phone, Shield, User, ChevronRight, CalendarPlus, MessageSquare } from 'lucide-react';
import { generateGoogleCalendarUrl } from '../../lib/calendarUtils';
import ConfirmModal from '../../components/ConfirmModal';

export default function Booking() {
    const { slug } = useParams();
    const { tenantId, isLoading: tenantLoading } = useTenantBySlug(slug);
    const { services } = useServices();
    const { stylists } = useStylists();
    const { data: businessConfig, isLoading: configLoading } = useTenantData(tenantId);
    const { appointments, addAppointment, cancelAppointment, updateAppointmentTime } = useAppointments({
        adminPhone:   businessConfig?.phone ?? undefined,
        businessName: businessConfig?.name  ?? undefined,
    });
    const { schedule } = useSchedule();
    const { blockedSlots } = useBlockedSlots();
    const { blockedPhones } = useBlockedPhones();
    const { announcements } = useAnnouncements();
    const { addToWaitingList } = useWaitingList();

    
    const isPhoneBlocked = (phone: string) => blockedPhones.includes(phone);
    const hasActiveAppointment = (phone: string) => appointments.some(a => a.clientPhone === phone && a.status === 'confirmada');
    const getActiveAppointmentByPhone = (phone: string) => appointments.find(a => a.clientPhone === phone && a.status === 'confirmada');
    const getServiceById = (id: number) => services.find(s => s.id === id);
    const getTodaySchedule = () => schedule[DAY_KEYS[new Date().getDay()] as keyof typeof schedule];
    const getScheduleForDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        return schedule[DAY_KEYS[d.getDay()] as keyof typeof schedule];
    };
    const getActiveAnnouncements = () => announcements.filter(a => a.active);

    // sendSMS removida — OTP ahora usa Twilio Verify (verify-otp edge function)
    // Para WhatsApp OTP futuro, descomentar y conectar a send-sms con ContentSid de auth template.


    const loading = tenantLoading || (tenantId && configLoading);

    const todaySchedule = getTodaySchedule();
    const activeAnnouncements = getActiveAnnouncements();
    const hasClosedAnnouncement = activeAnnouncements.some((a: Announcement) => a.type === 'closed');

    const category = businessConfig?.category || 'barbershop';

    const professionalLabelMap: Record<string, string> = {
        barbershop: 'Barbero',
        beauty_salon: 'Estilista',
        spa: 'Terapeuta',
        pet_grooming: 'Groomer',
        consulting: 'Especialista',
        sports: 'Espacio',
        other: 'Profesional'
    };

    const professionalLabel = professionalLabelMap[category] || 'Profesional';

    // Steps: 1=Data, 2=Service, 2.5(stored as 25)=Date, 3=Time, 4=Confirm, 5=Success
    // 10=Manage, 11=CancelSuccess, 12=UpdateSuccess
    const [step, setStep] = useState(1);
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientError, setClientError] = useState<string | null>(null);
    const [selectedService, setSelectedService] = useState<typeof services[0] | null>(null);
    const [selectedStylist, setSelectedStylist] = useState<typeof stylists[0] | null>(null);
    const [selectedAddOns, setSelectedAddOns] = useState<number[]>([]); // additional service IDs
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [selectedTime, setSelectedTime] = useState<string | null>(null);

    // Add-ons computed values: duration adds up, price adds up
    const totalDuration = useMemo(() => {
        const base = selectedService?.duration ?? 0;
        const extras = selectedAddOns.reduce((sum, id) => {
            const svc = services.find(s => s.id === id);
            return sum + (svc?.duration ?? 0);
        }, 0);
        return base + extras;
    }, [selectedService, selectedAddOns, services]);

    const totalPrice = useMemo(() => {
        const base = selectedService?.price ?? 0;
        const extras = selectedAddOns.reduce((sum, id) => {
            const svc = services.find(s => s.id === id);
            return sum + (svc?.price ?? 0);
        }, 0);
        return base + extras;
    }, [selectedService, selectedAddOns, services]);
    const [bookingResult, setBookingResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updatingAppointmentId, setUpdatingAppointmentId] = useState<string | null>(null);
    const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
    // const [cancelError, setCancelError] = useState<string | null>(null);

    // Formatter for 12h time
    const format12h = (timeStr: string | null) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        let hh = parseInt(h);
        const ampm = hh >= 12 ? 'pm' : 'am';
        hh = hh % 12;
        hh = hh ? hh : 12;
        return `${hh}:${m}${ampm}`;
    };

    // Generate next 5 days
    const availableDates = useMemo(() => {
        const dates: { dateStr: string; label: string; dayName: string; isToday: boolean }[] = [];
        const todayStr = format(new Date(), 'yyyy-MM-dd');

        const now = new Date();
        const nowTime = format(now, 'HH:mm');
        const daysAheadConfig = businessConfig?.bookingDaysAhead || 14;

        for (let i = 0; i < daysAheadConfig * 2; i++) {
            const d = addDays(new Date(), i);
            const dateStr = format(d, 'yyyy-MM-dd');

            // Skip past dates (safety guard)
            if (dateStr < todayStr) continue;

            // NEW: If today, check if business hours have already ended
            if (i === 0) {
                const schedule = getScheduleForDate(dateStr);
                if (!schedule.open || nowTime >= schedule.end) {
                    continue; // Skip today if closed or past closing time
                }
            }

            if (dates.length >= daysAheadConfig) break;

            const dayIdx = d.getDay();
            const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayIdx];
            dates.push({
                dateStr,
                label: i === 0 ? 'Hoy' : format(d, 'd MMM', { locale: es }),
                dayName: DAY_NAMES[dayKey],
                isToday: i === 0,
            });
        }
        return dates;
    }, []);

    // Get schedule for selected date
    const selectedDateSchedule = useMemo(() => getScheduleForDate(selectedDate), [selectedDate, getScheduleForDate]);

    const baseDate = useMemo(() => {
        const todayLocal = format(new Date(), 'yyyy-MM-dd');
        return selectedDate === todayLocal
            ? new Date()
            : new Date(selectedDate + 'T00:00:00');
    }, [selectedDate]);

    // Appointments for selected date
    const dateAppointments: SlotAppointment[] = useMemo(() => {
        return appointments
            .filter(a => a.date === selectedDate && a.status !== 'cancelada' && (!selectedStylist || a.stylistId === selectedStylist.id))
            .map(a => {
                const svc = services.find(s => s.id === a.serviceId);
                const start = parse(a.time.slice(0, 5), 'HH:mm', baseDate);
                const end = new Date(start.getTime() + (svc?.duration ?? 30) * 60000);
                return { id: a.id, stylistId: String(a.stylistId ?? '0'), start, end };
            });
    }, [appointments, selectedDate, selectedStylist, services, baseDate]);

    // ── Multi-Stylist Logic: Availability Map ──
    // Maps each time slot to a list of available stylist IDs. 
    // This allows us to assign a specific stylist even when "Any" is selected.
    const slotsMetadata = useMemo(() => {
        const metadata: Record<string, string[]> = {};
        if (!selectedService || !selectedDateSchedule.open) return metadata;

        const todayLocal = format(new Date(), 'yyyy-MM-dd');
        const baseDate = selectedDate === todayLocal
            ? new Date()
            : new Date(selectedDate + 'T00:00:00');

        const relevantBlockedSlots: BlockedInterval[] = blockedSlots
            .filter(b => b.date === selectedDate)
            .map(b => ({
                // Robust parsing: slice(0,5) in case DB returns HH:mm:ss
                start: parse(b.startTime.slice(0, 5), 'HH:mm', baseDate),
                end: parse(b.endTime.slice(0, 5), 'HH:mm', baseDate)
            }));

        // Add Lunch Break if configured
        if (selectedDateSchedule.breakStart && selectedDateSchedule.breakEnd) {
            relevantBlockedSlots.push({
                start: parse(selectedDateSchedule.breakStart, 'HH:mm', baseDate),
                end: parse(selectedDateSchedule.breakEnd, 'HH:mm', baseDate)
            });
        }

        const stylistsToCheck = selectedStylist ? [selectedStylist] : stylists;
        const bufferMinutes = businessConfig?.breakBetweenAppointments ?? 0;
        // Fallback: if no stylists exist (MVP), treat as generic resource with ID '0'
        if (stylistsToCheck.length === 0) {
            const slots = getSmartSlots(baseDate, totalDuration, selectedDateSchedule.start, selectedDateSchedule.end, dateAppointments, relevantBlockedSlots, bufferMinutes);
            slots.forEach(slot => {
                metadata[slot] = ['0'];
            });
            return metadata;
        }

        stylistsToCheck.forEach(stylist => {
            const stylistApps = appointments
                .filter(a => a.date === selectedDate && a.status !== 'cancelada' && String(a.stylistId) === String(stylist.id))
                .map(a => {
                    const svc = services.find(s => s.id === a.serviceId);
                    const start = parse(a.time.slice(0, 5), 'HH:mm', baseDate);
                    const end = new Date(start.getTime() + (svc?.duration ?? 30) * 60000);
                    return { id: a.id, stylistId: String(a.stylistId), start, end };
                });

            const slots = getSmartSlots(baseDate, totalDuration, selectedDateSchedule.start, selectedDateSchedule.end, stylistApps, relevantBlockedSlots, bufferMinutes);

            slots.forEach(slot => {
                if (!metadata[slot]) metadata[slot] = [];
                metadata[slot].push(String(stylist.id));
            });
        });

        return metadata;
    }, [selectedService, totalDuration, selectedDate, selectedDateSchedule, blockedSlots, selectedStylist, stylists, appointments, services, dateAppointments]);

    // Detect if the day is manually blocked (e.g., "All Day" block such as 00:00 - 23:59)
    const isDayBlockedManually = useMemo(() => {
        return blockedSlots.some(b =>
            b.date === selectedDate &&
            (b.startTime.slice(0, 5) === '00:00' && b.endTime.slice(0, 5) === '23:59')
        );
    }, [blockedSlots, selectedDate]);

    const availableSlots = useMemo(() => {
        return Object.keys(slotsMetadata).sort();
    }, [slotsMetadata]);

    const [isSendingSms, setIsSendingSms] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
    const [otpAttempts, setOtpAttempts] = useState(0);
    const [smsProvider, setSmsProvider] = useState<'demo' | 'whatsapp'>('demo');
    const [smsDebugError, setSmsDebugError] = useState<string | null>(null);
    const [resendCountdown, setResendCountdown] = useState(0);

    // Countdown timer for resend button
    useEffect(() => {
        if (resendCountdown <= 0) return;
        const timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCountdown]);

    // ── Step 1: Validate & Init OTP ───
    const handleClientSubmit = async () => {
        const cleanPhone = clientPhone.replace(/\s+/g, '');
        const result = appointmentSchema.pick({ clientName: true, clientPhone: true }).safeParse({
            clientName: clientName.trim(),
            clientPhone: cleanPhone
        });

        if (!result.success) {
            setClientError(result.error.issues[0].message);
            return;
        }

        if (isPhoneBlocked(cleanPhone)) {
            setClientError('Este número ha sido bloqueado. Contacta al establecimiento para más información.');
            return;
        }

        setClientError(null);
        setClientPhone(cleanPhone); // Update global state to clean value

        if (hasActiveAppointment(cleanPhone)) {
            setStep(10);
            return;
        }

        setIsSendingSms(true);
        setSmsDebugError(null);
        setResendCountdown(15);
        try {
            // Solo validamos — el OTP se manda después de elegir hora
            setSmsProvider('demo');
            setStep(2);
        } finally {
            setIsSendingSms(false);
        }
    };

    // ── Crear cita después de verificación OTP ──────────────────────────
    const createAppointmentAfterOtp = async () => {
        if (!selectedService || !selectedTime || !clientName || !clientPhone) return;

        const availableStylists = slotsMetadata[selectedTime] || [];
        const assignedStylistId = selectedStylist ? selectedStylist.id : (availableStylists[0] ?? null);

        // Build combined service name (main + add-ons)
        const addOnNames = selectedAddOns
            .map(id => services.find(s => s.id === id)?.name)
            .filter(Boolean);
        const combinedServiceName = selectedService.name + (addOnNames.length > 0 ? ' + ' + addOnNames.join(' + ') : '');

        const result = await addAppointment({
            clientName: clientName.trim(),
            clientPhone: clientPhone.trim(),
            serviceId: selectedService.id,
            stylistId: assignedStylistId ? Number(assignedStylistId) : null,
            date: selectedDate,
            time: selectedTime,
            additionalServices: addOnNames.length > 0 ? addOnNames as string[] : undefined,
        });

        setBookingResult(result);
        if (result.success) {
            setStep(5);
            if (tenantId) {
                const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
                const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
                fetch(`${SUPABASE_URL}/functions/v1/notify-admin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}`, 'apikey': ANON_KEY },
                    body: JSON.stringify({
                        tenant_id:     tenantId,
                        event_type:    'new',
                        admin_phone:   businessConfig?.phone ?? undefined,
                        business_name: businessConfig?.name  ?? undefined,
                        appointment: {
                            client_name:  clientName.trim(),
                            client_phone: clientPhone.trim(),
                            service_name: combinedServiceName,
                            date:         selectedDate,
                            time:         selectedTime,
                        },
                    }),
                }).catch(() => { /* fire-and-forget */ });
            }
        }
    };

    const verifyOtp = async () => {
        if (generatedOtp === '__verify__') {
            // ── Twilio: verificar código ingresado por el cliente ──
            setIsSendingSms(true);
            try {
                const _checkRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
                    body: JSON.stringify({ action: 'check', phone: clientPhone, code: otpCode }),
                });
                const data = _checkRes.ok ? await _checkRes.json().catch(() => ({})) : {};
                if (data?.verified) {
                    // OTP válido → crear la cita y ir a confirmación final
                    await createAppointmentAfterOtp();
                } else {
                    const newAttempts = otpAttempts + 1;
                    setOtpAttempts(newAttempts);
                    if (newAttempts >= 3) {
                        setClientError('Has excedido el número de intentos. Intenta más tarde.');
                        setStep(1);
                    } else {
                        setClientError(`Código incorrecto. Intentos restantes: ${3 - newAttempts}`);
                    }
                }
            } finally {
                setIsSendingSms(false);
            }
        } else {
            // ── Demo: comparación local ───────────────────────────────────────
            if (otpCode === generatedOtp) {
                await createAppointmentAfterOtp();
            } else {
                const newAttempts = otpAttempts + 1;
                setOtpAttempts(newAttempts);
                if (newAttempts >= 3) {
                    setClientError('Has excedido el número de intentos. Intenta más tarde.');
                    setStep(1);
                } else {
                    setClientError(`Código incorrecto. Intentos restantes: ${3 - newAttempts}`);
                }
            }
        }
    };

    const resendOtp = async () => {
        setIsSendingSms(true);
        setResendCountdown(15);
        try {
            const currentProvider = businessConfig?.smsProvider ?? 'demo';
            if (currentProvider === 'whatsapp') {
                await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
                    body: JSON.stringify({ action: 'send', phone: clientPhone }),
                });
            } else {
                const code = Math.floor(1000 + Math.random() * 9000).toString();
                setGeneratedOtp(code);
            }
            setOtpAttempts(0);
        } finally {
            setIsSendingSms(false);
        }
    };

    // ── Manage existing ───
    const handleClientCancel = async (appointmentId: string) => {
        try {
            await cancelAppointment({ id: appointmentId });
            setStep(11);

            // ── Notificar al admin y al cliente sobre la cancelación ──────
            if (businessConfig?.phone && tenantId) {
                supabase.functions.invoke('notify-admin', {
                    body: {
                        tenant_id: tenantId,
                        event_type: 'cancel',
                        admin_phone: businessConfig.phone,
                        business_name: businessConfig.name,
                        appointment: {
                            client_name: clientName.trim(),
                            client_phone: clientPhone.trim(),
                            service_name: selectedService?.name ?? 'Servicio',
                            date: selectedDate,
                            time: selectedTime ?? '00:00',
                        },
                    },
                }).catch(() => { /* fire-and-forget */ });
            }
        } catch (error) {
            console.error('Error al cancelar:', error);
        }
    };

    const handleStartUpdate = (appointmentId: string, serviceId: number) => {
        setIsUpdating(true);
        setUpdatingAppointmentId(appointmentId);
        const svc = services.find(s => s.id === serviceId);
        setSelectedService(svc ?? null);
        setSelectedStylist(stylists[0] || null);
        setStep(25); // Go to date picker for rescheduling
    };

    const handleUpdateTime = async (time: string) => {
        if (updatingAppointmentId) {
            await updateAppointmentTime({ id: updatingAppointmentId, newTime: time, newDate: selectedDate });
            setSelectedTime(time);
            setStep(12);

            // ── Notificar al admin y al cliente sobre la reprogramación ──────
            if (businessConfig?.phone && tenantId) {
                supabase.functions.invoke('notify-admin', {
                    body: {
                        tenant_id: tenantId,
                        event_type: 'reschedule',
                        admin_phone: businessConfig.phone,
                        business_name: businessConfig.name,
                        appointment: {
                            client_name: clientName.trim(),
                            client_phone: clientPhone.trim(),
                            service_name: selectedService?.name ?? 'Servicio',
                            date: selectedDate,
                            time,
                        },
                    },
                }).catch(() => { /* fire-and-forget */ });
            }
        }
    };

    // ── Normal flow ───

    const handleSelectTime = (time: string) => {
        if (isUpdating) { handleUpdateTime(time); return; }
        setSelectedTime(time);
        // Solo resalta la hora, el botón "Continuar" aparecerá en el UI
    };

    // Botón "Continuar" del Step 3: envía OTP y muestra banner WhatsApp
    const handleContinueToOtp = async () => {
        if (!selectedService || !selectedTime || !clientName || !clientPhone) return;

        // Consulta directa para obtener sms_provider (evita bug de cache)
        let currentProvider = 'demo';
        let bName = businessConfig?.name ?? 'CitaLink';
        if (tenantId) {
            const { data: tenantRow } = await supabase
                .from('tenants')
                .select('sms_provider, name')
                .eq('id', tenantId)
                .single();
            if (tenantRow) {
                currentProvider = tenantRow.sms_provider || 'demo';
                bName = tenantRow.name || bName;
            }
        }

        if (currentProvider === 'whatsapp') {
            // ── Enviar OTP y mostrar banner de WhatsApp ──────────────────────
            setIsSendingSms(true);
            setSmsDebugError(null);
            setResendCountdown(15);
            try {
                const dateLabel = selectedDate
                    ? format(new Date(selectedDate + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es })
                    : 'próximamente';
                const timeLabel = format12h(selectedTime);
                const appointmentDateTime = `${dateLabel} a las ${timeLabel}`;

                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const anonKey    = import.meta.env.VITE_SUPABASE_ANON_KEY;

                const funcRes = await fetch(`${supabaseUrl}/functions/v1/verify-otp`, {
                    method:  'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${anonKey}`,
                        'apikey': anonKey,
                    },
                    body: JSON.stringify({
                        action:              'send',
                        phone:               clientPhone,
                        tenant_id:           tenantId,
                        businessName:        bName,
                        clientName:          clientName.trim(),
                        serviceName:         selectedService?.name ?? 'tu servicio',
                        appointmentDateTime,
                    }),
                });

                const funcData = funcRes.ok
                    ? await funcRes.json().catch(() => ({ success: false, error: 'Respuesta inválida del servidor' }))
                    : { success: false, error: `HTTP ${funcRes.status}` };

                if (!funcData?.success) {
                    const debugErr = funcData?.error ?? 'Error al enviar código';
                    setSmsDebugError(debugErr);
                    setClientError(`Error procesando WhatsApp: ${debugErr}`);
                    return;
                }
                setSmsProvider(currentProvider as 'whatsapp');
                setGeneratedOtp('__verify__');
                setOtpAttempts(0);
                setOtpCode('');
                setStep(16); // ir a pantalla OTP (banner WhatsApp)
            } finally {
                setIsSendingSms(false);
            }
        } else {
            // Demo: crear cita directamente sin OTP
            await createAppointmentAfterOtp();
        }
    };

    // handleConfirm ahora solo se usa como fallback desde Step 4 si aún existe
    const handleConfirm = async () => {
        await handleContinueToOtp();
    };


    const resetBooking = () => {
        setStep(1);
        setClientName(''); setClientPhone(''); setClientError(null);
        setSelectedService(null); setSelectedStylist(null); setSelectedDate(new Date().toISOString().split('T')[0]);
        setSelectedTime(null); setBookingResult(null); setIsUpdating(false); setUpdatingAppointmentId(null);
    };

    // const inputStyle: React.CSSProperties = {
    //     padding: '10px 12px', borderRadius: 'var(--radius-md)',
    //     border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
    //     color: 'var(--color-text)', width: '100%', fontSize: '0.95rem',
    // };

    const activeAppt = getActiveAppointmentByPhone(clientPhone.trim());
    const activeService = activeAppt ? getServiceById(activeAppt.serviceId) : null;
    // const weeklyCancels = clientPhone ? getWeeklyCancellations(clientPhone.trim()) : 0;


    // @ts-ignore — used in JSX for closed-state rendering
    const isClosed = !todaySchedule.open || hasClosedAnnouncement;

    // const stepLabels = ['Datos', 'Servicio', 'Fecha', 'Hora', 'Confirmar']; // Removed unused

    const stepMap: Record<number, number> = { 1: 1, 2: 2, 22: 2, 25: 3, 3: 4, 4: 5 };
    const currentProgress = stepMap[step] ?? 0;

    const annColors: Record<string, { bg: string; color: string; icon: React.ElementType }> = {
        info: { bg: 'hsla(210, 80%, 55%, 0.12)', color: 'hsl(210, 80%, 55%)', icon: Info },
        warning: { bg: 'hsla(40, 90%, 50%, 0.12)', color: 'hsl(40, 90%, 50%)', icon: AlertTriangle },
        closed: { bg: 'hsla(0, 70%, 50%, 0.12)', color: 'var(--color-danger)', icon: AlertOctagon },
    };

    if (loading) {
        return <SplashScreen />;
    }

    return (
        <div className="container animate-fade-in" style={{ maxWidth: '520px', paddingTop: 'var(--space-xl)', paddingBottom: '3rem' }}>
            {step !== 5 && (
                <div className="text-center" style={{ marginBottom: 'var(--space-lg)' }}>
                    {businessConfig?.logoUrl && (
                        <div className="relative w-24 h-24 mx-auto mb-5 group">
                            {/* Glow ring */}
                            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/40 to-orange-500/40 blur-xl scale-110 opacity-0 group-hover:opacity-100 transition-all duration-700" />
                            <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl bg-slate-950">
                                <img src={businessConfig.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                            </div>
                        </div>
                    )}
                    <h2 className="text-2xl font-black text-white tracking-tight">
                        {step === 10 ? 'Tu Cita' : (businessConfig?.name || 'Reserva online')}
                    </h2>
                </div>
            )}

            {/* Step Titles for internal steps */}
            {step === 2 && <h2 className="text-xl font-black text-white text-center mb-6">Elige un Servicio</h2>}
            {step === 22 && <h2 className="text-xl font-black text-white text-center mb-6">Elige tu {professionalLabel}</h2>}
            {step === 25 && <h2 className="text-xl font-black text-white text-center mb-6">Selecciona Fecha</h2>}
            {step === 3 && <h2 className="text-xl font-black text-white text-center mb-6">Selecciona Hora</h2>}
            {step === 4 && <h2 className="text-xl font-black text-white text-center mb-6">Confirma tu Reserva</h2>}

            {/* Progress Bar */}
            {step >= 1 && step <= 25 && step !== 5 && (
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <div className="flex gap-1.5 h-1 mb-3">
                        {[1, 2, 3, 4, 5].map(s => (
                            <div key={s} className="flex-1 rounded-full transition-all duration-500"
                                style={{
                                    background: currentProgress >= s
                                        ? 'linear-gradient(90deg, var(--color-accent), #f97316)'
                                        : 'rgba(255,255,255,0.08)'
                                }}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-muted uppercase tracking-widest px-0.5">
                        <span className={currentProgress >= 1 ? 'text-accent' : ''}>Datos</span>
                        <span className={currentProgress >= 5 ? 'text-accent' : ''}>Confirmar</span>
                    </div>
                </div>
            )}

            {/* ── Announcements ── */}
            {activeAnnouncements.length > 0 && step !== 5 && (
                <div className="flex flex-col gap-2 mb-5">
                    {activeAnnouncements.map((ann: Announcement) => {
                        const ac = annColors[ann.type];
                        const AnnIcon = ac.icon;
                        return (
                            <div key={ann.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                                style={{ background: ac.bg, border: `1px solid ${ac.color}33` }}
                            >
                                <AnnIcon size={16} style={{ color: ac.color, flexShrink: 0 }} />
                                <span style={{ color: ac.color, fontWeight: 600, fontSize: '0.85rem' }}>{ann.message}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="card">

                {/* ══ STEP 1: Client Data ══ */}
                {step === 1 && (
                    <div className="animate-fade-in">
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/20 to-orange-500/20 border border-accent/20 mb-4">
                                <User size={28} className="text-accent" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-1">
                                ¡Bienvenido!
                            </h3>
                            <p className="text-sm text-muted">
                                Ingresa tus datos para comenzar.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={clientName}
                                    onChange={e => { setClientName(e.target.value); setClientError(null); }}
                                    placeholder="Tu nombre completo"
                                    className="w-full glass-card bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all outline-none"
                                    onKeyDown={e => e.key === 'Enter' && handleClientSubmit()}
                                />
                            </div>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                                    <Phone size={18} />
                                </div>
                                <input
                                    type="tel"
                                    value={clientPhone}
                                    onChange={e => { setClientPhone(e.target.value); setClientError(null); }}
                                    placeholder="Número de teléfono (10 dígitos)"
                                    className="w-full glass-card bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all outline-none"
                                    onKeyDown={e => e.key === 'Enter' && handleClientSubmit()}
                                />
                            </div>

                            {/* Security Badge */}
                            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <Shield size={15} className="text-accent shrink-0" />
                                <p className="text-[11px] text-slate-400">
                                    Verificación por SMS · Solo 1 cita por número de teléfono
                                </p>
                            </div>

                            {clientError && (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                    <AlertTriangle size={16} /><span>{clientError}</span>
                                </div>
                            )}

                            <button
                                className="btn btn-primary w-full py-4 text-base font-bold shadow-glow mt-2 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                onClick={handleClientSubmit}
                                disabled={isSendingSms || !clientName || !clientPhone}
                            >
                                {isSendingSms ? (
                                    <><RefreshCw className="animate-spin" size={18} /> Enviando...</>
                                ) : (
                                    <><span>Continuar</span><ChevronRight size={18} /></>
                                )}
                            </button>

                            {isSendingSms && (
                                <p className="text-[10px] text-accent/70 text-center mt-2 animate-pulse-soft font-medium">
                                    El código puede tardar unos 10 segundos en llegar...
                                </p>
                            )}

                            {/* DEBUG: error de WhatsApp — quitar cuando funcione */}
                            {smsDebugError && !isSendingSms && (
                                <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono break-all">
                                    <span className="font-bold text-red-400">⚠ DEBUG:</span> {smsDebugError}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ══ STEP 10: Manage Existing ══ */}
                {step === 10 && activeAppt && activeService && (
                    <div className="animate-fade-in">
                        {/* Big warning header */}
                        <div className="glass-panel p-6 rounded-2xl mb-6 border-l-4 border-l-yellow-500">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-yellow-500/20 rounded-full text-yellow-500 animate-pulse-soft">
                                    <AlertOctagon size={32} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Cita Pendiente</h3>
                                    <p className="text-sm text-yellow-500 font-medium">Tienes una reserva activa</p>
                                </div>
                            </div>
                            <p className="text-sm text-muted">
                                Hola <strong>{clientName}</strong>, detectamos que ya tienes una cita programada con este número.
                            </p>
                        </div>

                        {/* Appointment card */}
                        <div className="glass-card p-6 rounded-2xl mb-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Calendar size={120} />
                            </div>

                            <div className="flex items-center gap-4 mb-6 relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-orange-600 flex items-center justify-center text-white shadow-lg">
                                    <Calendar size={32} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{activeService.name}</h2>
                                    <p className="text-accent font-bold text-lg">${activeService.price}</p>
                                </div>
                            </div>

                            <div className="space-y-3 relative z-10">
                                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                                    <Clock size={18} className="text-muted" />
                                    <span className="font-medium text-white">{activeAppt.date} — {activeAppt.time}</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                                    <MapPin size={18} className="text-muted" />
                                    <span className="text-sm text-muted">{businessConfig?.address || 'Nuestra sucursal'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Action prompt */}
                        <div className="space-y-3">
                            <button className="btn btn-primary w-full py-4 text-lg" onClick={() => handleStartUpdate(activeAppt.id, activeAppt.serviceId)}>
                                <RefreshCw size={20} /> Reprogramar Cita
                            </button>

                            {(() => {
                                const apptDateTime = parse(`${activeAppt.date} ${activeAppt.time}`, 'yyyy-MM-dd HH:mm', new Date());
                                const now = new Date();
                                const diffMins = differenceInMinutes(apptDateTime, now);
                                const diffHours = diffMins / 60;

                                if (diffMins < 0) return null; // Already passed

                                if (diffHours < 1) {
                                    return (
                                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                                            <p className="font-bold mb-1">Cita muy próxima</p>
                                            <p>Falta menos de 1 hora. Debes llamar directamente para cancelar.</p>
                                            <a
                                                href={`tel:${businessConfig?.phone?.replace(/\D/g, '') || ''}`}
                                                className="btn btn-primary w-full mt-3 flex items-center justify-center gap-2"
                                            >
                                                <Phone size={18} /> Llamar ahora
                                            </a>
                                        </div>
                                    );
                                }

                                if (diffHours <= 5) {
                                    const message = encodeURIComponent(`Hola, me gustaría cancelar mi cita de las ${activeAppt.time} (${activeService.name}). Mi nombre es ${clientName}.`);
                                    return (
                                        <div className="flex flex-col gap-3">
                                            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 text-sm text-center">
                                                <p className="font-bold mb-1">Política de Cancelación</p>
                                                <p>Faltan menos de 5 horas. Por favor, avísale al dueño por WhatsApp.</p>
                                            </div>
                                            <a
                                                href={`https://wa.me/${businessConfig?.phone?.replace(/\D/g, '')}?text=${message}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-secondary w-full py-4 text-accent border-accent/20 flex items-center justify-center gap-2"
                                            >
                                                <XCircle size={20} /> Hablar por WhatsApp
                                            </a>
                                        </div>
                                    );
                                }

                                return (
                                    <button className="btn btn-ghost w-full py-4 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20" onClick={() => setIsCancelConfirmOpen(true)}>
                                        <XCircle size={20} /> Cancelar Cita
                                    </button>
                                );
                            })()}
                        </div>
                        <button className="btn btn-ghost w-full mt-4 text-sm" onClick={resetBooking}>← Volver al inicio</button>
                    </div>
                )}

                {/* ══ STEP 16: OTP Verification ══ */}
                {step === 16 && (
                    <div className="animate-fade-in max-w-md mx-auto text-center">
                        <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6 text-accent animate-pulse-soft">
                            <Shield size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Verificación de Seguridad</h3>

                        {/* ── Proveedor: WhatsApp ── */}
                        {smsProvider === 'whatsapp' && (
                            <div className="mb-6">
                                <div className="relative bg-[#0a2618] border border-[#25D366]/30 rounded-2xl p-4 overflow-hidden shadow-lg shadow-[#25D366]/10">
                                    <div className="absolute -top-8 -right-8 w-28 h-28 bg-[#25D366]/15 rounded-full blur-2xl pointer-events-none" />
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className="w-11 h-11 rounded-xl bg-[#25D366]/20 border border-[#25D366]/30 flex items-center justify-center shrink-0">
                                            <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6"><path d="M16 3C8.82 3 3 8.82 3 16c0 2.35.63 4.55 1.73 6.45L3 29l6.72-1.7A12.93 12.93 0 0016 29c7.18 0 13-5.82 13-13S23.18 3 16 3z" fill="#25D366"/><path d="M22.1 19.6c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.96-.95 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.68-1.63-.93-2.23-.24-.59-.49-.5-.68-.51h-.58c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.87 1.21 3.07c.15.2 2.08 3.17 5.04 4.45.7.3 1.25.48 1.68.62.7.22 1.34.19 1.84.11.56-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z" fill="#fff"/></svg>
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-[#25D366] text-xs font-bold uppercase tracking-widest">WhatsApp</span>
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#25D366]"></span>
                                                </span>
                                            </div>
                                            <p className="text-white text-sm font-medium">
                                                ¡Código enviado a <span className="text-[#25D366] font-bold">{clientPhone}</span>!
                                            </p>
                                            <p className="text-white/50 text-xs mt-0.5">Revisa tu WhatsApp e ingresa el código.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* MOCK SMS CARD — solo visible en modo DEMO */}
                        {generatedOtp && !isSendingSms && smsProvider === 'demo' && (
                            <div className="bg-slate-900/80 border border-emerald-500/30 p-4 rounded-xl mb-6 relative overflow-hidden group shadow-lg shadow-emerald-500/5 transition-all w-full max-w-sm mx-auto text-left">
                                <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl flex-shrink-0 group-hover:bg-emerald-500/20 transition-all duration-500"></div>
                                <div className="flex items-start gap-4 relative z-10">
                                    <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-[14px] shrink-0 border border-emerald-500/20">
                                        <MessageSquare size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">SMS Simulado</span>
                                            <span className="text-[10px] text-slate-500 font-medium">Ahora mismo</span>
                                        </div>
                                        <p className="text-sm text-slate-300 leading-relaxed mt-1.5">
                                            Tu código para <span className="font-semibold text-white">{businessConfig?.name || 'nuestro servicio'}</span> es: <span className="font-mono bg-black/60 px-2 py-1 rounded-md text-emerald-300 font-bold tracking-wider">{generatedOtp}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="glass-panel p-6 rounded-2xl space-y-4">
                            <input
                                type="text"
                                maxLength={4}
                                value={otpCode}
                                onChange={e => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setOtpCode(val);
                                    if (val.length === 4) setClientError(null);
                                }}
                                placeholder="0000"
                                className="w-full text-center text-3xl tracking-[0.5em] font-mono glass-card bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-accent focus:ring-1 focus:ring-accent transition-all outline-none"
                            />

                            {clientError && (
                                <div className="text-red-500 text-sm font-medium animate-pulse">
                                    {clientError}
                                </div>
                            )}

                            <button
                                className="btn btn-primary w-full py-4 text-lg shadow-glow disabled:opacity-50"
                                onClick={verifyOtp}
                                disabled={otpCode.length !== 4 || isSendingSms}
                            >
                                {isSendingSms ? 'Cargando...' : 'Verificar'}
                            </button>

                            <button
                                className="btn btn-ghost text-sm w-full text-muted hover:text-white disabled:opacity-50"
                                onClick={resendOtp}
                                disabled={isSendingSms || resendCountdown > 0}
                            >
                                {isSendingSms
                                    ? 'Enviando nuevo código...'
                                    : resendCountdown > 0
                                        ? `⏳ Reenviar en ${resendCountdown}s...`
                                        : '¿No recibiste el código? Reenviar'
                                }
                            </button>

                            {isSendingSms && (
                                <p className="text-[10px] text-accent/70 text-center animate-pulse-soft font-medium">
                                    El código puede tardar unos 10 segundos en llegar...
                                </p>
                            )}
                        </div>
                        <button className="btn btn-ghost w-full mt-4 text-sm" onClick={() => setStep(1)}>← Cambiar número</button>
                    </div>
                )}

                {/* ══ STEP 2: Stylist Selection ══ */}
                {step === 2 && (
                    <div className="animate-slide-up">
                        <div className="mb-6 text-center">
                            <p className="text-sm text-accent font-medium mb-1">Paso 1 de 4</p>
                            <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                ¿Prefieres a alguien en especial?
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {/* "Any" Option */}
                            <div
                                key="any-stylist"
                                className={`glass-card p-5 group cursor-pointer transition-all duration-500 !rounded-[2rem] border-white/5 hover:border-cyan-500/30 ${selectedStylist === null ? 'ring-2 ring-cyan-400 bg-cyan-400/10' : ''}`}
                                onClick={() => {
                                    setSelectedStylist(null);
                                    setSelectedAddOns([]);
                                    setStep(22);
                                }}
                            >
                                <div className="flex items-center gap-5">
                                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-800 shrink-0 shadow-lg border border-white/5 group-hover:scale-105 transition-transform duration-500">
                                        <div className="w-full h-full flex items-center justify-center text-cyan-400 bg-gradient-to-br from-cyan-400/10 to-blue-500/10">
                                            <RefreshCw size={32} />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-white text-lg mb-1 truncate group-hover:text-cyan-400 transition-colors">Cualquier {professionalLabel}</h4>
                                        <p className="text-sm text-muted uppercase tracking-widest">El primer disponible</p>
                                    </div>
                                </div>
                            </div>

                            {/* Stylists List */}
                            {stylists.map((stylist: Stylist) => (
                                <div
                                    key={stylist.id}
                                    className={`glass-card p-5 group cursor-pointer transition-all duration-500 !rounded-[2rem] border-white/5 hover:border-cyan-500/30 ${selectedStylist?.id === stylist.id ? 'ring-2 ring-cyan-400 bg-cyan-400/10' : ''}`}
                                    onClick={() => {
                                        setSelectedStylist(stylist);
                                        setSelectedAddOns([]);
                                        setStep(22);
                                    }}
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-800 shrink-0 shadow-lg border border-white/5 group-hover:scale-105 transition-transform duration-500">
                                            {stylist.image ? (
                                                <img src={stylist.image} alt={stylist.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-cyan-400 bg-gradient-to-br from-cyan-400/10 to-blue-500/10">
                                                    <Calendar size={32} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-white text-lg mb-1 truncate group-hover:text-cyan-400 transition-colors">{stylist.name}</h4>
                                            <p className="text-sm text-muted uppercase tracking-widest">{stylist.role}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="btn btn-ghost w-full mt-4 text-sm" onClick={() => setStep(1)}>← Cambiar número</button>
                    </div>
                )}

                {/* ══ STEP 22: Service ══ */}
                {step === 22 && (
                    <div className="animate-slide-up">
                        <div className="mb-6 text-center">
                            <p className="text-sm text-accent font-medium mb-1">Paso 2 de 4</p>
                            <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                ¿Qué te gustaría hacerte hoy?
                            </h3>
                        </div>

                        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4">
                            {services.filter(s => !s.isAddon).map((service: Service) => (
                                <div
                                    key={service.id}
                                    className={`glass-card group cursor-pointer transition-all duration-300 relative overflow-hidden rounded-2xl border border-white/5 hover:border-cyan-500/30 active:scale-[0.98] ${selectedService?.id === service.id ? 'ring-2 ring-cyan-400 bg-cyan-400/10 border-cyan-400/30' : ''}`}
                                    onClick={() => {
                                        setSelectedService(service);
                                        const hasAddons = services.some(s => s.isAddon);
                                        if (businessConfig?.enableAddons && hasAddons) {
                                            setStep(23);
                                        } else {
                                            setStep(25);
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-3 p-3">
                                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-slate-800 shrink-0 shadow-md border border-white/5 group-hover:scale-105 transition-transform duration-300">
                                            {service.image ? (
                                                <img src={service.image} alt={service.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-cyan-400 bg-gradient-to-br from-cyan-400/10 to-blue-500/10">
                                                    <Calendar size={24} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-white text-sm sm:text-base leading-snug group-hover:text-cyan-400 transition-colors">
                                                {service.name}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1 text-xs sm:text-sm">
                                                <span className="text-cyan-400 font-bold">${service.price}</span>
                                                <span className="text-muted flex items-center gap-1">
                                                    <Clock size={12} /> {service.duration} min
                                                </span>
                                            </div>
                                        </div>
                                        {selectedService?.id === service.id && (
                                            <div className="w-5 h-5 rounded-full bg-cyan-400 flex items-center justify-center shrink-0">
                                                <CheckCircle size={14} className="text-slate-900" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="btn btn-ghost w-full mt-4 text-sm" onClick={() => setStep(2)}>← Elegir otro {professionalLabel.toLowerCase()}</button>
                    </div>
                )}

                {/* ══ STEP 23: Add-On Services ══ */}
                {step === 23 && selectedService && (
                    <div className="animate-slide-up">
                        <div className="mb-5 text-center">
                            <p className="text-sm text-accent font-medium mb-1">Paso 2 de 4</p>
                            <h3 className="text-xl font-bold text-white">¿Deseas agregar algo más?</h3>
                            <p className="text-xs text-muted mt-1">Servicios adicionales opcionales</p>
                        </div>

                        {/* Add-on chips */}
                        <div className="flex flex-col gap-2">
                            {services
                                .filter(s => s.isAddon && s.id !== selectedService.id)
                                .map((s: Service) => {
                                    const isSelected = selectedAddOns.includes(s.id);
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedAddOns(prev =>
                                                    isSelected
                                                        ? prev.filter(id => id !== s.id)
                                                        : [...prev, s.id]
                                                );
                                            }}
                                            className={`flex items-center justify-between w-full px-4 py-3 rounded-2xl border transition-all duration-200 text-left ${
                                                isSelected
                                                    ? 'bg-cyan-400/10 border-cyan-400/40 ring-1 ring-cyan-400/40'
                                                    : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                                    isSelected ? 'bg-cyan-400 border-cyan-400' : 'border-white/30'
                                                }`}>
                                                    {isSelected && <CheckCircle size={10} className="text-slate-900" />}
                                                </div>
                                                <span className={`font-semibold text-sm ${
                                                    isSelected ? 'text-cyan-300' : 'text-white'
                                                }`}>{s.name}</span>
                                            </div>
                                            <span className="text-xs text-cyan-400 font-bold shrink-0">${s.price} · {s.duration}min</span>
                                        </button>
                                    );
                                })
                            }
                        </div>

                        {/* Summary if something selected */}
                        {selectedAddOns.length > 0 && (
                            <div className="mt-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
                                <span className="text-slate-500 font-bold uppercase tracking-widest mr-1">Resumen:</span>
                                <span className="font-semibold text-white">
                                    {selectedService.name} + {selectedAddOns.map(id => services.find(s => s.id === id)?.name).filter(Boolean).join(' + ')}
                                </span>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 mt-5">
                            <button
                                className="flex-1 btn btn-ghost text-sm py-3"
                                onClick={() => { setSelectedAddOns([]); setStep(25); }}
                            >
                                Omitir
                            </button>
                            {selectedAddOns.length > 0 && (
                                <button
                                    className="flex-1 btn text-sm py-3 font-bold"
                                    style={{ background: 'var(--color-accent)', color: '#fff' }}
                                    onClick={() => setStep(25)}
                                >
                                    Confirmar selección →
                                </button>
                            )}
                        </div>
                        <button className="btn btn-ghost w-full mt-2 text-sm" onClick={() => setStep(22)}>← Cambiar de servicio principal</button>
                    </div>
                )}

                {/* ══ STEP 25: Date Picker ══ */}
                {step === 25 && selectedService && (
                    <div className="animate-fade-in">
                        <h3 className="text-xl font-bold" style={{ marginBottom: 'var(--space-xs)' }}>
                            {isUpdating ? 'Nueva Fecha' : 'Selecciona Fecha'}
                        </h3>
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
                            {selectedService.name}
                        </p>
                        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 'var(--space-sm)' }}>
                            {availableDates.map(d => {
                                const daySchedule = getScheduleForDate(d.dateStr);
                                const closed = !daySchedule.open;
                                return (
                                    <button
                                        key={d.dateStr}
                                        onClick={() => { setSelectedDate(d.dateStr); setSelectedTime(null); setStep(3); }}
                                        className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-1 ${selectedDate === d.dateStr ? 'bg-cyan-500 border-cyan-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)]' : 'bg-white/5 border-white/10 hover:border-cyan-500/50 text-slate-300'} ${closed ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        disabled={closed}
                                    >
                                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{d.dayName}</span>
                                        <span className="text-sm font-bold">{d.label}</span>
                                        {d.isToday && <span className="text-[8px] uppercase font-black tracking-tighter text-cyan-200">HOY</span>}
                                        {closed && <span className="text-[8px] uppercase font-black tracking-tighter text-red-400">Cerrado</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 'var(--space-md)' }} onClick={() => { setIsUpdating(false); setStep(isUpdating ? 10 : 22); }}>← Atrás</button>
                    </div>
                )}

                {/* ══ STEP 3: Time ══ */}
                {step === 3 && selectedService && (
                    <div className="animate-slide-up">
                        <div className="text-center mb-6">
                            <p className="text-xs text-accent font-bold uppercase tracking-wider mb-2">Paso 3 de 4</p>
                            <h3 className="text-2xl font-bold text-white mb-2">Selecciona Hora</h3>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300">
                                <Calendar size={14} className="text-accent" />
                                {format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'EEEE d MMMM', { locale: es })}
                            </div>
                        </div>

                        {availableSlots.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {availableSlots.map((time, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelectTime(time)}
                                        className={`p-4 rounded-2xl border transition-all duration-300 group relative overflow-hidden ${selectedTime === time ? 'bg-cyan-500 border-cyan-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)]' : 'bg-white/5 border-white/10 hover:border-cyan-500/50 text-slate-300'}`}
                                    >
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className="text-sm font-bold tracking-tight">{format12h(time)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="glass-panel p-8 text-center rounded-2xl border-dashed border-2 border-white/10">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-muted">
                                    <Clock size={32} />
                                </div>
                                <h4 className="text-lg font-bold text-white mb-2">Sin horarios disponibles</h4>
                                <p className="text-sm text-muted mb-6">
                                    {isDayBlockedManually
                                        ? 'Este día no hay servicio por causa de fuerza mayor o descanso.'
                                        : (selectedDate === format(new Date(), 'yyyy-MM-dd')
                                            ? 'Las horas laborales han concluido por el día de hoy o la agenda está llena. Intenta otro día.'
                                            : 'Parece que el día está completamente reservado para este servicio.')}
                                </p>

                                {(() => {
                                    const now = new Date();
                                    const nowTime = format(now, 'HH:mm');
                                    const todayStr = format(now, 'yyyy-MM-dd');
                                    const isToday = selectedDate === todayStr;
                                    const daySched = getScheduleForDate(selectedDate);
                                    const isPastClosing = isToday && nowTime >= daySched.end;

                                    if (isDayBlockedManually || isPastClosing) return null;

                                    return (
                                        <button
                                            className="btn btn-primary w-full py-4 mb-3 text-accent border-accent/20 flex items-center justify-center gap-2 group"
                                            onClick={() => {
                                                if (!clientName || !clientPhone) {
                                                    setStep(27);
                                                } else {
                                                    addToWaitingList({
                                                        name: clientName,
                                                        phone: clientPhone,
                                                        serviceId: selectedService.id,
                                                        date: selectedDate,
                                                    });
                                                    setStep(26);
                                                }
                                            }}
                                        >
                                            <span className="group-hover:scale-110 transition-transform">⏳</span>
                                            Avísame si se libera un lugar
                                        </button>
                                    );
                                })()}
                                <button className="btn btn-ghost text-sm w-full" onClick={() => setStep(25)}>
                                    Ver otra fecha
                                </button>
                            </div>
                        )}

                        {availableSlots.length > 0 && selectedTime && (
                            <div className="mt-6 space-y-3 animate-slide-up">
                                {clientError && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm font-medium animate-pulse text-center mb-2">
                                        {clientError}
                                    </div>
                                )}
                                <button
                                    className="w-full py-4 rounded-2xl font-bold text-lg text-white bg-gradient-to-r from-fuchsia-500 to-orange-400 hover:from-fuchsia-600 hover:to-orange-500 shadow-lg shadow-fuchsia-500/20 transition-all duration-300 flex items-center justify-center gap-2"
                                    onClick={handleContinueToOtp}
                                    disabled={isSendingSms}
                                >
                                    {isSendingSms ? (
                                        <><span className="animate-spin">⏳</span> Enviando código...</>
                                    ) : (
                                        <>Continuar <ChevronRight size={20} /></>
                                    )}
                                </button>
                                <button className="btn btn-ghost w-full" onClick={() => { setSelectedTime(null); setClientError(null); }}>Elegir otra hora</button>
                            </div>
                        )}

                        {availableSlots.length > 0 && (
                            <button className="btn btn-ghost w-full mt-3" onClick={() => setStep(25)}>← Elegir otra fecha</button>
                        )}
                    </div>
                )}

                {/* ══ STEP 26: Waiting List Success ══ */}
                {step === 26 && (
                    <div className="animate-fade-in text-center py-8">
                        <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20 text-white">
                            <CheckCircle size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">¡Estás en la lista!</h3>
                        <p className="text-muted mb-8 leading-relaxed max-w-xs mx-auto">
                            Te avisaremos por <strong>WhatsApp</strong> si se libera un espacio para el día <strong>{selectedDate}</strong>.
                        </p>
                        <button className="btn btn-primary w-full py-4 font-bold" onClick={() => { setStep(1); setClientName(''); setClientPhone(''); }}>
                            Volver al Inicio
                        </button>
                    </div>
                )}

                {/* ══ STEP 27: Waiting List Info Collection ══ */}
                {step === 27 && selectedService && (
                    <div className="animate-slide-up">
                        <div className="text-center mb-6">
                            <h3 className="text-2xl font-bold text-white mb-2">Lista de Espera</h3>
                            <p className="text-sm text-muted">Ingresa tus datos para avisarte si se libera un cupo.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="glass-panel p-4 rounded-xl border border-white/5">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-accent mb-2">Nombre Completo</label>
                                <input
                                    type="text"
                                    className="w-full bg-transparent border-none text-white focus:ring-0 p-0 text-lg placeholder:text-white/10"
                                    placeholder="Ej: Juan Pérez"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                />
                            </div>

                            <div className="glass-panel p-4 rounded-xl border border-white/5">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-accent mb-2">WhatsApp</label>
                                <div className="flex items-center gap-2">
                                    <Phone size={18} className="text-muted" />
                                    <input
                                        type="tel"
                                        className="w-full bg-transparent border-none text-white focus:ring-0 p-0 text-lg placeholder:text-white/10"
                                        placeholder="Ej: 5512345678"
                                        value={clientPhone}
                                        onChange={(e) => setClientPhone(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                className="btn btn-primary w-full py-4 mt-4 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!clientName || clientPhone.length < 8}
                                onClick={async () => {
                                    await addToWaitingList({
                                        name: clientName,
                                        phone: clientPhone,
                                        serviceId: selectedService.id,
                                        date: selectedDate,
                                    });
                                    setStep(26);
                                }}
                            >
                                Unirme a la Lista
                            </button>

                            <button className="btn btn-ghost w-full py-2 text-sm" onClick={() => setStep(3)}>
                                ← Volver
                            </button>
                        </div>
                    </div>
                )}

                {/* ══ STEP 4: Confirm ══ */}
                {step === 4 && selectedService && selectedTime && (
                    <div className="animate-slide-up">
                        <div className="text-center mb-6">
                            <p className="text-xs text-accent font-bold uppercase tracking-wider mb-2">Paso 4 de 4</p>
                            <h3 className="text-2xl font-bold text-white">Confirmar Reserva</h3>
                        </div>

                        <div className="glass-card p-6 rounded-2xl mb-6 relative overflow-hidden text-left border-t-4 border-t-accent">
                            {/* Summary Content */}
                            <div className="flex gap-4 mb-6">
                                <div className="w-20 h-20 rounded-xl overflow-hidden shadow-lg border border-white/10 shrink-0">
                                    {selectedService.image ? (
                                        <img src={selectedService.image} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-slate-800 flex items-center justify-center"><RefreshCw className="text-muted" /></div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {/* Main service + add-ons combined label */}
                                    <h4 className="text-base font-bold text-white leading-snug">
                                        {selectedService.name}
                                        {selectedAddOns.length > 0 && (
                                            <span className="text-cyan-400">
                                                {' + ' + selectedAddOns.map(id => services.find(s => s.id === id)?.name).filter(Boolean).join(' + ')}
                                            </span>
                                        )}
                                    </h4>
                                    <p className="text-sm text-muted mb-2">{totalDuration} min en total</p>
                                    <div className="inline-block px-2 py-1 bg-accent/20 text-accent rounded text-xs font-bold border border-accent/20">
                                        ${totalPrice}
                                        {selectedAddOns.length > 0 && <span className="text-white/40 ml-1 font-normal">total</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 py-4 border-t border-white/10 border-b border-white/10 mb-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted">Fecha</span>
                                    <span className="font-medium text-white">{format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'EEEE d MMMM', { locale: es })}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted">Hora</span>
                                    <span className="font-bold text-accent text-lg">{format12h(selectedTime)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted">{professionalLabel}</span>
                                    <div className="flex items-center gap-2">
                                        {selectedStylist?.image && <img src={selectedStylist.image} className="w-5 h-5 rounded-full object-cover" />}
                                        <span className="text-sm text-white">{selectedStylist?.name ?? 'Cualquiera'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 text-sm text-right">
                                <span className="text-muted">{clientName}</span>
                                <span className="text-muted">{clientPhone}</span>
                            </div>
                        </div>

                        {bookingResult && !bookingResult.success && (
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 mb-6 flex items-center gap-3">
                                <AlertTriangle size={20} />
                                <span>{bookingResult.error}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <button className="btn btn-secondary py-3" onClick={() => setStep(3)}>Atrás</button>
                            <button className="btn btn-primary py-3 shadow-glow" onClick={handleConfirm}>Confirmar</button>
                        </div>
                    </div>
                )}

                {/* ══ STEP 5: Success ══ */}
                {step === 5 && (
                    <div className="animate-scale-in text-center pt-2 sm:pt-4 flex flex-col items-center">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full animate-pulse-soft"></div>
                            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center relative z-10 shadow-[0_0_40px_rgba(34,197,94,0.4)] text-white">
                                <CheckCircle size={40} />
                            </div>
                        </div>

                        <h3 className="text-3xl font-black text-white mb-2 tracking-tighter uppercase italic">¡Cita Confirmada!</h3>
                        <p className="text-slate-400 mb-8 text-[10px] font-black uppercase tracking-[0.3em]">Reserva finalizada con éxito</p>

                        {/* Liquid Glass Unified Card */}
                        <div className="w-full max-w-sm liquid-glass p-8 border border-white/20 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] mb-8 flex flex-col items-center">
                            {/* Header Section: Date & Time */}
                            <div className="w-full flex justify-between items-center mb-10 pb-6 border-b border-white/10">
                                <div className="text-left">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Día</span>
                                    <p className="text-white font-bold text-lg leading-tight uppercase">
                                        {selectedDate ? format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'EEEE d MMM', { locale: es }) : '---'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Hora</span>
                                    <p className="text-accent font-black text-2xl leading-none tracking-tighter">
                                        {format12h(selectedTime)}
                                    </p>
                                </div>
                            </div>

                            {/* Service Section */}
                            <div className="w-full mb-10 text-center">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Servicio Reservado</h4>
                                <div className="bg-white/5 rounded-3xl p-4 border border-white/10 w-full text-left">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-black flex items-center justify-center border border-white/10 shrink-0">
                                            {selectedService?.image ? <img src={selectedService.image} className="w-full h-full object-cover rounded-2xl" alt="" /> : <Calendar size={18} className="text-accent" />}
                                        </div>
                                        <p className="font-black text-white text-sm leading-tight">
                                            {selectedService?.name}
                                            {selectedAddOns.length > 0 && (
                                                <span className="text-cyan-400"> + {selectedAddOns.map(id => services.find(s => s.id === id)?.name).filter(Boolean).join(' + ')}</span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 pl-1">
                                        <span className="text-[9px] font-black text-slate-400 bg-white/10 px-2 py-0.5 rounded-full uppercase tracking-widest">{totalDuration} MIN</span>
                                        <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-widest">${totalPrice}{selectedAddOns.length > 0 ? ' total' : ''}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Staff Section */}
                            <div className="w-full mb-10">
                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center">
                                            {selectedStylist?.image ? <img src={selectedStylist.image} className="w-full h-full object-cover" alt="" /> : <User size={20} className="text-slate-500" />}
                                        </div>
                                        <div className="text-left leading-tight">
                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Profesional</span>
                                            <span className="text-xs font-bold text-white uppercase truncate max-w-[120px] block">{selectedStylist?.name ?? 'Cualquiera'}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center border border-accent/20">
                                            <Shield size={14} className="text-accent" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions Grid */}
                            <div className="w-full grid grid-cols-2 gap-3 mb-4">
                                <a
                                    href={businessConfig?.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessConfig?.address || '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-col items-center justify-center py-4 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-slate-400 hover:text-white"
                                >
                                    <MapPin size={20} className="mb-2" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Ubicación</span>
                                </a>
                                <a
                                    href={`tel:${businessConfig?.phone?.replace(/\D/g, '') || ''}`}
                                    className="flex flex-col items-center justify-center py-4 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-slate-400 hover:text-white"
                                >
                                    <Phone size={20} className="mb-2" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Llamada</span>
                                </a>
                            </div>

                            {/* Add to Calendar Section */}
                            {selectedService && selectedTime && selectedDate && (() => {
                                const calEvent = {
                                    title: `Cita: ${selectedService.name} en ${businessConfig?.name || 'Local'}`,
                                    description: `Servicio: ${selectedService.name}\nDuración: ${selectedService.duration} min\nPrecio: $${selectedService.price}\nProfesional: ${selectedStylist?.name ?? 'Cualquiera'}\n\nReservado vía CitaLink`,
                                    location: businessConfig?.address || '',
                                    startDate: selectedDate,
                                    startTime: selectedTime,
                                    durationMinutes: selectedService.duration,
                                };
                                return (
                                    <div className="w-full mb-6">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-center mb-3">Añadir al Calendario</p>
                                        <a
                                            href={generateGoogleCalendarUrl(calEvent)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-3 w-full py-4 rounded-3xl bg-gradient-to-b from-blue-500/10 to-blue-600/5 border border-blue-500/20 hover:border-blue-400/40 hover:bg-blue-500/15 transition-all text-blue-400 hover:text-blue-300 group"
                                        >
                                            <CalendarPlus size={20} className="group-hover:scale-110 transition-transform" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Agregar a Google Calendar</span>
                                        </a>
                                    </div>

                                );
                            })()}

                            {/* Final Redirect Action Button inside card or just below? Inside looks more unified */}
                            <a
                                href="/"
                                className="w-full py-5 rounded-[2.5rem] bg-gradient-to-r from-accent to-blue-600 hover:scale-[1.02] active:scale-95 transition-all duration-300 text-slate-900 font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3"
                            >
                                <span>Finalizar Reserva</span>
                                <ChevronRight size={20} />
                            </a>
                        </div>

                        <p className="text-slate-600 text-[9px] font-black uppercase tracking-[0.2em] mb-8">Gracias por confiar en {businessConfig?.name || 'nosotros'}</p>
                    </div>
                )}

                {/* ══ STEP 11: Cancel Success ══ */}
                {
                    step === 11 && (
                        <div className="animate-fade-in text-center" style={{ padding: 'var(--space-xl)' }}>
                            <XCircle size={64} style={{ color: 'var(--color-danger)', margin: '0 auto var(--space-md)' }} />
                            <h3 className="text-xl font-bold" style={{ marginBottom: 'var(--space-sm)' }}>Cita Cancelada</h3>
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-lg)' }}>Tu cita ha sido cancelada exitosamente.</p>
                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={resetBooking}>Reservar Nueva Cita</button>
                        </div>
                    )
                }

                {/* ══ STEP 12: Update Success ══ */}
                {
                    step === 12 && (
                        <div className="animate-fade-in text-center" style={{ padding: 'var(--space-xl)' }}>
                            <RefreshCw size={64} style={{ color: 'var(--color-accent)', margin: '0 auto var(--space-md)' }} />
                            <h3 className="text-xl font-bold" style={{ marginBottom: 'var(--space-sm)' }}>¡Hora Actualizada!</h3>
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-lg)' }}>
                                Tu cita se cambió a las <strong>{format12h(selectedTime)}</strong>.
                            </p>
                            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={resetBooking}>Volver al Inicio</button>
                        </div>
                    )
                }
                {/* ══ STEP 15: Closed Today Info ══ */}
                {
                    step === 15 && (
                        <div className="animate-fade-in text-center" style={{ padding: 'var(--space-xl)' }}>
                            <AlertOctagon size={56} style={{ color: 'var(--color-danger)', margin: '0 auto var(--space-md)' }} />
                            <h3 className="text-xl font-bold" style={{ marginBottom: 'var(--space-sm)' }}>Hoy no abrimos</h3>
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-lg)' }}>
                                Hola, <strong>{clientName}</strong> 👋 — Hoy no estamos recibiendo citas, pero puedes agendar para los próximos días.
                            </p>
                            <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={() => setStep(2)}>
                                Agendar para otro día
                            </button>
                            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 'var(--space-sm)' }} onClick={() => setStep(1)}>← Volver</button>
                        </div>
                    )
                }
            </div >

            <ConfirmModal
                isOpen={isCancelConfirmOpen}
                title="Cancelar Cita"
                message="¿Estás seguro de que deseas cancelar tu cita? Esta acción liberará el espacio para otro cliente."
                confirmLabel="Sí, Cancelar"
                onConfirm={() => {
                    setIsCancelConfirmOpen(false);
                    if (activeAppt) handleClientCancel(activeAppt.id);
                }}
                onCancel={() => setIsCancelConfirmOpen(false)}
                danger
            />
        </div >
    );
}
