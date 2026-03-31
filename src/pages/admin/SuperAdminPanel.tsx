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
                <h3 className="text-2xl font-black text-white text-center mb-2 uppercase tracking-tight">¿Eliminar Negocio?</h3>
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
    const [newBusiness, setNewBusiness] = useState({ name: '', slug: '', category: 'barbershop', ownerEmail: '', monthlyPrice: '29.99' });
    const [isCreating, setIsCreating] = useState(false);
    const [totalSmsCount, setTotalSmsCount] = useState<number | null>(null);
    const [smsCountsByTenant, setSmsCountsByTenant] = useState<Record<string, number>>({});
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
            // Conteo total
            const { count } = await supabase.from('sms_logs').select('*', { count: 'exact', head: true });
            setTotalSmsCount(count || 0);

            // Conteos por tenant
            const { data: logsData, error } = await supabase
                .from('sms_logs')
                .select('tenant_id');

            if (error) throw error;

            const counts: Record<string, number> = {};
            logsData?.forEach(log => {
                if (log.tenant_id) {
                    counts[log.tenant_id] = (counts[log.tenant_id] || 0) + 1;
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
        const res = await createTenant(newBusiness.name, newBusiness.slug, '', newBusiness.category, newBusiness.ownerEmail.trim().toLowerCase());
        setIsCreating(false);
        if (res.success) {
            setIsCreateModalOpen(false);
            setNewBusiness({ name: '', slug: '', category: 'barbershop', ownerEmail: '', monthlyPrice: '29.99' });
            showToast(
                res.inviteSent
                    ? `Negocio creado. Invitación enviada a ${newBusiness.ownerEmail}`
                    : 'Negocio creado. El dueño puede registrarse con ese correo.',
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
                    title="Clientes Únicos"
                    value={uniqueClients !== null ? uniqueClients : '...'}
                    color="text-violet-400"
                    sub="Por teléfono registrado"
                    delay="2"
                />
                <StatCard
                    icon={<Zap size={24} />}
                    title="SMS Totales"
                    value={totalSmsCount !== null ? totalSmsCount : '...'}
                    color="text-amber-400"
                    sub="Mensajes enviados"
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
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs font-mono text-accent/80 px-2 py-0.5 bg-accent/5 rounded border border-accent/20 tracking-tighter truncate">
                                            citalink.app/{tenant.slug}
                                        </span>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 rounded border border-amber-500/20 shadow-sm animate-fade-in">
                                            <Zap size={10} className="text-amber-500" />
                                            <span className="text-[10px] font-black text-amber-500 tracking-tighter">
                                                {smsCountsByTenant[tenant.id] || 0} SMS
                                            </span>
                                        </div>
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
                                            onClick={() => handleDeleteClick(tenant)}
                                            className="p-3 rounded-xl bg-white/5 text-slate-500 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>

                                    {/* SMS / WhatsApp Provider Selector */}
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                                        <div className="flex flex-col items-start mr-1">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Mensajería</span>
                                            <span className={`text-[10px] font-bold ${
                                                tenant.sms_provider === 'whatsapp' ? 'text-emerald-400'
                                                : tenant.sms_provider === 'sms' ? 'text-blue-400'
                                                : 'text-amber-500/70'
                                            }`}>
                                                {tenant.sms_provider === 'whatsapp' ? 'WHATSAPP'
                                                : tenant.sms_provider === 'sms' ? 'SMS'
                                                : 'DEMO'}
                                            </span>
                                        </div>
                                        <div className="flex gap-1">
                                            {(['demo', 'sms', 'whatsapp'] as const).map((p) => (
                                                <button
                                                    key={p}
                                                    onClick={async () => {
                                                        if (tenant.sms_provider === p) return;
                                                        const { error } = await supabase
                                                            .from('tenants')
                                                            .update({ sms_provider: p })
                                                            .eq('id', tenant.id);
                                                        if (error) {
                                                            showToast("Error: " + error.message, 'error');
                                                        } else {
                                                            fetchAllTenants();
                                                            const labels = { demo: 'Demo', sms: '📱 SMS', whatsapp: '💬 WhatsApp' };
                                                            showToast(`Mensajería → ${labels[p]} para ${tenant.name}`, 'info');
                                                        }
                                                    }}
                                                    className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter transition-all ${
                                                        tenant.sms_provider === p
                                                            ? p === 'whatsapp'
                                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                                                : p === 'sms'
                                                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                                            : 'bg-white/5 text-slate-600 border border-white/5 hover:border-white/20 hover:text-slate-400'
                                                    }`}
                                                >
                                                    {p === 'demo' ? '🔵 Demo' : p === 'sms' ? '📱 SMS' : '💬 WA'}
                                                </button>
                                            ))}
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
                                        onChange={e => {
                                            const name = e.target.value;
                                            const autoSlug = name
                                                .toLowerCase()
                                                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
                                                .replace(/[^\w\s-]/g, '')
                                                .trim()
                                                .replace(/\s+/g, '-')
                                                .replace(/-+/g, '-');
                                            setNewBusiness({ ...newBusiness, name, slug: autoSlug });
                                        }}
                                    />
                                </div>

                                {/* Correo del Dueño */}
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Correo del Dueño</label>
                                    <input
                                        required
                                        type="email"
                                        className="w-full bg-black/40 border border-accent/30 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none"
                                        placeholder="dueno@correo.com"
                                        value={newBusiness.ownerEmail}
                                        onChange={e => setNewBusiness({ ...newBusiness, ownerEmail: e.target.value })}
                                    />
                                    <p className="text-[10px] text-slate-500 ml-1">Se enviará un link de invitación a este correo para que el dueño cree su contraseña.</p>
                                </div>

                                {/* Slug — editable manualmente si se necesita ajustar */}
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Slug / URL <span className="normal-case font-normal text-slate-600">(auto-generado)</span></label>
                                    <div className="flex">
                                        <div className="bg-white/5 border border-white/10 rounded-l-xl px-4 py-3 text-slate-500 text-sm border-r-0 shrink-0">citalink.app/</div>
                                        <input
                                            required
                                            type="text"
                                            className="flex-1 bg-black/40 border border-white/10 rounded-r-xl px-3 py-3 text-white focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none font-mono text-sm"
                                            placeholder="mi-negocio"
                                            value={newBusiness.slug}
                                            onChange={e => setNewBusiness({ ...newBusiness, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') })}
                                        />
                                    </div>
                                </div>

                                {/* Categoría — picker visual */}
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Categoría</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'barbershop', label: 'Barbería', icon: <Scissors size={18} />, color: 'amber' },
                                            { id: 'beauty_salon', label: 'Salón', icon: <Sparkles size={18} />, color: 'pink' },
                                            { id: 'nail_bar', label: "Nail's", icon: <Sparkles size={18} />, color: 'rose' },
                                            { id: 'spa', label: 'Spa', icon: <Flower2 size={18} />, color: 'emerald' },
                                            { id: 'consulting', label: 'Clínica', icon: <Briefcase size={18} />, color: 'blue' },
                                            { id: 'other', label: 'Otro', icon: <MoreHorizontal size={18} />, color: 'slate' },
                                        ].map(cat => {
                                            const isSelected = newBusiness.category === cat.id;
                                            const colorMap: Record<string, string> = {
                                                amber: isSelected ? 'border-amber-400/60 bg-amber-400/10 text-amber-400' : 'border-white/5 text-slate-500 hover:border-amber-400/30 hover:text-amber-400',
                                                pink: isSelected ? 'border-pink-400/60 bg-pink-400/10 text-pink-400' : 'border-white/5 text-slate-500 hover:border-pink-400/30 hover:text-pink-400',
                                                rose: isSelected ? 'border-rose-400/60 bg-rose-400/10 text-rose-400' : 'border-white/5 text-slate-500 hover:border-rose-400/30 hover:text-rose-400',
                                                emerald: isSelected ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-400' : 'border-white/5 text-slate-500 hover:border-emerald-400/30 hover:text-emerald-400',
                                                blue: isSelected ? 'border-blue-400/60 bg-blue-400/10 text-blue-400' : 'border-white/5 text-slate-500 hover:border-blue-400/30 hover:text-blue-400',
                                                slate: isSelected ? 'border-slate-400/60 bg-slate-400/10 text-slate-300' : 'border-white/5 text-slate-500 hover:border-slate-400/30 hover:text-slate-400',
                                            };
                                            return (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => setNewBusiness({ ...newBusiness, category: cat.id })}
                                                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 cursor-pointer bg-black/30 ${colorMap[cat.color]}`}
                                                >
                                                    {cat.icon}
                                                    <span className="text-[10px] font-bold uppercase tracking-wide leading-none">{cat.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Costo Mensual */}
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Costo Mensual ($)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent font-black text-sm pointer-events-none">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-accent font-black focus:ring-2 focus:ring-accent focus:border-transparent transition-all outline-none"
                                            value={newBusiness.monthlyPrice}
                                            onChange={e => setNewBusiness({ ...newBusiness, monthlyPrice: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={isCreating}
                                className="btn btn-primary w-full py-4 text-lg shadow-xl shadow-accent/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isCreating ? (
                                    <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span> Creando...</>) : (
                                    'Iniciar Instancia de Negocio'
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
