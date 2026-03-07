import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../lib/store';
import { useAuthStore } from '../../lib/store/authStore';
import { useUIStore } from '../../lib/store/uiStore';
import { useAppointments } from '../../lib/store/queries/useAppointments';
import { useServices } from '../../lib/store/queries/useServices';
import { useWaitingList } from '../../lib/store/queries/useWaitingList';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useStylists } from '../../lib/store/queries/useStylists';
import { Skeleton } from '../../components/ui/Skeleton';
import { Calendar, DollarSign, Users, User, TrendingUp, Bell, MessageCircle, Phone, Clock, Scissors, CreditCard, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

type ChartRange = '7D' | '30D' | '3M' | 'AÑO';

export default function Dashboard() {
    const { t } = useTranslation();
    const [chartRange, setChartRange] = useState<ChartRange>('7D');
    const [dashboardStylistId, setDashboardStylistId] = useState<number | 'all'>('all');

    const { userRole, userStylistId } = useAuthStore();
    const { showToast } = useUIStore();

    // Optimize: only load last 12 months for dashboard metrics
    const startDate = useMemo(() => format(subMonths(new Date(), 12), 'yyyy-MM-01'), []);
    const { appointments: allAppointments, isPending: apptsPending } = useAppointments({ startDate });
    const { services, isPending: svcsLoading } = useServices();
    const { waitingList, addToWaitingList } = useWaitingList();
    const { stylists } = useStylists();
    const { data: tenantConfig } = useTenantData();
    const businessConfig = tenantConfig || { slug: '' };

    const isLoading = apptsPending || svcsLoading;

    const {
        generateReminderWhatsAppUrl, getServiceById,
        cancellationLog
    } = useStore();

    const appointments = useMemo(() => {
        if (userRole === 'employee' && userStylistId) {
            return allAppointments.filter(a => a.stylistId === userStylistId);
        }
        return allAppointments;
    }, [allAppointments, userRole, userStylistId]);

    const todayAppts = useMemo(() => {
        // Actually, we should use format from date-fns or local formatting
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const tStr = `${yyyy}-${mm}-${dd}`;
        return appointments.filter(a => a.date === tStr && a.status !== 'cancelada');
    }, [appointments]);

    const revenue = useMemo(() => {
        return todayAppts.reduce((sum, a) => {
            const svc = services.find(s => s.id === a.serviceId);
            if (!svc) return sum;

            let isFinished = a.status === 'completada';
            if (!isFinished && a.status !== 'cancelada') {
                const end = new Date(`${a.date}T${a.time}`);
                end.setMinutes(end.getMinutes() + svc.duration);
                if (new Date() >= end) isFinished = true;
            }

            return isFinished ? sum + svc.price : sum;
        }, 0);
    }, [todayAppts, services]);

    const reminders = useMemo(() => {
        const target = new Date();
        target.setDate(target.getDate() + 1);
        const yyyy = target.getFullYear();
        const mm = String(target.getMonth() + 1).padStart(2, '0');
        const dd = String(target.getDate()).padStart(2, '0');
        const tStr = `${yyyy}-${mm}-${dd}`;
        return appointments.filter(a => a.date === tStr && a.status !== 'cancelada');
    }, [appointments]);

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
                    let isFinished = a.status === 'completada';
                    if (!isFinished) {
                        const end = new Date(`${a.date}T${a.time}`);
                        end.setMinutes(end.getMinutes() + (svc?.duration || 0));
                        if (new Date() >= end) isFinished = true;
                    }
                    if (isFinished) {
                        currentRevenue += price;
                    }
                }
            } else if (isLastMonth) {
                if (!isCanceled) {
                    lastCompleted++;
                    let isFinished = a.status === 'completada';
                    if (!isFinished) {
                        const end = new Date(`${a.date}T${a.time}`);
                        end.setMinutes(end.getMinutes() + (svc?.duration || 0));
                        if (new Date() >= end) isFinished = true;
                    }
                    if (isFinished) {
                        lastRevenue += price;
                    }
                }
            }
        });

        // Growth metrics
        const revenueGrowth = lastRevenue === 0 ? (currentRevenue > 0 ? 100 : 0) : ((currentRevenue - lastRevenue) / lastRevenue) * 100;
        const appsGrowth = lastCompleted === 0 ? (currentCompleted > 0 ? 100 : 0) : ((currentCompleted - lastCompleted) / lastCompleted) * 100;

        return {
            revenue: currentRevenue,
            lastRevenue,
            revenueGrowth,
            count: currentCompleted,
            appsGrowth,
            canceled: currentCanceled
        };
    }, [appointments, services]);

    // Graph Data
    const revenueChartData = useMemo(() => {
        const data = [];
        const today = new Date();

        if (chartRange === '7D' || chartRange === '30D') {
            const daysCount = chartRange === '7D' ? 7 : 30;
            for (let i = daysCount - 1; i >= 0; i--) {
                const d = subDays(today, i);
                const dateStr = format(d, 'yyyy-MM-dd');
                const label = format(d, 'd MMM', { locale: es });

                const dayRevenue = appointments
                    .filter(a => a.date === dateStr && a.status !== 'cancelada')
                    .reduce((sum, appt) => {
                        const svc = services.find(s => s.id === appt.serviceId);
                        if (!svc) return sum;
                        let isFinished = appt.status === 'completada';
                        if (!isFinished) {
                            const end = new Date(`${appt.date}T${appt.time}`);
                            end.setMinutes(end.getMinutes() + svc.duration);
                            if (new Date() >= end) isFinished = true;
                        }
                        return isFinished ? sum + svc.price : sum;
                    }, 0);

                data.push({
                    name: label,
                    date: dateStr,
                    Ingresos: dayRevenue
                });
            }
        } else if (chartRange === '3M') {
            // Last 12 weeks
            for (let i = 11; i >= 0; i--) {
                const startOfTargetWeek = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
                const endOfTargetWeek = endOfWeek(startOfTargetWeek, { weekStartsOn: 1 });
                const label = `${format(startOfTargetWeek, 'd', { locale: es })}-${format(endOfTargetWeek, 'd MMM', { locale: es })}`;

                const weekRevenue = appointments
                    .filter(a => {
                        if (a.status === 'cancelada') return false;
                        const d = new Date(a.date + 'T12:00:00');
                        return isWithinInterval(d, { start: startOfTargetWeek, end: endOfTargetWeek });
                    })
                    .reduce((sum, appt) => {
                        const svc = services.find(s => s.id === appt.serviceId);
                        if (!svc) return sum;
                        return sum + svc.price;
                    }, 0);

                data.push({
                    name: label,
                    Ingresos: weekRevenue
                });
            }
        } else if (chartRange === 'AÑO') {
            // Last 12 months
            for (let i = 11; i >= 0; i--) {
                const targetMonth = startOfMonth(subMonths(today, i));
                const endOfTargetMonth = endOfMonth(targetMonth);
                const label = format(targetMonth, 'MMM yy', { locale: es });

                const monthRevenue = appointments
                    .filter(a => {
                        if (a.status === 'cancelada') return false;
                        const d = new Date(a.date + 'T12:00:00');
                        return isWithinInterval(d, { start: targetMonth, end: endOfTargetMonth });
                    })
                    .reduce((sum, appt) => {
                        const svc = services.find(s => s.id === appt.serviceId);
                        if (!svc) return sum;
                        return sum + svc.price;
                    }, 0);

                data.push({
                    name: label.charAt(0).toUpperCase() + label.slice(1),
                    Ingresos: monthRevenue
                });
            }
        }

        return data;
    }, [appointments, services, chartRange]);

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
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-cyan-600/15 via-blue-600/5 to-purple-600/15 border border-white/5 p-8 md:p-12 shadow-2xl mb-12 group">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none group-hover:scale-110 group-hover:opacity-5 transition-all duration-700">
                    <Users size={160} />
                </div>
                <div className="relative z-10 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8">
                    <div className="flex-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest mb-4">
                            PWA Discovery
                        </div>
                        <h3 className="text-2xl md:text-3xl font-black text-white mb-3 tracking-tight">
                            Tu App de Reservas
                        </h3>
                        <p className="text-slate-400 text-sm md:text-base max-w-xl leading-relaxed font-medium">
                            Tus clientes pueden instalar esta web como una app nativa en su celular para reservar en segundos.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                        <div className="flex items-center bg-black/40 backdrop-blur-md rounded-2xl px-5 py-4 border border-white/5 flex-1 md:min-w-[320px] shadow-inner">
                            <code className="text-blue-400 font-mono text-xs md:text-sm select-all truncate">
                                citalink.app/reserva/{businessConfig.slug || '...'}
                            </code>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    const url = `${window.location.origin}/reserva/${businessConfig.slug}`;
                                    navigator.clipboard.writeText(url);
                                    showToast('¡Enlace copiado!', 'success');
                                }}
                                className="flex-1 sm:flex-none px-10 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black rounded-2xl hover:brightness-110 transition-all active:scale-95 shadow-xl shadow-cyan-900/40 text-sm tracking-wide"
                            >
                                Copiar Link
                            </button>
                            <a
                                href={`/reserva/${businessConfig.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-5 py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all border border-white/10 text-sm flex items-center gap-2 backdrop-blur-sm"
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
                                                    <div key={match.id} className="flex justify-between items-center bg-black/30 backdrop-blur-md p-3 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                                                        <div>
                                                            <span className="text-white font-black text-sm block tracking-tight">{match.name.toUpperCase()}</span>
                                                            <span className="text-[10px] text-slate-500 font-mono tracking-tighter">{match.phone}</span>
                                                        </div>
                                                        <a
                                                            href={`https://wa.me/${match.phone.replace(/\D/g, '')}?text=Hola ${match.name}, te contactamos de ${(businessConfig as any)?.name}. ¡Se acaba de liberar un espacio el ${match.date} a las ${time12Str}! ¿Te interesa tomarlo?`}
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
                                } as any);
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
                                <div key={item.id} className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[1.5rem] p-5 flex flex-col justify-between group hover:border-accent/30 transition-all duration-500 relative overflow-hidden">
                                    <div className="absolute -right-4 -top-4 w-12 h-12 bg-accent/5 blur-xl rounded-full"></div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="text-white font-black text-base block tracking-tight leading-none mb-1">{item.name.toUpperCase()}</span>
                                            <span className="text-[10px] text-slate-500 font-mono">{item.phone}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[9px] font-black uppercase text-accent/60 tracking-widest block mb-0.5">Esperando</span>
                                            <span className="text-[10px] text-white font-bold bg-white/5 px-2 py-0.5 rounded-md">{item.date}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-muted mb-4">
                                        <Scissors size={12} className="opacity-40" />
                                        <span>{svc?.name || 'Cualquier servicio'}</span>
                                    </div>

                                    <a
                                        href={`https://wa.me/${item.phone.replace(/\D/g, '')}?text=Hola ${item.name}, te contactamos de ${(businessConfig as any)?.name}. Vimos que estabas en nuestra lista de espera para el ${item.date}. ¿Aún estás interesado en agendar una cita?`}
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="glass-panel p-6 rounded-[2rem] border border-white/5 flex items-center gap-5 group hover:border-blue-500/20 transition-all duration-500 relative overflow-hidden bg-slate-900/40">
                    <div className="absolute -left-4 -top-4 w-20 h-20 bg-blue-500/5 blur-2xl rounded-full group-hover:bg-blue-500/10 transition-all duration-700"></div>
                    <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform duration-500 shadow-inner border border-white/5 relative z-10">
                        <Calendar size={26} />
                    </div>
                    <div className="relative z-10 w-full">
                        <p className="text-[10px] text-slate-500 mb-1 font-black uppercase tracking-widest">{t('dashboard.metrics.today_appts')}</p>
                        {isLoading ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-black text-white tracking-tighter">{todayAppts.length}</p>}
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-[2rem] border border-white/5 flex items-center gap-5 group hover:border-emerald-500/20 transition-all duration-500 relative overflow-hidden bg-slate-900/40">
                    <div className="absolute -left-4 -top-4 w-20 h-20 bg-emerald-500/5 blur-2xl rounded-full group-hover:bg-emerald-500/10 transition-all duration-700"></div>
                    <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform duration-500 shadow-inner border border-white/5 relative z-10">
                        <DollarSign size={26} />
                    </div>
                    <div className="relative z-10">
                        <div className="relative z-10 w-full">
                            <p className="text-[10px] text-slate-500 mb-1 font-black uppercase tracking-widest">{t('dashboard.metrics.today_revenue')}</p>
                            {isLoading ? <Skeleton className="h-9 w-24" /> : <p className="text-3xl font-black text-emerald-400 tracking-tighter">${revenue}</p>}
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-[2rem] border border-white/5 relative overflow-hidden group hover:border-amber-500/20 transition-all duration-500 bg-slate-900/40 flex flex-col justify-between h-full">
                    <div className="absolute -left-4 -top-4 w-20 h-20 bg-amber-500/5 blur-2xl rounded-full group-hover:bg-amber-500/10 transition-all duration-700"></div>
                    <div className="flex items-center gap-4 relative z-10 mb-4">
                        <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform duration-500 shadow-inner border border-white/5">
                            <Activity size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-slate-500 mb-0.5 font-black uppercase tracking-widest truncate">{t('dashboard.metrics.month_appts')}</p>
                            <div className="flex items-center gap-2">
                                {isLoading ? <Skeleton className="h-8 w-12" /> : <p className="text-3xl font-black text-white tracking-tighter">{currentMonthStats.count}</p>}
                                <div className={`flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-lg border ${currentMonthStats.appsGrowth >= 0 ? 'text-emerald-400 bg-emerald-400/5 border-emerald-400/20' : 'text-red-400 bg-red-400/5 border-red-400/20'}`}>
                                    {currentMonthStats.appsGrowth >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                    {Math.abs(Math.round(currentMonthStats.appsGrowth))}%
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold tracking-tight relative z-10 opacity-70 border-t border-white/5 pt-3">
                        {t('dashboard.metrics.canceled', { count: currentMonthStats.canceled })}
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-[2rem] border border-white/5 relative overflow-hidden group hover:border-pink-500/20 transition-all duration-500 bg-slate-900/40 flex flex-col justify-between h-full">
                    <div className="absolute -left-4 -top-4 w-20 h-20 bg-pink-500/5 blur-2xl rounded-full group-hover:bg-pink-500/10 transition-all duration-700"></div>
                    <div className="flex items-center gap-4 relative z-10 mb-4">
                        <div className="p-3.5 rounded-2xl bg-pink-500/10 text-pink-400 group-hover:scale-110 transition-transform duration-500 shadow-inner border border-white/5">
                            <CreditCard size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-slate-500 mb-0.5 font-black uppercase tracking-widest truncate">{t('dashboard.metrics.month_revenue')}</p>
                            <div className="flex items-center gap-2">
                                {isLoading ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-black text-pink-400 tracking-tighter">${currentMonthStats.revenue}</p>}
                                <div className={`flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-lg border ${currentMonthStats.revenueGrowth >= 0 ? 'text-emerald-400 bg-emerald-400/5 border-emerald-400/20' : 'text-red-400 bg-red-400/5 border-red-400/20'}`}>
                                    {currentMonthStats.revenueGrowth >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                    {Math.abs(Math.round(currentMonthStats.revenueGrowth))}%
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold tracking-tight relative z-10 opacity-70 border-t border-white/5 pt-3 uppercase">
                        {userRole === 'employee' ? t('dashboard.metrics.own_revenue') : t('dashboard.metrics.vs_last_month', { amount: currentMonthStats.lastRevenue })}
                    </div>
                </div>
            </div>

            {/* Financial Charts & Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Revenue Chart ── */}
                <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/5 flex flex-col min-h-[350px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <TrendingUp size={20} className="text-accent" /> {t('dashboard.charts.revenue')}
                        </h3>
                        {/* Rango Selector */}
                        <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 overflow-x-auto hide-scrollbar">
                            {(["7D", "30D", "3M", "AÑO"] as ChartRange[]).map(range => (
                                <button
                                    key={range}
                                    onClick={() => setChartRange(range)}
                                    aria-current={chartRange === range ? 'page' : undefined}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap ${chartRange === range
                                        ? 'bg-[var(--accent)] text-white shadow-md'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                        }`}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>
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
                                        formatter={(value: any) => [`$${value}`, 'Ingresos']}
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
                        <Scissors size={20} className="text-pink-400" /> {t('dashboard.charts.top_services')}
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
                            <h3 className="font-bold text-lg text-white">{t('dashboard.reminders.title')} ({reminders.length})</h3>
                        </div>
                        <p className="text-sm text-muted mb-6 max-w-2xl">
                            Estas citas fueron reservadas con anticipación (3+ días). Se recomienda enviar un recordatorio para confirmar asistencia.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {reminders.map(appt => {
                                const svc = getServiceById(appt.serviceId);
                                const waUrl = generateReminderWhatsAppUrl(appt);
                                return (
                                    <div key={appt.id} className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-5 rounded-3xl hover:border-accent/40 transition-all duration-300 group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <div className="font-black text-white text-base tracking-tight mb-1">{appt.clientName.toUpperCase()}</div>
                                                <div className="text-[10px] font-bold text-accent tracking-widest bg-accent/10 px-2 py-0.5 rounded inline-block">{svc?.name.toUpperCase()}</div>
                                            </div>
                                            {(() => {
                                                const [h, m] = appt.time.split(':');
                                                let hh = parseInt(h);
                                                const ampm = hh >= 12 ? 'pm' : 'am';
                                                hh = hh % 12;
                                                hh = hh ? hh : 12;
                                                return <span className="text-white font-black bg-white/5 border border-white/10 px-3 py-1 rounded-xl text-xs">{hh}:{m}{ampm}</span>;
                                            })()}
                                        </div>

                                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-6 font-medium">
                                            <Phone size={12} className="opacity-50" />
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
                    <div className="flex items-center gap-2">
                        <User size={14} className="text-accent hidden sm:block" />
                        <select
                            value={dashboardStylistId}
                            onChange={(e) => setDashboardStylistId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="bg-slate-900/50 border border-white/10 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-accent"
                        >
                            <option value="all">Todos los barberos</option>
                            {stylists.map(s => (
                                <option key={s.id} value={s.id}>{s.name.split(' ')[0]}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {(() => {
                    const now = new Date();
                    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                    const upcomingAppts = todayAppts.filter(appt => {
                        const isMatch = dashboardStylistId === 'all' || appt.stylistId === dashboardStylistId;
                        if (!isMatch) return false;

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

                                const duration = svc?.duration || 30;
                                const endTimeDisplay = (() => {
                                    const [hours, minutes] = appt.time.split(':').map(Number);
                                    const endMinutes = hours * 60 + minutes + duration;
                                    let endHours = Math.floor(endMinutes / 60);
                                    const endMins = String(endMinutes % 60).padStart(2, '0');
                                    const ampm = endHours >= 12 && endHours < 24 ? 'pm' : 'am';
                                    endHours = endHours % 12;
                                    endHours = endHours ? endHours : 12;
                                    return `${endHours}:${endMins}${ampm}`;
                                })();

                                return (
                                    <div key={appt.id} className={`group flex items-stretch gap-0 rounded-2xl border transition-all overflow-hidden ${isCurrentlyHappening
                                        ? 'bg-accent/10 border-accent/20 ring-1 ring-accent/10 shadow-lg'
                                        : 'glass-card border-white/5 hover:border-accent/30 hover:shadow-xl'
                                        }`}>

                                        {/* Status Indicator Bar */}
                                        <div className={`w-1.5 shrink-0 ${isCurrentlyHappening ? 'bg-accent animate-pulse' : 'bg-gradient-to-b from-white/20 to-transparent'}`} />

                                        {/* Time Column */}
                                        <div className={`flex flex-col items-center justify-center w-28 shrink-0 border-r py-4 ${isCurrentlyHappening ? 'bg-accent/10 border-accent/10' : 'bg-white/[0.03] border-white/5'}`}>
                                            <span className={`text-base font-black tracking-tighter ${isCurrentlyHappening ? 'text-accent' : 'text-white'}`}>
                                                {displayTime.replace(/(am|pm)/, '')}
                                            </span>
                                            <span className={`text-[10px] font-black uppercase tracking-widest -mt-1 ${isCurrentlyHappening ? 'text-accent' : 'text-accent/60'}`}>
                                                {displayTime.match(/(am|pm)/)?.[0]}
                                            </span>
                                            <span className={`text-[9px] font-bold mt-2 opacity-60 ${isCurrentlyHappening ? 'text-accent' : 'text-white'}`}>
                                                a {endTimeDisplay.replace(/(am|pm)/, '')} {endTimeDisplay.match(/(am|pm)/)?.[0].toUpperCase()}
                                            </span>
                                        </div>

                                        {/* Main Info */}
                                        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
                                            <div className="flex items-center gap-5">
                                                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner relative overflow-hidden ${isCurrentlyHappening ? 'bg-accent text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                    {isCurrentlyHappening && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                                                    <span className="relative z-10">{appt.clientName.charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="font-black text-white text-lg tracking-tight uppercase">{appt.clientName}</span>
                                                        {isCurrentlyHappening && (
                                                            <span className="px-2 py-0.5 rounded-full bg-accent/20 text-[9px] font-black uppercase tracking-widest text-accent border border-accent/20 shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)] animate-pulse">EN VIVO</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] font-bold text-slate-500 flex items-center gap-3 tracking-wide">
                                                        <div className="flex items-center gap-1.5 uppercase"><Scissors size={12} className="text-accent/60" /> {svc?.name}</div>
                                                        {appt.stylistId && stylists.find(s => s.id === appt.stylistId) && (
                                                            <>
                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                                                                <div className="flex items-center gap-1.5 uppercase text-slate-400"><User size={12} className="opacity-40 text-accent/60" /> {stylists.find(s => s.id === appt.stylistId)?.name.split(' ')[0]}</div>
                                                            </>
                                                        )}
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                                                        <div className="flex items-center gap-1.5"><Phone size={12} className="opacity-40" /> {appt.clientPhone}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                {isCurrentlyHappening ? (
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-2 bg-accent/5 px-3 py-1.5 rounded-full border border-accent/10">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping"></div> Ahora
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] px-3 py-1.5">Agenda</span>
                                                )}
                                                <div className={`
                                                    px-4 py-2 rounded-xl text-[10px] font-black border uppercase tracking-widest shadow-inner
                                                    ${isCurrentlyHappening
                                                        ? 'bg-accent text-white border-white/10'
                                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}
                                                `}>
                                                    {isCurrentlyHappening ? 'Atendiendo' : 'Confirmada'}
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

            {/* Completed Appointments Today */}
            <div className="glass-card p-6 rounded-xl border border-emerald-500/10">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-emerald-400">Citas Completadas Hoy</h3>
                    <div className="flex items-center gap-2">
                        <User size={14} className="text-emerald-500 hidden sm:block" />
                        <select
                            value={dashboardStylistId}
                            onChange={(e) => setDashboardStylistId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="bg-slate-900/50 border border-emerald-500/20 text-emerald-400 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                        >
                            <option value="all">Todos los barberos</option>
                            {stylists.map(s => (
                                <option key={s.id} value={s.id}>{s.name.split(' ')[0]}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {(() => {
                    const now = new Date();
                    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                    const completedAppts = todayAppts.filter(appt => {
                        const isMatch = dashboardStylistId === 'all' || appt.stylistId === dashboardStylistId;
                        if (!isMatch) return false;

                        if (appt.status === 'completada') return true;

                        const svc = services.find(s => s.id === appt.serviceId);
                        const duration = svc?.duration || 30;

                        // Calculate end time
                        const [hours, minutes] = appt.time.split(':').map(Number);
                        const endMinutes = hours * 60 + minutes + duration;
                        const endHours = Math.floor(endMinutes / 60);
                        const endMins = endMinutes % 60;
                        const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

                        // Show if it is confirmed but time has passed
                        return currentTimeStr >= endTimeStr && appt.status === 'confirmada';
                    }).sort((a, b) => b.time.localeCompare(a.time)); // Sort descending by time

                    if (completedAppts.length === 0) {
                        return (
                            <div className="text-center py-12 text-emerald-500/40 bg-emerald-500/5 rounded-lg border border-dashed border-emerald-500/10">
                                <Activity size={48} className="mx-auto mb-4 opacity-40" />
                                <p>Aún no hay citas completadas el día de hoy.</p>
                            </div>
                        );
                    }

                    return (
                        <div className="space-y-3">
                            {completedAppts.map(appt => {
                                const svc = services.find(s => s.id === appt.serviceId);

                                const displayTime = (() => {
                                    const [h, m] = appt.time.split(':');
                                    let hh = parseInt(h);
                                    const ampm = hh >= 12 ? 'pm' : 'am';
                                    hh = hh % 12;
                                    hh = hh ? hh : 12;
                                    return `${hh}:${m}${ampm}`;
                                })();

                                const duration = svc?.duration || 30;
                                const endTimeDisplay = (() => {
                                    const [hours, minutes] = appt.time.split(':').map(Number);
                                    const endMinutes = hours * 60 + minutes + duration;
                                    let endHours = Math.floor(endMinutes / 60);
                                    const endMins = String(endMinutes % 60).padStart(2, '0');
                                    const ampm = endHours >= 12 && endHours < 24 ? 'pm' : 'am';
                                    endHours = endHours % 12;
                                    endHours = endHours ? endHours : 12;
                                    return `${endHours}:${endMins}${ampm}`;
                                })();

                                return (
                                    <div key={appt.id} className="group flex items-stretch gap-0 rounded-2xl border transition-all overflow-hidden glass-card border-white/5 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/10">

                                        {/* Status Indicator Bar */}
                                        <div className="w-1.5 shrink-0 bg-gradient-to-b from-emerald-500/50 to-transparent" />

                                        {/* Time Column */}
                                        <div className="flex flex-col items-center justify-center w-28 shrink-0 border-r py-4 bg-white/[0.03] border-white/5">
                                            <span className="text-base font-black tracking-tighter text-white">
                                                {displayTime.replace(/(am|pm)/, '')}
                                            </span>
                                            <span className="text-[10px] font-black uppercase tracking-widest -mt-1 text-emerald-500/60">
                                                {displayTime.match(/(am|pm)/)?.[0]}
                                            </span>
                                            <span className="text-[9px] font-bold mt-2 opacity-60 text-white">
                                                a {endTimeDisplay.replace(/(am|pm)/, '')} {endTimeDisplay.match(/(am|pm)/)?.[0].toUpperCase()}
                                            </span>
                                        </div>

                                        {/* Main Info */}
                                        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
                                            <div className="flex items-center gap-5">
                                                <div className="h-12 w-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner relative overflow-hidden bg-slate-800 text-emerald-500/70">
                                                    <span className="relative z-10">{appt.clientName.charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="font-black text-white text-lg tracking-tight uppercase">{appt.clientName}</span>
                                                    </div>
                                                    <div className="text-[10px] font-bold text-slate-500 flex items-center gap-3 tracking-wide">
                                                        <div className="flex items-center gap-1.5 uppercase"><Scissors size={12} className="text-emerald-500/60" /> {svc?.name}</div>
                                                        {appt.stylistId && stylists.find(s => s.id === appt.stylistId) && (
                                                            <>
                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                                                                <div className="flex items-center gap-1.5 uppercase text-slate-400"><User size={12} className="opacity-40 text-emerald-500/60" /> {stylists.find(s => s.id === appt.stylistId)?.name.split(' ')[0]}</div>
                                                            </>
                                                        )}
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                                                        <div className="flex items-center gap-1.5"><Phone size={12} className="opacity-40" /> {appt.clientPhone}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="text-right mr-2 hidden sm:block">
                                                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Ingreso</span>
                                                    <span className="text-sm font-black text-emerald-400">${svc?.price || 0}</span>
                                                </div>
                                                <div className="px-4 py-2 rounded-xl text-[10px] font-black border uppercase tracking-widest shadow-inner bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                                    Completada
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
        </div>
    );
}

