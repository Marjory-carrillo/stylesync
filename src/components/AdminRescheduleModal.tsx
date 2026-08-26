import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Calendar, Clock, RefreshCw, User, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAppointments } from '../lib/store/queries/useAppointments';
import { useServices } from '../lib/store/queries/useServices';
import { useStylists } from '../lib/store/queries/useStylists';
import { useSchedule } from '../lib/store/queries/useSchedule';
import { useBlockedSlots } from '../lib/store/queries/useBlockedSlots';
import { useTenantData } from '../lib/store/queries/useTenantData';
import { getSmartSlots, calculateAppointmentDuration, getRealAdditionalServices, type Appointment as SlotAppointment, type BlockedInterval } from '../lib/smartSlots';
import DatePickerInput from './DatePickerInput';
import TimePickerInput from './TimePickerInput';
import type { Appointment } from '../lib/types/store.types';
import { DAY_NAMES } from '../lib/constants';
import { parse } from 'date-fns';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

interface AdminRescheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: Appointment | null;
}

export default function AdminRescheduleModal({ isOpen, onClose, appointment }: AdminRescheduleModalProps) {
    const queryClient = useQueryClient();
    const { updateAppointmentTime, appointments } = useAppointments();
    const { services } = useServices();
    const { stylists } = useStylists();
    const { schedule } = useSchedule();
    const { blockedSlots } = useBlockedSlots();
    const { data: tenantConfig } = useTenantData();

    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [useManualTime, setUseManualTime] = useState(false);

    const bufferMinutes = (tenantConfig as any)?.breakBetweenAppointments ?? 0;

    useEffect(() => {
        if (appointment) {
            setNewDate(appointment.date);
            setNewTime(appointment.time ? appointment.time.slice(0, 5) : '10:00');
        }
    }, [appointment]);

    const service = useMemo(() => {
        if (!appointment) return null;
        return (services || []).find((s: any) => String(s.id) === String(appointment.serviceId));
    }, [services, appointment]);

    const stylist = useMemo(() => {
        if (!appointment) return null;
        return (stylists || []).find((s: any) => String(s.id) === String(appointment.stylistId));
    }, [stylists, appointment]);

    // Check if the stylist or business is open on newDate
    const daySchedule = useMemo(() => {
        if (!newDate || !schedule) return null;
        try {
            const dateObj = parse(newDate, 'yyyy-MM-dd', new Date());
            const dayIndex = dateObj.getDay();
            const dayKey = DAY_KEYS[dayIndex];

            // If appointment is for a specific professional and they have a custom schedule
            if (stylist && stylist.schedule && stylist.schedule[dayKey] !== undefined) {
                return stylist.schedule[dayKey];
            }

            return schedule[dayKey] || null;
        } catch (_) {
            return null;
        }
    }, [newDate, schedule, stylist]);

    const isDayClosed = useMemo(() => {
        if (!daySchedule) return false;
        return daySchedule.open === false;
    }, [daySchedule]);

    // Smart Slots Calculation
    const availableSlots = useMemo(() => {
        if (!newDate || isDayClosed || !daySchedule || !appointment) return [];

        const serviceDuration = calculateAppointmentDuration(appointment, services);
        const workStart = daySchedule.start || '09:00';
        const workEnd = daySchedule.end || '18:00';

        const baseDate = parse(newDate, 'yyyy-MM-dd', new Date());

        // Map existing appointments (excluding current appt being rescheduled)
        const slotAppointments: SlotAppointment[] = (appointments || [])
            .filter(a => a.id !== appointment.id && a.date === newDate && a.status !== 'cancelada')
            .filter(a => {
                if (appointment.stylistId) {
                    return String(a.stylistId || (a as any).stylist_id || '') === String(appointment.stylistId);
                }
                return true;
            })
            .map(a => {
                const apptStart = parse(`${a.date} ${a.time.slice(0, 5)}`, 'yyyy-MM-dd HH:mm', new Date());
                const dur = calculateAppointmentDuration(a, services);
                const apptEnd = new Date(apptStart.getTime() + dur * 60000);
                return {
                    id: a.id,
                    stylistId: String(a.stylistId || ''),
                    start: apptStart,
                    end: apptEnd,
                };
            });

        // Map blocked intervals
        const slotBlocked: BlockedInterval[] = (blockedSlots || [])
            .filter(b => b.date === newDate)
            .filter(b => {
                if (b.staffId && appointment.stylistId) {
                    return String(b.staffId) === String(appointment.stylistId);
                }
                return true;
            })
            .map(b => {
                const bStart = parse(`${b.date} ${b.startTime.slice(0, 5)}`, 'yyyy-MM-dd HH:mm', new Date());
                const bEnd = parse(`${b.date} ${b.endTime.slice(0, 5)}`, 'yyyy-MM-dd HH:mm', new Date());
                return { start: bStart, end: bEnd };
            });

        if (daySchedule.breakStart && daySchedule.breakEnd) {
            slotBlocked.push({
                start: parse(`${newDate} ${daySchedule.breakStart.slice(0, 5)}`, 'yyyy-MM-dd HH:mm', new Date()),
                end: parse(`${newDate} ${daySchedule.breakEnd.slice(0, 5)}`, 'yyyy-MM-dd HH:mm', new Date()),
            });
        }

        return getSmartSlots(baseDate, serviceDuration, workStart, workEnd, slotAppointments, slotBlocked, bufferMinutes);
    }, [newDate, isDayClosed, daySchedule, appointment, appointments, services, blockedSlots, bufferMinutes]);

    if (!isOpen || !appointment) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDate || !newTime || isDayClosed) return;

        setIsSaving(true);
        try {
            const addOnNames = getRealAdditionalServices(appointment.additionalServices, services);
            const fullServiceName = service 
                ? service.name + (addOnNames.length > 0 ? ' + ' + addOnNames.join(' + ') : '') 
                : 'Servicio';

            await updateAppointmentTime({
                id: appointment.id,
                newDate,
                newTime,
                serviceName: fullServiceName,
            });
            onClose();
        } catch (_) {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.refetchQueries({ queryKey: ['appointments'] });
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    const format12h = (t: string) => {
        if (!t) return '';
        const [h, m] = t.split(':');
        let hh = parseInt(h);
        const ampm = hh >= 12 ? 'PM' : 'AM';
        hh = hh % 12 || 12;
        return `${hh}:${m} ${ampm}`;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-md glass-panel bg-[#0f172a] border border-white/10 rounded-3xl shadow-2xl overflow-visible p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2.5 text-white">
                        <div className="p-2.5 rounded-2xl bg-accent/20 text-accent border border-accent/30 shadow-lg shadow-accent/10">
                            <RefreshCw size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base tracking-tight">Reagendar Cita Inteligente</h3>
                            <p className="text-xs text-slate-400">Verifica horarios de atención y ocupación real</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Cancellation Warning if appt was cancelled */}
                {appointment.status === 'cancelada' && (
                    <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2.5">
                        <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-red-200">Esta cita fue cancelada</p>
                            <p className="text-[11px] text-red-300/80 mt-0.5">
                                No es posible reagendar una cita que ya fue cancelada. Si el cliente desea agendar de nuevo, por favor crea una nueva cita.
                            </p>
                        </div>
                    </div>
                )}

                {/* Info Card */}
                <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-white/10 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1.5 text-sm">
                            <User size={14} className="text-cyan-400" /> {appointment.clientName}
                        </span>
                        <span className="text-slate-400 font-mono">{appointment.clientPhone}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                        <span className="flex items-center gap-1.5">
                            <Sparkles size={13} className="text-purple-400" /> {service?.name || 'Servicio'} ({service?.duration || 30} min)
                        </span>
                        {stylist && <span className="text-slate-400">Atiende: <strong className="text-slate-200">{stylist.name}</strong></span>}
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                    {/* Date Picker */}
                    <div className="relative z-[50]">
                        <label className="block text-[10px] uppercase font-black text-slate-400 mb-1.5 tracking-widest flex items-center gap-1">
                            <Calendar size={12} className="text-cyan-400" /> Nueva Fecha
                        </label>
                        <DatePickerInput
                            value={newDate}
                            onChange={val => {
                                setNewDate(val);
                                setNewTime('');
                            }}
                        />
                    </div>

                    {/* Day Closed Warning */}
                    {isDayClosed ? (
                        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2.5 animate-fade-in">
                            <AlertCircle size={18} className="shrink-0 text-red-400" />
                            <span>
                                <strong>Día no laboral:</strong> {stylist ? `${stylist.name} no atiende` : 'El negocio está cerrado'} los días <strong className="underline font-bold">{DAY_NAMES[DAY_KEYS[parse(newDate, 'yyyy-MM-dd', new Date()).getDay()]] || 'seleccionados'}</strong>. Por favor elige otra fecha.
                            </span>
                        </div>
                    ) : (
                        /* Time Selection Area */
                        <div className="space-y-2 relative z-[40]">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest flex items-center gap-1">
                                    <Clock size={12} className="text-amber-400" /> Horarios Disponibles ({availableSlots.length})
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setUseManualTime(!useManualTime)}
                                    className="text-[10px] text-cyan-400 hover:underline font-bold"
                                >
                                    {useManualTime ? 'Ver Sugeridos' : 'Hora Manual'}
                                </button>
                            </div>

                            {!useManualTime ? (
                                availableSlots.length > 0 ? (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                                        {availableSlots.map(slotTime => {
                                            const isSelected = newTime === slotTime;
                                            return (
                                                <button
                                                    key={slotTime}
                                                    type="button"
                                                    onClick={() => setNewTime(slotTime)}
                                                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20 scale-105'
                                                            : 'bg-slate-900/80 border-white/10 text-slate-200 hover:border-accent/40 hover:bg-accent/10'
                                                    }`}
                                                >
                                                    {format12h(slotTime)}
                                                    {isSelected && <CheckCircle2 size={12} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs text-center space-y-1">
                                        <p className="font-bold">⚠️ Sin horarios sugeridos</p>
                                        <p className="text-[11px] opacity-80">El día está saturado o fuera de turno. Puedes seleccionar hora manual si deseas forzar un horario.</p>
                                    </div>
                                )
                            ) : (
                                <TimePickerInput
                                    value={newTime}
                                    onChange={val => setNewTime(val)}
                                />
                            )}
                        </div>
                    )}

                    <div className="pt-2 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-xs font-bold transition-all cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !newDate || !newTime || isDayClosed || appointment.status === 'cancelada'}
                            className="flex-1 py-3 px-4 rounded-xl bg-accent hover:brightness-110 text-white text-xs font-bold shadow-lg shadow-accent/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={14} className={isSaving ? 'animate-spin' : ''} /> {isSaving ? 'Reagendando...' : 'Confirmar Reagendamiento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
