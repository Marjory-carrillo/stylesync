import { useState, useMemo, useEffect } from 'react';
import { format, addDays, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, User, Phone, Sparkles, Calendar, Clock, CheckCircle, Loader2, UserCheck, Image as ImageIcon } from 'lucide-react';
import { useAppointments } from '../lib/store/queries/useAppointments';
import { useServices } from '../lib/store/queries/useServices';
import { useStylists } from '../lib/store/queries/useStylists';
import { useBlockedSlots } from '../lib/store/queries/useBlockedSlots';
import { useSchedule } from '../lib/store/queries/useSchedule';
import { useTenantData } from '../lib/store/queries/useTenantData';
import { markQuoteAsBooked } from '../lib/store/queries/useQuotes';
import { getSmartSlots, calculateAppointmentDuration, type Appointment as SlotAppointment, type BlockedInterval } from '../lib/smartSlots';
import { useUIStore } from '../lib/store/uiStore';
import { normalizePhone } from '../lib/schemas';
import { sendManualBookingClientNotification } from '../lib/whatsappService';
import type { Quote } from '../lib/types/store.types';

export const DAY_NAMES: Record<string, string> = {
    monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
    thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
};

interface Props {
    quote: Quote | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function QuoteDirectBookingModal({ quote, isOpen, onClose, onSuccess }: Props) {
    const { showToast } = useUIStore();
    const { addAppointment, appointments, isAdding } = useAppointments();
    const { services } = useServices();
    const { stylists } = useStylists();
    const { blockedSlots } = useBlockedSlots();
    const { schedule } = useSchedule();
    const { data: businessConfig } = useTenantData();

    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [selectedStylistId, setSelectedStylistId] = useState<string>('any');
    const [formError, setFormError] = useState<string | null>(null);
    const [isBookedSuccess, setIsBookedSuccess] = useState(false);

    // Sincronizar datos al abrir con la cotización
    useEffect(() => {
        if (quote) {
            setClientName(quote.clientName || '');
            setClientPhone(quote.clientPhone || '');
            setSelectedStylistId(quote.stylistId ? String(quote.stylistId) : 'any');
            setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
            setSelectedTime(null);
            setFormError(null);
            setIsBookedSuccess(false);
        }
    }, [quote, isOpen]);

    const matchedService = useMemo(() => {
        if (!quote?.serviceId) return services[0] || null;
        return services.find(s => Number(s.id) === Number(quote.serviceId)) || services[0] || null;
    }, [quote, services]);

    // Especialista fijado por la cotización o seleccionado
    const assignedStylist = useMemo(() => {
        if (quote?.stylistId) {
            return stylists.find(s => Number(s.id) === Number(quote.stylistId)) || null;
        }
        if (selectedStylistId === 'any') return null;
        return stylists.find(s => String(s.id) === selectedStylistId) || null;
    }, [quote, selectedStylistId, stylists]);

    const totalDuration = quote?.totalDuration || matchedService?.duration || 60;
    const totalPrice = quote?.totalPrice ?? matchedService?.price ?? 0;

    // Obtener horario del día
    const getScheduleForDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getDay()];
        return schedule[dayKey];
    };

    // Generar fechas disponibles (próximos 45 días)
    const availableDates = useMemo(() => {
        const dates: { dateStr: string; label: string; dayName: string; isToday: boolean }[] = [];
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        for (let i = 0; i < 45; i++) {
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

    // Horarios disponibles para la duración fija de la cotización y el especialista correspondiente
    const availableSlots = useMemo(() => {
        if (!selectedDate) return [];

        const todayLocal = format(new Date(), 'yyyy-MM-dd');
        const baseDate = selectedDate === todayLocal ? new Date() : new Date(selectedDate + 'T00:00:00');
        const dateSchedule = getScheduleForDate(selectedDate);

        if (!dateSchedule || !dateSchedule.open) return [];

        const targetStylist = assignedStylist;

        const blocked: BlockedInterval[] = blockedSlots
            .filter(b => {
                if (b.date !== selectedDate) return false;
                if (b.staffId && targetStylist && String(b.staffId) !== String(targetStylist.id)) return false;
                return true;
            })
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

        const bufferMinutes = businessConfig?.breakBetweenAppointments ?? 0;
        const stylistsToCheck = targetStylist ? [targetStylist] : (selectedStylistId === 'any' ? stylists : []);

        if (stylistsToCheck.length === 0) {
            const appts: SlotAppointment[] = appointments
                .filter(a => a.date === selectedDate && a.status === 'confirmada')
                .map(a => {
                    const dur = calculateAppointmentDuration(a, services, null);
                    const start = parse(a.time.slice(0, 5), 'HH:mm', baseDate);
                    const end = new Date(start.getTime() + dur * 60000);
                    return { id: a.id, stylistId: '0', start, end };
                });
            return getSmartSlots(baseDate, totalDuration, dateSchedule.start, dateSchedule.end, appts, blocked, bufferMinutes);
        }

        const allSlots = new Set<string>();
        stylistsToCheck.forEach(stylist => {
            const stylistAppts: SlotAppointment[] = appointments
                .filter(a => a.date === selectedDate && a.status === 'confirmada' && String(a.stylistId) === String(stylist.id))
                .map(a => {
                    const dur = calculateAppointmentDuration(a, services, null);
                    const start = parse(a.time.slice(0, 5), 'HH:mm', baseDate);
                    const end = new Date(start.getTime() + dur * 60000);
                    return { id: a.id, stylistId: String(stylist.id), start, end };
                });
            const slots = getSmartSlots(baseDate, totalDuration, dateSchedule.start, dateSchedule.end, stylistAppts, blocked, bufferMinutes);
            slots.forEach(s => allSlots.add(s));
        });

        return Array.from(allSlots).sort();
    }, [selectedDate, assignedStylist, selectedStylistId, stylists, blockedSlots, schedule, appointments, services, totalDuration, businessConfig]);

    const handleConfirm = async () => {
        if (!quote) return;
        if (!clientName.trim()) {
            setFormError('Por favor ingresa el nombre de la clienta.');
            return;
        }
        const cleanPhone = normalizePhone(clientPhone);
        if (cleanPhone.length < 10) {
            setFormError('Ingresa un teléfono válido a 10 dígitos.');
            return;
        }
        if (!selectedDate || !selectedTime) {
            setFormError('Por favor selecciona una fecha y horario para la cita.');
            return;
        }

        try {
            setFormError(null);
            
            // Construir lista de tags adicionales
            const addOns: string[] = [];

            if (quote.referenceImageUrl) {
                addOns.push(`Referencia: ${quote.referenceImageUrl}`);
            }
            if (quote.sizeName) {
                addOns.push(`Largo: ${quote.sizeName}`);
            }
            if (quote.extras && quote.extras.length > 0) {
                quote.extras.forEach(ext => {
                    const durPart = (ext.duration && ext.duration > 0) ? `, +${ext.duration} min` : '';
                    const pricePart = (ext.price && ext.price > 0) ? `+$${ext.price} MXN` : 'Sin costo';
                    addOns.push(`Extra: ${ext.name} (${pricePart}${durPart})`);
                });
            }
            if (quote.styles && quote.styles.length > 0) {
                quote.styles.forEach(st => {
                    const durPart = (st.duration && st.duration > 0) ? `, +${st.duration} min` : '';
                    const pricePart = (st.price && st.price > 0) ? `+$${st.price} MXN` : 'Sin costo';
                    addOns.push(`Diseño: ${st.name}${st.qty > 1 ? ` x${st.qty}` : ''} (${pricePart}${durPart})`);
                });
            }
            addOns.push(`Cotización Confirmada: $${totalPrice} MXN`);

            const serviceId = matchedService?.id || 1;
            const stylistId = assignedStylist ? assignedStylist.id : (quote.stylistId || (stylists.length > 0 ? stylists[0].id : null));

            const newAppt = await addAppointment({
                clientName: clientName.trim(),
                clientPhone: cleanPhone,
                serviceId,
                stylistId,
                date: selectedDate,
                time: selectedTime,
                status: 'confirmada',
                additionalServices: addOns,
            } as any);

            if (newAppt?.id) {
                await markQuoteAsBooked(quote.id, newAppt.id);

                // 🔔 Enviar Notificación WhatsApp exclusivamente al Cliente
                if (cleanPhone) {
                    sendManualBookingClientNotification({
                        clientPhone: cleanPhone,
                        clientName: clientName.trim(),
                        businessName: businessConfig?.name || 'CitaLink',
                        businessSlug: businessConfig?.slug || undefined,
                        date: selectedDate,
                        time: selectedTime,
                        serviceName: matchedService?.name || 'Servicio',
                    });
                }
            }

            setIsBookedSuccess(true);
            showToast('¡Cita agendada con éxito desde la cotización! 🎉', 'success');
            if (onSuccess) onSuccess();
        } catch (err: any) {
            console.error('Error booking quote:', err);
            setFormError(err.message || 'Ocurrió un error al registrar la cita.');
        }
    };

    if (!isOpen || !quote) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
            <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-8">
                
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-950/40">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-white text-base">Agendar desde Cotización</h3>
                            <p className="text-xs text-slate-400">Pasa esta cotización a cita confirmada</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
                    {isBookedSuccess ? (
                        <div className="py-8 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                                <CheckCircle size={32} />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-white">¡Cita Agendada Exitosamente!</h4>
                                <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                                    La cotización ha sido guardada como cita confirmada con su fecha, horario y foto de referencia vinculada.
                                </p>
                            </div>
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all"
                                >
                                    Cerrar Ventana
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Card Resumen de la Cotización */}
                            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-slate-950 border border-pink-500/20 flex gap-3 items-center">
                                {quote.referenceImageUrl ? (
                                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-black border border-white/10 shrink-0">
                                        <img src={quote.referenceImageUrl} alt="Diseño" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20 flex items-center justify-center shrink-0">
                                        <ImageIcon size={24} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-pink-400 mb-0.5">Cotización Personalizada</p>
                                    <h4 className="text-sm font-bold text-white leading-tight truncate">
                                        {matchedService?.name || 'Servicio de Uñas'} {quote.sizeName ? `(${quote.sizeName})` : ''}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1.5 text-xs">
                                        <span className="font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                            ${totalPrice} MXN
                                        </span>
                                        <span className="text-slate-400 flex items-center gap-1 font-medium">
                                            <Clock size={12} className="text-cyan-400" /> {totalDuration} min
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Datos de la clienta */}
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-300 block mb-1">Nombre de la Clienta *</label>
                                    <div className="relative">
                                        <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={clientName}
                                            onChange={(e) => setClientName(e.target.value)}
                                            placeholder="Ej. Carolina Mendoza"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-white/10 rounded-xl text-sm text-white focus:border-cyan-400 outline-none transition-colors"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-300 block mb-1">Teléfono WhatsApp (10 dígitos) *</label>
                                    <div className="relative">
                                        <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="tel"
                                            value={clientPhone}
                                            onChange={(e) => setClientPhone(e.target.value)}
                                            placeholder="Ej. 55 1234 5678"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-white/10 rounded-xl text-sm text-white focus:border-cyan-400 outline-none transition-colors font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Especialista asignado */}
                            {quote.stylistId ? (
                                <div>
                                    <label className="text-xs font-bold text-slate-300 block mb-1">Profesional Asignado</label>
                                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-pink-500/10 border border-pink-500/30 rounded-xl text-white">
                                        <div className="flex items-center gap-2.5">
                                            <UserCheck size={16} className="text-pink-400" />
                                            <span className="font-bold text-sm text-white">{assignedStylist?.name || 'Profesional de la cotización'}</span>
                                        </div>
                                        <span className="text-[10px] bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full font-bold border border-pink-500/35">
                                            Fijado en Cotización
                                        </span>
                                    </div>
                                </div>
                            ) : stylists.length > 1 && (
                                <div>
                                    <label className="text-xs font-bold text-slate-300 block mb-1">Profesional a Atender</label>
                                    <div className="relative">
                                        <UserCheck size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <select
                                            value={selectedStylistId}
                                            onChange={(e) => setSelectedStylistId(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-white/10 rounded-xl text-sm text-white focus:border-cyan-400 outline-none transition-colors cursor-pointer"
                                        >
                                            <option value="any">Cualquier Profesional Disponible</option>
                                            {stylists.map(st => (
                                                <option key={st.id} value={String(st.id)}>{st.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Selector de Fecha */}
                            <div>
                                <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                                    <Calendar size={14} className="text-cyan-400" /> Selecciona la Fecha
                                </label>
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                                    {availableDates.slice(0, 14).map((d) => (
                                        <button
                                            key={d.dateStr}
                                            type="button"
                                            onClick={() => { setSelectedDate(d.dateStr); setSelectedTime(null); }}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all border text-center ${
                                                selectedDate === d.dateStr
                                                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                                                    : 'bg-slate-950/60 border-white/10 text-slate-300 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="text-[10px] opacity-75">{d.dayName.slice(0, 3)}</div>
                                            <div className="text-xs font-extrabold">{d.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Selector de Horarios Disponibles */}
                            <div>
                                <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                                    <Clock size={14} className="text-cyan-400" /> Horario ({totalDuration} min calculados)
                                </label>
                                {availableSlots.length === 0 ? (
                                    <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 text-center text-xs text-amber-300">
                                        No hay horarios disponibles para esta duración en la fecha seleccionada.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1">
                                        {availableSlots.map((slot) => (
                                            <button
                                                key={slot}
                                                type="button"
                                                onClick={() => setSelectedTime(slot)}
                                                className={`py-2 rounded-xl text-xs font-bold transition-all border text-center ${
                                                    selectedTime === slot
                                                        ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white border-pink-400 shadow-md shadow-pink-500/25'
                                                        : 'bg-slate-950/60 border-white/10 text-slate-300 hover:border-white/20'
                                                }`}
                                            >
                                                {slot}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {formError && (
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                                    {formError}
                                </div>
                            )}

                            {/* Botón de Confirmación */}
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    disabled={isAdding || !selectedTime}
                                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                    {isAdding ? (
                                        <><Loader2 size={18} className="animate-spin" /> Agendando Cita...</>
                                    ) : (
                                        <>✓ Confirmar Cita (${totalPrice} MXN - {selectedTime || '--:--'})</>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
