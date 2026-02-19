
import { useMemo } from 'react';
import { format, parse, addMinutes, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, User, Scissors, Phone } from 'lucide-react';

interface ResourceCalendarProps {
    appointments: any[];
    stylists: any[];
    currentDate: Date;
    onDateChange: (date: Date) => void;
    onAppointmentClick: (appt: any) => void;
    services: any[];
}

export default function ResourceCalendar({
    appointments = [],
    stylists = [],
    currentDate = new Date(),
    onDateChange,
    onAppointmentClick,
    services = []
}: ResourceCalendarProps) {

    // ── Generate Time Slots (9:00 - 21:00) ──
    const timeSlots = useMemo(() => {
        const slots = [];
        let start = new Date(currentDate);
        start.setHours(9, 0, 0, 0); // Start at 9:00 AM
        const end = new Date(currentDate);
        end.setHours(21, 0, 0, 0); // End at 9:00 PM

        while (start < end) {
            slots.push(format(start, 'HH:mm'));
            start = addMinutes(start, 30); // 30 min intervals
        }
        return slots;
    }, [currentDate]);

    // ── Align Appointments ──
    const getAppointmentStyle = (appt: any) => {
        try {
            if (!appt.time) return { display: 'none' };

            const start = parse(appt.time, 'HH:mm', currentDate);
            const startMinutes = start.getHours() * 60 + start.getMinutes();
            const baseMinutes = 9 * 60; // 9:00 AM start
            const top = Math.max(0, startMinutes - baseMinutes); // Minutes from 9:00 AM

            const service = services.find(s => s.id === appt.serviceId);
            const duration = service ? service.duration : 30;
            const height = duration;

            return {
                top: `${(top / 30) * 60}px`, // 60px per 30 mins
                height: `${(height / 30) * 60}px`,
            };
        } catch (error) {
            console.error('Error calculating style for appt:', appt, error);
            return { display: 'none' };
        }
    };

    // ── Navigation Functions ──
    const handlePrevDay = () => {
        const prev = new Date(currentDate);
        prev.setDate(prev.getDate() - 1);
        onDateChange(prev);
    };

    const handleNextDay = () => {
        const next = new Date(currentDate);
        next.setDate(next.getDate() + 1);
        onDateChange(next);
    };

    if (!stylists || !appointments) {
        return <div className="p-10 text-center text-muted">Cargando calendario...</div>;
    }

    return (
        <div className="flex flex-col h-full animate-fade-in select-none">

            {/* ── Calendar Header (Navigation) ── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 px-2">
                <div className="flex items-center gap-2 order-2 sm:order-1 w-full sm:w-auto justify-between sm:justify-start">
                    <button
                        onClick={() => onDateChange(new Date())}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                    >
                        Hoy
                    </button>
                    <div className="flex items-center gap-1">
                        <button onClick={handlePrevDay} className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white">
                            <ChevronLeft size={20} />
                        </button>
                        <button onClick={handleNextDay} className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                <div className="text-center order-1 sm:order-2">
                    <h3 className="text-lg md:text-xl font-bold text-white capitalize tracking-tight">
                        {format(currentDate, 'EEEE d MMMM yyyy', { locale: es })}
                    </h3>
                </div>

                <div className="hidden sm:block order-3 w-[100px]" /> {/* Spacer to center title on desktop */}
            </div>

            {/* ── Main Grid Container ── */}
            <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar glass-panel rounded-2xl border border-white/5 relative bg-slate-900/50 shadow-inner" style={{ maxHeight: 'calc(100vh - 250px)' }}>

                <div className="min-w-[800px] flex"> {/* Min width for scrolling */}

                    {/* ── Time Column (Sticky Left) ── */}
                    <div className="sticky left-0 z-20 bg-slate-900/95 backdrop-blur border-r border-white/10 w-16 shrink-0 flex flex-col pt-12">
                        {timeSlots.map((time, idx) => (
                            <div key={time} className="h-[60px] flex items-start justify-center pt-1 relative">
                                <span className="text-xs text-muted font-medium -mt-2.5 bg-slate-900/80 px-1 rounded">{time}</span>
                                {/* Horizontal Guideline */}
                                {idx >= 0 && <div className="absolute top-0 right-0 w-2 h-[1px] bg-white/10" />}
                            </div>
                        ))}
                    </div>

                    {/* ── Columns Container ── */}
                    <div className="flex flex-1">
                        {(stylists.length > 0 ? stylists : [{ id: '0', name: 'General', image: null }]).map(stylist => {
                            // Filter appointments for this stylist and date
                            const stylistAppts = appointments.filter(a =>
                                (String(a.stylistId) === String(stylist.id) || (stylist.id === '0' && !a.stylistId)) &&
                                isSameDay(parse(a.date, 'yyyy-MM-dd', new Date()), currentDate) &&
                                a.status !== 'cancelada'
                            );

                            return (
                                <div key={stylist.id} className="flex-1 min-w-[180px] border-r border-white/5 relative">
                                    {/* ── Stylist Header (Sticky Top) ── */}
                                    <div className="sticky top-0 z-10 bg-slate-800/90 backdrop-blur border-b border-white/10 h-12 flex items-center justify-center gap-2 shadow-sm">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">
                                            {stylist.image ? (
                                                <img src={stylist.image} className="w-full h-full object-cover rounded-full" />
                                            ) : (
                                                <User size={14} />
                                            )}
                                        </div>
                                        <span className="font-bold text-white text-sm truncate max-w-[100px]">{stylist.name}</span>
                                    </div>

                                    {/* ── Grid Rows (Visual Guides) ── */}
                                    <div className="relative pb-10">
                                        {timeSlots.map(time => (
                                            <div key={time} className="h-[60px] border-b border-white/5 box-border" />
                                        ))}
                                        {/* ── Appointments (Events) ── */}
                                        {stylistAppts.map(appt => {
                                            const style = getAppointmentStyle(appt);
                                            const service = services.find(s => s.id === appt.serviceId);

                                            // Conditional styling for Completed vs Confirmed
                                            const isCompleted = appt.status === 'completada';
                                            const isPast = new Date(appt.date + 'T' + appt.time) < new Date();
                                            const bgColor = isCompleted ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-100'
                                                : (isPast ? 'bg-slate-700/40 border-slate-600/40 text-slate-300'
                                                    : 'bg-accent/20 border-accent/40 text-accent-100 hover:bg-accent/30');

                                            return (
                                                <div
                                                    key={appt.id}
                                                    className={`absolute left-1 right-1 rounded-md border p-2 text-xs overflow-hidden cursor-pointer transition-all shadow-sm group hover:z-30 hover:shadow-lg ${bgColor}`}
                                                    style={style}
                                                    onClick={() => onAppointmentClick(appt)}
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-bold truncate">{appt.clientName}</span>
                                                        <span className="text-[10px] opacity-80">{appt.time}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-0.5 opacity-90 truncate">
                                                        <Scissors size={10} />
                                                        <span>{service?.name || 'Servicio'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-0.5 opacity-75 truncate text-[10px]">
                                                        <Phone size={10} />
                                                        <span>{appt.clientPhone}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Current Time Line (Red) */}
                                        {isSameDay(currentDate, new Date()) && (
                                            <div
                                                className="absolute left-0 right-0 border-t-2 border-red-500 z-50 pointer-events-none opacity-60"
                                                style={{
                                                    top: `${((new Date().getHours() * 60 + new Date().getMinutes()) - (9 * 60)) / 30 * 60}px`
                                                }}
                                            >
                                                <div className="absolute -left-1 -top-1.5 w-3 h-3 bg-red-500 rounded-full" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Legend / Footer info */}
            <div className="mt-4 flex gap-4 text-xs text-muted justify-end px-2">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-accent/20 border border-accent/40"></div>
                    <span>Confirmada</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40"></div>
                    <span>Completada</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-slate-700/40 border border-slate-600/40"></div>
                    <span>Pasada</span>
                </div>
            </div>
        </div>
    );
}
