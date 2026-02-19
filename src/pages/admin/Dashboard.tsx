import { useMemo } from 'react';
import { useStore } from '../../lib/store';
import { Calendar, DollarSign, Users, TrendingUp, Bell, MessageCircle, Phone, Clock } from 'lucide-react';

export default function Dashboard() {
    const {
        getAppointmentsForToday, getTodayRevenue, appointments, services,
        getReminders, generateReminderWhatsAppUrl, getServiceById,
        cancellationLog, waitingList, businessConfig
    } = useStore();
    const todayAppts = getAppointmentsForToday();
    const revenue = getTodayRevenue();
    const totalClients = new Set(appointments.map(a => a.clientPhone)).size;
    const reminders = getReminders();

    // ── Reports Logic ──
    const currentMonthStats = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthAppts = appointments.filter(a => {
            const d = new Date(a.date + 'T' + a.time);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear && a.status !== 'cancelada';
        });

        const revenue = monthAppts.reduce((sum, appt) => {
            const svc = services.find(s => s.id === appt.serviceId);
            return sum + (svc?.price || 0);
        }, 0);

        return { count: monthAppts.length, revenue };
    }, [appointments, services]);

    const topServices = useMemo(() => {
        const counts: Record<number, number> = {};
        appointments.forEach(a => {
            if (a.status === 'cancelada') return;
            counts[a.serviceId] = (counts[a.serviceId] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([id, count]) => {
                const svc = services.find(s => s.id === Number(id));
                return { name: svc?.name || 'Unknown', count, price: svc?.price || 0 };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);
    }, [appointments, services]);

    return (
        <div className="animate-fade-in space-y-6 md:space-y-8">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white mb-1">Dashboard</h2>
                    <p className="text-slate-400 text-xs md:text-sm">Resumen de actividad y métricas clave.</p>
                </div>
                <div className="glass-panel px-3 py-1.5 md:px-4 md:py-2 rounded-xl flex items-center gap-2 text-xs md:text-sm text-accent whitespace-nowrap">
                    <Clock size={14} className="md:size-4" />
                    <span className="capitalize">{new Date().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </div>
            </header>

            {/* ── Client App Link Banner ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/20 via-blue-600/10 to-purple-600/20 border border-blue-500/20 p-5 md:p-6 shadow-xl mb-8 group">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                    <Users size={120} />
                </div>
                <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    <div className="flex-1">
                        <h3 className="text-lg md:text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <span className="bg-blue-500/20 p-1.5 rounded-lg text-blue-400"><Users size={20} /></span>
                            Tu App de Reservas
                        </h3>
                        <p className="text-slate-300 text-xs md:text-sm max-w-xl leading-relaxed">
                            Tus clientes pueden instalar esta web como una app para reservar sin barra de navegación.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <div className="flex items-center bg-black/40 rounded-xl px-4 py-3 border border-white/5 flex-1 md:min-w-[280px]">
                            <code className="text-blue-400 font-mono text-xs select-all truncate">
                                stylesync.app/reserva/{businessConfig.slug || '...'}
                            </code>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const url = `${window.location.origin}/reserva/${businessConfig.slug}`;
                                    navigator.clipboard.writeText(url);
                                    alert('¡Enlace copiado!');
                                }}
                                className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-900/20 text-xs md:text-sm"
                            >
                                Copiar Link
                            </button>
                            <a
                                href={`/reserva/${businessConfig.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-3 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-colors border border-white/10 text-xs md:text-sm flex items-center gap-2"
                            >
                                Abrir
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Alerts & Recovery Opportunities ── */}
            {(cancellationLog.length > 0 && waitingList.length > 0) && (
                <div className="glass-panel p-6 rounded-xl border-l-4 border-yellow-500 relative overflow-hidden mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500 animate-pulse">
                            <Bell size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white">Oportunidades de Recuperación</h3>
                    </div>

                    <div className="space-y-4">
                        {cancellationLog.slice(0, 3).map(cancel => {
                            // Find matches in waiting list for same date
                            const matches = waitingList.filter(w => w.date === cancel.date && w.serviceId === getServiceById(services.find(s => s.name === cancel.serviceName)?.id ?? 0)?.id);
                            if (matches.length === 0) return null;

                            return (
                                <div key={cancel.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-sm text-red-400 mb-2">
                                        <Clock size={14} />
                                        <span>Cita Cancelada: <strong>{cancel.date} - {cancel.time}</strong> ({cancel.serviceName})</span>
                                    </div>
                                    <p className="text-xs text-muted mb-3">Hay {matches.length} clientes esperando para esta fecha:</p>

                                    <div className="space-y-2">
                                        {matches.map(match => (
                                            <div key={match.id} className="flex justify-between items-center bg-black/20 p-2 rounded border border-white/5">
                                                <div>
                                                    <span className="text-white font-bold text-sm block">{match.name}</span>
                                                    <span className="text-xs text-muted">{match.phone}</span>
                                                </div>
                                                <a
                                                    href={`https://wa.me/${match.phone.replace(/\D/g, '')}?text=Hola ${match.name}, vimos que estabas interesado en una cita para el ${match.date}. ¡Se acaba de liberar un espacio a las ${cancel.time}! ¿Te interesa?`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-sm bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1 rounded"
                                                >
                                                    <MessageCircle size={12} className="mr-1" /> Avisar
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-card p-6 rounded-xl flex items-center gap-4 group">
                    <div className="p-3 rounded-lg bg-accent/10 text-accent group-hover:scale-110 transition-transform duration-200">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-muted mb-1">Citas Hoy</p>
                        <p className="text-2xl font-bold text-white">{todayAppts.length}</p>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-xl flex items-center gap-4 group">
                    <div className="p-3 rounded-lg bg-green-500/10 text-green-500 group-hover:scale-110 transition-transform duration-200">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-muted mb-1">Ingresos Hoy</p>
                        <p className="text-2xl font-bold text-green-500">${revenue}</p>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-xl flex items-center gap-4 group">
                    <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform duration-200">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-muted mb-1">Clientes Totales</p>
                        <p className="text-2xl font-bold text-white">{totalClients}</p>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-xl flex items-center gap-4 group">
                    <div className="p-3 rounded-lg bg-pink-500/10 text-pink-500 group-hover:scale-110 transition-transform duration-200">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-muted mb-1">Ingresos Mes</p>
                        <p className="text-2xl font-bold text-pink-500">${currentMonthStats.revenue}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ── Top Services ── */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={18} className="text-accent" /> Servicios Top
                    </h3>
                    <div className="space-y-4">
                        {topServices.map((svc, i) => (
                            <div key={i} className="group">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-300">{svc.name}</span>
                                    <span className="text-white font-bold">{svc.count} citas</span>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-accent to-orange-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${(svc.count / (topServices[0]?.count || 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                        {topServices.length === 0 && <p className="text-sm text-muted">No hay datos suficientes.</p>}
                    </div>
                </div>

                {/* ── Reminders ── */}
                <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/5">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Bell size={100} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="flex h-3 w-3 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
                            </span>
                            <h3 className="font-bold text-lg text-white">Recordatorios para Mañana ({reminders.length})</h3>
                        </div>
                        <p className="text-sm text-muted mb-6 max-w-2xl">
                            Estas citas fueron reservadas con anticipación (3+ días). Se recomienda enviar un recordatorio para confirmar asistencia.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {reminders.map(appt => {
                                const svc = getServiceById(appt.serviceId);
                                const waUrl = generateReminderWhatsAppUrl(appt);
                                return (
                                    <div key={appt.id} className="bg-white/5 border border-white/5 p-4 rounded-lg hover:bg-white/10 transition-colors">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="font-bold text-white">{appt.clientName}</div>
                                                <div className="text-xs text-muted">{svc?.name}</div>
                                            </div>
                                            <span className="text-accent font-mono font-bold bg-accent/10 px-2 py-1 rounded text-xs">{appt.time}</span>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-muted mb-4">
                                            <Phone size={12} />
                                            <span>{appt.clientPhone}</span>
                                        </div>

                                        <a
                                            href={waUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-primary w-full py-2 text-xs gap-2"
                                        >
                                            <MessageCircle size={14} /> WhatsApp
                                        </a>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Today's Appointments */}
            <div className="glass-card p-6 rounded-xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-white">Próximas Citas de Hoy</h3>
                    <button className="text-xs text-accent hover:underline">Ver todas</button>
                </div>

                {todayAppts.length > 0 ? (
                    <div className="space-y-3">
                        {todayAppts.map(appt => {
                            const svc = services.find(s => s.id === appt.serviceId);
                            return (
                                <div key={appt.id} className="flex justify-between items-center p-4 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-muted font-bold group-hover:text-white transition-colors">
                                            {appt.clientName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white">{appt.clientName}</div>
                                            <div className="text-xs text-muted flex items-center gap-2">
                                                <span>{svc?.name}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                                <span>{appt.clientPhone}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="font-bold text-white text-lg">{appt.time}</div>
                                            <div className="text-xs text-muted">Hoy</div>
                                        </div>
                                        <div className={`
                                            px-3 py-1 rounded-full text-xs font-bold border
                                            ${appt.status === 'confirmada' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}
                                        `}>
                                            {appt.status}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted bg-white/5 rounded-lg border border-dashed border-white/10">
                        <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No hay citas programadas para hoy.</p>
                        <p className="text-xs mt-2">Disfruta tu día libre o gestiona otras tareas.</p>
                    </div>
                )}
            </div>
        </div>
    );
}


