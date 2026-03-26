import { useState, useMemo } from 'react';
import { format, addDays, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, User, Phone, Scissors, Calendar, Clock, ChevronLeft, CheckCircle, AlertTriangle, Loader2, UserCheck } from 'lucide-react';
import { useAppointments } from '../lib/store/queries/useAppointments';
import { useServices } from '../lib/store/queries/useServices';
import { useStylists } from '../lib/store/queries/useStylists';
import { useStore, DAY_NAMES } from '../lib/store';
import { getSmartSlots, type Appointment as SlotAppointment, type BlockedInterval } from '../lib/smartSlots';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

type Step = 'datos' | 'servicio' | 'barbero' | 'fecha' | 'hora' | 'exito';

export default function AdminBookingModal({ isOpen, onClose }: Props) {
    const { addAppointment, appointments, isAdding } = useAppointments();
    const { services } = useServices();
    const { stylists } = useStylists();
    const { blockedSlots, blockedPhones, getScheduleForDate, businessConfig } = useStore();
    const bufferMinutes = businessConfig?.breakBetweenAppointments ? 10 : 0;

    // Form state
    const [step, setStep] = useState<Step>('datos');
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [selectedService, setSelectedService] = useState<typeof services[0] | null>(null);
    const [selectedStylist, setSelectedStylist] = useState<typeof stylists[0] | null | 'any'>('any');
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [lastCreated, setLastCreated] = useState<{ clientName: string; date: string; time: string } | null>(null);

    // Reset all state
    const reset = () => {
        setStep('datos');
        setClientName('');
        setClientPhone('');
        setSelectedService(null);
        setSelectedStylist('any');
        setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
        setSelectedTime(null);
        setFormError(null);
        setLastCreated(null);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    // Build available dates (60 days ahead — admin can book further than clients)
    const availableDates = useMemo(() => {
        const dates: { dateStr: string; label: string; dayName: string; isToday: boolean }[] = [];
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        for (let i = 0; i < 60; i++) {
            const d = addDays(new Date(), i);
            const dateStr = format(d, 'yyyy-MM-dd');
            const dayIdx = d.getDay();
            const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayIdx];
            dates.push({
                dateStr,
                label: i === 0 ? 'Hoy' : format(d, 'd MMM', { locale: es }),
                dayName: DAY_NAMES[dayKey],
                isToday: dateStr === todayStr,
            });
        }
        return dates;
    }, []);

    // Compute available time slots for selected date + service + stylist
    const availableSlots = useMemo(() => {
        if (!selectedService) return [];

        const todayLocal = format(new Date(), 'yyyy-MM-dd');
        const baseDate = selectedDate === todayLocal ? new Date() : new Date(selectedDate + 'T00:00:00');
        const dateSchedule = getScheduleForDate(selectedDate);

        if (!dateSchedule.open) return [];

        const blocked: BlockedInterval[] = blockedSlots
            .filter(b => b.date === selectedDate)
            .map(b => ({
                start: parse(b.startTime.slice(0, 5), 'HH:mm', baseDate),
                end: parse(b.endTime.slice(0, 5), 'HH:mm', baseDate),
            }));

        if (dateSchedule.breakStart && dateSchedule.breakEnd) {
            blocked.push({
                start: parse(dateSchedule.breakStart, 'HH:mm', baseDate),
                end: parse(dateSchedule.breakEnd, 'HH:mm', baseDate),
            });
        }

        const stylistsToCheck = selectedStylist === 'any' ? stylists : (selectedStylist ? [selectedStylist] : []);

        if (stylistsToCheck.length === 0) {
            // No stylists configured — use generic slot
            const appts: SlotAppointment[] = appointments
                .filter(a => a.date === selectedDate && a.status === 'confirmada')
                .map(a => {
                    const svc = services.find(s => s.id === a.serviceId);
                    const start = parse(a.time.slice(0, 5), 'HH:mm', baseDate);
                    const end = new Date(start.getTime() + (svc?.duration ?? 30) * 60000);
                    return { id: a.id, stylistId: '0', start, end };
                });
            return getSmartSlots(baseDate, selectedService.duration, dateSchedule.start, dateSchedule.end, appts, blocked, bufferMinutes);
        }

        const allSlots = new Set<string>();
        stylistsToCheck.forEach(stylist => {
            const stylistAppts: SlotAppointment[] = appointments
                .filter(a => a.date === selectedDate && a.status === 'confirmada' && String(a.stylistId) === String(stylist.id))
                .map(a => {
                    const svc = services.find(s => s.id === a.serviceId);
                    const start = parse(a.time.slice(0, 5), 'HH:mm', baseDate);
                    const end = new Date(start.getTime() + (svc?.duration ?? 30) * 60000);
                    return { id: a.id, stylistId: String(stylist.id), start, end };
                });
            const slots = getSmartSlots(baseDate, selectedService.duration, dateSchedule.start, dateSchedule.end, stylistAppts, blocked, bufferMinutes);
            slots.forEach(s => allSlots.add(s));
        });
        return Array.from(allSlots).sort();
    }, [selectedService, selectedDate, selectedStylist, stylists, appointments, services, blockedSlots, getScheduleForDate]);

    // Step: datos — client data validation
    const handleDatosNext = () => {
        const name = clientName.trim();
        const phone = clientPhone.replace(/\s+/g, '').trim();
        if (!name || name.length < 2) {
            setFormError('Ingresa un nombre válido.');
            return;
        }
        if (!phone || phone.length < 7) {
            setFormError('Ingresa un teléfono válido.');
            return;
        }
        if (blockedPhones.includes(phone)) {
            setFormError('Este número está bloqueado. No se puede crear la cita.');
            return;
        }
        setClientPhone(phone);
        setFormError(null);
        setStep('servicio');
    };

    // Step: confirm booking
    const handleConfirm = async () => {
        if (!selectedService || !selectedTime) return;

        let stylistId: number | null = null;
        if (selectedStylist !== 'any' && selectedStylist !== null) {
            stylistId = selectedStylist.id;
        } else if (stylists.length > 0) {
            // Auto-pick first available stylist for this slot
            stylistId = stylists[0].id;
        }

        try {
            await addAppointment({
                clientName: clientName.trim(),
                clientPhone: clientPhone.trim(),
                serviceId: selectedService.id,
                stylistId,
                date: selectedDate,
                time: selectedTime,
            });
            setLastCreated({ clientName: clientName.trim(), date: selectedDate, time: selectedTime });
            setStep('exito');
        } catch {
            // Error toast is handled by useAppointments
        }
    };

    // Format 12h time
    const fmt12h = (t: string) => {
        const [h, m] = t.split(':');
        let hh = parseInt(h);
        const ampm = hh >= 12 ? 'pm' : 'am';
        hh = hh % 12 || 12;
        return `${hh}:${m}${ampm}`;
    };

    const stepIndex: Record<Step, number> = { datos: 1, servicio: 2, barbero: 3, fecha: 4, hora: 5, exito: 6 };
    const totalSteps = 5;
    const progress = Math.min((stepIndex[step] - 1) / totalSteps, 1);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
            onClick={handleClose}
        >
            <div
                className="relative w-full max-w-lg bg-[#0f1420] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                style={{ maxHeight: '90vh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-accent/10 border border-accent/20">
                            <UserCheck size={20} className="text-accent" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Nueva Cita</h2>
                            <p className="text-xs text-slate-500">Registro rápido por el admin</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Progress bar */}
                {step !== 'exito' && (
                    <div className="px-6 pt-4 shrink-0">
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-accent to-cyan-400 rounded-full transition-all duration-500"
                                style={{ width: `${progress * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Datos</span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Confirmar</span>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

                    {/* ══ STEP: Datos ══ */}
                    {step === 'datos' && (
                        <div className="animate-fade-in space-y-5">
                            <div>
                                <p className="text-xs font-bold text-accent uppercase tracking-widest mb-4">Paso 1: Datos del Cliente</p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                                            Nombre Completo
                                        </label>
                                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20 transition-all">
                                            <User size={16} className="text-slate-500 shrink-0" />
                                            <input
                                                type="text"
                                                value={clientName}
                                                onChange={e => { setClientName(e.target.value); setFormError(null); }}
                                                placeholder="Ej: Juan Pérez"
                                                className="bg-transparent outline-none text-white placeholder:text-slate-600 text-sm w-full"
                                                onKeyDown={e => e.key === 'Enter' && handleDatosNext()}
                                                autoFocus
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                                            Teléfono / WhatsApp
                                        </label>
                                        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20 transition-all">
                                            <Phone size={16} className="text-slate-500 shrink-0" />
                                            <input
                                                type="tel"
                                                value={clientPhone}
                                                onChange={e => { setClientPhone(e.target.value); setFormError(null); }}
                                                placeholder="Ej: 5512345678"
                                                className="bg-transparent outline-none text-white placeholder:text-slate-600 text-sm w-full"
                                                onKeyDown={e => e.key === 'Enter' && handleDatosNext()}
                                            />
                                        </div>
                                    </div>

                                    {formError && (
                                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                            <AlertTriangle size={16} />
                                            <span>{formError}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={handleDatosNext}
                                disabled={!clientName || !clientPhone}
                                className="w-full py-3.5 bg-gradient-to-r from-accent to-cyan-500 text-white font-bold rounded-2xl hover:brightness-110 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-accent/20"
                            >
                                Continuar →
                            </button>
                        </div>
                    )}

                    {/* ══ STEP: Servicio ══ */}
                    {step === 'servicio' && (
                        <div className="animate-fade-in">
                            <p className="text-xs font-bold text-accent uppercase tracking-widest mb-4">Paso 2: Servicio</p>
                            <div className="space-y-2">
                                {services.map(svc => (
                                    <button
                                        key={svc.id}
                                        onClick={() => { setSelectedService(svc); setStep('barbero'); }}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${selectedService?.id === svc.id ? 'bg-accent/10 border-accent/30' : 'bg-white/[0.03] border-white/5 hover:border-accent/20 hover:bg-white/5'}`}
                                    >
                                        <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                                            <Scissors size={18} className="text-accent" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white text-sm">{svc.name}</p>
                                            <p className="text-xs text-slate-500">{svc.duration} min</p>
                                        </div>
                                        <span className="text-accent font-black text-sm shrink-0">${svc.price}</span>
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setStep('datos')} className="w-full mt-4 py-2.5 text-sm text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                                <ChevronLeft size={16} /> Regresar
                            </button>
                        </div>
                    )}

                    {/* ══ STEP: Barbero ══ */}
                    {step === 'barbero' && (
                        <div className="animate-fade-in">
                            <p className="text-xs font-bold text-accent uppercase tracking-widest mb-4">Paso 3: Barbero / Profesional</p>
                            <div className="space-y-2">
                                {/* Any option */}
                                <button
                                    onClick={() => { setSelectedStylist('any'); setStep('fecha'); }}
                                    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.03] hover:border-accent/20 hover:bg-white/5 transition-all text-left"
                                >
                                    <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                        <UserCheck size={18} className="text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-sm">Cualquier Profesional</p>
                                        <p className="text-xs text-slate-500">Primera disponibilidad</p>
                                    </div>
                                </button>
                                {stylists.map(st => (
                                    <button
                                        key={st.id}
                                        onClick={() => { setSelectedStylist(st); setStep('fecha'); }}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${selectedStylist !== 'any' && selectedStylist?.id === st.id ? 'bg-accent/10 border-accent/30' : 'bg-white/[0.03] border-white/5 hover:border-accent/20 hover:bg-white/5'}`}
                                    >
                                        {st.image ? (
                                            <img src={st.image} alt={st.name} className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white/10" />
                                        ) : (
                                            <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                                                <User size={18} className="text-accent" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white text-sm truncate">{st.name}</p>
                                            {st.role && <p className="text-xs text-slate-500 truncate">{st.role}</p>}
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setStep('servicio')} className="w-full mt-4 py-2.5 text-sm text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                                <ChevronLeft size={16} /> Regresar
                            </button>
                        </div>
                    )}

                    {/* ══ STEP: Fecha ══ */}
                    {step === 'fecha' && (
                        <div className="animate-fade-in">
                            <p className="text-xs font-bold text-accent uppercase tracking-widest mb-4">Paso 4: Fecha</p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {availableDates.slice(0, 28).map(d => {
                                    const daySchedule = getScheduleForDate(d.dateStr);
                                    const closed = !daySchedule.open;
                                    return (
                                        <button
                                            key={d.dateStr}
                                            disabled={closed}
                                            onClick={() => { setSelectedDate(d.dateStr); setSelectedTime(null); setStep('hora'); }}
                                            className={`flex flex-col items-center p-2.5 rounded-2xl border text-center transition-all duration-200 ${selectedDate === d.dateStr ? 'bg-accent border-accent/50 shadow-lg shadow-accent/20' : 'bg-white/[0.03] border-white/5 hover:border-accent/30'} ${closed ? 'opacity-30 cursor-not-allowed' : ''}`}
                                        >
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{d.dayName?.slice(0, 3)}</span>
                                            <span className="text-sm font-bold text-white mt-0.5">{d.label}</span>
                                            {d.isToday && <span className="text-[8px] text-cyan-300 font-black uppercase tracking-tighter">HOY</span>}
                                            {closed && <span className="text-[8px] text-red-400 font-black uppercase">Cerrado</span>}
                                        </button>
                                    );
                                })}
                            </div>
                            <button onClick={() => setStep('barbero')} className="w-full mt-4 py-2.5 text-sm text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                                <ChevronLeft size={16} /> Regresar
                            </button>
                        </div>
                    )}

                    {/* ══ STEP: Hora ══ */}
                    {step === 'hora' && (
                        <div className="animate-fade-in">
                            <p className="text-xs font-bold text-accent uppercase tracking-widest mb-1">Paso 5: Hora</p>
                            <p className="text-xs text-slate-500 mb-4">
                                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                {' — '}{selectedService?.name}
                            </p>

                            {availableSlots.length === 0 ? (
                                <div className="text-center py-10 text-slate-500">
                                    <Clock size={40} className="mx-auto mb-3 opacity-20" />
                                    <p className="text-sm font-medium">No hay horarios disponibles este día.</p>
                                    <p className="text-xs mt-1">Prueba con otra fecha.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {availableSlots.map(slot => (
                                        <button
                                            key={slot}
                                            onClick={() => { setSelectedTime(slot); setStep('hora'); }}
                                            className={`py-2.5 rounded-2xl border text-sm font-bold transition-all duration-200 ${selectedTime === slot ? 'bg-accent border-accent/50 text-white shadow-lg shadow-accent/20' : 'bg-white/[0.03] border-white/5 text-slate-300 hover:border-accent/30 hover:text-white'}`}
                                        >
                                            {fmt12h(slot)}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {selectedTime && (
                                <div className="mt-6 space-y-3">
                                    {/* Summary card */}
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Resumen</p>
                                        <div className="flex items-center gap-2 text-sm text-white">
                                            <User size={14} className="text-accent shrink-0" />
                                            <span className="font-bold">{clientName}</span>
                                            <span className="text-slate-500 text-xs ml-auto">{clientPhone}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-white">
                                            <Scissors size={14} className="text-accent shrink-0" />
                                            <span>{selectedService?.name}</span>
                                            <span className="text-accent font-bold ml-auto">${selectedService?.price}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-white">
                                            <Calendar size={14} className="text-accent shrink-0" />
                                            <span>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                            <span className="font-bold ml-auto">{fmt12h(selectedTime)}</span>
                                        </div>
                                        {selectedStylist !== 'any' && selectedStylist && (
                                            <div className="flex items-center gap-2 text-sm text-white">
                                                <UserCheck size={14} className="text-accent shrink-0" />
                                                <span>{selectedStylist.name}</span>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleConfirm}
                                        disabled={isAdding}
                                        className="w-full py-3.5 bg-gradient-to-r from-accent to-cyan-500 text-white font-bold rounded-2xl hover:brightness-110 transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                                    >
                                        {isAdding ? (
                                            <><Loader2 size={18} className="animate-spin" /> Guardando...</>
                                        ) : (
                                            '✓ Confirmar Cita'
                                        )}
                                    </button>
                                </div>
                            )}

                            <button onClick={() => setStep('fecha')} className="w-full mt-4 py-2.5 text-sm text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-2">
                                <ChevronLeft size={16} /> Regresar
                            </button>
                        </div>
                    )}

                    {/* ══ STEP: Éxito ══ */}
                    {step === 'exito' && lastCreated && (
                        <div className="animate-fade-in text-center py-4">
                            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
                                <CheckCircle size={40} className="text-emerald-400" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">¡Cita Registrada!</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Cita para <strong className="text-white">{lastCreated.clientName}</strong> el{' '}
                                <strong className="text-white">
                                    {new Date(lastCreated.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </strong>{' '}
                                a las <strong className="text-accent">{fmt12h(lastCreated.time)}</strong>.
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={reset}
                                    className="w-full py-3.5 bg-gradient-to-r from-accent to-cyan-500 text-white font-bold rounded-2xl hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-accent/20"
                                >
                                    + Registrar Otra Cita
                                </button>
                                <button
                                    onClick={handleClose}
                                    className="w-full py-3 text-sm text-slate-500 hover:text-white transition-colors"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
