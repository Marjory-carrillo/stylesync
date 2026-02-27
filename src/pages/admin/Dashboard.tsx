import { useMemo } from 'react';
import { useStore } from '../../lib/store';
import { Calendar, DollarSign, Users, TrendingUp, Bell, MessageCircle, Phone, Clock, Scissors, CreditCard, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
    const {
        getAppointmentsForToday, getTodayRevenue, appointments, services,
        getReminders, generateReminderWhatsAppUrl, getServiceById,
        cancellationLog, waitingList, businessConfig, showToast,
        addToWaitingList
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

        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        let currentRevenue = 0;
        let lastRevenue = 0;
        let currentCompleted = 0;
        let lastCompleted = 0;
        let currentCanceled = 0;

        appointments.forEach(a => {
            const d = new Date(a.date + 'T' + a.time);
            const isCurrentMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            const isLastMonth = d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
            const isCanceled = a.status === 'cancelada';

            const svc = services.find(s => s.id === a.serviceId);
            const price = svc?.price || 0;

            if (isCurrentMonth) {
                if (isCanceled) {
                    currentCanceled++;
                } else {
                    currentCompleted++;
                    currentRevenue += price;
                }
            } else if (isLastMonth) {
                if (!isCanceled) {
                    lastCompleted++;
                    lastRevenue += price;
                }
            }
        });

        // Growth metrics
        const revenueGrowth = lastRevenue === 0 ? 100 : ((currentRevenue - lastRevenue) / lastRevenue) * 100;
        const appsGrowth = lastCompleted === 0 ? 100 : ((currentCompleted - lastCompleted) / lastCompleted) * 100;

        return {
            revenue: currentRevenue,
            lastRevenue,
            revenueGrowth,
            count: currentCompleted,
            appsGrowth,
            canceled: currentCanceled
        };
    }, [appointments, services]);

    // Graph Data: Last 7 Days Revenue
    const revenueChartData = useMemo(() => {
        const data = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toLocaleDateString('en-CA');

            const dayRevenue = appointments
                .filter(a => a.date === dateStr && a.status !== 'cancelada')
                .reduce((sum, appt) => {
                    const svc = services.find(s => s.id === appt.serviceId);
                    return sum + (svc?.price || 0);
                }, 0);

            data.push({
                name: d.toLocaleDateString('es-MX', { weekday: 'short' }).substring(0, 3).toUpperCase(),
                date: dateStr,
                Ingresos: dayRevenue
            });
        }
        return data;
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
                <div className="glass-panel px-4 py-2 rounded-2xl flex items-center gap-2 text-xs md:text-sm text-cyan-400 whitespace-nowrap shadow-inner">
                    <Clock size={14} className="md:size-4" />
                    <span className="capitalize">{new Date().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </div>
            </header>

            {/* ── Client App Link Banner ── */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-cyan-600/20 via-blue-600/10 to-purple-600/20 border border-cyan-500/20 p-6 md:p-10 shadow-2xl mb-10 group">
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
                                citalink.app/reserva/{businessConfig.slug || '...'}
                            </code>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const url = `${window.location.origin}/reserva/${businessConfig.slug}`;
                                    navigator.clipboard.writeText(url);
                                    showToast('¡Enlace copiado!', 'success');
                                }}
                                className="flex-1 sm:flex-none px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-2xl hover:from-cyan-400 hover:to-blue-500 transition-all active:scale-95 shadow-lg shadow-cyan-900/20 text-xs md:text-sm"
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
            {
                (cancellationLog.length > 0 && waitingList.length > 0) && (
                    <div className="glass-panel p-6 rounded-xl border-l-4 border-yellow-500 relative overflow-hidden mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500 animate-pulse">
                                <Bell size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white">Oportunidades de Recuperación</h3>
                        </div>

                        <div className="space-y-4">
                            {cancellationLog.slice(0, 5).map(cancel => {
                                // Find matches in waiting list for same date
                                // We match primarily by date now, and show the service name in the UI for context
                                const matches = waitingList.filter(w => w.date === cancel.date);
                                if (matches.length === 0) return null;

                                return (
                                    <div key={cancel.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                                        <div className="flex items-center gap-2 text-sm text-red-400 mb-2">
                                            <Clock size={14} />
                                            {/* Formatter for 12h time */}
                                            {(() => {
                                                const [h, m] = cancel.time.split(':');
                                                let hh = parseInt(h);
                                                const ampm = hh >= 12 ? 'pm' : 'am';
                                                hh = hh % 12;
                                                hh = hh ? hh : 12;
                                                const time12 = `${hh}:${m}${ampm}`;
                                                return <span>Espacio liberado el <strong>{cancel.date}</strong> a las <strong>{time12}</strong> ({cancel.serviceName})</span>;
                                            })()}
                                        </div>
                                        <p className="text-xs text-muted mb-3">Hay {matches.length} clientes esperando para esta fecha:</p>

                                        <div className="space-y-2">
                                            {matches.map(match => {
                                                const [h, m] = cancel.time.split(':');
                                                let hh = parseInt(h);
                                                const ampm = hh >= 12 ? 'pm' : 'am';
                                                hh = hh % 12;
                                                hh = hh ? hh : 12;
                                                const time12Str = `${hh}:${m}${ampm}`;

                                                return (
                                                    <div key={match.id} className="flex justify-between items-center bg-black/20 p-2 rounded border border-white/5">
                                                        <div>
                                                            <span className="text-white font-bold text-sm block">{match.name}</span>
                                                            <span className="text-xs text-muted">{match.phone}</span>
                                                        </div>
                                                        <a
                                                            href={`https://wa.me/${match.phone.replace(/\D/g, '')}?text=Hola ${match.name}, te contactamos de ${businessConfig.name}. ¡Se acaba de liberar un espacio el ${match.date} a las ${time12Str}! ¿Te interesa tomarlo?`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn btn-sm bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                                                        >
                                                            <MessageCircle size={14} /> Avisar Cliente
                                                        </a>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            }

            {/* ── General Waiting List Header (Always visible if there's someone waiting) ── */}
            {waitingList.length > 0 && (
                <div className="glass-panel p-6 rounded-2xl border border-white/5 mb-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Users size={20} className="text-accent" /> Lista de Espera ({waitingList.length})
                            </h3>
                            <p className="text-xs text-muted">Clientes esperando un espacio libre</p>
                        </div>
                        <button
                            onClick={async () => {
                                const name = prompt('Nombre del cliente:');
                                if (!name) return;
                                const phone = prompt('WhatsApp (10 dígitos):');
                                if (!phone) return;
                                const date = prompt('Fecha (YYYY-MM-DD):', new Date().toLocaleDateString('en-CA'));
                                if (!date) return;

                                // Find first service as default
                                const serviceId = services[0]?.id || 0;

                                await addToWaitingList({
                                    name,
                                    phone,
                                    date,
                                    serviceId
                                });
                                showToast('Cliente añadido a la lista', 'success');
                            }}
                            className="px-4 py-2 bg-accent/20 text-accent hover:bg-accent hover:text-white rounded-xl border border-accent/20 transition-all font-bold text-xs"
                        >
                            + Añadir a Lista
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {waitingList.map(item => {
                            const svc = getServiceById(item.serviceId);
                            return (
                                <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between group hover:bg-white/10 transition-all">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <span className="text-white font-bold block">{item.name}</span>
                                            <span className="text-xs text-muted">{item.phone}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-black uppercase text-accent tracking-tighter">Interés</span>
                                            <span className="text-xs text-white block font-medium">{item.date}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-muted mb-4">
                                        <Scissors size={12} className="opacity-40" />
                                        <span>{svc?.name || 'Cualquier servicio'}</span>
                                    </div>

                                    <a
                                        href={`https://wa.me/${item.phone.replace(/\D/g, '')}?text=Hola ${item.name}, te contactamos de ${businessConfig.name}. Vimos que estabas en nuestra lista de espera para el ${item.date}. ¿Aún estás interesado en agendar una cita?`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-sm bg-accent/20 text-accent hover:bg-accent hover:text-white w-full py-2 rounded-lg border border-accent/20 transition-all font-bold text-xs flex items-center justify-center gap-2"
                                    >
                                        <MessageCircle size={14} /> Contactar por WhatsApp
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-card p-6 rounded-xl flex items-center gap-4 group hover:border-blue-500/30">
                    <div className="p-3 rounded-lg bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform duration-200 shadow-inner">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-400 mb-1 font-medium">Citas Hoy</p>
                        <p className="text-2xl font-black text-white tracking-tight">{todayAppts.length}</p>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-xl flex items-center gap-4 group hover:border-emerald-500/30 relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-emerald-500/20 blur-xl rounded-full"></div>
                    <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform duration-200 shadow-inner">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-400 mb-1 font-medium">Ingresos Hoy</p>
                        <p className="text-2xl font-black text-emerald-400 tracking-tight">${revenue}</p>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-xl relative overflow-hidden group hover:border-amber-400/30">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-amber-400/10 text-amber-400 group-hover:scale-110 transition-transform duration-200 shadow-inner">
                                <Activity size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-400 mb-1 font-medium">Citas del Mes</p>
                                <p className="text-2xl font-black text-white tracking-tight">{currentMonthStats.count}</p>
                            </div>
                        </div>
                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${currentMonthStats.appsGrowth >= 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
                            {currentMonthStats.appsGrowth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            {Math.abs(Math.round(currentMonthStats.appsGrowth))}%
                        </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500 font-medium">
                        {currentMonthStats.canceled} citas canceladas
                    </div>
                </div>

                <div className="glass-card p-6 rounded-xl relative overflow-hidden group hover:border-pink-500/30">
                    <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-pink-500/20 blur-xl rounded-full"></div>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-pink-500/10 text-pink-500 group-hover:scale-110 transition-transform duration-200 shadow-inner">
                                <CreditCard size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-400 mb-1 font-medium">Ingresos del Mes</p>
                                <p className="text-2xl font-black text-pink-400 tracking-tight">${currentMonthStats.revenue}</p>
                            </div>
                        </div>
                        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${currentMonthStats.revenueGrowth >= 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
                            {currentMonthStats.revenueGrowth >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            {Math.abs(Math.round(currentMonthStats.revenueGrowth))}%
                        </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500 font-medium">
                        vs ${currentMonthStats.lastRevenue} mes pasado
                    </div>
                </div>
            </div>

            {/* Financial Charts & Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Revenue Chart ── */}
                <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/5 flex flex-col min-h-[350px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <TrendingUp size={20} className="text-accent" /> Ingresos (Últimos 7 Días)
                        </h3>
                    </div>
                    <div className="flex-1 w-full relative">
                        {revenueChartData.every(d => d.Ingresos === 0) ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
                                <Activity size={48} className="mb-4 text-slate-500" />
                                <p className="text-sm text-slate-400 font-medium">No hay suficientes datos de ingresos para esta semana.</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--hue-accent), 100%, 50%)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--hue-accent), 100%, 50%)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                                        itemStyle={{ color: 'hsl(var(--hue-accent), 100%, 60%)', fontWeight: 'bold' }}
                                        labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                        formatter={(value: number) => [`$${value}`, 'Ingresos']}
                                    />
                                    <Area type="monotone" dataKey="Ingresos" stroke="hsl(var(--hue-accent), 100%, 50%)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* ── Top Services ── */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Scissors size={20} className="text-pink-400" /> Top Servicios
                    </h3>
                    <div className="space-y-5">
                        {topServices.length > 0 ? topServices.map((svc, i) => (
                            <div key={i} className="group">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <div className="text-sm font-bold text-white mb-0.5">{svc.name}</div>
                                        <div className="text-xs text-slate-400">{svc.count} citas completadas</div>
                                    </div>
                                    <div className="text-sm font-black text-pink-400">${svc.price * svc.count}</div>
                                </div>
                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${(svc.count / (topServices[0]?.count || 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )) : (
                            <p className="text-sm text-slate-500 text-center py-10">No hay datos suficientes para mostrar.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ── Reminders ── */}
                <div className="lg:col-span-3 glass-panel p-6 rounded-2xl border border-white/5">
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
                                            {(() => {
                                                const [h, m] = appt.time.split(':');
                                                let hh = parseInt(h);
                                                const ampm = hh >= 12 ? 'pm' : 'am';
                                                hh = hh % 12;
                                                hh = hh ? hh : 12;
                                                return <span className="text-accent font-mono font-bold bg-accent/10 px-2 py-1 rounded text-xs">{hh}:{m}{ampm}</span>;
                                            })()}
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

                {(() => {
                    const now = new Date();
                    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                    const upcomingAppts = todayAppts.filter(appt => {
                        const svc = services.find(s => s.id === appt.serviceId);
                        const duration = svc?.duration || 30;

                        // Calculate end time
                        const [hours, minutes] = appt.time.split(':').map(Number);
                        const endMinutes = hours * 60 + minutes + duration;
                        const endHours = Math.floor(endMinutes / 60);
                        const endMins = endMinutes % 60;
                        const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

                        // Show if it hasn't finished yet and isn't completed/cancelled
                        return currentTimeStr < endTimeStr && appt.status === 'confirmada';
                    }).sort((a, b) => a.time.localeCompare(b.time));

                    if (upcomingAppts.length === 0) {
                        return (
                            <div className="text-center py-12 text-muted bg-white/5 rounded-lg border border-dashed border-white/10">
                                <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                                <p>No hay más citas para lo que queda del día.</p>
                                <p className="text-xs mt-2">Buen trabajo, has terminado por hoy.</p>
                            </div>
                        );
                    }

                    return (
                        <div className="space-y-3">
                            {upcomingAppts.map(appt => {
                                const svc = services.find(s => s.id === appt.serviceId);
                                const isCurrentlyHappening = currentTimeStr >= appt.time;

                                const displayTime = (() => {
                                    const [h, m] = appt.time.split(':');
                                    let hh = parseInt(h);
                                    const ampm = hh >= 12 ? 'pm' : 'am';
                                    hh = hh % 12;
                                    hh = hh ? hh : 12;
                                    return `${hh}:${m}${ampm}`;
                                })();

                                return (
                                    <div key={appt.id} className={`group flex items-stretch gap-0 rounded-2xl border transition-all overflow-hidden ${isCurrentlyHappening
                                        ? 'bg-accent/10 border-accent/20 ring-1 ring-accent/10 shadow-lg'
                                        : 'glass-card border-white/5 hover:border-accent/30 hover:shadow-xl'
                                        }`}>

                                        {/* Status Indicator Bar */}
                                        <div className={`w-1.5 shrink-0 ${isCurrentlyHappening ? 'bg-accent animate-pulse' : 'bg-gradient-to-b from-white/20 to-transparent'}`} />

                                        {/* Time Column */}
                                        <div className={`flex flex-col items-center justify-center w-20 shrink-0 border-r py-4 ${isCurrentlyHappening ? 'bg-accent/10 border-accent/10' : 'bg-white/[0.03] border-white/5'}`}>
                                            <span className={`text-base font-black tracking-tighter ${isCurrentlyHappening ? 'text-accent' : 'text-white'}`}>
                                                {displayTime.replace(/(am|pm)/, '')}
                                            </span>
                                            <span className={`text-[10px] font-black uppercase tracking-widest -mt-1 ${isCurrentlyHappening ? 'text-accent' : 'text-accent/60'}`}>
                                                {displayTime.match(/(am|pm)/)?.[0]}
                                            </span>
                                        </div>

                                        {/* Main Info */}
                                        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-4 p-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner ${isCurrentlyHappening ? 'bg-accent text-white shadow-accent/50' : 'bg-white/5 text-muted group-hover:text-white'}`}>
                                                    {appt.clientName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="font-bold text-white text-base">{appt.clientName}</span>
                                                        {isCurrentlyHappening && (
                                                            <span className="px-1.5 py-0.5 rounded-full bg-accent/20 text-[8px] font-black uppercase tracking-widest text-accent border border-accent/20">EN VIVO</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs font-medium text-muted flex items-center gap-2">
                                                        <div className="flex items-center gap-1"><Scissors size={10} className="text-accent/40" /> {svc?.name}</div>
                                                        <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                                        <div className="flex items-center gap-1"><Phone size={10} className="opacity-40" /> {appt.clientPhone}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {isCurrentlyHappening ? (
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-1.5">
                                                        <Clock size={10} className="animate-spin-slow" /> Ahora
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Hoy</span>
                                                )}
                                                <div className={`
                                                    px-3 py-1 rounded-lg text-xs font-bold border uppercase tracking-tighter
                                                    ${isCurrentlyHappening
                                                        ? 'bg-accent/20 text-accent border-accent/30'
                                                        : 'bg-green-500/10 text-green-500 border-green-500/20'}
                                                `}>
                                                    {isCurrentlyHappening ? 'En proceso' : 'Confirmada'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>
        </div >
    );
}


