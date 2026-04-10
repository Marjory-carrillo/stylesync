import { useEffect, useState, useMemo } from 'react';
import { useSuperAdmin } from '../../lib/store/queries/useSuperAdmin';
import {
    Building2, Trash2, Search, ChevronRight,
    LayoutDashboard, Plus, X, BarChart3,
    Zap, AlertTriangle, Calendar, Users,
    Scissors, Sparkles, Flower2, Briefcase, MoreHorizontal
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { subMonths, isAfter } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import { useUIStore } from '../../lib/store/uiStore';
import { getPlanBadgeStyles } from '../../lib/planLimits';
import type { PlanType } from '../../lib/planLimits';

// Modal de confirmación premium para borrado
const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, tenantName }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel max-w-md w-full p-8 border border-white/10 shadow-2xl animate-scale-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-transparent"></div>
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-6 mx-auto">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-2xl font-black text-white text-center mb-2 uppercase tracking-tight">Â¿Eliminar Negocio?</h3>
                <p className="text-slate-400 text-center mb-8 leading-relaxed">
                    Estás a punto de eliminar <span className="text-white font-bold">"{tenantName}"</span>. Esta acción es irreversible y borrará todos los datos asociados.
                </p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={onConfirm}
                        className="w-full py-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
                    >
                        Confirmar Eliminación
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold uppercase tracking-widest transition-all"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function SuperAdminPanel() {
    const { allTenants, fetchAllTenants, switchTenant, deleteTenant, createTenant } = useSuperAdmin();
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [tenantToDelete, setTenantToDelete] = useState<any>(null);
    const [newBusiness, setNewBusiness] = useState({ name: '', slug: '', category: 'barbershop', ownerEmail: '', ownerPassword: '', monthlyPrice: '29.99', timezone: 'America/Mexico_City', brandSlug: '', plan: 'free' as PlanType, noTrial: false });
    const [isCreating, setIsCreating] = useState(false);
    const [isExistingOwner, setIsExistingOwner] = useState(false);
    const [selectedOwnerId, setSelectedOwnerId] = useState('');
    const [totalSmsCount, setTotalSmsCount] = useState<number | null>(null);
    const [smsCountsByTenant, setSmsCountsByTenant] = useState<Record<string, { total: number; week: number; month: number }>>({});
    const [appointmentsLast30, setAppointmentsLast30] = useState<number | null>(null);
    const [uniqueClients, setUniqueClients] = useState<number | null>(null);
    const showToast = useUIStore(s => s.showToast);
    const navigate = useNavigate();

    useEffect(() => {
        fetchAllTenants();
        fetchSmsMetrics();
        fetchAppointmentMetrics();

        const channel = supabase
            .channel('public:sms_logs')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sms_logs' }, () => {
                fetchSmsMetrics();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchAllTenants]);

    const fetchSmsMetrics = async () => {
        try {
            // Conteo total de mensajes WhatsApp reales (excluye demo)
            const { count } = await supabase
                .from('sms_logs')
                .select('*', { count: 'exact', head: true })
                .eq('provider', 'whatsapp');
            setTotalSmsCount(count || 0);

            // Conteos por tenant â€” solo WhatsApp, con fecha para semana/mes
            const { data: logsData, error } = await supabase
                .from('sms_logs')
                .select('tenant_id, created_at')
                .eq('provider', 'whatsapp');

            if (error) throw error;

            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const oneMonthAgo = subMonths(now, 1);

            const counts: Record<string, { total: number; week: number; month: number }> = {};
            logsData?.forEach(log => {
                if (log.tenant_id) {
                    if (!counts[log.tenant_id]) counts[log.tenant_id] = { total: 0, week: 0, month: 0 };
                    counts[log.tenant_id].total += 1;
                    const logDate = new Date(log.created_at);
                    if (logDate >= oneWeekAgo) counts[log.tenant_id].week += 1;
                    if (logDate >= oneMonthAgo) counts[log.tenant_id].month += 1;
                }
            });
            setSmsCountsByTenant(counts);
        } catch (err) {
            console.error("Error fetching SMS metrics:", err);
        }
    };

    const fetchAppointmentMetrics = async () => {
        try {
            const since = subMonths(new Date(), 1).toISOString();

            // Citas en los últimos 30 días
            const { count: apptCount } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .gte('date', since.split('T')[0]);
            setAppointmentsLast30(apptCount || 0);

            // Total clientes únicos (por número de teléfono)
            const { data: phones } = await supabase
                .from('appointments')
                .select('client_phone');
            const unique = new Set((phones || []).map((r: any) => r.client_phone).filter(Boolean));
            setUniqueClients(unique.size);
        } catch (err) {
            console.error('Error fetching appointment metrics:', err);
        }
    };

    const filteredTenants = useMemo(() => {
        return allTenants.filter(t =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.category?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allTenants, searchTerm]);

    const newThisMonth = allTenants.filter(t => isAfter(new Date(t.created_at || ''), subMonths(new Date(), 1))).length;


    const handleCreateBusiness = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        const res = await createTenant(
            newBusiness.name,
            newBusiness.slug,
            '',
            newBusiness.category,
            newBusiness.ownerEmail.trim().toLowerCase(),
            newBusiness.ownerPassword,
            newBusiness.timezone,
            isExistingOwner && selectedOwnerId ? selectedOwnerId : undefined,
            isExistingOwner && newBusiness.brandSlug ? newBusiness.brandSlug : undefined,
            newBusiness.noTrial
        );
        setIsCreating(false);
        if (res.success) {
            // Update the plan on the new tenant
            if (res.data?.id && newBusiness.plan !== 'free') {
                await supabase.from('tenants').update({ plan: newBusiness.plan }).eq('id', res.data.id);
            }
            setIsCreateModalOpen(false);
            setNewBusiness({ name: '', slug: '', category: 'barbershop', ownerEmail: '', ownerPassword: '', monthlyPrice: '29.99', timezone: 'America/Mexico_City', brandSlug: '', plan: 'free', noTrial: false });
            setIsExistingOwner(false);
            setSelectedOwnerId('');
            showToast(
                isExistingOwner
                    ? `Sucursal creada y asignada al dueño existente.`
                    : res.accountCreated
                        ? `Negocio creado. Cuenta creada para ${newBusiness.ownerEmail}`
                        : 'Negocio creado. La cuenta del dueño no se pudo crear automáticamente.',
                'success'
            );
            fetchAllTenants();
        } else {
            showToast(res.error || 'Error al crear negocio', 'error');
        }
    };

    const handleDeleteClick = (tenant: any) => {
        setTenantToDelete(tenant);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!tenantToDelete) return;
        const res = await deleteTenant(tenantToDelete.id);
        if (res.success) {
            showToast('Negocio eliminado', 'success');
            setIsDeleteModalOpen(false);
            setTenantToDelete(null);
            fetchAllTenants();
        } else {
            showToast(res.error || 'Error al eliminar', 'error');
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<Building2 size={24} />}
                    title="Negocios Totales"
                    value={allTenants.length}
                    color="text-blue-400"
                    sub={`${newThisMonth} nuevos este mes`}
                    delay="0"
                />
                <StatCard
                    icon={<Calendar size={24} />}
                    title="Citas (últimos 30d)"
                    value={appointmentsLast30 !== null ? appointmentsLast30 : '...'}
                    color="text-emerald-400"
                    sub="En toda la plataforma"
                    delay="1"
                />
                <StatCard
                    icon={<Users size={24} />}
                    title="Clientes Ãšnicos"
                    value={uniqueClients !== null ? uniqueClients : '...'}
                    color="text-violet-400"
                    sub="Por teléfono registrado"
                    delay="2"
                />
                <StatCard
                    icon={<Zap size={24} />}
                    title="WhatsApp Totales"
                    value={totalSmsCount !== null ? totalSmsCount : '...'}
                    color="text-emerald-400"
                    sub="Mensajes WhatsApp enviados"
                    delay="3"
                />
            </div>

            {/* Distribución por Categoría */}
            <div className="glass-panel p-6 border border-white/5">
                <h3 className="text-white font-black text-xl mb-6 flex items-center gap-2 uppercase tracking-tight">
                    <BarChart3 className="text-violet-400" size={20} />
                    Distribución por Categoría
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {(() => {
                        const categories = [
                            { id: 'barbershop', label: 'Barberías', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                            { id: 'beauty_salon', label: 'Salones', color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
                            { id: 'nail_bar', label: "Nail's", color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
                            { id: 'spa', label: 'Spas', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                            { id: 'consulting', label: 'Clínicas', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                            { id: 'other', label: 'Otros', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' }
                        ];
                        const legacyMap: Record<string, string> = { 'salon': 'beauty_salon', 'clinic': 'consulting', 'barber': 'barbershop' };
                        const mainIds = categories.filter(c => c.id !== 'other').map(c => c.id);

                        return categories.map(cat => {
                            let count = 0;
                            if (cat.id === 'other') {
                                count = allTenants.filter(t => { const n = legacyMap[t.category || ''] || t.category || ''; return !mainIds.includes(n); }).length;
                            } else {
                                count = allTenants.filter(t => t.category === cat.id || legacyMap[t.category || ''] === cat.id).length;
                            }
                            return (
                                <div key={cat.id} className={`p-4 rounded-2xl ${cat.bg} border ${cat.border} flex flex-col items-center gap-1 text-center`}>
                                    <span className={`text-3xl font-black ${cat.color}`}>{count}</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{cat.label}</span>
                                </div>
                            );
                        });
                    })()}
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
                                className="glass-card flex flex-col p-4 sm:p-5 border-white/5 hover:border-accent/20 hover:bg-white/5 transition-all duration-300 group"
                                style={{ animationDelay: `${idx * 0.05}s` }}
                            >
                                {/* â”€â”€ Top row: logo + info + action buttons â”€â”€ */}
                                <div className="flex items-start gap-3 sm:gap-4">
                                    {/* Logo */}
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-xl group-hover:scale-105 transition-transform">
                                        {tenant.logoUrl ? (
                                            <img src={tenant.logoUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <Building2 size={22} className="text-slate-600 group-hover:text-accent transition-colors" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h3 className="text-base sm:text-lg font-black text-white truncate uppercase tracking-tight max-w-[140px] sm:max-w-[200px]">{tenant.name}</h3>
                                            <span className="px-2 py-0.5 rounded bg-white/5 text-[8px] sm:text-[9px] font-black tracking-widest uppercase text-slate-400 border border-white/5 shadow-inner shrink-0">
                                                {(() => {
                                                    const cat = tenant.category?.toLowerCase() || '';
                                                    if (cat === 'barbershop' || cat === 'barber') return 'BARBERÃA';
                                                    if (cat === 'beauty_salon' || cat === 'salon') return 'SALÃ“N';
                                                    if (cat === 'nail_bar') return "NAIL'S";
                                                    if (cat === 'spa') return 'SPA';
                                                    if (cat === 'consulting' || cat === 'clinic') return 'CLÃNICA';
                                                    if (cat === 'other') return 'OTRO';
                                                    return cat.toUpperCase() || 'ESTÃNDAR';
                                                })()}
                                            </span>
                                            {(() => {
                                                const p = (tenant.plan || 'free') as PlanType;
                                                const b = getPlanBadgeStyles(p);
                                                return <span className={`px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-black tracking-widest uppercase border shrink-0 ${b.bg} ${b.text} ${b.border}`}>{p.toUpperCase()}</span>;
                                            })()}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[10px] sm:text-xs font-mono text-accent/80 px-2 py-0.5 bg-accent/5 rounded border border-accent/20 tracking-tighter truncate max-w-[160px] sm:max-w-none">
                                                citalink.app/{tenant.slug}
                                            </span>
                                            {tenant.brand_slug && (
                                                <span className="flex items-center gap-1 text-[8px] font-black text-violet-400 px-2 py-0.5 bg-violet-500/10 rounded border border-violet-500/25 uppercase tracking-wider shrink-0">
                                                    <Building2 size={8} />
                                                    {allTenants.filter(t => t.brand_slug === tenant.brand_slug).length} suc.
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action buttons â€” always top-right */}
                                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                        <button
                                            onClick={async () => {
                                                await switchTenant(tenant.id);
                                                navigate('/admin');
                                            }}
                                            className="btn btn-primary p-2.5 sm:p-3 rounded-xl shadow-none hover:shadow-accent/40"
                                            title="Administrar Negocio"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(tenant)}
                                            className="p-2.5 sm:p-3 rounded-xl bg-white/5 text-slate-500 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* â”€â”€ Bottom row: stats + controls â”€â”€ */}
                                <div className="mt-3 pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2">

                                    {/* WA Stats */}
                                    <div className="flex items-center gap-1.5">
                                        {(() => {
                                            const stats = smsCountsByTenant[tenant.id] || { total: 0, week: 0, month: 0 };
                                            return (
                                                <>
                                                    <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20" title="WA esta semana">
                                                        <Calendar size={9} className="text-emerald-400" />
                                                        <span className="text-[10px] font-black text-emerald-400">{stats.week}</span>
                                                        <span className="text-[8px] text-emerald-400/60 font-bold">SEM</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20" title="WA este mes">
                                                        <BarChart3 size={9} className="text-blue-400" />
                                                        <span className="text-[10px] font-black text-blue-400">{stats.month}</span>
                                                        <span className="text-[8px] text-blue-400/60 font-bold">MES</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20" title="WA totales">
                                                        <Zap size={9} className="text-emerald-400" />
                                                        <span className="text-[10px] font-black text-emerald-400">{stats.total}</span>
                                                        <span className="text-[8px] text-emerald-400/60 font-bold">TOT</span>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    {/* Spacer */}
                                    <div className="flex-1" />

                                    {/* Controls row â€” wrap on small screens */}
                                    <div className="flex flex-wrap items-center gap-2">

                                        {/* Mensajería */}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/5">
                                            <div className="flex flex-col items-start">
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">WA</span>
                                                <span className={`text-[9px] font-bold leading-none ${tenant.sms_provider === 'whatsapp' ? 'text-emerald-400' : 'text-amber-500/70'}`}>
                                                    {tenant.sms_provider === 'whatsapp' ? 'ON' : 'DEMO'}
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                {(['demo', 'whatsapp'] as const).map((p) => (
                                                    <button
                                                        key={p}
                                                        onClick={async () => {
                                                            if (tenant.sms_provider === p) return;
                                                            const { error } = await supabase.from('tenants').update({ sms_provider: p }).eq('id', tenant.id);
                                                            if (error) { showToast("Error: " + error.message, 'error'); }
                                                             else { fetchAllTenants(); showToast(`Mensajería → ${p === 'whatsapp' ? '💬 WhatsApp' : 'Demo'} para ${tenant.name}`, 'info'); }

                                                        }}
                                                        className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all ${
                                                            tenant.sms_provider === p
                                                                ? p === 'whatsapp' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                                                : 'bg-white/5 text-slate-600 border border-white/5 hover:border-white/20 hover:text-slate-400'
                                                        }`}
                                                    >
                                                        {p === 'demo' ? '🔵' : '💬'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Plan */}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/5">
                                            <div className="flex flex-col items-start">
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">Plan</span>
                                                <span className={`text-[9px] font-bold leading-none ${
                                                    tenant.plan === 'business' ? 'text-violet-400' : tenant.plan === 'pro' ? 'text-amber-400' : 'text-slate-500'
                                                }`}>
                                                    {(tenant.plan || 'free').toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                {(['free', 'pro', 'business'] as const).map((p) => (
                                                    <button
                                                        key={p}
                                                        onClick={async () => {
                                                            if ((tenant.plan || 'free') === p) return;
                                                            const { error } = await supabase.from('tenants').update({ plan: p }).eq('id', tenant.id);
                                                            if (error) { showToast('Error: ' + error.message, 'error'); }
                                                            else { fetchAllTenants(); showToast(`Plan → ${p === 'pro' ? '⭐ Pro' : p === 'business' ? '🚀 Business' : 'Free'} para ${tenant.name}`, 'success'); }
                                                        }}
                                                        className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all ${
                                                            (tenant.plan || 'free') === p
                                                                ? p === 'business' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/40'
                                                                : p === 'pro' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                                                : 'bg-slate-500/20 text-slate-400 border border-slate-500/40'
                                                                : 'bg-white/5 text-slate-600 border border-white/5 hover:border-white/20 hover:text-slate-400'
                                                        }`}
                                                    >
                                                        {p === 'free' ? 'F' : p === 'pro' ? '⭐' : '🚀'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {/* Modals */}
            <DeleteConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                tenantName={tenantToDelete?.name}
            />

            {/* Create Business Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-xl bg-[#0a0f1a] border border-white/[0.08] rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden animate-scale-in">
                        {/* Header */}
                        <div className="relative p-6 pb-5 border-b border-white/5 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/5 to-transparent" />
                            <div className="relative flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                        <Plus size={22} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white tracking-tight">Nuevo Negocio</h3>
                                        <p className="text-slate-500 text-[11px] mt-0.5">Configuración rápida de instancia SaaS</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsCreateModalOpen(false)} className="p-2.5 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10">
                                    <X size={18} className="text-slate-500" />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleCreateBusiness} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

                            {/* â”€â”€ Sección: Negocio â”€â”€ */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Building2 size={14} className="text-blue-400" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Datos del Negocio</span>
                                </div>

                                {/* Nombre */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-400 ml-1">Nombre Comercial</label>
                                    <input
                                        required type="text"
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm"
                                        placeholder="Ej. Barbería El Rey"
                                        value={newBusiness.name}
                                        onChange={e => {
                                            const name = e.target.value;
                                            const autoSlug = name
                                                .toLowerCase()
                                                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                                                .replace(/[^\w\s-]/g, '')
                                                .trim()
                                                .replace(/\s+/g, '-')
                                                .replace(/-+/g, '-');
                                            setNewBusiness({ ...newBusiness, name, slug: autoSlug });
                                        }}
                                    />
                                </div>

                                {/* Slug */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-400 ml-1">URL Personalizada</label>
                                    <div className="flex">
                                        <div className="bg-white/[0.03] border border-white/[0.08] border-r-0 rounded-l-xl px-3.5 py-3 text-slate-500 text-xs font-medium shrink-0 flex items-center">citalink.app/</div>
                                        <input
                                            required type="text"
                                            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-r-xl px-3 py-3 text-white font-mono text-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none"
                                            placeholder="mi-negocio"
                                            value={newBusiness.slug}
                                            onChange={e => setNewBusiness({ ...newBusiness, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') })}
                                        />
                                    </div>
                                </div>

                                {/* Brand Slug (only when assigning to existing owner) */}
                                {isExistingOwner && (
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-400 ml-1">Link de Marca (Todas las Sucursales)</label>
                                        <div className="flex">
                                            <div className="bg-white/[0.03] border border-violet-500/20 border-r-0 rounded-l-xl px-3.5 py-3 text-slate-500 text-xs font-medium shrink-0 flex items-center">citalink.app/sucursales/</div>
                                            <input
                                                type="text"
                                                className="flex-1 bg-white/[0.04] border border-violet-500/20 rounded-r-xl px-3 py-3 text-violet-400 font-mono text-sm focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all outline-none"
                                                placeholder="mi-marca"
                                                value={newBusiness.brandSlug}
                                                onChange={e => setNewBusiness({ ...newBusiness, brandSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') })}
                                            />
                                        </div>
                                        <p className="text-[10px] text-violet-400/60 ml-1">Los clientes verán todas las sucursales en un solo link.</p>
                                    </div>
                                )}

                                {/* Zona Horaria */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-400 ml-1">Zona Horaria</label>
                                    <select
                                        value={newBusiness.timezone}
                                        onChange={e => setNewBusiness({ ...newBusiness, timezone: e.target.value })}
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm appearance-none"
                                    >
                                        <option value="America/Mexico_City" className="bg-slate-900">Hora Central (CDMX, Monterrey)</option>
                                        <option value="America/Tijuana" className="bg-slate-900">Hora del Pacífico (Tijuana, Mexicali)</option>
                                        <option value="America/Mazatlan" className="bg-slate-900">Hora de la Montaña (Mazatlán, Culiacán)</option>
                                        <option value="America/Cancun" className="bg-slate-900">Hora del Este (Cancún)</option>
                                        <option value="America/Bogota" className="bg-slate-900">Colombia / Perú / Ecuador</option>
                                        <option value="America/Santiago" className="bg-slate-900">Chile</option>
                                        <option value="America/Argentina/Buenos_Aires" className="bg-slate-900">Argentina</option>
                                        <option value="Europe/Madrid" className="bg-slate-900">España (Península)</option>
                                    </select>
                                </div>

                                {/* Categoría */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-400 ml-1">Categoría</label>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {[
                                            { id: 'barbershop', label: 'Barbería', icon: <Scissors size={16} />, color: 'amber' },
                                            { id: 'beauty_salon', label: 'Salón', icon: <Sparkles size={16} />, color: 'pink' },
                                            { id: 'nail_bar', label: "Nail's", icon: <Sparkles size={16} />, color: 'rose' },
                                            { id: 'spa', label: 'Spa', icon: <Flower2 size={16} />, color: 'emerald' },
                                            { id: 'consulting', label: 'Clínica', icon: <Briefcase size={16} />, color: 'blue' },
                                            { id: 'other', label: 'Otro', icon: <MoreHorizontal size={16} />, color: 'slate' },
                                        ].map(cat => {
                                            const isSelected = newBusiness.category === cat.id;
                                            const colorMap: Record<string, string> = {
                                                amber: isSelected ? 'border-amber-400/50 bg-amber-400/10 text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.1)]' : 'border-white/5 text-slate-500 hover:border-amber-400/30 hover:text-amber-400',
                                                pink: isSelected ? 'border-pink-400/50 bg-pink-400/10 text-pink-400 shadow-[0_0_12px_rgba(244,114,182,0.1)]' : 'border-white/5 text-slate-500 hover:border-pink-400/30 hover:text-pink-400',
                                                rose: isSelected ? 'border-rose-400/50 bg-rose-400/10 text-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.1)]' : 'border-white/5 text-slate-500 hover:border-rose-400/30 hover:text-rose-400',
                                                emerald: isSelected ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.1)]' : 'border-white/5 text-slate-500 hover:border-emerald-400/30 hover:text-emerald-400',
                                                blue: isSelected ? 'border-blue-400/50 bg-blue-400/10 text-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.1)]' : 'border-white/5 text-slate-500 hover:border-blue-400/30 hover:text-blue-400',
                                                slate: isSelected ? 'border-slate-400/50 bg-slate-400/10 text-slate-300' : 'border-white/5 text-slate-500 hover:border-slate-400/30 hover:text-slate-400',
                                            };
                                            return (
                                                <button
                                                    key={cat.id} type="button"
                                                    onClick={() => setNewBusiness({ ...newBusiness, category: cat.id })}
                                                    className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border transition-all duration-200 cursor-pointer bg-white/[0.02] ${colorMap[cat.color]}`}
                                                >
                                                    {cat.icon}
                                                    <span className="text-[9px] font-bold uppercase tracking-wider leading-none">{cat.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-white/5" />

                            {/* â”€â”€ Sección: Acceso del Dueño â”€â”€ */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <Users size={14} className="text-emerald-400" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Acceso del Dueño</span>
                                    </div>
                                    {/* Toggle: Existing Owner */}
                                    <button
                                        type="button"
                                        onClick={() => { setIsExistingOwner(!isExistingOwner); setSelectedOwnerId(''); }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                                            isExistingOwner
                                                ? 'bg-violet-500/20 text-violet-400 border-violet-500/40'
                                                : 'bg-white/5 text-slate-500 border-white/10 hover:text-slate-300'
                                        }`}
                                    >
                                        <Building2 size={10} />
                                        {isExistingOwner ? 'Dueño Existente' : '+ Nueva Cuenta'}
                                    </button>
                                </div>

                                {isExistingOwner ? (
                                    /* Existing Owner Selector */
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold text-slate-400 ml-1">Seleccionar Dueño Existente</label>
                                        <select
                                            required
                                            value={selectedOwnerId}
                                            onChange={e => setSelectedOwnerId(e.target.value)}
                                            className="w-full bg-white/[0.04] border border-violet-500/20 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all outline-none text-sm appearance-none"
                                        >
                                            <option value="" className="bg-slate-900">â€” Elegir un dueño â€”</option>
                                            {(() => {
                                                // Get unique owners from existing tenants
                                                const ownerMap = new Map<string, { id: string; name: string }>(); 
                                                allTenants.forEach(t => {
                                                    if (t.owner_id && !ownerMap.has(t.owner_id)) {
                                                        ownerMap.set(t.owner_id, { id: t.owner_id, name: t.name });
                                                    }
                                                });
                                                return Array.from(ownerMap.values()).map(owner => (
                                                    <option key={owner.id} value={owner.id} className="bg-slate-900">
                                                        Dueño de: {owner.name}
                                                    </option>
                                                ));
                                            })()}
                                        </select>
                                        <p className="text-[10px] text-violet-400/70 ml-1">ðŸ“Ž La nueva sucursal aparecerá en el panel del dueño seleccionado.</p>
                                    </div>
                                ) : (
                                    /* New Owner: Email + Password */
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-400 ml-1">Correo Electrónico</label>
                                                <input
                                                    required type="email"
                                                    className="w-full bg-white/[0.04] border border-emerald-500/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 transition-all outline-none text-sm"
                                                    placeholder="dueno@correo.com"
                                                    value={newBusiness.ownerEmail}
                                                    onChange={e => setNewBusiness({ ...newBusiness, ownerEmail: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-400 ml-1">Contraseña</label>
                                                <input
                                                    required type="password" minLength={6}
                                                    className="w-full bg-white/[0.04] border border-emerald-500/20 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 transition-all outline-none text-sm"
                                                    placeholder="Mín. 6 caracteres"
                                                    value={newBusiness.ownerPassword}
                                                    onChange={e => setNewBusiness({ ...newBusiness, ownerPassword: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-500/80 ml-1 -mt-1">El dueño usará estas credenciales para acceder a su panel de administración.</p>
                                    </>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="border-t border-white/5" />

                            {/* â”€â”€ Sección: Plan â”€â”€ */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Zap size={14} className="text-amber-400" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Plan</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {([
                                        { key: 'free' as PlanType, label: 'Free', price: '$0', color: 'slate' },
                                        { key: 'pro' as PlanType, label: 'Pro', price: '$899', color: 'amber' },
                                        { key: 'business' as PlanType, label: 'Business', price: '$1,649', color: 'violet' },
                                    ]).map(p => {
                                        const isActive = newBusiness.plan === p.key;
                                        return (
                                            <button
                                                key={p.key}
                                                type="button"
                                                onClick={() => setNewBusiness({ ...newBusiness, plan: p.key, monthlyPrice: p.price.replace(/[$,]/g, '') })}
                                                className={`p-3 rounded-xl border text-center transition-all ${isActive
                                                    ? p.color === 'amber' ? 'border-amber-500/50 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                                                    : p.color === 'violet' ? 'border-violet-500/50 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.1)]'
                                                    : 'border-slate-500/50 bg-slate-500/10'
                                                    : 'border-white/5 bg-white/[0.02] hover:bg-white/5'
                                                }`}
                                            >
                                                <div className={`text-xs font-black uppercase tracking-wider ${isActive
                                                    ? p.color === 'amber' ? 'text-amber-400' : p.color === 'violet' ? 'text-violet-400' : 'text-slate-300'
                                                    : 'text-slate-500'
                                                }`}>{p.label}</div>
                                                <div className={`text-[10px] mt-1 font-bold ${isActive ? 'text-slate-300' : 'text-slate-600'}`}>{p.price}/mes</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Trial Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <div>
                                    <p className="text-xs font-bold text-white">Período de prueba (21 días)</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                        {newBusiness.noTrial
                                            ? 'El negocio inicia directamente en el plan seleccionado.'
                                            : 'El negocio tendrá acceso completo durante 21 días gratis.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setNewBusiness({ ...newBusiness, noTrial: !newBusiness.noTrial })}
                                    className={`relative w-10 h-5 rounded-full transition-all shrink-0 ml-4 ${
                                        newBusiness.noTrial ? 'bg-slate-700' : 'bg-accent'
                                    }`}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                                        newBusiness.noTrial ? 'left-0.5' : 'left-5'
                                    }`} />
                                </button>
                            </div>

                            {/* Error */}
                            {/* (error display is handled by showToast) */}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isCreating}
                                className="w-full py-4 rounded-2xl font-black text-white text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2.5 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 via-blue-500 to-purple-600 hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {isCreating ? (
                                    <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span> Creando Instancia...</>
                                ) : (
                                    <><Zap size={16} /> Crear Negocio</>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, title, value, color, sub, delay }: { icon: any, title: string, value: any, color: string, sub: string, delay: string }) {
    return (
        <div
            className="animate-scale-in glass-card p-6 border border-white/5 flex flex-col gap-4 group hover:bg-white/[0.04]"
            style={{ animationDelay: `0.${delay}s` }}
        >
            <div className={`p-3 rounded-2xl bg-white/5 border border-white/5 shadow-inner w-fit ${color}`}>
                {icon}
            </div>
            <div>
                <div className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 mb-0.5">{title}</div>
                <div className="text-3xl font-black text-white tracking-tight">{value}</div>
                <div className="text-[10px] text-slate-600 font-medium mt-1">{sub}</div>
            </div>
        </div>
    );
}
