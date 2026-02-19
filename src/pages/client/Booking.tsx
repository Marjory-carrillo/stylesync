import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { parse, format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useStore, DAY_NAMES, type Announcement, type Service, type Stylist } from '../../lib/store';
import SplashScreen from '../../components/SplashScreen';
import { getSmartSlots, type Appointment as SlotAppointment, type BlockedInterval } from '../../lib/smartSlots';
import { CheckCircle, AlertTriangle, Calendar, Clock, MapPin, XCircle, RefreshCw, Info, AlertOctagon, Phone, Shield } from 'lucide-react';

export default function Booking() {
    const { slug } = useParams();
    const {
        services, stylists, appointments,
        addAppointment, cancelAppointment, updateAppointmentTime,
        isPhoneBlocked, hasActiveAppointment, getActiveAppointmentByPhone,
        getServiceById,
        businessConfig, getTodaySchedule, getActiveAnnouncements, getScheduleForDate,
        addToWaitingList, blockedSlots, loadTenantBySlug, tenantId, loading, showToast
    } = useStore();

    useEffect(() => {
        if (slug && !tenantId) {
            loadTenantBySlug(slug);
        }
    }, [slug, tenantId, loadTenantBySlug]);

    if (loading) {
        return <SplashScreen />;
    }

    const todaySchedule = getTodaySchedule();
    const activeAnnouncements = getActiveAnnouncements();
    const hasClosedAnnouncement = activeAnnouncements.some((a: Announcement) => a.type === 'closed');

    // Terminology Adapter
    const category = businessConfig.category || 'barbershop';

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
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [bookingResult, setBookingResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updatingAppointmentId, setUpdatingAppointmentId] = useState<string | null>(null);
    // const [cancelError, setCancelError] = useState<string | null>(null);

    // Generate next 5 days
    const availableDates = useMemo(() => {
        const dates: { dateStr: string; label: string; dayName: string; isToday: boolean }[] = [];
        for (let i = 0; i < 5; i++) {
            const d = addDays(new Date(), i);
            const dateStr = format(d, 'yyyy-MM-dd');
            const dayIdx = d.getDay();
            const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayIdx];
            dates.push({
                dateStr,
                label: format(d, 'd MMM', { locale: es }),
                dayName: DAY_NAMES[dayKey],
                isToday: i === 0,
            });
        }
        return dates;
    }, []);

    // Get schedule for selected date
    const selectedDateSchedule = useMemo(() => getScheduleForDate(selectedDate), [selectedDate, getScheduleForDate]);

    // Appointments for selected date
    const dateAppointments: SlotAppointment[] = useMemo(() => {
        return appointments
            .filter(a => a.date === selectedDate && a.status === 'confirmada' && (!selectedStylist || a.stylistId === selectedStylist.id))
            .map(a => {
                const svc = services.find(s => s.id === a.serviceId);
                const start = parse(a.time, 'HH:mm', new Date());
                const end = new Date(start.getTime() + (svc?.duration ?? 30) * 60000);
                return { id: a.id, stylistId: String(a.stylistId ?? '0'), start, end };
            });
    }, [appointments, selectedDate, selectedStylist, services]);

    // ── Multi-Stylist Logic: Availability Map ──
    // Maps each time slot to a list of available stylist IDs. 
    // This allows us to assign a specific stylist even when "Any" is selected.
    const slotsMetadata = useMemo(() => {
        const metadata: Record<string, string[]> = {};
        if (!selectedService || !selectedDateSchedule.open) return metadata;

        const baseDate = selectedDate === new Date().toISOString().split('T')[0]
            ? new Date()
            : new Date(selectedDate + 'T00:00:00');

        const relevantBlockedSlots: BlockedInterval[] = blockedSlots
            .filter(b => b.date === selectedDate)
            .map(b => ({
                start: parse(b.startTime, 'HH:mm', baseDate),
                end: parse(b.endTime, 'HH:mm', baseDate)
            }));

        // Add Lunch Break if configured
        if (selectedDateSchedule.breakStart && selectedDateSchedule.breakEnd) {
            relevantBlockedSlots.push({
                start: parse(selectedDateSchedule.breakStart, 'HH:mm', baseDate),
                end: parse(selectedDateSchedule.breakEnd, 'HH:mm', baseDate)
            });
        }

        const stylistsToCheck = selectedStylist ? [selectedStylist] : stylists;
        // Fallback: if no stylists exist (MVP), treat as generic resource with ID '0'
        if (stylistsToCheck.length === 0) {
            const slots = getSmartSlots(baseDate, selectedService.duration, selectedDateSchedule.start, selectedDateSchedule.end, dateAppointments, relevantBlockedSlots, 10);
            slots.forEach(slot => {
                metadata[slot] = ['0'];
            });
            return metadata;
        }

        stylistsToCheck.forEach(stylist => {
            const stylistApps = appointments
                .filter(a => a.date === selectedDate && a.status === 'confirmada' && String(a.stylistId) === String(stylist.id))
                .map(a => {
                    const svc = services.find(s => s.id === a.serviceId);
                    const start = parse(a.time, 'HH:mm', new Date());
                    const end = new Date(start.getTime() + (svc?.duration ?? 30) * 60000);
                    return { id: a.id, stylistId: String(a.stylistId), start, end };
                });

            const slots = getSmartSlots(baseDate, selectedService.duration, selectedDateSchedule.start, selectedDateSchedule.end, stylistApps, relevantBlockedSlots, 10);

            slots.forEach(slot => {
                if (!metadata[slot]) metadata[slot] = [];
                metadata[slot].push(String(stylist.id));
            });
        });

        return metadata;
    }, [selectedService, selectedDate, selectedDateSchedule, blockedSlots, selectedStylist, stylists, appointments, services, dateAppointments]);

    const availableSlots = useMemo(() => {
        return Object.keys(slotsMetadata).sort();
    }, [slotsMetadata]);

    const [otpCode, setOtpCode] = useState('');
    const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
    const [otpAttempts, setOtpAttempts] = useState(0);

    // ── Step 1: Validate & Init OTP ───
    const handleClientSubmit = () => {
        if (!clientName.trim() || !clientPhone.trim()) {
            setClientError('Por favor completa tu nombre y teléfono.');
            return;
        }
        if (clientPhone.trim().length < 7) {
            setClientError('Ingresa un número de teléfono válido.');
            return;
        }
        if (isPhoneBlocked(clientPhone.trim())) {
            setClientError('Este número ha sido bloqueado. Contacta al establecimiento para más información.');
            return;
        }
        setClientError(null);

        if (hasActiveAppointment(clientPhone.trim())) {
            setStep(10);
            return;
        }

        // If today is closed, show info screen but still allow booking for future?
        // Actually step 15 was used for "Closed". Let's use 16 for OTP.

        // Generate OTP
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        setGeneratedOtp(code);
        setOtpAttempts(0);
        setOtpCode('');

        // Simulate SMS (MVP)
        console.log(`[SMS MOCK] Código para ${clientPhone}: ${code} `);
        showToast(`[SIMULACIÓN SMS] Código: ${code}`, 'info');

        setStep(16); // Go to OTP verification
    };

    const verifyOtp = () => {
        if (otpCode === generatedOtp) {
            // Success
            if (isClosed) {
                setStep(15); // Closed info
            } else {
                setStep(2); // Service select
            }
        } else {
            const newAttempts = otpAttempts + 1;
            setOtpAttempts(newAttempts);
            if (newAttempts >= 3) {
                setClientError('Has excedido el número de intentos. Intenta más tarde.');
                setStep(1);
            } else {
                setClientError(`Código incorrecto.Intentos restantes: ${3 - newAttempts} `);
            }
        }
    };

    const resendOtp = () => {
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        setGeneratedOtp(code);
        setOtpAttempts(0);
        console.log(`[SMS MOCK] Reenvío para ${clientPhone}: ${code} `);
        showToast(`[SIMULACIÓN SMS] Nuevo código: ${code}`, 'info');
    };

    // ── Manage existing ───
    const handleClientCancel = async (appointmentId: string) => {
        const result = await cancelAppointment(appointmentId, true);
        if (result.success) { setStep(11); }
        else { console.error(result.error ?? 'Error al cancelar.'); }
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
            await updateAppointmentTime(updatingAppointmentId, time);
            setSelectedTime(time);
            setStep(12);
        }
    };

    // ── Normal flow ───
    const handleSelectService = (service: typeof services[0]) => {
        setSelectedService(service);
        setStep(22); // Go to stylist selection
    };

    const handleSelectStylist = (stylist: typeof stylists[0] | null) => {
        setSelectedStylist(stylist);
        setStep(25); // Go to date picker
    };

    const handleSelectDate = (dateStr: string) => {
        setSelectedDate(dateStr);
        setStep(3); // Go to time selection
    };

    const handleSelectTime = (time: string) => {
        if (isUpdating) { handleUpdateTime(time); return; }
        setSelectedTime(time);
        setStep(4);
    };

    const handleConfirm = async () => {
        if (!selectedService || !selectedTime || !clientName || !clientPhone) return;

        // Smart Assignment: Pick the first available stylist for this slot
        const availableStylists = slotsMetadata[selectedTime] || [];
        const assignedStylistId = selectedStylist ? selectedStylist.id : (availableStylists[0] ?? null);

        const result = await addAppointment({
            clientName: clientName.trim(),
            clientPhone: clientPhone.trim(),
            serviceId: selectedService.id,
            stylistId: assignedStylistId ? Number(assignedStylistId) : null,
            date: selectedDate,
            time: selectedTime,
        });
        setBookingResult(result);
        if (result.success) setStep(5);
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


    const isClosed = !todaySchedule.open || hasClosedAnnouncement;

    // const stepLabels = ['Datos', 'Servicio', 'Fecha', 'Hora', 'Confirmar']; // Removed unused

    const stepMap: Record<number, number> = { 1: 1, 2: 2, 22: 2, 25: 3, 3: 4, 4: 5 };
    const currentProgress = stepMap[step] ?? 0;

    const annColors: Record<string, { bg: string; color: string; icon: typeof Info }> = {
        info: { bg: 'hsla(210, 80%, 55%, 0.12)', color: 'hsl(210, 80%, 55%)', icon: Info },
        warning: { bg: 'hsla(40, 90%, 50%, 0.12)', color: 'hsl(40, 90%, 50%)', icon: AlertTriangle },
        closed: { bg: 'hsla(0, 70%, 50%, 0.12)', color: 'var(--color-danger)', icon: AlertOctagon },
    };

    return (
        <div className="container animate-fade-in" style={{ maxWidth: '600px', paddingTop: 'var(--space-xl)' }}>
            {step !== 5 && (
                <div className="text-center" style={{ marginBottom: 'var(--space-lg)' }}>
                    {businessConfig.logoUrl && (
                        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/5 p-1 border border-white/10 shadow-2xl relative group">
                            <div className="absolute inset-0 rounded-full bg-accent/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            <img src={businessConfig.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-full relative z-10 bg-slate-900" />
                        </div>
                    )}
                    <h2 className="text-2xl font-bold text-center">
                        {step === 10 ? 'Tu Cita' : (businessConfig.logoUrl ? businessConfig.name : `Reserva tu Cita en ${businessConfig.name} `)}
                    </h2>
                </div>
            )}

            {/* Step Titles for internal steps */}
            {step === 2 && <h2 className="text-2xl font-bold text-center mb-6">Elige un Servicio</h2>}
            {step === 22 && <h2 className="text-2xl font-bold text-center mb-6">Elige tu {professionalLabel}</h2>}
            {step === 25 && <h2 className="text-2xl font-bold text-center mb-6">Selecciona Fecha</h2>}
            {step === 3 && <h2 className="text-2xl font-bold text-center mb-6">Selecciona Hora</h2>}
            {step === 4 && <h2 className="text-2xl font-bold text-center mb-6">Confirma tu Reserva</h2>}

            {/* ── Announcements ── */}
            {activeAnnouncements.length > 0 && step !== 5 && (
                <div className="flex flex-col gap-sm" style={{ marginBottom: 'var(--space-lg)' }}>
                    {activeAnnouncements.map((ann: Announcement) => {
                        const ac = annColors[ann.type]; const AnnIcon = ac.icon;
                        return (
                            <div key={ann.id} className="flex items-center gap-sm" style={{
                                padding: 'var(--space-sm) var(--space-md)', borderRadius: 'var(--radius-md)',
                                background: ac.bg, border: `1px solid ${ac.color} 33`,
                            }}>
                                <AnnIcon size={18} style={{ color: ac.color, flexShrink: 0 }} />
                                <span style={{ color: ac.color, fontWeight: 600, fontSize: '0.9rem' }}>{ann.message}</span>
                            </div>
                        );
                    })}
                </div>
            )}



            {/* Progress Bar (Segmented & Clean) */}
            {step >= 1 && step <= 25 && step !== 5 && (
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <div className="flex gap-1 h-1 mb-2">
                        {[1, 2, 3, 4, 5].map(s => (
                            <div key={s} className="flex-1 rounded-full transition-all duration-500"
                                style={{
                                    background: currentProgress >= s ? 'var(--color-accent)' : 'var(--color-border)',
                                    opacity: currentProgress >= s ? 1 : 0.3
                                }}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between text-xs font-medium text-muted uppercase tracking-wider">
                        <span>Datos</span>
                        <span>Confirmar</span>
                    </div>
                </div>
            )}

            <div className="card">

                {/* ══ STEP 1: Client Data ══ */}
                {step === 1 && (
                    <div className="animate-fade-in max-w-md mx-auto">
                        <div className="text-center mb-8">
                            <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-white mb-2">
                                ¡Bienvenido!
                            </h3>
                            <p className="text-muted">
                                Ingresa tus datos para comenzar.
                            </p>
                        </div>

                        <div className="glass-panel p-6 rounded-2xl space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1 ml-1">Nombre</label>
                                <input
                                    type="text"
                                    value={clientName}
                                    onChange={e => { setClientName(e.target.value); setClientError(null); }}
                                    placeholder="Ej: Ana García"
                                    className="w-full glass-card bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-accent focus:ring-1 focus:ring-accent transition-all outline-none"
                                    onKeyDown={e => e.key === 'Enter' && handleClientSubmit()}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1 ml-1">Teléfono</label>
                                <input
                                    type="tel"
                                    value={clientPhone}
                                    onChange={e => { setClientPhone(e.target.value); setClientError(null); }}
                                    placeholder="Ej: 55 1234 5678"
                                    className="w-full glass-card bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-accent focus:ring-1 focus:ring-accent transition-all outline-none"
                                    onKeyDown={e => e.key === 'Enter' && handleClientSubmit()}
                                />
                            </div>

                            {clientError && (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm animate-pulse-soft">
                                    <AlertTriangle size={18} /><span>{clientError}</span>
                                </div>
                            )}

                            <button className="btn btn-primary w-full py-4 text-lg shadow-glow mt-2" onClick={handleClientSubmit}>
                                Continuar
                            </button>
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
                                    <span className="text-sm text-muted">{businessConfig.address}</span>
                                </div>
                            </div>
                        </div>

                        {/* Action prompt */}
                        <div className="space-y-3">
                            <button className="btn btn-primary w-full py-4 text-lg" onClick={() => handleStartUpdate(activeAppt.id, activeAppt.serviceId)}>
                                <RefreshCw size={20} /> Reprogramar Cita
                            </button>

                            <button className="btn btn-ghost w-full py-4 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20" onClick={() => { if (confirm('¿Estás seguro de cancelar tu cita?')) handleClientCancel(activeAppt.id); }}>
                                <XCircle size={20} /> Cancelar Cita
                            </button>
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
                        <p className="text-muted mb-6">
                            Hemos enviado un código a <strong>{clientPhone}</strong>. Ingrésalo para continuar.
                        </p>

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
                                className="btn btn-primary w-full py-4 text-lg shadow-glow"
                                onClick={verifyOtp}
                                disabled={otpCode.length !== 4}
                            >
                                Verificar
                            </button>

                            <button className="btn btn-ghost text-sm w-full text-muted hover:text-white" onClick={resendOtp}>
                                ¿No recibiste el código? Reenviar
                            </button>
                        </div>
                        <button className="btn btn-ghost w-full mt-4 text-sm" onClick={() => setStep(1)}>← Cambiar número</button>
                    </div>
                )}

                {/* ══ STEP 2: Service ══ */}
                {step === 2 && (
                    <div className="animate-slide-up">
                        <div className="mb-6 text-center">
                            <p className="text-sm text-accent font-medium mb-1">Paso 1 de 4</p>
                            <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                ¿Qué te gustaría hacerte hoy?
                            </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {services.map((service: Service) => (
                                <button
                                    key={service.id}
                                    className="glass-card group text-left relative overflow-hidden rounded-xl border border-white/5 hover:border-accent/40 transition-all duration-300"
                                    onClick={() => handleSelectService(service)}
                                >
                                    {/* Image aspect ratio container */}
                                    <div className="relative w-full pb-[75%] bg-slate-800">
                                        {service.image ? (
                                            <img
                                                src={service.image}
                                                alt={service.name}
                                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-muted/20">
                                                <RefreshCw size={32} />
                                            </div>
                                        )}
                                        {/* Price Tag */}
                                        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded-lg border border-white/10">
                                            ${service.price}
                                        </div>
                                    </div>

                                    <div className="p-3">
                                        <h4 className="font-bold text-sm text-white group-hover:text-accent transition-colors mb-1">{service.name}</h4>
                                        <div className="flex items-center gap-1 text-xs text-muted">
                                            <Clock size={12} />
                                            <span>{service.duration} min</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <button className="btn btn-ghost w-full mt-4 text-sm" onClick={() => setStep(1)}>← Cambiar mis datos</button>
                    </div>
                )}

                {/* ══ STEP 22: Stylist Selection ══ */}
                {step === 22 && (
                    <div className="animate-slide-up">
                        <div className="mb-6 text-center">
                            <p className="text-sm text-accent font-medium mb-1">Paso 2 de 4</p>
                            <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                ¿Prefieres a alguien en especial?
                            </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* "Any" Option */}
                            <button
                                className="glass-card group flex flex-col items-center justify-center p-6 rounded-xl border border-white/5 hover:border-accent/40 transition-all duration-300"
                                onClick={() => handleSelectStylist(null)}
                            >
                                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <RefreshCw size={24} className="text-accent" />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-lg">Cualquier {professionalLabel}</h3>
                                    <p className="text-muted-foreground text-sm">El primer disponible</p>
                                </div>
                            </button>

                            {/* Stylists List */}
                            {stylists.map((stylist: Stylist) => (
                                <button
                                    key={stylist.id}
                                    className="glass-card group flex flex-col items-center justify-center p-6 rounded-xl border border-white/5 hover:border-accent/40 transition-all duration-300"
                                    onClick={() => handleSelectStylist(stylist)}
                                >
                                    <div className="w-16 h-16 rounded-full bg-slate-700 mb-3 overflow-hidden group-hover:scale-110 transition-transform border border-white/10">
                                        {stylist.image ? (
                                            <img src={stylist.image} alt={stylist.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted">User</div>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-white text-center">{stylist.name}</h4>
                                </button>
                            ))}
                        </div>
                        <button className="btn btn-ghost w-full mt-4 text-sm" onClick={() => setStep(2)}>← Elegir otro servicio</button>
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
                                        className={`btn ${closed ? 'btn-ghost' : 'btn-secondary'} `}
                                        onClick={() => !closed && handleSelectDate(d.dateStr)}
                                        disabled={closed}
                                        style={{
                                            flexDirection: 'column', padding: '12px 8px', textAlign: 'center',
                                            opacity: closed ? 0.4 : 1, cursor: closed ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        <span className="font-bold" style={{ fontSize: '0.95rem' }}>{d.label}</span>
                                        <span className="text-sm" style={{ fontSize: '0.75rem', color: closed ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                                            {closed ? 'Cerrado' : d.dayName}
                                        </span>
                                        {d.isToday && <span style={{ fontSize: '0.65rem', color: 'var(--color-accent)', fontWeight: 700 }}>HOY</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 'var(--space-md)' }} onClick={() => { setIsUpdating(false); setStep(isUpdating ? 10 : 2); }}>← Atrás</button>
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
                                {format(new Date(selectedDate), 'EEEE d MMMM', { locale: es })}
                            </div>
                        </div>

                        {availableSlots.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {availableSlots.map((time, idx) => (
                                    <button
                                        key={time}
                                        className="btn btn-secondary py-3 text-sm hover:border-accent hover:text-accent transition-all animate-scale-in"
                                        style={{ animationDelay: `${idx * 0.05} s` }}
                                        onClick={() => handleSelectTime(time)}
                                    >
                                        {time}
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
                                    Parece que el día está completo para este servicio.
                                </p>

                                <button
                                    className="btn btn-primary w-full py-3 mb-3"
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
                                    ⏳ Avísame si se libera un lugar
                                </button>
                                <button className="btn btn-ghost text-sm w-full" onClick={() => setStep(25)}>
                                    Ver otra fecha
                                </button>
                            </div>
                        )}

                        {availableSlots.length > 0 && (
                            <button className="btn btn-ghost w-full mt-6" onClick={() => setStep(25)}>← Elegir otra fecha</button>
                        )}
                    </div>
                )}

                {/* ══ STEP 26: Waiting List Success ══ */}
                {step === 26 && (
                    <div className="animate-fade-in" style={{ textAlign: 'center' }}>
                        <div style={{ margin: '0 auto var(--space-lg)', width: '80px', height: '80px', borderRadius: '50%', background: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 10px 25px -5px var(--color-success)' }}>
                            <CheckCircle size={40} />
                        </div>
                        <h3 className="text-2xl font-bold" style={{ marginBottom: 'var(--space-md)' }}>¡Estás en la lista!</h3>
                        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-xl)', lineHeight: 1.6 }}>
                            Te avisaremos por <strong>WhatsApp</strong> si se libera un espacio para tu fecha deseada.
                        </p>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setStep(1); setClientName(''); setClientPhone(''); }}>
                            Volver al Inicio
                        </button>
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
                                <div>
                                    <h4 className="text-lg font-bold text-white">{selectedService.name}</h4>
                                    <p className="text-sm text-muted mb-2">{selectedService.duration} min</p>
                                    <div className="inline-block px-2 py-1 bg-accent/20 text-accent rounded text-xs font-bold border border-accent/20">
                                        ${selectedService.price}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 py-4 border-t border-white/10 border-b border-white/10 mb-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted">Fecha</span>
                                    <span className="font-medium text-white">{format(new Date(selectedDate), 'EEEE d MMMM', { locale: es })}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted">Hora</span>
                                    <span className="font-bold text-accent text-lg">{selectedTime}</span>
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
                    <div className="animate-scale-in text-center pt-8">
                        <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-glow text-white animate-pulse-soft">
                            <CheckCircle size={48} />
                        </div>

                        <h3 className="text-3xl font-bold text-white mb-2">¡Reserva Exitosa!</h3>
                        <p className="text-muted mb-8 text-lg">
                            Te esperamos el <span className="text-white font-medium">{selectedDate}</span> a las <span className="text-accent font-bold">{selectedTime}</span>
                        </p>

                        {/* Stirst info if selected */}
                        <div className="glass-card p-4 mb-6 flex items-center gap-4 text-left mx-auto max-w-sm">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-700 shrink-0 border border-white/10">
                                {selectedStylist?.image ? <img src={selectedStylist.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center">✂️</div>}
                            </div>
                            <div>
                                <p className="text-xs text-muted uppercase tracking-wider">Tu {professionalLabel}</p>
                                <p className="font-bold text-white">{selectedStylist?.name ?? 'Cualquiera disponible'}</p>
                            </div>
                        </div>

                        {/* ══ Business Details Card ══ */}
                        <div className="glass-panel p-6 rounded-2xl mb-6 text-left border border-white/10">
                            <div className="flex items-start gap-3 mb-4">
                                <div className="p-2 bg-white/5 rounded-lg text-accent">
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <span className="font-bold text-sm block text-white">Ubicación</span>
                                    <p className="text-sm text-muted mt-1">{businessConfig.address}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 mb-6">
                                <div className="p-2 bg-white/5 rounded-lg text-accent">
                                    <Phone size={20} />
                                </div>
                                <div>
                                    <span className="font-bold text-sm block text-white">Teléfono</span>
                                    <p className="text-sm text-muted mt-1">{businessConfig.phone}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <a
                                    href={businessConfig.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessConfig.address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary w-full justify-center group"
                                >
                                    <MapPin size={18} className="group-hover:text-accent transition-colors" />
                                    <span>Abrir en Google Maps</span>
                                </a >
                                {
                                    businessConfig.phone && (
                                        <a
                                            href={`tel:${businessConfig.phone.replace(/\D/g, '')}`}
                                            className="btn btn-ghost w-full justify-center border border-white/10 hover:border-white/20"
                                        >
                                            <Phone size={18} /> Llamar al Negocio
                                        </a>
                                    )
                                }
                            </div >
                        </div >

                        <button className="btn btn-primary w-full py-4 shadow-lg" onClick={resetBooking}>
                            Hacer otra reserva
                        </button>
                    </div >
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
                                Tu cita se cambió a las <strong>{selectedTime}</strong>.
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
        </div >
    );
}
