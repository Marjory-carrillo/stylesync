import { useState } from 'react';
import { useStore } from '../../lib/store';
import { Trash2, CheckCircle, User, Phone, Scissors, AlertOctagon, ChevronRight, Send, Ban, ChevronDown, ChevronUp, MessageCircle, Users, AlertTriangle, CalendarDays } from 'lucide-react';

import ResourceCalendar from '../../components/admin/ResourceCalendar';

export default function Appointments() {
    const {
        appointments, cancellationLog, waitingList, stylists, services,
        getServiceById, getStylistById, cancelAppointment, completeAppointment,
        blockPhone, isPhoneBlocked, generateWhatsAppUrl, generateReminderWhatsAppUrl, removeFromWaitingList
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
            alert(`⚠️ ATENCIÓN: Hay ${waitingForDate.length} cliente(s) en la Lista de Espera para esta fecha.\n\nRevisa la sección 'Lista de Espera' para contactarlos.`);
            setShowWaiting(true);
        }
    };

    return (
        <div className="animate-fade-in space-y-4 h-[calc(100vh-100px)] flex flex-col"> {/* Full height container */}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-none">
                <div>
                    <h2 className="text-2xl font-bold text-white">Agenda de Citas</h2>
                    <p className="text-sm text-muted">Gestiona las reservas y el flujo de trabajo.</p>
                </div>

                {/* View Switcher & Filters */}
                <div className="flex flex-wrap gap-2 p-1 bg-slate-900/50 rounded-lg border border-white/10">

                    {/* View Toggle */}
                    <div className="flex mr-2 bg-white/5 rounded-md p-0.5 border border-white/5">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-white'}`}
                        >
                            <Users size={14} /> Lista
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'calendar' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-white'}`}
                        >
                            <CalendarDays className="mr-2" size={20} /> Calendario
                        </button>
                    </div>

                    {/* List Mode Filters */}
                    {viewMode === 'list' && (
                        <>
                            <button
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filter === 'confirmada' ? 'bg-white/10 text-white shadow-sm' : 'text-muted hover:text-white hover:bg-white/5'}`}
                                onClick={() => setFilter('confirmada')}
                            >
                                Confirmadas
                            </button>
                            <button
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${filter === 'recordatorios' ? 'bg-accent/20 text-accent shadow-sm ring-1 ring-accent/50' : 'text-muted hover:text-white hover:bg-white/5'}`}
                                onClick={() => setFilter('recordatorios')}
                            >
                                🔔 Recordatorios
                            </button>
                            <button
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filter === 'completada' ? 'bg-white/10 text-white shadow-sm' : 'text-muted hover:text-white hover:bg-white/5'}`}
                                onClick={() => setFilter('completada')}
                            >
                                Historial
                            </button>
                            <button
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filter === 'cancelada' ? 'bg-white/10 text-white shadow-sm' : 'text-muted hover:text-white hover:bg-white/5'}`}
                                onClick={() => setFilter('cancelada')}
                            >
                                Canceladas
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Waiting List Alert - Visible in both modes if relevant */}
            {waitingList.length > 0 && !showWaiting && (
                <div
                    className="glass-panel p-4 rounded-xl border border-accent/30 bg-accent/5 cursor-pointer hover:bg-accent/10 transition-colors flex justify-between items-center group flex-none"
                    onClick={() => setShowWaiting(true)}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-accent/20 text-accent animate-pulse">
                            <AlertOctagon size={20} />
                        </div>
                        <span className="font-bold text-accent">
                            Hay {waitingList.length} clientes en Lista de Espera esperando un turno
                        </span>
                    </div>
                    <ChevronRight size={20} className="text-accent group-hover:translate-x-1 transition-transform" />
                </div>
            )}

            {/* ─── MAIN CONTENT AREA ─── */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">

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
                    /* LIST VIEW CONTENT */
                    <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 space-y-4 pb-20">
                        {/* Empty State */}
                        {filteredAppointments.length === 0 && (
                            <div className="py-20 text-center glass-panel rounded-2xl border-dashed border-white/10">
                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-muted">
                                    <Scissors size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Sin citas {filter}s</h3>
                                <p className="text-muted">No hay citas en esta categoría por ahora.</p>
                            </div>
                        )}

                        {/* Appointments List */}
                        {filteredAppointments.map(apt => {
                            const service = getServiceById(apt.serviceId);
                            const stylist = getStylistById(apt.stylistId);
                            const isCompleted = apt.status === 'completada';
                            const isCancelled = apt.status === 'cancelada';
                            const blocked = isPhoneBlocked(apt.clientPhone);

                            return (
                                <div key={apt.id} className={`glass-card p-5 rounded-xl border border-white/5 relative group transition-all hover:border-white/20 ${isCompleted ? 'opacity-75' : ''}`}>
                                    <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">

                                        {/* Info */}
                                        <div className="flex items-start gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shadow-inner ${isCompleted ? 'bg-emerald-500/20 text-emerald-500' : (isCancelled ? 'bg-slate-700 text-slate-400' : 'bg-gradient-to-br from-accent to-orange-500 text-white')}`}>
                                                {apt.time}
                                            </div>
                                            <div>
                                                <h3 className={`text-lg font-bold text-white flex items-center gap-2 ${isCancelled ? 'line-through text-muted' : ''}`}>
                                                    {apt.clientName}
                                                    {isCompleted && <CheckCircle size={16} className="text-emerald-500" />}
                                                </h3>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted mt-1">
                                                    <span className="flex items-center gap-1.5 font-medium text-slate-300">
                                                        <Scissors size={14} /> {service?.name || 'Servicio eliminado'}
                                                    </span>
                                                    <span className="flex items-center gap-1.5" title="Estilista asignado">
                                                        <User size={14} /> {stylist?.name || 'Sin asignar'}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 font-mono text-xs opacity-70">
                                                        {apt.date}
                                                    </span>
                                                    {filter === 'recordatorios' && (
                                                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-accent/20 text-accent ml-2">
                                                            {apt.date}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1 flex gap-2 text-xs text-muted">
                                                    <span className="flex items-center gap-1 group/phone cursor-pointer">
                                                        <Phone size={12} /> {apt.clientPhone}
                                                    </span>
                                                    {blocked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-500">BLOQUEADO</span>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 self-end md:self-auto">
                                            {filter === 'recordatorios' ? (
                                                <a
                                                    href={generateReminderWhatsAppUrl(apt)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="btn btn-sm bg-green-600 hover:bg-green-500 text-white border-none gap-2"
                                                >
                                                    <Send size={14} /> Recordar
                                                </a>
                                            ) : (
                                                <>
                                                    {apt.status === 'confirmada' && (
                                                        <>
                                                            <a href={generateWhatsAppUrl(apt)} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost hover:text-green-400" title="Chat WhatsApp">
                                                                <MessageCircle size={18} />
                                                            </a>
                                                            <button onClick={() => completeAppointment(apt.id)} className="btn btn-sm btn-ghost hover:text-emerald-400" title="Completar">
                                                                <CheckCircle size={18} />
                                                            </button>
                                                            <button onClick={() => handleAdminCancel(apt)} className="btn btn-sm btn-ghost hover:text-red-400" title="Cancelar">
                                                                <Trash2 size={18} />
                                                            </button>
                                                            {!blocked && (
                                                                <button className="btn btn-sm btn-ghost hover:text-red-500" title="Bloquear Cliente" onClick={() => { if (confirm('¿Bloquear?')) blockPhone(apt.clientPhone) }}>
                                                                    <Ban size={18} />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* ── Waiting List Section (Inside List View Scroll) ── */}
                        <div className="pt-4 border-t border-white/5">
                            <button
                                className="flex items-center gap-3 w-full p-4 rounded-xl hover:bg-white/5 transition-colors text-left group"
                                onClick={() => setShowWaiting(!showWaiting)}
                            >
                                <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:scale-110 transition-transform">
                                    <Users size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        Lista de Espera <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-muted">{waitingList.length}</span>
                                    </h3>
                                </div>
                                {showWaiting ? <ChevronUp size={20} className="text-muted" /> : <ChevronDown size={20} className="text-muted" />}
                            </button>
                            {showWaiting && (
                                <div className="glass-panel mt-2 rounded-xl overflow-hidden animate-fade-in mb-4">
                                    {waitingList.length > 0 ? (
                                        <div className="divide-y divide-white/5">
                                            {waitingList.map(client => {
                                                const svc = getServiceById(client.serviceId);
                                                return (
                                                    <div key={client.id} className="p-4 flex justify-between items-center text-sm">
                                                        <div>
                                                            <span className="font-bold block">{client.name}</span>
                                                            <span className="text-muted">{client.phone} • {svc?.name}</span>
                                                        </div>
                                                        <button onClick={() => removeFromWaitingList(client.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : <div className="p-4 text-center text-muted text-sm">Vacía</div>}
                                </div>
                            )}
                        </div>

                        {/* ── Cancellation Log (Inside List View Scroll) ── */}
                        <div>
                            <button
                                className="flex items-center gap-3 w-full p-4 rounded-xl hover:bg-white/5 transition-colors text-left group"
                                onClick={() => setShowLog(!showLog)}
                            >
                                <div className="p-2 rounded-lg bg-red-500/10 text-red-500 group-hover:scale-110 transition-transform">
                                    <AlertTriangle size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        Registro de Cancelaciones <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-muted">{cancellationLog.length}</span>
                                    </h3>
                                </div>
                                {showLog ? <ChevronUp size={20} className="text-muted" /> : <ChevronDown size={20} className="text-muted" />}
                            </button>
                            {showLog && (
                                <div className="glass-panel mt-2 rounded-xl overflow-hidden animate-fade-in bg-black/20">
                                    {cancellationLog.length > 0 ? (
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="text-xs uppercase text-muted bg-white/5 border-b border-white/5">
                                                    <th className="p-3">Cliente</th>
                                                    <th className="p-3">Motivo/Fecha</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {cancellationLog.map(log => (
                                                    <tr key={log.id}>
                                                        <td className="p-3">
                                                            <div className="font-bold text-white">{log.clientName}</div>
                                                            <div className="text-xs text-muted">{log.serviceName}</div>
                                                        </td>
                                                        <td className="p-3 text-muted">
                                                            <div>{log.date} {log.time}</div>
                                                            <div className="text-[10px] opacity-60">Cancelado: {new Date(log.cancelledAt).toLocaleDateString()}</div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : <div className="p-4 text-center text-muted text-sm">Sin cancelaciones</div>}
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
