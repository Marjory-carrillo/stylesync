import { useEffect, useState, useMemo } from 'react';
import { useSuperAdmin } from '../../lib/store/queries/useSuperAdmin';
import {
    Building2, Trash2, Search, ChevronRight,
    LayoutDashboard, Plus, X, BarChart3,
    Zap, AlertTriangle, Calendar, Users,
    Scissors, Sparkles, Flower2, Briefcase, MoreHorizontal,
    DollarSign, Pencil
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

const PlanConfirmModal = ({ isOpen, onClose, onConfirm, details }: any) => {
    if (!isOpen || !details) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel max-w-md w-full p-8 border border-white/10 shadow-2xl animate-scale-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-transparent"></div>
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-6 mx-auto">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-2xl font-black text-white text-center mb-2 uppercase tracking-tight">¿Cambiar Plan?</h3>
                <p className="text-slate-400 text-center mb-6 leading-relaxed">
                    Estás a punto de cambiar el plan de <span className="text-white font-bold">"{details.tenantName}"</span>:
                    <br />
                    <span className="text-slate-500 line-through font-bold">{details.from.toUpperCase()}</span>
                    <span className="text-white font-bold mx-2">➔</span>
                    <span className="text-amber-400 font-extrabold">{details.to.toUpperCase()}</span>
                </p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={onConfirm}
                        className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 animate-pulse-soft"
                    >
                        Confirmar Cambio
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

const SmsConfirmModal = ({ isOpen, onClose, onConfirm, details }: any) => {
    if (!isOpen || !details) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel max-w-md w-full p-8 border border-white/10 shadow-2xl animate-scale-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-transparent"></div>
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-6 mx-auto">
                    <Zap size={32} />
                </div>
                <h3 className="text-2xl font-black text-white text-center mb-2 uppercase tracking-tight">¿Cambiar WhatsApp?</h3>
                <p className="text-slate-400 text-center mb-6 leading-relaxed">
                    ¿Deseas cambiar el modo de WhatsApp para <span className="text-white font-bold">"{details.tenantName}"</span>?
                    <br />
                    <span className="text-slate-500 line-through font-bold">{details.from.toUpperCase()}</span>
                    <span className="text-white font-bold mx-2">➔</span>
                    <span className="text-emerald-400 font-extrabold">{details.to.toUpperCase()}</span>
                </p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={onConfirm}
                        className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 animate-pulse-soft"
                    >
                        Confirmar Cambio
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

const formatDateForInput = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch {
        return '';
    }
};

const formatAsEndOfDay = (dateStr: string) => {
    if (!dateStr) return null;
    const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    return new Date(`${datePart}T23:59:59`).toISOString();
};

const EditBusinessModal = ({ isOpen, onClose, tenant, onSave }: any) => {
    const [name, setName] = useState(tenant.name || '');
    const [slug, setSlug] = useState(tenant.slug || '');
    const [category, setCategory] = useState(tenant.category || 'barbershop');
    const [timezone, setTimezone] = useState(tenant.timezone || 'America/Mexico_City');
    const [trialEndsAt, setTrialEndsAt] = useState(formatDateForInput(tenant.trial_ends_at));
    const [subscriptionType, setSubscriptionType] = useState(tenant.subscription_type || 'manual');
    const [paymentStatus, setPaymentStatus] = useState(tenant.payment_status || 'active');
    const [gracePeriodEndsAt, setGracePeriodEndsAt] = useState(formatDateForInput(tenant.grace_period_ends_at));
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const payload: any = {
            name,
            slug,
            category,
            timezone,
            trial_ends_at: trialEndsAt ? formatAsEndOfDay(trialEndsAt) : null,
            subscription_type: subscriptionType,
            payment_status: paymentStatus,
            grace_period_ends_at: gracePeriodEndsAt ? formatAsEndOfDay(gracePeriodEndsAt) : null,
        };
        await onSave(tenant.id, payload);
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-xl bg-[#0a0f1a] border border-white/[0.08] rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="relative p-6 pb-5 border-b border-white/5 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/5 to-transparent" />
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <Pencil size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white tracking-tight">Editar Negocio</h3>
                                <p className="text-slate-500 text-[11px] mt-0.5">Modificar parámetros de la sucursal</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2.5 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10">
                            <X size={18} className="text-slate-500" />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                    <div className="space-y-4">
                        {/* Nombre */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 ml-1">Nombre Comercial</label>
                            <input
                                required type="text"
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm"
                                value={name}
                                onChange={e => setName(e.target.value)}
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
                                    value={slug}
                                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))}
                                />
                            </div>
                            {slug !== tenant.slug && (
                                <p className="text-[10px] text-amber-500/80 ml-1 mt-1">
                                    ⚠️ Cambiar el link de reserva dejará inactivo el enlace anterior del cliente.
                                </p>
                            )}
                        </div>

                        {/* Zona Horaria */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 ml-1">Zona Horaria</label>
                            <select
                                value={timezone}
                                onChange={e => setTimezone(e.target.value)}
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
                                    const isSelected = category === cat.id;
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
                                            onClick={() => setCategory(cat.id)}
                                            className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border transition-all duration-200 cursor-pointer bg-white/[0.02] ${colorMap[cat.color]}`}
                                        >
                                            {cat.icon}
                                            <span className="text-[9px] font-bold uppercase tracking-wider leading-none">{cat.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Tipo de Suscripción */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 ml-1">Tipo de Suscripción</label>
                            <select
                                value={subscriptionType}
                                onChange={e => setSubscriptionType(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm appearance-none"
                            >
                                <option value="manual" className="bg-slate-900">Manual (Cortesía / Demo)</option>
                                <option value="stripe" className="bg-slate-900">Stripe (Validación Automática)</option>
                            </select>
                        </div>

                        {/* Estado del Pago */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 ml-1">Estado del Pago</label>
                            <select
                                value={paymentStatus}
                                onChange={e => setPaymentStatus(e.target.value)}
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm appearance-none"
                            >
                                <option value="active" className="bg-slate-900">🟢 Activo</option>
                                <option value="grace_period" className="bg-slate-900">🟡 Período de Gracia (Aviso)</option>
                                <option value="suspended" className="bg-slate-900">🔴 Suspendido (Bloqueo)</option>
                            </select>
                        </div>

                        {/* Fin del Período de Gracia */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 ml-1">Fin Período de Gracia</label>
                            <input
                                type="date"
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm"
                                value={gracePeriodEndsAt}
                                onChange={e => setGracePeriodEndsAt(e.target.value)}
                            />
                        </div>

                        {/* Expiración del Trial */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 ml-1">Vencimiento Período de Prueba</label>
                            <input
                                type="date"
                                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm"
                                value={trialEndsAt}
                                onChange={e => setTrialEndsAt(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full py-4 rounded-2xl font-black text-white text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2.5 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 via-blue-500 to-purple-600 hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {isSaving ? (
                            <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span> Guardando...</>
                        ) : (
                            <><Pencil size={16} /> Guardar Cambios</>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default function SuperAdminPanel() {
    const { allTenants, fetchAllTenants, switchTenant, deleteTenant, createTenant, updateTenant } = useSuperAdmin();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPlan, setFilterPlan] = useState<'all' | 'free' | 'lite' | 'pro' | 'business' | 'trial' | 'trial_expired' | 'at_risk'>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [tenantToDelete, setTenantToDelete] = useState<any>(null);
    const [pendingPlanChange, setPendingPlanChange] = useState<{ tenantId: string; tenantName: string; from: PlanType; to: PlanType } | null>(null);
    const [pendingSmsChange, setPendingSmsChange] = useState<{ tenantId: string; tenantName: string; from: 'demo' | 'whatsapp'; to: 'demo' | 'whatsapp' } | null>(null);
    const [tenantToEdit, setTenantToEdit] = useState<any>(null);
    const [newBusiness, setNewBusiness] = useState({ name: '', slug: '', category: 'barbershop', ownerEmail: '', ownerPassword: '', monthlyPrice: '29.99', timezone: 'America/Mexico_City', brandSlug: '', plan: 'free' as PlanType, noTrial: false });
    const [isCreating, setIsCreating] = useState(false);
    const [isExistingOwner, setIsExistingOwner] = useState(false);
    const [selectedOwnerId, setSelectedOwnerId] = useState('');
    const [totalSmsCount, setTotalSmsCount] = useState<number | null>(null);
    const [smsCountsByTenant, setSmsCountsByTenant] = useState<Record<string, { total: number; week: number; month: number }>>({});
    const [appointmentsLast30, setAppointmentsLast30] = useState<number | null>(null);
    const [appointmentsByTenant, setAppointmentsByTenant] = useState<Record<string, number>>({});
    const [uniqueClients, setUniqueClients] = useState<number | null>(null);
    const [smsByMonth, setSmsByMonth] = useState<{ month_label: string; count: number }[]>([]);
    const showToast = useUIStore(s => s.showToast);
    const navigate = useNavigate();
    const [isSlugManual, setIsSlugManual] = useState(false);

    const getCategorySuffix = (catId: string) => {
        switch (catId) {
            case 'barbershop': return '-barber';
            case 'beauty_salon': return '-beauty';
            case 'nail_bar': return '-nails';
            case 'spa': return '-spa';
            case 'pet_grooming': return '-pets';
            case 'consulting': return '-consulting';
            default: return '';
        }
    };

    const updateNewBusinessSlug = (businessName: string, catId: string, manualOverride: boolean = isSlugManual) => {
        if (manualOverride) return;
        const baseSlug = businessName.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
        
        if (!baseSlug) {
            setNewBusiness(prev => ({ ...prev, slug: '' }));
            return;
        }

        const suffix = getCategorySuffix(catId);
        if (suffix && !baseSlug.endsWith(suffix)) {
            setNewBusiness(prev => ({ ...prev, slug: baseSlug + suffix }));
        } else {
            setNewBusiness(prev => ({ ...prev, slug: baseSlug }));
        }
    };

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
            // 1. Obtener conteos por tenant agrupados desde la vista de Supabase
            const { data: viewData, error } = await supabase
                .from('whatsapp_metrics_by_tenant')
                .select('*');

            if (error) throw error;

            let sumTotal = 0;
            const counts: Record<string, { total: number; week: number; month: number }> = {};
            viewData?.forEach((row: any) => {
                if (row.tenant_id) {
                    counts[row.tenant_id] = {
                        total: row.total || 0,
                        week: row.week || 0,
                        month: row.month || 0
                    };
                    sumTotal += row.total || 0;
                }
            });
            setSmsCountsByTenant(counts);
            setTotalSmsCount(sumTotal);

            // 2. Obtener historial mensual de mensajes
            const { data: monthData } = await supabase
                .from('whatsapp_metrics_by_month')
                .select('*');
            if (monthData) {
                setSmsByMonth(monthData.map((d: any) => ({ month_label: d.month_label, count: d.count || 0 })));
            }
        } catch (err) {
            console.error("Error fetching SMS metrics:", err);
        }
    };

    const fetchAppointmentMetrics = async () => {
        try {
            // 1. Obtener métricas globales agrupadas desde la vista de Supabase
            const { data: globalData, error: globalErr } = await supabase
                .from('global_platform_metrics')
                .select('*')
                .single();

            if (globalErr) throw globalErr;

            if (globalData) {
                setAppointmentsLast30(globalData.appointments_last_30d || 0);
                setUniqueClients(globalData.unique_clients || 0);
            }

            // 2. Obtener conteos de citas por tenant desde la vista
            const { data: apptTenantData, error: tenantErr } = await supabase
                .from('appointments_last_30d_by_tenant')
                .select('*');

            if (tenantErr) throw tenantErr;

            const apptCounts: Record<string, number> = {};
            apptTenantData?.forEach((row: any) => {
                if (row.tenant_id) {
                    apptCounts[row.tenant_id] = row.count || 0;
                }
            });
            setAppointmentsByTenant(apptCounts);
        } catch (err) {
            console.error('Error fetching appointment metrics:', err);
        }
    };

    const tenantsByMonth = useMemo(() => {
        const groups: Record<string, number> = {};
        allTenants.forEach(t => {
            if (t.created_at) {
                const date = new Date(t.created_at);
                const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                groups[monthStr] = (groups[monthStr] || 0) + 1;
            }
        });
        return Object.entries(groups)
            .map(([month_label, count]) => ({ month_label, count }))
            .sort((a, b) => b.month_label.localeCompare(a.month_label));
    }, [allTenants]);

    const planCounts = useMemo(() => {
        const counts = { all: allTenants.length, free: 0, lite: 0, pro: 0, business: 0, trial: 0, trial_expired: 0, at_risk: 0 };
        const now = new Date();

        // Agrupar por negocio único usando brand_slug, owner_id o id de tenant
        const businesses: Record<string, { plan: PlanType; isTrial: boolean; hasTrialEnds: boolean; tenantIds: string[] }> = {};

        allTenants.forEach(t => {
            const p = (t.plan || 'free') as PlanType;
            const isTrial = t.trial_ends_at ? new Date(t.trial_ends_at) > now : false;
            const key = t.brand_slug || t.owner_id || t.id;

            if (!businesses[key]) {
                businesses[key] = {
                    plan: p,
                    isTrial,
                    hasTrialEnds: !!t.trial_ends_at,
                    tenantIds: [t.id]
                };
            } else {
                const currentRank = getPlanRank(businesses[key].plan);
                const newRank = getPlanRank(p);
                if (newRank > currentRank) {
                    businesses[key].plan = p;
                }
                businesses[key].isTrial = businesses[key].isTrial && isTrial;
                businesses[key].hasTrialEnds = businesses[key].hasTrialEnds || !!t.trial_ends_at;
                businesses[key].tenantIds.push(t.id);
            }
        });

        function getPlanRank(p: PlanType) {
            if (p === 'business') return 3;
            if (p === 'pro') return 2;
            if (p === 'lite') return 1;
            return 0;
        }

        Object.values(businesses).forEach(biz => {
            const p = biz.plan;
            if (p === 'free') counts.free++;
            else if (p === 'lite') counts.lite++;
            else if (p === 'pro') counts.pro++;
            else if (p === 'business') counts.business++;
            
            if (biz.isTrial) {
                counts.trial++;
            } else if (biz.hasTrialEnds && p === 'free') {
                counts.trial_expired++;
            }

            // At Risk: Trial expired + free, OR 0 appointments in last 30d across all branches
            const isTrialExpired = biz.hasTrialEnds && !biz.isTrial && p === 'free';
            const totalAppts = biz.tenantIds.reduce((sum, tid) => sum + (appointmentsByTenant[tid] || 0), 0);
            if (isTrialExpired || totalAppts === 0) {
                counts.at_risk++;
            }
        });

        return counts;
    }, [allTenants, appointmentsByTenant]);

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { all: allTenants.length, barbershop: 0, beauty_salon: 0, nail_bar: 0, spa: 0, consulting: 0, other: 0 };
        const legacyMap: Record<string, string> = { 'salon': 'beauty_salon', 'clinic': 'consulting', 'barber': 'barbershop' };
        const knownKeys = ['barbershop', 'beauty_salon', 'nail_bar', 'spa', 'consulting'];
        
        allTenants.forEach(t => {
            const cat = legacyMap[t.category || ''] || t.category || 'other';
            if (knownKeys.includes(cat)) {
                counts[cat] = (counts[cat] || 0) + 1;
            } else {
                counts.other = (counts.other || 0) + 1;
            }
        });
        return counts;
    }, [allTenants]);

    const filteredTenants = useMemo(() => {
        const now = new Date();
        return allTenants.filter(t => {
            // Search term
            const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.category?.toLowerCase().includes(searchTerm.toLowerCase());
                
            if (!matchesSearch) return false;

            // Resolve the tenant's business-level plan and trial status
            const key = t.brand_slug || t.owner_id || t.id;
            const siblings = allTenants.filter(x => (x.brand_slug || x.owner_id || x.id) === key);
            
            let resolvedPlan: PlanType = 'free';
            let resolvedIsTrial = true;
            let resolvedHasTrialEnds = false;
            let resolvedTotalAppts = 0;

            function getPlanRank(p: PlanType) {
                if (p === 'business') return 3;
                if (p === 'pro') return 2;
                if (p === 'lite') return 1;
                return 0;
            }

            siblings.forEach(s => {
                const sp = (s.plan || 'free') as PlanType;
                const strial = s.trial_ends_at ? new Date(s.trial_ends_at) > now : false;
                if (getPlanRank(sp) > getPlanRank(resolvedPlan)) {
                    resolvedPlan = sp;
                }
                resolvedIsTrial = resolvedIsTrial && strial;
                resolvedHasTrialEnds = resolvedHasTrialEnds || !!s.trial_ends_at;
                resolvedTotalAppts += appointmentsByTenant[s.id] || 0;
            });

            // Plan filter
            if (filterPlan !== 'all') {
                if (filterPlan === 'trial') {
                    if (!resolvedIsTrial) return false;
                } else if (filterPlan === 'trial_expired') {
                    if (resolvedIsTrial || !resolvedHasTrialEnds || resolvedPlan !== 'free') return false;
                } else if (filterPlan === 'at_risk') {
                    const isTrialExpired = resolvedHasTrialEnds && !resolvedIsTrial && resolvedPlan === 'free';
                    if (!isTrialExpired && resolvedTotalAppts > 0) return false;
                } else {
                    if (resolvedPlan !== filterPlan) return false;
                }
            }

            // Category filter
            if (filterCategory !== 'all') {
                const legacyMap: Record<string, string> = { 'salon': 'beauty_salon', 'clinic': 'consulting', 'barber': 'barbershop' };
                const cat = legacyMap[t.category || ''] || t.category || 'other';
                const knownKeys = ['barbershop', 'beauty_salon', 'nail_bar', 'spa', 'consulting'];
                
                if (filterCategory === 'other') {
                    if (knownKeys.includes(cat)) return false;
                } else {
                    if (cat !== filterCategory) return false;
                }
            }

            return true;
        });
    }, [allTenants, searchTerm, filterPlan, filterCategory, appointmentsByTenant]);

    const newThisMonth = allTenants.filter(t => isAfter(new Date(t.created_at || ''), subMonths(new Date(), 1))).length;

    const mrrInfo = useMemo(() => {
        let totalMrr = 0;
        let freeCount = 0;
        let liteCount = 0;
        let proCount = 0;
        let businessCount = 0;
        let activeTrials = 0;

        const now = new Date();
        const businesses: Record<string, { 
            plan: PlanType; 
            isTrial: boolean; 
            totalExtraEmployees: number; 
            totalExtraBranches: number;
            paymentStatus: string;
            gracePeriodEndsAt: string | null;
        }> = {};

        allTenants.forEach(tenant => {
            const plan = (tenant.plan || 'free') as PlanType;
            const isTrial = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) > now : false;
            const key = tenant.brand_slug || tenant.owner_id || tenant.id;

            if (!businesses[key]) {
                businesses[key] = {
                    plan,
                    isTrial,
                    totalExtraEmployees: tenant.extra_employees_paid || 0,
                    totalExtraBranches: tenant.extra_branches_paid || 0,
                    paymentStatus: tenant.payment_status || 'active',
                    gracePeriodEndsAt: tenant.grace_period_ends_at || null
                };
            } else {
                const currentRank = getPlanRank(businesses[key].plan);
                const newRank = getPlanRank(plan);
                if (newRank > currentRank) {
                    businesses[key].plan = plan;
                }
                businesses[key].isTrial = businesses[key].isTrial && isTrial;
                businesses[key].totalExtraEmployees += tenant.extra_employees_paid || 0;
                businesses[key].totalExtraBranches = Math.max(businesses[key].totalExtraBranches, tenant.extra_branches_paid || 0);
                
                // Aggregating payment status
                if (tenant.payment_status === 'suspended' || businesses[key].paymentStatus === 'suspended') {
                    businesses[key].paymentStatus = 'suspended';
                } else if (tenant.payment_status === 'grace_period' || businesses[key].paymentStatus === 'grace_period') {
                    businesses[key].paymentStatus = 'grace_period';
                    businesses[key].gracePeriodEndsAt = tenant.grace_period_ends_at || businesses[key].gracePeriodEndsAt;
                }
            }
        });

        function getPlanRank(p: PlanType) {
            if (p === 'business') return 3;
            if (p === 'pro') return 2;
            if (p === 'lite') return 1;
            return 0;
        }

        Object.values(businesses).forEach(biz => {
            const { plan, isTrial, totalExtraEmployees, totalExtraBranches, paymentStatus, gracePeriodEndsAt } = biz;

            const isSuspended = paymentStatus === 'suspended' || 
                               (paymentStatus === 'grace_period' && gracePeriodEndsAt && new Date(gracePeriodEndsAt) < now);

            if (isTrial) {
                activeTrials++;
            }

            let basePrice = 0;
            if (plan === 'free') {
                freeCount++;
            } else if (plan === 'pro') {
                proCount++;
                if (!isTrial && !isSuspended) basePrice = 649;
            } else if (plan === 'business') {
                businessCount++;
                if (!isTrial && !isSuspended) basePrice = 1249;
            } else if (plan === 'lite') {
                liteCount++;
                if (!isTrial && !isSuspended) basePrice = 349;
            }

            if (!isTrial && !isSuspended) {
                totalMrr += basePrice;
                // Sumar profesionales extra: Pro y Business permiten profesionales adicionales pagados ($249 MXN/mes c/u)
                if (plan === 'pro' || plan === 'business') {
                    totalMrr += totalExtraEmployees * 249;
                }
                // Sumar sucursales extra: Business permite sucursales adicionales pagadas ($599 MXN/mes c/u)
                if (plan === 'business') {
                    totalMrr += totalExtraBranches * 599;
                }
            }
        });

        return { totalMrr, freeCount, liteCount, proCount, businessCount, activeTrials };
    }, [allTenants]);


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
            setIsSlugManual(false);
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

    const confirmPlanChange = async () => {
        if (!pendingPlanChange) return;
        const { tenantId, to, tenantName } = pendingPlanChange;
        const { error } = await supabase.from('tenants').update({ plan: to }).eq('id', tenantId);
        if (error) {
            showToast('Error: ' + error.message, 'error');
        } else {
            fetchAllTenants();
            showToast(`Plan → ${to === 'pro' ? '⭐ Pro' : to === 'business' ? '🚀 Business' : 'Free'} para ${tenantName}`, 'success');
        }
        setPendingPlanChange(null);
    };

    const confirmSmsChange = async () => {
        if (!pendingSmsChange) return;
        const { tenantId, to, tenantName } = pendingSmsChange;
        const { error } = await supabase.from('tenants').update({ sms_provider: to }).eq('id', tenantId);
        if (error) {
            showToast("Error: " + error.message, 'error');
        } else {
            fetchAllTenants();
            showToast(`Mensajería → ${to === 'whatsapp' ? '💬 WhatsApp' : 'Demo'} para ${tenantName}`, 'info');
        }
        setPendingSmsChange(null);
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                    icon={<Building2 size={24} />}
                    title="Negocios Totales"
                    value={allTenants.length}
                    color="text-blue-400"
                    sub={
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{newThisMonth} nuevos este mes</span>
                            {planCounts.at_risk > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFilterPlan('at_risk');
                                        document.getElementById('tenants-table')?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 font-extrabold uppercase text-[8px] transition-all border border-red-500/20 tracking-tighter"
                                >
                                    ⚠️ {planCounts.at_risk} EN RIESGO
                                </button>
                            )}
                        </div>
                    }
                    delay="0"
                />
                <StatCard
                    icon={<DollarSign size={24} />}
                    title="MRR Estimado"
                    value={`$${mrrInfo.totalMrr.toLocaleString()} MXN`}
                    color="text-emerald-400"
                    sub={`${mrrInfo.liteCount} Esen · ${mrrInfo.proCount} Pro · ${mrrInfo.businessCount} Biz · ${mrrInfo.activeTrials} Trials`}
                    delay="1"
                />
                <StatCard
                    icon={<Calendar size={24} />}
                    title="Citas (últimos 30d)"
                    value={appointmentsLast30 !== null ? appointmentsLast30 : '...'}
                    color="text-emerald-400"
                    sub="En toda la plataforma"
                    delay="2"
                />
                <StatCard
                    icon={<Users size={24} />}
                    title="Clientes Únicos"
                    value={uniqueClients !== null ? uniqueClients : '...'}
                    color="text-violet-400"
                    sub="Por teléfono registrado"
                    delay="3"
                />
                <StatCard
                    icon={<Zap size={24} />}
                    title="WhatsApp Totales"
                    value={totalSmsCount !== null ? totalSmsCount : '...'}
                    color="text-emerald-400"
                    sub="Mensajes WhatsApp enviados"
                    delay="4"
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

            {/* Historial de Crecimiento Mensual */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Historial de Mensajes de WhatsApp */}
                <div className="glass-panel p-6 border border-white/5 flex flex-col">
                    <h3 className="text-white font-black text-lg mb-4 flex items-center gap-2 uppercase tracking-tight">
                        <Zap className="text-emerald-400" size={18} />
                        Historial Mensual de WhatsApp
                    </h3>
                    <div className="flex-1 max-h-60 overflow-y-auto space-y-2.5 pr-2 custom-scrollbar">
                        {smsByMonth.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 text-xs">Sin registros de WhatsApp aún.</div>
                        ) : (
                            smsByMonth.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white/[0.02] border border-white/[0.04] p-3.5 rounded-xl hover:bg-white/[0.04] transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 animate-pulse-soft"></div>
                                        <span className="text-sm font-semibold text-slate-300 uppercase">{item.month_label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-black text-emerald-400">{item.count.toLocaleString()}</span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">mensajes</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Historial de Registro de Negocios */}
                <div className="glass-panel p-6 border border-white/5 flex flex-col">
                    <h3 className="text-white font-black text-lg mb-4 flex items-center gap-2 uppercase tracking-tight">
                        <Building2 className="text-blue-400" size={18} />
                        Historial Mensual de Negocios
                    </h3>
                    <div className="flex-1 max-h-60 overflow-y-auto space-y-2.5 pr-2 custom-scrollbar">
                        {tenantsByMonth.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 text-xs">Sin registros de negocios aún.</div>
                        ) : (
                            tenantsByMonth.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white/[0.02] border border-white/[0.04] p-3.5 rounded-xl hover:bg-white/[0.04] transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500/80"></div>
                                        <span className="text-sm font-semibold text-slate-300 uppercase">{item.month_label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-black text-blue-400">+{item.count}</span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">nuevos</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>


            {/* Tenant Management Table */}
            <div id="tenants-table" className="glass-panel rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                <div className="p-6 border-b border-white/5 bg-white/[0.03] flex flex-col gap-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
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

                    {/* Filter Pills */}
                    <div className="flex flex-col gap-3 pt-2 border-t border-white/5">
                        {/* Plan Filters */}
                        <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider mr-2">Plan:</span>
                            {([
                                { key: 'all', label: 'Todos' },
                                { key: 'free', label: 'Free' },
                                { key: 'lite', label: 'Lite' },
                                { key: 'pro', label: 'Pro' },
                                { key: 'business', label: 'Business' },
                                { key: 'trial', label: 'Trial Activo' },
                                { key: 'trial_expired', label: 'Trial Vencido' },
                                { key: 'at_risk', label: '⚠️ En Riesgo' },
                            ] as const).map(p => {
                                const isActive = filterPlan === p.key;
                                const count = planCounts[p.key];
                                return (
                                    <button
                                        key={p.key}
                                        type="button"
                                        onClick={() => setFilterPlan(p.key)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                            isActive
                                                ? 'bg-accent/20 text-accent border-accent/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                                                : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'
                                        }`}
                                    >
                                        {p.label} <span className="opacity-60 font-mono ml-0.5">({count})</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Category Filters */}
                        <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider mr-2">Categoría:</span>
                            {([
                                { key: 'all', label: 'Todas' },
                                { key: 'barbershop', label: 'Barberías' },
                                { key: 'beauty_salon', label: 'Salones' },
                                { key: 'nail_bar', label: "Nail's" },
                                { key: 'spa', label: 'Spas' },
                                { key: 'consulting', label: 'Clínicas' },
                                { key: 'other', label: 'Otros' },
                            ] as const).map(c => {
                                const isActive = filterCategory === c.key;
                                const count = categoryCounts[c.key];
                                return (
                                    <button
                                        key={c.key}
                                        type="button"
                                        onClick={() => setFilterCategory(c.key)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                            isActive
                                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                                : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'
                                        }`}
                                    >
                                        {c.label} <span className="opacity-60 font-mono ml-0.5">({count})</span>
                                    </button>
                                );
                            })}
                        </div>
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
                                {/* —— Top row: logo + info + action buttons —— */}
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
                                                    if (cat === 'barbershop' || cat === 'barber') return 'BARBERÍA';
                                                    if (cat === 'beauty_salon' || cat === 'salon') return 'SALÓN';
                                                    if (cat === 'nail_bar') return "NAIL'S";
                                                    if (cat === 'spa') return 'SPA';
                                                    if (cat === 'consulting' || cat === 'clinic') return 'CLÍNICA';
                                                    if (cat === 'other') return 'OTRO';
                                                    return cat.toUpperCase() || 'ESTÁNDAR';
                                                })()}
                                            </span>
                                            {(() => {
                                                const p = (tenant.plan || 'free') as PlanType;
                                                const b = getPlanBadgeStyles(p);
                                                return <span className={`px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-black tracking-widest uppercase border shrink-0 ${b.bg} ${b.text} ${b.border}`}>{p.toUpperCase()}</span>;
                                            })()}
                                            {tenant.extra_employees_paid > 0 && (
                                                <span className="px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-black tracking-widest uppercase border shrink-0 bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.05)]">
                                                    +{tenant.extra_employees_paid} PROF. EXTRA
                                                </span>
                                            )}
                                            {tenant.extra_branches_paid > 0 && (
                                                <span className="px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-black tracking-widest uppercase border shrink-0 bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_12px_rgba(147,51,234,0.05)]">
                                                    +{tenant.extra_branches_paid} SUC. EXTRA
                                                </span>
                                            )}
                                            {(() => {
                                                if (!tenant.trial_ends_at) return null;
                                                const ends = new Date(tenant.trial_ends_at);
                                                const now = new Date();
                                                const diffTime = ends.getTime() - now.getTime();
                                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                
                                                if (diffDays > 0) {
                                                    return (
                                                        <span className="px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-black tracking-widest uppercase border shrink-0 bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.05)]">
                                                            TRIAL · {diffDays} {diffDays === 1 ? 'DÍA' : 'DÍAS'}
                                                        </span>
                                                    );
                                                } else if (tenant.plan === 'free' || !tenant.plan) {
                                                    return (
                                                        <span className="px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-black tracking-widest uppercase border shrink-0 bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.05)]">
                                                            TRIAL VENCIDO
                                                        </span>
                                                    );
                                                }
                                                return null;
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
 
                                    {/* Action buttons — always top-right */}
                                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setTenantToEdit(tenant)}
                                            className="p-2.5 sm:p-3 rounded-xl bg-white/5 text-slate-400 hover:text-accent transition-colors border border-transparent hover:border-accent/20"
                                            title="Editar Parámetros"
                                        >
                                            <Pencil size={18} />
                                        </button>
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
 
                                {/* —— Bottom row: stats + controls —— */}
                                <div className="mt-3 pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2">
 
                                    {/* WA Stats + Activity */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
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

                                        {/* Activity Citas (últimos 30 días) */}
                                        {(() => {
                                            const apptCount = appointmentsByTenant[tenant.id] || 0;
                                            if (apptCount > 5) {
                                                return (
                                                    <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20" title="Citas en los últimos 30 días">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                                        <span className="text-[10px] font-black text-emerald-400">{apptCount}</span>
                                                        <span className="text-[8px] text-emerald-400/60 font-bold">CITAS</span>
                                                    </div>
                                                );
                                            } else if (apptCount > 0) {
                                                return (
                                                    <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20" title="Citas en los últimos 30 días">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                                        <span className="text-[10px] font-black text-amber-400">{apptCount}</span>
                                                        <span className="text-[8px] text-amber-400/60 font-bold">CITAS</span>
                                                    </div>
                                                );
                                            } else {
                                                return (
                                                    <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 rounded-lg border border-red-500/20" title="Sin citas en los últimos 30 días">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                        <span className="text-[10px] font-black text-red-400 font-mono">INACTIVO</span>
                                                    </div>
                                                );
                                            }
                                        })()}
                                    </div>

                                    {/* Subscription & Payment Status Badges */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {/* Sub Type Badge */}
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase border ${
                                            tenant.subscription_type === 'stripe'
                                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                                        }`}>
                                            {tenant.subscription_type === 'stripe' ? '🔗 STRIPE' : '👤 MANUAL'}
                                        </span>

                                        {/* Payment Status Badge */}
                                        {tenant.subscription_type === 'stripe' && (
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase border ${
                                                tenant.payment_status === 'active'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : tenant.payment_status === 'grace_period'
                                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                            }`}>
                                                {tenant.payment_status === 'active' && '🟢 ACTIVO'}
                                                {tenant.payment_status === 'grace_period' && '🟡 GRACIA'}
                                                {tenant.payment_status === 'suspended' && '🔴 SUSPENDIDO'}
                                            </span>
                                        )}
                                    </div>
 
                                    {/* Spacer */}
                                    <div className="flex-1" />
 
                                    {/* Controls row — wrap on small screens */}
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
                                                        type="button"
                                                        onClick={() => {
                                                            if (tenant.sms_provider === p) return;
                                                            setPendingSmsChange({
                                                                tenantId: tenant.id,
                                                                tenantName: tenant.name,
                                                                from: tenant.sms_provider || 'demo',
                                                                to: p
                                                            });
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
                                                        type="button"
                                                        onClick={() => {
                                                            const currentPlan = (tenant.plan || 'free') as PlanType;
                                                            if (currentPlan === p) return;
                                                            setPendingPlanChange({
                                                                tenantId: tenant.id,
                                                                tenantName: tenant.name,
                                                                from: currentPlan,
                                                                to: p
                                                            });
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

            <PlanConfirmModal
                isOpen={!!pendingPlanChange}
                onClose={() => setPendingPlanChange(null)}
                onConfirm={confirmPlanChange}
                details={pendingPlanChange}
            />

            <SmsConfirmModal
                isOpen={!!pendingSmsChange}
                onClose={() => setPendingSmsChange(null)}
                onConfirm={confirmSmsChange}
                details={pendingSmsChange}
            />

            {tenantToEdit && (
                <EditBusinessModal
                    isOpen={!!tenantToEdit}
                    onClose={() => setTenantToEdit(null)}
                    tenant={tenantToEdit}
                    onSave={async (id: string, payload: any) => {
                        const res = await updateTenant(id, payload);
                        if (res.success) {
                            showToast('Negocio actualizado exitosamente', 'success');
                            setTenantToEdit(null);
                            fetchAllTenants();
                        } else {
                            showToast(res.error || 'Error al actualizar negocio', 'error');
                        }
                    }}
                />
            )}

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
                                            setNewBusiness({ ...newBusiness, name });
                                            updateNewBusinessSlug(name, newBusiness.category);
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
                                            onChange={e => {
                                                const manualSlug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
                                                setNewBusiness({ ...newBusiness, slug: manualSlug });
                                                setIsSlugManual(true);
                                            }}
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
                                                    onClick={() => {
                                                        setNewBusiness({ ...newBusiness, category: cat.id });
                                                        updateNewBusinessSlug(newBusiness.name, cat.id);
                                                    }}
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
                                        { key: 'pro' as PlanType, label: 'Pro', price: '$649', color: 'amber' },
                                        { key: 'business' as PlanType, label: 'Business', price: '$1,249', color: 'violet' },
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
                                    <p className="text-xs font-bold text-white">Período de prueba (30 días)</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                        {newBusiness.noTrial
                                            ? 'El negocio inicia directamente en el plan seleccionado.'
                                            : 'El negocio tendrá acceso completo durante 30 días gratis.'}
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

function StatCard({ icon, title, value, color, sub, delay }: { icon: any, title: string, value: any, color: string, sub: React.ReactNode, delay: string }) {
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
