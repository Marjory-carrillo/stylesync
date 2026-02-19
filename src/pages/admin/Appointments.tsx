import { useState } from 'react';
import { useStore } from '../../lib/store';
import { Trash2, CheckCircle, User, Phone, Scissors, Send, Ban, ChevronDown, MessageCircle, Users, CalendarDays } from 'lucide-react';

import ResourceCalendar from '../../components/admin/ResourceCalendar';

export default function Appointments() {
    const {
        appointments,
        services,
        stylists,
        waitingList,
        cancellationLog,
        completeAppointment,
        cancelAppointment,
        removeFromWaitingList,
        getServiceById,
        getStylistById,
        isPhoneBlocked,
        generateWhatsAppUrl,
        generateReminderWhatsAppUrl,
        showToast
    } = useStore();

    const [filter, setFilter] = useState<'confirmada' | 'completada' | 'cancelada' | 'recordatorios'>('confirmada');
    const [showWaiting, setShowWaiting] = useState(false);
    const [showLog, setShowLog] = useState(false);

    // ── Calendar View Logic ──
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [calendarDate, setCalendarDate] = useState(new Date());

    // ── Filter Logic ──
    const isTomorrow = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return d.toDateString() === tomorrow.toDateString();
    };

    const filteredAppointments = appointments.filter(apt => {
        if (filter === 'recordatorios') {
            return apt.status === 'confirmada' && isTomorrow(apt.date);
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
                    {/* View Switcher */}
                    <div className="flex bg-white/5 rounded-xl p-0.5">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-muted hover:text-white'}`}
                        >
                            <Users size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'calendar' ? 'bg-white/10 text-white shadow-sm' : 'text-muted hover:text-white'}`}
                        >
                            <CalendarDays size={16} />
                        </button>
                    </div>

                    <div className="w-px h-6 bg-white/10" />

                    {/* Filters (Compact) */}
                    {viewMode === 'list' && (
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
                    )}
                </div>
            </div>

            {/* Alerts Container */}
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
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-black/20 rounded-3xl border border-white/5 backdrop-blur-sm">
                {viewMode === 'calendar' ? (
                    <ResourceCalendar
                        appointments={appointments}
                        stylists={stylists}
                        services={services}
                        currentDate={calendarDate}
                        onDateChange={setCalendarDate}
                        onAppointmentClick={(apt) => {
                            if (confirm(`¿Acciones para ${apt.clientName}?\n\nOK: Marcar como Completada\nCancel: Cancelar Cita`)) {
                                completeAppointment(apt.id);
                            } else {
                                handleAdminCancel(apt);
                            }
                        }}
                    />
                ) : (
                    <div className="overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {/* Empty State */}
                        {filteredAppointments.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-60">
                                <Scissors size={48} className="text-white/10 mb-4" />
                                <h3 className="text-lg font-medium text-white mb-1">Sin citas aquí</h3>
                                <p className="text-sm text-muted">No hay citas registradas en esta categoría.</p>
                            </div>
                        )}

                        {/* Ultra Compact List Items */}
                        {filteredAppointments.map(apt => {
                            const service = getServiceById(apt.serviceId);
                            const stylist = getStylistById(apt.stylistId);
                            const isCompleted = apt.status === 'completada';
                            const isCancelled = apt.status === 'cancelada';
                            const blocked = isPhoneBlocked(apt.clientPhone);

                            return (
                                <div
                                    key={apt.id}
                                    className={`group flex items-center gap-4 p-3 rounded-xl border transition-all ${isCompleted ? 'bg-white/5 border-transparent opacity-50 grayscale' :
                                        isCancelled ? 'bg-red-500/5 border-red-500/10 opacity-70' :
                                            'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20 hover:shadow-lg'
                                        }`}
                                >
                                    {/* Time Column */}
                                    <div className="flex flex-col items-center justify-center w-14 shrink-0">
                                        <span className={`text-lg font-bold tracking-tight ${isCancelled ? 'text-red-400 line-through' : 'text-white'}`}>
                                            {apt.time}
                                        </span>
                                        <span className="text-[10px] uppercase font-bold text-muted tracking-wider">
                                            {new Date(apt.date).toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 3)}
                                        </span>
                                    </div>

                                    {/* Divider */}
                                    <div className="w-px h-8 bg-white/10" />

                                    {/* Main Info */}
                                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                                        {/* Client */}
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold truncate ${isCancelled ? 'text-muted line-through' : 'text-white'}`}>
                                                    {apt.clientName}
                                                </span>
                                                {blocked && <Ban size={12} className="text-red-500" />}
                                            </div>
                                            <a href={`tel:${apt.clientPhone}`} className="text-xs text-muted hover:text-white transition-colors flex items-center gap-1 w-fit">
                                                <Phone size={10} /> {apt.clientPhone}
                                            </a>
                                        </div>

                                        {/* Details */}
                                        <div className="flex flex-col md:px-4">
                                            <span className="text-sm text-white/90 truncate flex items-center gap-1.5">
                                                <Scissors size={12} className="text-accent/60" /> {service?.name}
                                            </span>
                                            <span className="text-xs text-muted truncate flex items-center gap-1.5">
                                                <User size={12} className="opacity-50" /> {stylist?.name || 'Cualquiera'}
                                            </span>
                                        </div>

                                        {/* Actions (Right Aligned) */}
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {filter === 'recordatorios' ? (
                                                <a href={generateReminderWhatsAppUrl(apt)} target="_blank" rel="noreferrer" className="btn-icon bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white rounded-lg p-2 transition-colors" title="Enviar Recordatorio">
                                                    <Send size={16} />
                                                </a>
                                            ) : (
                                                apt.status === 'confirmada' && (
                                                    <>
                                                        <a href={generateWhatsAppUrl(apt)} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-muted hover:bg-white/10 hover:text-green-400 transition-colors" title="WhatsApp">
                                                            <MessageCircle size={18} />
                                                        </a>
                                                        <button onClick={() => completeAppointment(apt.id)} className="p-2 rounded-lg text-muted hover:bg-white/10 hover:text-emerald-400 transition-colors" title="Completar">
                                                            <CheckCircle size={18} />
                                                        </button>
                                                        <button onClick={() => handleAdminCancel(apt)} className="p-2 rounded-lg text-muted hover:bg-white/10 hover:text-red-400 transition-colors" title="Cancelar">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Collapsibles (Waiting/Log) - Inline Style */}
                        {(waitingList.length > 0 || cancellationLog.length > 0) && (
                            <div className="pt-4 border-t border-white/5 space-y-2">
                                {waitingList.length > 0 && (
                                    <div className="rounded-xl bg-black/20 border border-white/5 overflow-hidden">
                                        <button
                                            onClick={() => setShowWaiting(!showWaiting)}
                                            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                                        >
                                            <span className="text-xs font-bold uppercase tracking-wider text-muted px-1">Lista de Espera ({waitingList.length})</span>
                                            <ChevronDown size={14} className={`text-muted transition-transform ${showWaiting ? 'rotate-180' : ''}`} />
                                        </button>
                                        {showWaiting && (
                                            <div className="p-2 space-y-1">
                                                {waitingList.map(client => (
                                                    <div key={client.id} className="flex justify-between items-center p-2 rounded-lg bg-white/5 text-sm">
                                                        <span>{client.name} <span className="text-muted text-xs">({client.phone})</span></span>
                                                        <button onClick={() => removeFromWaitingList(client.id)} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={14} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {cancellationLog.length > 0 && (
                                    <div className="rounded-xl bg-black/20 border border-white/5 overflow-hidden">
                                        <button
                                            onClick={() => setShowLog(!showLog)}
                                            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                                        >
                                            <span className="text-xs font-bold uppercase tracking-wider text-muted px-1">Cancelaciones Recientes</span>
                                            <ChevronDown size={14} className={`text-muted transition-transform ${showLog ? 'rotate-180' : ''}`} />
                                        </button>
                                        {showLog && (
                                            <div className="p-2">
                                                {cancellationLog.slice(0, 5).map(log => (
                                                    <div key={log.id} className="flex justify-between items-center p-2 text-xs border-b border-white/5 last:border-0">
                                                        <span className="text-muted">{log.clientName}</span>
                                                        <span className="opacity-50">{new Date(log.cancelledAt).toLocaleDateString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
