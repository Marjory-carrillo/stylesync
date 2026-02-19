import { useState } from 'react';
import { useStore } from '../../lib/store';
import { Trash2, CheckCircle, User, Phone, Scissors, AlertOctagon, ChevronRight, Send, Ban, ChevronDown, MessageCircle, Users, AlertTriangle, CalendarDays } from 'lucide-react';

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
                <div className="flex flex-wrap items-center gap-3 p-1.5 bg-black/20 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl">
                    {/* View Toggle Segmented Control */}
                    <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-muted hover:text-white'}`}
                        >
                            <Users size={14} /> Lista
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'calendar' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-muted hover:text-white'}`}
                        >
                            <CalendarDays size={14} /> Calendario
                        </button>
                    </div>

                    {/* Divider */}
                    {viewMode === 'list' && <div className="w-px h-8 bg-white/10 mx-1"></div>}

                    {/* List Filters */}
                    {viewMode === 'list' && (
                        <div className="flex gap-1 overflow-x-auto no-scrollbar">
                            {[
                                { id: 'confirmada', label: 'Confirmadas', icon: '✅' },
                                { id: 'recordatorios', label: 'Recordatorios', icon: '🔔' },
                                { id: 'completada', label: 'Historial', icon: '🏁' },
                                { id: 'cancelada', label: 'Canceladas', icon: '🚫' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilter(tab.id as any)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${filter === tab.id
                                        ? 'bg-accent/10 border-accent/20 text-accent shadow-glow'
                                        : 'bg-transparent border-transparent text-muted hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <span className="opacity-70 mr-1.5">{tab.icon}</span> {tab.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Waiting List Alert - Visible in both modes if relevant */}
            {waitingList.length > 0 && !showWaiting && (
                <button
                    className="w-full group flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 to-orange-600/5 border border-orange-500/20 hover:border-orange-500/40 transition-all cursor-pointer shadow-lg shadow-orange-900/5 mb-4"
                    onClick={() => setShowWaiting(true)}
                >
                    <div className="flex items-center gap-4 text-left">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-orange-500/20 text-orange-500 group-hover:scale-110 transition-transform">
                            <AlertOctagon size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg">Lista de Espera Activa</h3>
                            <p className="text-sm text-orange-200/70">
                                Hay <span className="font-bold text-orange-400">{waitingList.length} clientes</span> esperando un turno para esta fecha.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 font-bold text-sm group-hover:bg-orange-500/20 transition-colors">
                        Ver Lista <ChevronDown size={16} />
                    </div>
                </button>
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
                            <div className="flex flex-col items-center justify-center py-24 text-center rounded-3xl border-2 border-dashed border-white/5 bg-white/5/50">
                                <div className="w-20 h-20 bg-gradient-to-br from-white/5 to-white/10 rounded-full flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/10">
                                    <Scissors size={40} className="text-white/20" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Sin citas {filter}s</h3>
                                <p className="text-muted max-w-xs mx-auto">
                                    No hay citas en esta categoría por el momento.
                                </p>
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
                                <div key={apt.id} className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${isCompleted ? 'bg-slate-900/50 border-white/5 opacity-60' :
                                    isCancelled ? 'bg-red-950/10 border-red-500/10' :
                                        'glass-card border-white/10 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5'
                                    }`}>
                                    {/* Status Stripe */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isCompleted ? 'bg-slate-500' :
                                        isCancelled ? 'bg-red-500' :
                                            'bg-accent'
                                        }`} />

                                    <div className="flex flex-col md:flex-row gap-4 p-5 pl-7 items-center">

                                        {/* Time Box */}
                                        <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl border shadow-inner shrink-0 ${isCompleted ? 'bg-slate-800 border-white/5 text-slate-400' :
                                            isCancelled ? 'bg-red-900/20 border-red-500/20 text-red-500' :
                                                'bg-gradient-to-br from-slate-900 to-black border-white/10 text-white group-hover:border-accent/30 transition-colors'
                                            }`}>
                                            <span className={`text-xl font-bold tracking-tight ${!isCompleted && !isCancelled ? 'text-accent drop-shadow-sm' : ''}`}>{apt.time}</span>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 text-center md:text-left space-y-1">
                                            <div className="flex flex-col md:flex-row md:items-center gap-2">
                                                <h3 className={`text-xl font-bold truncate ${isCancelled ? 'line-through text-muted-foreground' : 'text-white'}`}>
                                                    {apt.clientName}
                                                </h3>
                                                {isCompleted && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/20 self-center md:self-auto"><CheckCircle size={10} /> Completada</span>}
                                            </div>

                                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1.5 text-slate-300 group-hover:text-white transition-colors">
                                                    <Scissors size={14} className="text-accent/70" /> {service?.name || 'Servicio eliminado'}
                                                </span>
                                                <span className="flex items-center gap-1.5" title="Estilista asignado">
                                                    <User size={14} className="opacity-50" /> {stylist?.name || 'Sin asignar'}
                                                </span>
                                                <span className="flex items-center gap-1.5 font-mono text-xs opacity-50">
                                                    {apt.date}
                                                </span>
                                            </div>

                                            {/* Phone badge */}
                                            <div className="pt-1 flex items-center justify-center md:justify-start gap-2">
                                                <a href={`tel:${apt.clientPhone}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-xs text-muted-foreground border border-white/5">
                                                    <Phone size={10} /> {apt.clientPhone}
                                                </a>
                                                {blocked && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 border border-red-500/20">BLOQUEADO</span>}
                                            </div>
                                        </div>

                                        {/* Actions Bar (Glass container) */}
                                        <div className="flex items-center gap-1 p-1.5 rounded-xl bg-black/20 border border-white/5 backdrop-blur-md shadow-inner self-center md:self-auto">
                                            {filter === 'recordatorios' ? (
                                                <a
                                                    href={generateReminderWhatsAppUrl(apt)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="btn btn-sm bg-green-600 hover:bg-green-500 text-white border-none gap-2 shadow-lg shadow-green-900/20"
                                                >
                                                    <Send size={14} /> <span className="hidden lg:inline">Recordar</span>
                                                </a>
                                            ) : (
                                                <>
                                                    {apt.status === 'confirmada' && (
                                                        <>
                                                            <a href={generateWhatsAppUrl(apt)} target="_blank" rel="noreferrer" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-muted hover:text-green-400 transition-all" title="Chat WhatsApp">
                                                                <MessageCircle size={18} />
                                                            </a>
                                                            <button onClick={() => completeAppointment(apt.id)} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-muted hover:text-emerald-400 transition-all" title="Completar">
                                                                <CheckCircle size={18} />
                                                            </button>
                                                            <button onClick={() => handleAdminCancel(apt)} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-muted hover:text-red-400 transition-all" title="Cancelar">
                                                                <Trash2 size={18} />
                                                            </button>
                                                            {!blocked && (
                                                                <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-muted hover:text-red-500 transition-all" title="Bloquear Cliente" onClick={() => { if (confirm('¿Bloquear?')) blockPhone(apt.clientPhone) }}>
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
                                className="flex items-center gap-4 w-full p-4 rounded-xl bg-white/5 border border-white/5 hover:border-accent/30 hover:bg-white/10 transition-all text-left group"
                                onClick={() => setShowWaiting(!showWaiting)}
                            >
                                <div className="p-2.5 rounded-xl bg-accent/20 text-accent group-hover:scale-110 transition-transform shadow-lg shadow-accent/10">
                                    <Users size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-white flex items-center gap-2 text-lg">
                                        Lista de Espera
                                        {waitingList.length > 0 && <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-accent text-white rounded-full shadow-glow">{waitingList.length}</span>}
                                    </h3>
                                    <p className="text-xs text-muted">Clientes esperando un turno</p>
                                </div>
                                <div className={`p-2 rounded-full bg-black/20 text-muted transition-transform duration-300 ${showWaiting ? 'rotate-180' : ''}`}>
                                    <ChevronDown size={18} />
                                </div>
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
                                className="flex items-center gap-4 w-full p-4 rounded-xl bg-white/5 border border-white/5 hover:border-red-500/30 hover:bg-white/10 transition-all text-left group mt-4"
                                onClick={() => setShowLog(!showLog)}
                            >
                                <div className="p-2.5 rounded-xl bg-red-500/20 text-red-500 group-hover:scale-110 transition-transform shadow-lg shadow-red-900/20">
                                    <AlertTriangle size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-white flex items-center gap-2 text-lg">
                                        Registro de Cancelaciones
                                        {cancellationLog.length > 0 && <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-white/10 text-white rounded-full">{cancellationLog.length}</span>}
                                    </h3>
                                    <p className="text-xs text-muted">Historial de citas canceladas</p>
                                </div>
                                <div className={`p-2 rounded-full bg-black/20 text-muted transition-transform duration-300 ${showLog ? 'rotate-180' : ''}`}>
                                    <ChevronDown size={18} />
                                </div>
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
