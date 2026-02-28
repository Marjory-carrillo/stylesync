import { useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { Trash2, User, Phone, Scissors, Send, ChevronDown, MessageCircle, Users, CalendarDays, Clock } from 'lucide-react';


export default function Appointments() {
    const {
        appointments: allAppointments,
        waitingList,
        cancellationLog,
        cancelAppointment,
        removeFromWaitingList,
        getServiceById,
        getStylistById,
        isPhoneBlocked,
        generateWhatsAppUrl,
        generateReminderWhatsAppUrl,
        showToast,
        userRole,
        userStylistId
    } = useStore();

    const appointments = useMemo(() => {
        if (userRole === 'employee' && userStylistId) {
            return allAppointments.filter(a => a.stylistId === userStylistId);
        }
        return allAppointments;
    }, [allAppointments, userRole, userStylistId]);

    const [filter, setFilter] = useState<'confirmada' | 'completada' | 'cancelada' | 'recordatorios'>('confirmada');
    const [showWaiting, setShowWaiting] = useState(false);
    const [showLog, setShowLog] = useState(false);


    // ── Filter Logic ──
    const isTomorrow = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return d.toDateString() === tomorrow.toDateString();
    };

    // Use local system date in YYYY-MM-DD format (timezone-safe)
    const todayStr = new Date().toLocaleDateString('en-CA');

    const filteredAppointments = appointments.filter(apt => {
        const service = getServiceById(apt.serviceId);
        let isFinished = apt.status === 'completada';

        if (!isFinished && apt.status !== 'cancelada') {
            const end = new Date(`${apt.date}T${apt.time}`);
            end.setMinutes(end.getMinutes() + (service?.duration || 0));
            if (new Date() >= end) isFinished = true;
        }

        if (filter === 'recordatorios') {
            return apt.status === 'confirmada' && !isFinished && isTomorrow(apt.date);
        }
        if (filter === 'confirmada') {
            return apt.status === 'confirmada' && !isFinished;
        }
        if (filter === 'completada') {
            return isFinished;
        }
        return apt.status === filter;
    }).sort((a, b) => {
        // Sort by date then time
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
    });

    const handleAdminCancel = async (apt: typeof appointments[0]) => {
        if (!confirm('¿Estás seguro de cancelar esta cita?')) return;

        await cancelAppointment(apt.id);

        // Check waiting list for this date
        const waitingForDate = waitingList.filter(w => w.date === apt.date);
        if (waitingForDate.length > 0) {
            showToast(`Hay ${waitingForDate.length} cliente(s) en espera para esta fecha`, 'info');
            setShowWaiting(true);
        }
    };

    return (
        <div className="animate-fade-in h-[calc(100vh-100px)] flex flex-col gap-6">

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 flex-none px-1">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Agenda</h2>
                    <p className="text-sm text-muted-foreground">Gestión de citas y reservas</p>
                </div>

                {/* Controls Container */}
                <div className="flex items-center gap-3 bg-black/40 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
                    {/* Filters (Compact) */}
                    <div className="flex gap-1">
                        {[
                            { id: 'confirmada', label: 'Confirmadas', color: 'text-emerald-400' },
                            { id: 'recordatorios', label: 'Recordatorios', color: 'text-amber-400' },
                            { id: 'completada', label: 'Historial', color: 'text-slate-400' },
                            { id: 'cancelada', label: 'Canceladas', color: 'text-red-400' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id as any)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${filter === tab.id
                                    ? `bg-white/5 border-white/10 text-white`
                                    : 'border-transparent text-muted hover:bg-white/5'
                                    }`}
                            >
                                <span className={`mr-1.5 ${filter === tab.id ? tab.color : 'opacity-50'}`}>●</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="space-y-2 flex-none">
                {/* Waiting List Alert (Compact) */}
                {waitingList.length > 0 && !showWaiting && (
                    <button
                        onClick={() => setShowWaiting(true)}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 hover:border-amber-500/40 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-sm font-medium text-amber-200">
                                <span className="font-bold text-amber-400">{waitingList.length}</span> personas en lista de espera
                            </span>
                        </div>
                        <ChevronDown size={16} className="text-amber-500/50 group-hover:text-amber-400" />
                    </button>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-start">
                <div className="w-full max-w-5xl bg-black/20 rounded-3xl border border-white/5 backdrop-blur-sm overflow-hidden flex flex-col shadow-2xl h-full">
                    <div className="overflow-y-auto custom-scrollbar p-3 space-y-2 flex-1">
                        {/* Empty State */}
                        {filteredAppointments.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-60">
                                <Scissors size={48} className="text-white/10 mb-4" />
                                <h3 className="text-lg font-medium text-white mb-1">Sin citas aquí</h3>
                                <p className="text-sm text-muted">No hay citas registradas en esta categoría.</p>
                            </div>
                        )}

                        {/* Grouped List Items */}
                        {(() => {
                            const grouped = filteredAppointments.reduce((acc, apt) => {
                                if (!acc[apt.date]) acc[apt.date] = [];
                                acc[apt.date].push(apt);
                                return acc;
                            }, {} as Record<string, typeof appointments>);

                            return Object.keys(grouped).sort().map(date => (
                                <div key={date} className="space-y-2 mb-6 last:mb-2">
                                    {/* Date Header */}
                                    <div className="flex items-center gap-3 px-3 py-2 sticky top-0 bg-[#161b2a]/95 backdrop-blur-sm z-10 border-b border-white/5 mx-[-8px]">
                                        <div className="p-1.5 rounded-lg bg-accent/10 border border-accent/20">
                                            <CalendarDays size={12} className="text-accent" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
                                                {new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </span>
                                            {date === todayStr && (
                                                <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5">Hoy</span>
                                            )}
                                        </div>
                                    </div>

                                    {grouped[date].map(apt => {
                                        const service = getServiceById(apt.serviceId);
                                        const stylist = getStylistById(apt.stylistId);

                                        let isCompleted = apt.status === 'completada';
                                        if (!isCompleted && apt.status !== 'cancelada') {
                                            const end = new Date(`${apt.date}T${apt.time}`);
                                            end.setMinutes(end.getMinutes() + (service?.duration || 0));
                                            if (new Date() >= end) isCompleted = true;
                                        }

                                        const isCancelled = apt.status === 'cancelada';
                                        const blocked = isPhoneBlocked(apt.clientPhone);

                                        // Formatter for 12h time
                                        const displayTime = (() => {
                                            const [h, m] = apt.time.split(':');
                                            let hh = parseInt(h);
                                            const ampm = hh >= 12 ? 'pm' : 'am';
                                            hh = hh % 12;
                                            hh = hh ? hh : 12;
                                            return `${hh}:${m}${ampm}`;
                                        })();

                                        return (
                                            <div
                                                key={apt.id}
                                                className={`group flex items-stretch gap-0 rounded-2xl border transition-all overflow-hidden ${isCompleted ? 'bg-white/[0.02] border-white/5 opacity-60 grayscale' :
                                                    isCancelled ? 'bg-red-500/[0.02] border-red-500/10 opacity-70' :
                                                        'glass-card border-white/5 hover:border-accent/30 hover:shadow-2xl hover:shadow-accent/5'
                                                    }`}
                                            >
                                                {/* Status Indicator Bar */}
                                                <div className={`w-1.5 shrink-0 ${isCompleted ? 'bg-emerald-500/30' : isCancelled ? 'bg-red-500/30' : 'bg-gradient-to-b from-accent/80 to-accent/20'}`} />

                                                {/* Time Column */}
                                                <div className="flex flex-col items-center justify-center w-20 shrink-0 bg-white/[0.03] border-r border-white/5 py-4">
                                                    <span className={`text-base font-black tracking-tighter ${isCancelled ? 'text-red-400 line-through' : 'text-white'}`}>
                                                        {displayTime.replace(/(am|pm)/, '')}
                                                    </span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-accent/80 -mt-1">
                                                        {displayTime.match(/(am|pm)/)?.[0]}
                                                    </span>
                                                </div>

                                                {/* Main Info */}
                                                <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-4 p-4">
                                                    {/* Client info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-lg font-bold truncate ${isCancelled ? 'text-muted line-through' : 'text-white'}`}>
                                                                {apt.clientName}
                                                            </span>
                                                            {blocked && <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-[10px] font-bold text-red-500 border border-red-500/20">BLOQUEADO</span>}
                                                        </div>
                                                        <a href={`tel:${apt.clientPhone}`} className="text-xs font-medium text-muted hover:text-accent transition-colors flex items-center gap-2 w-fit">
                                                            <div className="p-1 rounded-md bg-white/5"><Phone size={10} /></div> {apt.clientPhone}
                                                        </a>
                                                    </div>

                                                    {/* Service & Stylist */}
                                                    <div className="flex flex-col gap-1.5 md:min-w-[180px]">
                                                        <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
                                                            <div className="p-1 rounded-md bg-accent/10 text-accent"><Scissors size={12} /></div>
                                                            <span className="truncate">{service?.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs font-medium text-muted">
                                                            <div className="p-1 rounded-md bg-white/5"><User size={12} /></div>
                                                            <span className="truncate">{stylist?.name || 'Cualquier profesional'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center justify-end gap-2 pr-2">
                                                        {filter === 'recordatorios' ? (
                                                            <a href={generateReminderWhatsAppUrl(apt)} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-xl text-xs font-bold transition-all border border-emerald-500/20" title="Enviar Recordatorio">
                                                                <Send size={14} /> <span>Recordatorio</span>
                                                            </a>
                                                        ) : (
                                                            apt.status === 'confirmada' && (
                                                                <div className="flex items-center gap-1">
                                                                    <a href={generateWhatsAppUrl(apt)} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl text-muted hover:bg-emerald-500/10 hover:text-emerald-400 transition-all border border-transparent hover:border-emerald-500/20" title="WhatsApp">
                                                                        <MessageCircle size={20} />
                                                                    </a>
                                                                    <button onClick={() => handleAdminCancel(apt)} className="p-2.5 rounded-xl text-muted hover:bg-red-500/10 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20" title="Cancelar">
                                                                        <Trash2 size={20} />
                                                                    </button>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ));
                        })()}
                    </div>


                    {/* Waiting List & Logs (Persistent across views) */}
                    {(waitingList.length > 0 || cancellationLog.length > 0) && (
                        <div className="p-4 border-t border-white/5 flex flex-col sm:flex-row gap-3 bg-black/40 flex-none">
                            {waitingList.length > 0 && (
                                <div className="flex-1 rounded-xl bg-black/20 border border-white/5 overflow-hidden">
                                    <button
                                        onClick={() => setShowWaiting(!showWaiting)}
                                        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Users size={14} className="text-accent" />
                                            <span className="text-[10px] font-black uppercase tracking-wider text-muted">Lista de Espera ({waitingList.length})</span>
                                        </div>
                                        <ChevronDown size={14} className={`text-muted transition-transform ${showWaiting ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showWaiting && (
                                        <div className="p-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                                            {waitingList.map(client => (
                                                <div key={client.id} className="flex justify-between items-center p-2 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition-colors">
                                                    <div className="flex flex-col">
                                                        <span className="text-white font-bold text-xs">{client.name}</span>
                                                        <span className="text-muted text-[10px]">{client.phone} • {client.date}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <a href={`https://wa.me/${client.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-md">
                                                            <MessageCircle size={14} />
                                                        </a>
                                                        <button onClick={() => removeFromWaitingList(client.id)} className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded-md">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {cancellationLog.length > 0 && (
                                <div className="flex-1 rounded-xl bg-black/20 border border-white/5 overflow-hidden">
                                    <button
                                        onClick={() => setShowLog(!showLog)}
                                        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Clock size={14} className="text-red-400" />
                                            <span className="text-[10px] font-black uppercase tracking-wider text-muted">Historial de Cancelaciones</span>
                                        </div>
                                        <ChevronDown size={14} className={`text-muted transition-transform ${showLog ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showLog && (
                                        <div className="p-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                                            {cancellationLog.slice(0, 10).map(log => (
                                                <div key={log.id} className="flex justify-between items-center p-2 text-[10px] border-b border-white/5 last:border-0 hover:bg-white/5 rounded transition-colors">
                                                    <div className="flex flex-col">
                                                        <span className="text-white font-medium">{log.clientName}</span>
                                                        <span className="text-muted">{log.serviceName} • {log.date}</span>
                                                    </div>
                                                    <span className="opacity-40 text-[9px]">{new Date(log.cancelledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
