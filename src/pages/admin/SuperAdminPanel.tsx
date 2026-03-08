import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import {
    Building2, Trash2, Search, ChevronRight,
    LayoutDashboard, TrendingUp, DollarSign, Plus, X, BarChart3,
    ArrowUpRight, Globe, Zap, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip
} from 'recharts';
import { format, subMonths, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '../../lib/supabaseClient';

export default function SuperAdminPanel() {
    const { allTenants, fetchAllTenants, switchTenant, deleteTenant, createTenant } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newBusiness, setNewBusiness] = useState({ name: '', slug: '', category: 'barbershop', address: '' });
    const [totalSmsCount, setTotalSmsCount] = useState<number | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchAllTenants();
        fetchTotalSms();
    }, [fetchAllTenants]);

    const fetchTotalSms = async () => {
        const { count } = await supabase.from('sms_logs').select('*', { count: 'exact', head: true });
        setTotalSmsCount(count || 0);
    };

    const filteredTenants = useMemo(() => {
        return allTenants.filter(t =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.category?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allTenants, searchTerm]);

    // Metrics calculation
    const mrr = allTenants.length * 29.99;
    const activeLast30Days = allTenants.filter(t => isAfter(new Date(t.created_at || ''), subMonths(new Date(), 1))).length;

    // Chart data preparation
    const chartData = useMemo(() => {
        const months = Array.from({ length: 6 }).map((_, i) => {
            const date = subMonths(new Date(), 5 - i);
            return {
                name: format(date, 'MMM', { locale: es }).toUpperCase(),
                count: allTenants.filter(t => isAfter(new Date(t.created_at || ''), subMonths(date, 1))).length,
                month: format(date, 'yyyy-MM')
            };
        });
        return months;
    }, [allTenants]);

    const handleCreateBusiness = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await createTenant(newBusiness.name, newBusiness.slug, newBusiness.address, newBusiness.category);
        if (res.success) {
            setIsCreateModalOpen(false);
            setNewBusiness({ name: '', slug: '', category: 'barbershop', address: '' });
            fetchAllTenants();
        } else {
            alert(res.error);
        }
    };

    return (
        <div className="animate-fade-in flex flex-col gap-8 h-full pb-10">
            {/* HQ Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative">
                <div className="absolute -top-10 -left-10 w-64 h-64 bg-accent/5 rounded-full blur-3xl -z-10 animate-pulse-soft"></div>

                <div className="flex items-center gap-5">
                    <div className="p-4 bg-gradient-to-br from-accent/20 to-blue-600/20 border border-white/10 rounded-2xl glass-card text-accent shadow-lg shadow-accent/10">
                        <LayoutDashboard size={32} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-4xl font-black text-white tracking-tighter">CitaLink <span className="text-accent font-light italic">HQ</span></h1>
                            <span className="bg-accent text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase mb-1">Central</span>
                        </div>
                        <p className="text-slate-400 text-sm font-medium tracking-wide">Panel de Control Global y Desempeño de Plataforma</p>
                    </div>
                </div>

                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="btn btn-primary px-8 py-3 w-full md:w-auto shadow-2xl shadow-accent/20 group"
                >
                    <Plus className="group-hover:rotate-90 transition-transform" />
                    Crear Nuevo Negocio
                </button>
            </header>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<Building2 size={24} />}
                    title="Negocios Totales"
                    value={allTenants.length}
                    color="text-blue-400"
                    trend="+1"
                    delay="0"
                />
                <StatCard
                    icon={<DollarSign size={24} />}
                    title="MRR Estimado"
                    value={`$${mrr.toFixed(2)}`}
                    color="text-emerald-400"
                    trend="+14%"
                    delay="1"
                />
                <StatCard
                    icon={<Zap size={24} />}
                    title="Nuevos (30d)"
                    value={activeLast30Days}
                    color="text-violet-400"
                    trend="Activo"
                    delay="2"
                />
                <StatCard
                    icon={<Globe size={24} />}
                    title="Salud Plataforma"
                    value="99.9%"
                    color="text-accent"
                    trend="Óptima"
                    delay="3"
                />
                <StatCard
                    icon={<Zap size={24} />}
                    title="SMS Totales (Log)"
                    value={totalSmsCount !== null ? totalSmsCount : '...'}
                    color="text-amber-400"
                    trend="Plataforma"
                    delay="4"
                />
            </div>

            {/* Platform Insights & Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-panel p-6 border border-white/5 relative overflow-hidden flex flex-col min-h-[400px]">
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div>
                            <h3 className="text-white font-black text-xl flex items-center gap-2 uppercase tracking-tight">
                                <TrendingUp className="text-accent" size={20} />
                                Crecimiento de Negocios
                            </h3>
                            <p className="text-slate-500 text-xs mt-1">Registros mensuales consolidados de la red CitaLink</p>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-black text-accent border border-accent/30 px-2 py-1 rounded bg-accent/5 uppercase">Tiempo Real</span>
                        </div>
                    </div>

                    <div className="flex-1 min-h-[250px] relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                                />
                                <YAxis
                                    hide
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    itemStyle={{ color: 'var(--color-accent)', fontWeight: 'bold' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="var(--color-accent)"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorCount)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-panel p-6 border border-white/5 flex flex-col">
                    <h3 className="text-white font-black text-xl mb-6 flex items-center gap-2 uppercase tracking-tight">
                        <BarChart3 className="text-violet-400" size={20} />
                        Distribución
                    </h3>
                    <div className="space-y-6">
                        {(() => {
                            const categories = [
                                { id: 'barbershop', label: 'Barberías' },
                                { id: 'beauty_salon', label: 'Salones' },
                                { id: 'nail_bar', label: "Nail's" },
                                { id: 'spa', label: 'Spas' },
                                { id: 'consulting', label: 'Clínicas' },
                                { id: 'other', label: 'Otros' }
                            ];

                            return categories.map((cat, i) => {
                                let count = 0;
                                if (cat.id === 'other') {
                                    // Count anything not in the main list
                                    const mainIds = categories.filter(c => c.id !== 'other').map(c => c.id);
                                    count = allTenants.filter(t => !mainIds.includes(t.category || '')).length;
                                } else {
                                    // Handle legacy 'salon' or 'clinic' mapping too just in case
                                    const legacyMap: Record<string, string> = {
                                        'salon': 'beauty_salon',
                                        'clinic': 'consulting',
                                        'barber': 'barbershop'
                                    };
                                    count = allTenants.filter(t =>
                                        t.category === cat.id ||
                                        (legacyMap[t.category || ''] === cat.id)
                                    ).length;
                                }

                                const percentage = allTenants.length ? Math.round((count / allTenants.length) * 100) : 0;

                                return (
                                    <div key={cat.id} className="space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-400 font-bold uppercase tracking-widest">{cat.label}</span>
                                            <span className="text-white font-black">{percentage}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-violet-500 to-accent transition-all duration-1000"
                                                style={{ width: `${percentage}%`, transitionDelay: `${i * 0.1}s` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                    <div className="mt-auto pt-6 border-t border-white/5">
                        <button
                            onClick={() => document.getElementById('tenants-table')?.scrollIntoView({ behavior: 'smooth' })}
                            className="w-full p-4 bg-white/2 rounded-xl border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent group-hover:scale-110 transition-transform">
                                    <ArrowUpRight size={18} />
                                </div>
                                <span className="text-sm font-bold text-slate-300">Ver reporte completo</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tenant Management Table */}
            <div id="tenants-table" className="glass-panel rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 border-b border-white/5 bg-white/[0.03] flex justify-between items-center">
                    <div className="relative group max-w-xl w-full">
                        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                            <Search className="text-slate-500 group-focus-within:text-accent transition-colors" size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar proveedor o slug..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/40 border border-white/5 text-white rounded-xl py-4 pl-14 pr-6 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/40 transition-all font-medium placeholder:text-slate-600"
                        />
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[600px] custom-scrollbar">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {filteredTenants.map((tenant, idx) => (
                            <div
                                key={tenant.id}
                                className="glass-card flex items-center p-5 border-white/5 hover:border-accent/20 hover:bg-white/5 transition-all duration-300 group"
                                style={{ animationDelay: `${idx * 0.05}s` }}
                            >
                                <div className="w-16 h-16 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-2xl group-hover:scale-105 transition-transform">
                                    {tenant.logoUrl ? (
                                        <img src={tenant.logoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <Building2 size={24} className="text-slate-600 group-hover:text-accent transition-colors" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 ml-5">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-lg font-black text-white truncate uppercase tracking-tight">{tenant.name}</h3>
                                        <span className="px-2.5 py-1 rounded bg-white/5 text-[9px] font-black tracking-widest uppercase text-slate-400 border border-white/5 shadow-inner">
                                            {(() => {
                                                const cat = tenant.category?.toLowerCase() || '';
                                                if (cat === 'barbershop' || cat === 'barber') return 'BARBERÍA';
                                                if (cat === 'beauty_salon' || cat === 'salon') return 'SALÓN';
                                                if (cat === 'nail_bar') return "NAIL'S";
                                                if (cat === 'spa') return 'SPA';
                                                if (cat === 'consulting' || cat === 'clinic') return 'CLÍNICA';
                                                if (cat === 'other') return 'OTRO';
                                                return cat.toUpperCase() || 'ESTÁNDAR';
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono text-accent/80 px-2 py-0.5 bg-accent/5 rounded border border-accent/20 tracking-tighter truncate">
                                            citalink.app/{tenant.slug}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                                            <Calendar size={12} className="opacity-30" />
                                            {format(new Date(tenant.created_at || ''), "MMM yyyy", { locale: es })}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-3 ml-4">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={async () => {
                                                await switchTenant(tenant.id);
                                                navigate('/admin');
                                            }}
                                            className="btn btn-primary p-3 rounded-xl shadow-none hover:shadow-accent/40"
                                            title="Administrar Negocio"
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (window.confirm(`¿Seguro que quieres eliminar "${tenant.name}"? Se perderán todos los datos.`)) {
                                                    deleteTenant(tenant.id);
                                                }
                                            }}
                                            className="p-3 rounded-xl bg-white/5 text-slate-500 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>

                                    {/* SMS Control Toggle */}
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Servicio SMS</span>
                                            <span className={`text-[10px] font-bold ${tenant.sms_enabled ? 'text-accent' : 'text-amber-500/70'}`}>
                                                {tenant.sms_enabled ? 'ACTIVO' : 'DEMO'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                const newState = !tenant.sms_enabled;
                                                // Definiremos updateTenantSms en el store
                                                const { error } = await supabase.from('tenants').update({ sms_enabled: newState }).eq('id', tenant.id);
                                                if (error) {
                                                    alert("Error al actualizar SMS: " + error.message);
                                                } else {
                                                    fetchAllTenants();
                                                }
                                            }}
                                            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${tenant.sms_enabled ? 'bg-accent' : 'bg-slate-700'}`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${tenant.sms_enabled ? 'translate-x-5' : 'translate-x-0'}`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Create Business Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="glass-panel w-full max-w-lg border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-scale-in">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.03]">
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight uppercase">Nuevo Negocio</h3>
                                <p className="text-slate-400 text-xs mt-1">Configuración rápida de instancia SaaS</p>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X className="text-slate-400" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateBusiness} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Nombre Comercial</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none"
                                        placeholder="Ej. Barbería El Rey"
                                        value={newBusiness.name}
                                        onChange={e => setNewBusiness({ ...newBusiness, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Slug / URL Amigable</label>
                                    <div className="flex">
                                        <div className="bg-white/5 border border-white/10 rounded-l-xl px-4 py-3 text-slate-500 text-sm border-r-0">citalink.app/</div>
                                        <input
                                            required
                                            type="text"
                                            className="flex-1 bg-black/40 border border-white/10 rounded-r-xl px-3 py-3 text-white focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none font-mono"
                                            placeholder="el-rey"
                                            value={newBusiness.slug}
                                            onChange={e => setNewBusiness({ ...newBusiness, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Categoría</label>
                                        <select
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-accent transition-all outline-none appearance-none cursor-pointer"
                                            value={newBusiness.category}
                                            onChange={e => setNewBusiness({ ...newBusiness, category: e.target.value })}
                                        >
                                            <option value="barbershop">Barbería</option>
                                            <option value="beauty_salon">Salón</option>
                                            <option value="nail_bar">Nail's</option>
                                            <option value="spa">Spa</option>
                                            <option value="consulting">Clínica</option>
                                            <option value="other">Otro</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Costo Mensual</label>
                                        <div className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-accent font-black text-center">$29.99</div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Dirección (Opcional)</label>
                                    <textarea
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-accent transition-all outline-none h-20"
                                        value={newBusiness.address}
                                        onChange={e => setNewBusiness({ ...newBusiness, address: e.target.value })}
                                    ></textarea>
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary w-full py-4 text-lg shadow-xl shadow-accent/20">
                                Iniciar Instancia de Negocio
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, title, value, color, trend, delay }: { icon: any, title: string, value: any, color: string, trend: string, delay: string }) {
    return (
        <div
            className="animate-scale-in glass-card p-6 border border-white/5 flex flex-col gap-4 group hover:bg-white/[0.04]"
            style={{ animationDelay: `0.${delay}s` }}
        >
            <div className="flex justify-between items-start">
                <div className={`p-3 rounded-2xl bg-white/5 border border-white/5 shadow-inner ${color}`}>
                    {icon}
                </div>
                <div className="flex flex-col items-end">
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${trend.includes('+') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-accent/20 text-accent'} border border-current opacity-70 group-hover:opacity-100 transition-opacity`}>
                        {trend}
                    </span>
                    <span className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter mt-1">Tendencia</span>
                </div>
            </div>
            <div>
                <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 mb-0.5">{title}</div>
                <div className="text-2xl font-black text-white tracking-tight">{value}</div>
            </div>
        </div>
    );
}
