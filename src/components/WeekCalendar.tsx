import { useMemo, useState } from 'react';
import type { Appointment, Service, Stylist } from '../lib/types/store.types';
import { format, addDays, startOfWeek, subWeeks, addWeeks, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, MessageCircle, Ban } from 'lucide-react';

interface WeekCalendarProps {
    appointments: Appointment[];
    services: Service[];
    stylists: Stylist[];
    onWhatsApp: (apt: Appointment, type: 'confirm' | 'remind') => void;
    onCancel: (apt: Appointment) => void;
}

export default function WeekCalendar({ appointments, services, stylists, onWhatsApp, onCancel }: WeekCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);

    const START_HOUR = 8; // 8:00 AM
    const END_HOUR = 20; // 8:00 PM
    const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

    const weekDays = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
        return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    }, [currentDate]);

    // Generar un color pseudoaleatorio predecible basado en string (usado para Servicios o Estilistas)
    const getColorForString = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 25%)`; // Dark pastel colors
    };

    const getAppointmentsForDay = (day: Date) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        return appointments.filter(a => a.date === dayStr && a.status !== 'cancelada');
    };

    const calculateTop = (timeStr: string) => {
        // "09:30" => top: ...
        const [h, m] = timeStr.split(':').map(Number);
        const minsFromStart = (h - START_HOUR) * 60 + m;
        // pixel per min = say, 1.2px (60 mins = 72px)
        return (minsFromStart / 60) * 80; // 80px per hour
    };

    const calculateHeight = (durationMins: number) => {
        return (durationMins / 60) * 80;
    };

    return (
        <div className="flex flex-col h-full bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
            {/* Calendar Header Nav */}
            <div className="flex justify-between items-center p-4 border-b border-white/5 bg-[#0f172a]">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <h3 className="text-lg font-bold text-white capitalize">
                        {format(weekDays[0], 'MMMM yyyy', { locale: es })}
                    </h3>
                    <button
                        onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
                <button
                    onClick={() => setCurrentDate(new Date())}
                    className="text-sm text-accent hover:underline font-medium px-3 py-1.5 bg-accent/10 rounded-md"
                >
                    Hoy
                </button>
            </div>

            {/* Calendar Grid Container */}
            <div className="flex flex-1 overflow-auto custom-scrollbar relative">

                {/* Time Axis (Y) */}
                <div className="w-16 flex-shrink-0 bg-[#0f172a] border-r border-white/5 relative z-10 sticky left-0">
                    <div className="h-12 border-b border-white/5"></div> {/* Empty corner */}
                    {HOURS.map(hour => (
                        <div key={hour} className="h-[80px] relative text-right pr-2">
                            <span className="text-[10px] text-muted-foreground absolute -top-2 right-2">
                                {hour > 12 ? `${hour - 12} PM` : `${hour === 0 ? 12 : hour} AM`}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="flex flex-1 min-w-[800px] relative">
                    {weekDays.map((day, i) => (
                        <div key={i} className="flex-1 border-r border-white/5 flex flex-col relative min-w-[120px]">
                            {/* Day Header */}
                            <div className={`h-12 flex flex-col items-center justify-center border-b border-white/5 sticky top-0 z-20 bg-[#0f172a]/95 backdrop-blur-sm ${isToday(day) ? 'bg-accent/10 border-b-accent/50' : ''}`}>
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                    {format(day, 'EEE', { locale: es })}
                                </span>
                                <span className={`text-lg font-black ${isToday(day) ? 'text-accent' : 'text-white'}`}>
                                    {format(day, 'd')}
                                </span>
                            </div>

                            {/* Hours Grid Lanes */}
                            <div className="relative flex-1" style={{ height: `${(END_HOUR - START_HOUR + 1) * 80}px` }}>
                                {HOURS.map(hour => (
                                    <div key={hour} className="absolute w-full h-[80px] border-b border-white/5 opacity-50 pointer-events-none" style={{ top: `${(hour - START_HOUR) * 80}px` }}></div>
                                ))}

                                {/* Appointments */}
                                {getAppointmentsForDay(day).map(apt => {
                                    const svc = services.find(s => s.id === apt.serviceId);
                                    const styl = stylists.find(s => s.id === apt.stylistId);
                                    const duration = svc?.duration || 60;
                                    const [h] = apt.time.split(':').map(Number);

                                    if (h < START_HOUR || h > END_HOUR) return null; // Outside visible hours

                                    const topPos = calculateTop(apt.time);
                                    const heightPx = calculateHeight(duration);
                                    const bgColor = getColorForString(svc?.name || 'Servicio');

                                    return (
                                        <div
                                            key={apt.id}
                                            onClick={() => setSelectedApt(apt)}
                                            className="absolute left-[2%] right-[2%] rounded-md border border-white/20 p-2 overflow-hidden cursor-pointer hover:brightness-125 transition-all shadow-md active:scale-[0.98]"
                                            style={{
                                                top: topPos,
                                                height: heightPx,
                                                backgroundColor: bgColor,
                                            }}
                                        >
                                            <div className="text-[10px] sm:text-xs font-bold text-white truncate leading-tight mb-0.5">
                                                {apt.clientName}
                                            </div>
                                            <div className="text-[9px] text-white/80 truncate leading-tight">
                                                {svc?.name}
                                            </div>
                                            <div className="text-[9px] text-white/60 font-medium truncate flex items-center gap-1 mt-0.5">
                                                <Clock size={8} /> {apt.time} • {styl?.name.split(' ')[0] || 'N/A'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Appointment Detail Mini-Modal */}
            {selectedApt && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedApt(null)}>
                    <div
                        className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative"
                        onClick={e => e.stopPropagation()}
                    >
                        {(() => {
                            const svc = services.find(s => s.id === selectedApt.serviceId);
                            const styl = stylists.find(s => s.id === selectedApt.stylistId);
                            const isFinished = selectedApt.status === 'completada';

                            return (
                                <>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white">{selectedApt.clientName}</h3>
                                            <p className="text-sm text-muted">{selectedApt.clientPhone}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${isFinished ? 'bg-slate-500/20 text-slate-400' : 'bg-green-500/20 text-green-400'}`}>
                                            {isFinished ? 'COMPLETADA' : 'CONFIRMADA'}
                                        </span>
                                    </div>

                                    <div className="space-y-3 mb-6 bg-white/5 p-4 rounded-xl">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted">Fecha y Hora</span>
                                            <span className="text-white font-medium">{selectedApt.date} • {selectedApt.time}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted">Servicio</span>
                                            <span className="text-white font-medium">{svc?.name}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted">Profesional</span>
                                            <span className="text-white font-medium">{styl?.name || 'Cualquiera'}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setSelectedApt(null); onWhatsApp(selectedApt, 'confirm'); }}
                                            className="flex-1 btn bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white border border-green-500/20 flex flex-col items-center gap-1 py-3"
                                        >
                                            <MessageCircle size={18} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Confirmación</span>
                                        </button>
                                        <button
                                            onClick={() => { setSelectedApt(null); onWhatsApp(selectedApt, 'remind'); }}
                                            className="flex-1 btn bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white border border-amber-500/20 flex flex-col items-center gap-1 py-3"
                                        >
                                            <MessageCircle size={18} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Recordatorio</span>
                                        </button>
                                        {!isFinished && (
                                            <button
                                                onClick={() => { setSelectedApt(null); onCancel(selectedApt); }}
                                                className="flex-1 btn bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 flex flex-col items-center gap-1 py-3"
                                            >
                                                <Ban size={18} />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">Cancelar</span>
                                            </button>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
