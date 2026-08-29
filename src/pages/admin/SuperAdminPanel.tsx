import { useEffect, useState, useMemo } from 'react';
import { useSuperAdmin } from '../../lib/store/queries/useSuperAdmin';
import {
    Building2, Trash2, Search, ChevronRight,
    LayoutDashboard, Plus, X, BarChart3,
    Zap, AlertTriangle, Calendar, Users, UserPlus,
    Scissors, Sparkles, Flower2, Briefcase, MoreHorizontal,
    DollarSign, Pencil, Eye, Key, EyeOff, Download, ShoppingBag,
    Phone, MapPin, MessageCircle, Copy, Check, ExternalLink, Navigation, RefreshCw, Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { subMonths, isAfter } from 'date-fns';
import { supabase } from '../../lib/supabaseClient';
import { useUIStore } from '../../lib/store/uiStore';
import { getPlanBadgeStyles } from '../../lib/planLimits';
import type { PlanType } from '../../lib/planLimits';
import { COUNTRY_PRESETS, getCountryPreset } from '../../lib/pricingConfig';
import DatePickerInput from '../../components/DatePickerInput';

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

const PricingRatesModal = ({ isOpen, onClose, smsTwilioCost, setSmsTwilioCost, whatsappCost, setWhatsappCost, showToast }: any) => {
    const [localSmsCost, setLocalSmsCost] = useState(String(smsTwilioCost));
    const [localWaCost, setLocalWaCost] = useState(String(whatsappCost));

    useEffect(() => {
        setLocalSmsCost(String(smsTwilioCost));
        setLocalWaCost(String(whatsappCost));
    }, [smsTwilioCost, whatsappCost, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        const parsedSms = parseFloat(localSmsCost) || 0.0085;
        const parsedWa = parseFloat(localWaCost) || 0.0085;
        setSmsTwilioCost(parsedSms);
        setWhatsappCost(parsedWa);
        localStorage.setItem('citalink_twilio_sms_cost', String(parsedSms));
        localStorage.setItem('citalink_wa_cost', String(parsedWa));

        let currentObj: any = { fxRate: 18.50, whatsappRate: parsedWa, twilioRate: parsedSms };
        try {
            const s = localStorage.getItem('citalink_variable_rates');
            if (s) currentObj = { ...JSON.parse(s), whatsappRate: parsedWa, twilioRate: parsedSms };
        } catch(e) {}
        localStorage.setItem('citalink_variable_rates', JSON.stringify(currentObj));

        if (showToast) showToast('Tarifas de mensajería actualizadas', 'success');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-md bg-[#0a0f1a] border border-white/10 rounded-3xl p-6 shadow-2xl animate-scale-in space-y-5">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                            <Settings size={18} />
                        </div>
                        <div>
                            <h3 className="font-black text-white text-base tracking-tight uppercase">Tarifas de Mensajería</h3>
                            <p className="text-[10px] text-slate-400">Configura el costo unitario por mensaje en dólares (USD)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Costo SMS Twilio (+1 USA) */}
                    <div className="space-y-2 p-3.5 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Phone size={13} />
                                <span>Costo SMS Twilio (+1 USA/CA)</span>
                            </label>
                            <span className="text-[10px] font-bold text-cyan-400 font-mono">USD / SMS</span>
                        </div>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                            <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={localSmsCost}
                                onWheel={e => (e.target as HTMLElement).blur()}
                                onChange={(e) => setLocalSmsCost(e.target.value)}
                                className="w-full bg-black/50 border border-cyan-500/30 rounded-xl py-2.5 pl-8 pr-4 text-white text-sm font-bold focus:outline-none focus:border-cyan-400 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0.0085"
                            />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            <span className="text-[9px] text-slate-400 font-bold">Presets comunes:</span>
                            {['0.0079', '0.0085', '0.0100', '0.0150'].map(preset => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setLocalSmsCost(preset)}
                                    className={`px-2 py-0.5 rounded-md text-[9px] font-bold font-mono transition-all ${
                                        localSmsCost === preset
                                            ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                                            : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                                    }`}
                                >
                                    ${preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Costo WhatsApp Cloud API */}
                    <div className="space-y-2 p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                                <MessageCircle size={13} />
                                <span>Costo WhatsApp Cloud API</span>
                            </label>
                            <span className="text-[10px] font-bold text-emerald-400 font-mono">USD / mensaje</span>
                        </div>
                        <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                            <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={localWaCost}
                                onWheel={e => (e.target as HTMLElement).blur()}
                                onChange={(e) => setLocalWaCost(e.target.value)}
                                className="w-full bg-black/50 border border-emerald-500/30 rounded-xl py-2.5 pl-8 pr-4 text-white text-sm font-bold focus:outline-none focus:border-emerald-400 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0.0085"
                            />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            <span className="text-[9px] text-slate-400 font-bold">Presets comunes:</span>
                            {['0.0050', '0.0085', '0.0125'].map(preset => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setLocalWaCost(preset)}
                                    className={`px-2 py-0.5 rounded-md text-[9px] font-bold font-mono transition-all ${
                                        localWaCost === preset
                                            ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                                            : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                                    }`}
                                >
                                    ${preset}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <button
                        type="button"
                        onClick={handleSave}
                        className="flex-1 py-3 rounded-xl bg-accent hover:brightness-110 text-slate-950 font-black uppercase tracking-wider text-xs transition-all shadow-md"
                    >
                        Guardar Tarifas
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
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

const EditBusinessModal = ({ isOpen, onClose, tenant, onSave, onSwitchTenant, onResetPassword, onRelinkOwner, onDelete, smsStats, apptCount, smsUsCount, smsTwilioCost = 0.0085, whatsappCost = 0.0085, onOpenPricingModal }: any) => {
    const [activeTab, setActiveTab] = useState<'info' | 'plan' | 'owner' | 'metrics'>('info');
    const [name, setName] = useState(tenant.name || '');
    const [slug, setSlug] = useState(tenant.slug || '');
    const [category, setCategory] = useState(tenant.category || 'barbershop');
    const [phone, setPhone] = useState(tenant.phone || '');
    const [address, setAddress] = useState(tenant.address || '');
    const [googleMapsUrl, setGoogleMapsUrl] = useState(tenant.google_maps_url || '');
    const [countryCode, setCountryCode] = useState(tenant.countryCode || tenant.country_code || 'MX');
    const [timezone, setTimezone] = useState(tenant.timezone || 'America/Mexico_City');
    const [plan, setPlan] = useState<PlanType>((tenant.plan || 'lite') as PlanType);
    const [trialEndsAt, setTrialEndsAt] = useState(formatDateForInput(tenant.trial_ends_at));
    const [subscriptionType, setSubscriptionType] = useState(tenant.subscription_type || 'manual');
    const isTrialExpired = !!(tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date());
    const [paymentStatus, setPaymentStatus] = useState(
        tenant.payment_status ? tenant.payment_status : (isTrialExpired ? 'suspended' : 'active')
    );
    const [gracePeriodEndsAt, setGracePeriodEndsAt] = useState(formatDateForInput(tenant.grace_period_ends_at));
    const [marketplaceEnabled, setMarketplaceEnabled] = useState(tenant.marketplace_enabled || false);
    const [marketplaceCommissionRate, setMarketplaceCommissionRate] = useState<number>(tenant.marketplace_commission_rate ?? 15);
    const [smsProvider, setSmsProvider] = useState(tenant.sms_provider || 'demo');
    const [extraEmployeesPaid] = useState<number>(tenant.extra_employees_paid || 0);
    const [extraBranchesPaid] = useState<number>(tenant.extra_branches_paid || 0);
    const [isSaving, setIsSaving] = useState(false);
    const [copiedSlug, setCopiedSlug] = useState(false);

    const [ownerEmail, setOwnerEmail] = useState('');
    const [loadingOwner, setLoadingOwner] = useState(false);

    useEffect(() => {
        if (!tenant?.id) return;
        setLoadingOwner(true);
        supabase
            .from('tenant_users')
            .select('email')
            .eq('tenant_id', tenant.id)
            .eq('role', 'owner')
            .limit(1)
            .maybeSingle()
            .then(({ data }) => {
                if (data?.email) setOwnerEmail(data.email);
                setLoadingOwner(false);
            });
    }, [tenant?.id]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const preset = getCountryPreset(countryCode);
        const payload: any = {
            name: name.trim(),
            slug: slug.trim().toLowerCase(),
            category,
            phone: phone.trim() || null,
            address: address.trim() || null,
            google_maps_url: googleMapsUrl.trim() || null,
            country_code: countryCode,
            currency: preset.currency,
            currency_symbol: preset.currencySymbol,
            timezone,
            plan,
            trial_ends_at: trialEndsAt ? formatAsEndOfDay(trialEndsAt) : null,
            subscription_type: subscriptionType,
            payment_status: paymentStatus,
            grace_period_ends_at: gracePeriodEndsAt ? formatAsEndOfDay(gracePeriodEndsAt) : null,
            marketplace_enabled: marketplaceEnabled,
            marketplace_commission_rate: marketplaceCommissionRate,
            sms_provider: smsProvider,
            extra_employees_paid: extraEmployeesPaid,
            extra_branches_paid: extraBranchesPaid
        };
        await onSave(tenant.id, payload);
        setIsSaving(false);
    };

    const handleCopySlug = () => {
        navigator.clipboard.writeText(`https://www.citalink.app/${slug}`);
        setCopiedSlug(true);
        setTimeout(() => setCopiedSlug(false), 2000);
    };

    const cleanPhone = (phone || '').replace(/\D/g, '');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-2xl bg-[#0a0f1a] border border-white/[0.08] rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="relative p-5 sm:p-6 pb-4 border-b border-white/5 overflow-hidden bg-gradient-to-r from-blue-600/10 via-purple-600/5 to-transparent">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div className="w-12 h-12 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                                {tenant.logoUrl ? (
                                    <img decoding="async" loading="lazy" src={tenant.logoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <Sparkles size={20} className="text-accent" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-lg sm:text-xl font-black text-white tracking-tight uppercase truncate">
                                        {tenant.name}
                                    </h3>
                                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-[9px] font-black tracking-wider uppercase text-blue-400 border border-blue-500/20">
                                        {getCountryPreset(countryCode).flag} {getCountryPreset(countryCode).currency}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <button
                                        type="button"
                                        onClick={handleCopySlug}
                                        className="text-xs font-mono text-accent/90 hover:text-accent flex items-center gap-1 transition-colors"
                                        title="Copiar enlace"
                                    >
                                        <span>citalink.app/{slug}</span>
                                        {copiedSlug ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => onSwitchTenant && onSwitchTenant(tenant.id)}
                                className="px-3 py-2 rounded-xl bg-accent hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md"
                                title="Entrar al Panel de Control de este Negocio"
                            >
                                <Zap size={14} />
                                <span className="hidden sm:inline">Entrar al Panel</span>
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10 text-slate-500 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-1.5 mt-4 pt-2 border-t border-white/5 overflow-x-auto custom-scrollbar">
                        {[
                            { id: 'info' as const, label: '📋 Datos & Contacto' },
                            { id: 'plan' as const, label: '💎 Plan & Cobro' },
                            { id: 'owner' as const, label: '👤 Dueño & Accesos' },
                            { id: 'metrics' as const, label: '💬 Mensajes & Métricas' },
                        ].map(t => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setActiveTab(t.id)}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                                    activeTab === t.id
                                        ? 'bg-accent/20 text-accent border-accent/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                                        : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    
                    {/* TAB 1: DATOS & CONTACTO */}
                    {activeTab === 'info' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre Comercial *</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enlace Público / Slug *</label>
                                    <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.08] overflow-hidden focus-within:border-blue-500/40">
                                        <span className="px-3 py-2.5 bg-white/5 text-slate-500 text-xs font-mono select-none flex items-center border-r border-white/5">
                                            citalink.app/
                                        </span>
                                        <input
                                            required
                                            type="text"
                                            className="flex-1 bg-transparent px-3 py-2.5 text-white font-mono text-sm focus:outline-none"
                                            value={slug}
                                            onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Rubro / Categoría */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rubro / Categoría</label>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                                    {[
                                        { id: 'barbershop', label: 'Barbería', icon: <Scissors size={14} /> },
                                        { id: 'beauty_salon', label: 'Salón', icon: <Sparkles size={14} /> },
                                        { id: 'nail_bar', label: "Nail's", icon: <Sparkles size={14} /> },
                                        { id: 'spa', label: 'Spa', icon: <Flower2 size={14} /> },
                                        { id: 'consulting', label: 'Clínica', icon: <Briefcase size={14} /> },
                                        { id: 'other', label: 'Otro', icon: <MoreHorizontal size={14} /> },
                                    ].map(cat => {
                                        const isSelected = category === cat.id;
                                        return (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setCategory(cat.id)}
                                                className={`flex flex-col items-center gap-1 py-2 px-1.5 rounded-xl border text-center transition-all ${
                                                    isSelected
                                                        ? 'bg-accent/20 border-accent/40 text-accent font-black shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                                                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white hover:border-white/10'
                                                }`}
                                            >
                                                {cat.icon}
                                                <span className="text-[8px] font-bold uppercase tracking-wider">{cat.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Teléfono del Negocio */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Phone size={12} className="text-emerald-400" />
                                        <span>Teléfono / WhatsApp de Recepción</span>
                                    </label>
                                    {cleanPhone && (
                                        <a
                                            href={`https://wa.me/${cleanPhone}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors"
                                        >
                                            <MessageCircle size={11} />
                                            <span>Abrir WhatsApp</span>
                                        </a>
                                    )}
                                </div>
                                <input
                                    type="tel"
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 transition-all outline-none text-sm"
                                    placeholder="Ej. 8681361010 o +52 868 136 1010"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                />
                            </div>

                            {/* Dirección Física & Google Maps */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <MapPin size={12} className="text-rose-400" />
                                        <span>Dirección Física del Local</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm"
                                        placeholder="Ej. Av. Hidalgo #120, Col. Centro"
                                        value={address}
                                        onChange={e => setAddress(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Navigation size={12} className="text-blue-400" />
                                            <span>Coordenadas / Maps</span>
                                        </label>
                                        {googleMapsUrl && (
                                            <a
                                                href={googleMapsUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition-colors"
                                            >
                                                <ExternalLink size={10} />
                                                <span>Ver Mapa</span>
                                            </a>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-xs font-mono"
                                        placeholder="https://maps.google.com/?q=25.8690,-97.5027"
                                        value={googleMapsUrl}
                                        onChange={e => setGoogleMapsUrl(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* País, Moneda y Zona Horaria */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">País y Divisa</label>
                                    <select
                                        value={countryCode}
                                        onChange={e => {
                                            const code = e.target.value;
                                            setCountryCode(code);
                                            const preset = getCountryPreset(code);
                                            if (preset.timezone) setTimezone(preset.timezone);
                                        }}
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm cursor-pointer"
                                    >
                                        {Object.values(COUNTRY_PRESETS).map(country => (
                                            <option key={country.code} value={country.code} className="bg-slate-900 text-white">
                                                {country.flag} {country.name} ({country.currencySymbol} · {country.phonePrefix})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zona Horaria</label>
                                    <select
                                        value={timezone}
                                        onChange={e => setTimezone(e.target.value)}
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm cursor-pointer"
                                    >
                                        <option value="America/Mexico_City" className="bg-slate-900">🇲🇽 México Central (CDMX, Mty, Gdl)</option>
                                        <option value="America/Tijuana" className="bg-slate-900">🇲🇽 México Pacífico (Tijuana, Mexicali)</option>
                                        <option value="America/Mazatlan" className="bg-slate-900">🇲🇽 México Montaña (Mazatlán, Culiacán)</option>
                                        <option value="America/Cancun" className="bg-slate-900">🇲🇽 México Este (Cancún)</option>
                                        <option value="America/New_York" className="bg-slate-900">🇺🇸 EE.UU. Este (New York, Miami)</option>
                                        <option value="America/Chicago" className="bg-slate-900">🇺🇸 EE.UU. Central (Chicago, Houston)</option>
                                        <option value="Europe/Madrid" className="bg-slate-900">🇪🇸 España (Madrid, Barcelona)</option>
                                        <option value="America/Bogota" className="bg-slate-900">🇨🇴/🇪🇨 Colombia / Perú / Ecuador</option>
                                        <option value="America/Santiago" className="bg-slate-900">🇨🇱 Chile</option>
                                        <option value="America/Argentina/Buenos_Aires" className="bg-slate-900">🇦🇷 Argentina</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: PLAN & COBRO */}
                    {activeTab === 'plan' && (
                        <div className="space-y-4 animate-fade-in">
                            {/* Selector de Plan */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plan de Suscripción</label>
                                <div className="grid grid-cols-3 gap-2.5">
                                    {[
                                        { key: 'lite' as PlanType, name: 'Esencial', price: '$349', desc: '1 Staff' },
                                        { key: 'pro' as PlanType, name: 'Pro', price: '$649', desc: 'Multi-Staff' },
                                        { key: 'business' as PlanType, name: 'Business', price: '$1,249', desc: 'Sucursales' },
                                    ].map(p => (
                                        <button
                                            type="button"
                                            key={p.key}
                                            onClick={() => setPlan(p.key)}
                                            className={`p-3 rounded-2xl border text-center transition-all ${
                                                plan === p.key
                                                    ? 'bg-accent/20 border-accent/40 text-white shadow-lg shadow-accent/10'
                                                    : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white hover:border-white/10'
                                            }`}
                                        >
                                            <p className="font-black text-xs text-white">{p.name}</p>
                                            <p className="text-[10px] font-bold text-accent">{p.price}/mes</p>
                                            <p className="text-[9px] text-slate-500 mt-0.5">{p.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tipo de Suscripción & Estado de Pago */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de Cobro</label>
                                    <select
                                        value={subscriptionType}
                                        onChange={e => setSubscriptionType(e.target.value)}
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm"
                                    >
                                        <option value="manual" className="bg-slate-900">👤 Manual (Cortesía / Efectivo / Demo)</option>
                                        <option value="stripe" className="bg-slate-900">🔗 Stripe (Cobro Automático)</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado del Pago</label>
                                    <select
                                        value={paymentStatus}
                                        onChange={e => setPaymentStatus(e.target.value)}
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm"
                                    >
                                        <option value="active" className="bg-slate-900">🟢 Activo (Acceso Total)</option>
                                        <option value="grace_period" className="bg-slate-900">🟡 Período de Gracia (Aviso de Pago)</option>
                                        <option value="suspended" className="bg-slate-900">🔴 Suspendido (Bloqueo)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Fechas de Trial y Período de Gracia */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Calendar size={12} className="text-amber-400" />
                                        <span>Fin de Prueba Gratis (Trial)</span>
                                    </label>
                                    <DatePickerInput
                                        value={trialEndsAt}
                                        onChange={val => setTrialEndsAt(val)}
                                        placeholder="Sin vencimiento..."
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Calendar size={12} className="text-rose-400" />
                                        <span>Fin de Período de Gracia</span>
                                    </label>
                                    <DatePickerInput
                                        value={gracePeriodEndsAt}
                                        onChange={val => setGracePeriodEndsAt(val)}
                                        placeholder="Sin periodo de gracia..."
                                    />
                                </div>
                            </div>

                            {/* Marketplace CitaLink */}
                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-white flex items-center gap-1.5">
                                            <ShoppingBag size={14} className="text-emerald-400" />
                                            <span>Marketplace / Explorar CitaLink</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Permite que nuevos clientes encuentren este negocio en la app</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={marketplaceEnabled}
                                        onChange={e => setMarketplaceEnabled(e.target.checked)}
                                        className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                                    />
                                </div>

                                {marketplaceEnabled && (
                                    <div className="space-y-1.5 pt-2 border-t border-white/5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Comisión de Marketplace</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[10, 15].map((rate) => (
                                                <button
                                                    key={rate}
                                                    type="button"
                                                    onClick={() => setMarketplaceCommissionRate(rate)}
                                                    className={`py-2 px-3 rounded-xl border text-xs font-black transition-all ${
                                                        marketplaceCommissionRate === rate
                                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                                            : 'bg-white/[0.02] text-slate-400 border-white/5 hover:text-white'
                                                    }`}
                                                >
                                                    {rate}% Comisión
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: DUEÑO & ACCESOS */}
                    {activeTab === 'owner' && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cuenta de Usuario del Dueño</span>
                                        <p className="text-sm font-bold text-white font-mono mt-0.5">
                                            {loadingOwner ? 'Cargando correo...' : (ownerEmail || 'Sin usuario asignado')}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-white/5">
                                    <button
                                        type="button"
                                        onClick={() => onResetPassword && onResetPassword(tenant)}
                                        className="py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <Key size={13} />
                                        <span>Cambiar Contraseña</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => onRelinkOwner && onRelinkOwner(tenant)}
                                        className="py-2.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <RefreshCw size={13} />
                                        <span>Re-vincular Cuenta</span>
                                    </button>
                                </div>
                            </div>

                            {/* Contactar por WhatsApp */}
                            {cleanPhone && (
                                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                                    <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                        <MessageCircle size={14} />
                                        <span>Enviar Mensaje Directo al Dueño</span>
                                    </p>
                                    <p className="text-[11px] text-slate-300">
                                        Escríbele directamente a su WhatsApp ({phone}) para brindarle soporte o enviarle información de su cuenta.
                                    </p>
                                    <a
                                        href={`https://wa.me/${cleanPhone}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-lg shadow-emerald-600/20"
                                    >
                                        <MessageCircle size={13} />
                                        <span>Abrir Chat de WhatsApp</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 4: MENSAJES & MÉTRICAS */}
                    {activeTab === 'metrics' && (
                        <div className="space-y-4 animate-fade-in">
                            {/* Proveedor de WhatsApp */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proveedor de Notificaciones</label>
                                    {onOpenPricingModal && (
                                        <button
                                            type="button"
                                            onClick={onOpenPricingModal}
                                            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition-colors"
                                        >
                                            <Settings size={11} />
                                            <span>Ajustar Tarifas USD</span>
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSmsProvider('whatsapp')}
                                        className={`py-3 px-4 rounded-2xl border text-center transition-all ${
                                            smsProvider === 'whatsapp'
                                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] font-bold'
                                                : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <p className="text-xs font-black">💬 WhatsApp Cloud API</p>
                                        <p className="text-[9px] text-emerald-400/80 mt-0.5">${whatsappCost} USD / mensaje</p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSmsProvider('demo')}
                                        className={`py-3 px-4 rounded-2xl border text-center transition-all ${
                                            smsProvider === 'demo'
                                                ? 'bg-amber-500/20 border-amber-400 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)] font-bold'
                                                : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <p className="text-xs font-black">🔵 Modo Demo / Manual</p>
                                        <p className="text-[9px] text-amber-400/80 mt-0.5">Sin costo de API</p>
                                    </button>
                                </div>
                            </div>

                            {/* Métricas de Mensajes, Citas y Costos en USD */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Citas este Mes</span>
                                    <p className="text-lg font-black text-white mt-0.5">{apptCount || 0}</p>
                                    <span className="text-[9px] font-mono text-slate-400 block mt-0.5">Est. ${((apptCount || 0) * whatsappCost).toFixed(2)} USD</span>
                                </div>
                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase">WA esta Semana</span>
                                    <p className="text-lg font-black text-emerald-400 mt-0.5">{smsStats?.week || 0}</p>
                                    <span className="text-[9px] font-mono text-emerald-400/80 block mt-0.5">${((smsStats?.week || 0) * whatsappCost).toFixed(2)} USD</span>
                                </div>
                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase">WA Totales</span>
                                    <p className="text-lg font-black text-blue-400 mt-0.5">{smsStats?.total || 0}</p>
                                    <span className="text-[9px] font-mono text-blue-400/80 block mt-0.5">${((smsStats?.total || 0) * whatsappCost).toFixed(2)} USD</span>
                                </div>
                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase">SMS (+1 USA/CA)</span>
                                    <p className="text-lg font-black text-cyan-400 mt-0.5">{smsUsCount || 0}</p>
                                    <span className="text-[9px] font-mono text-cyan-400/80 block mt-0.5">${((smsUsCount || 0) * smsTwilioCost).toFixed(2)} USD</span>
                                </div>
                            </div>

                            {/* Banner informativo de SMS Tradicional con botón para editar */}
                            <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-xs text-cyan-300/90 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Phone size={14} className="shrink-0 text-cyan-400" />
                                    <span className="text-[11px] leading-relaxed">
                                        SMS a números <strong>+1 (USA/Canadá)</strong> vía Twilio tarificado a <strong>${smsTwilioCost} USD</strong> por SMS.
                                    </span>
                                </div>
                                {onOpenPricingModal && (
                                    <button
                                        type="button"
                                        onClick={onOpenPricingModal}
                                        className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-bold border border-cyan-500/30 transition-all shrink-0"
                                    >
                                        Editar Tarifa
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Submit and Delete Bar */}
                    <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => onDelete && onDelete(tenant)}
                            className="py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                            <Trash2 size={14} />
                            <span>Eliminar Negocio</span>
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-colors"
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="py-3 px-6 rounded-xl font-black text-white text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 transition-all duration-300 disabled:opacity-40 bg-gradient-to-r from-blue-600 via-blue-500 to-purple-600 hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {isSaving ? (
                                    <><span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"></span> Guardando...</>
                                ) : (
                                    <><Pencil size={14} /> Guardar Cambios</>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function SuperAdminPanel() {
    const { allTenants, fetchAllTenants, switchTenant, deleteTenant, createTenant, updateTenant, relinkOwner, resetOwnerPassword } = useSuperAdmin();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPlan, setFilterPlan] = useState<'all' | 'free' | 'lite' | 'pro' | 'business' | 'trial' | 'trial_expired' | 'at_risk'>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [tenantToDelete, setTenantToDelete] = useState<any>(null);
    const [pendingPlanChange, setPendingPlanChange] = useState<{ tenantId: string; tenantName: string; from: PlanType; to: PlanType } | null>(null);
    const [pendingSmsChange, setPendingSmsChange] = useState<{ tenantId: string; tenantName: string; from: 'demo' | 'whatsapp'; to: 'demo' | 'whatsapp' } | null>(null);
    const [tenantToEdit, setTenantToEdit] = useState<any>(null);
    const [newBusiness, setNewBusiness] = useState({ name: '', slug: '', category: 'barbershop', ownerEmail: '', ownerPassword: '', monthlyPrice: '349', timezone: 'America/Mexico_City', countryCode: 'MX', brandSlug: '', plan: 'lite' as PlanType, noTrial: false });
    const [isCreating, setIsCreating] = useState(false);
    const [isExistingOwner, setIsExistingOwner] = useState(false);
    const [selectedOwnerId, setSelectedOwnerId] = useState('');
    const [ownerSearchQuery, setOwnerSearchQuery] = useState('');

    // Lista única de dueños existentes para vincular sucursales
    const uniqueOwners = useMemo(() => {
        const ownerMap = new Map<string, { id: string; name: string; email: string; slug: string; category?: string; brandSlug?: string }>();
        allTenants.forEach((t: any) => {
            if (t.owner_id && !ownerMap.has(t.owner_id)) {
                const ownerTu = t.tenant_users?.find((u: any) => u.role === 'owner') || t.tenant_users?.[0];
                ownerMap.set(t.owner_id, {
                    id: t.owner_id,
                    name: t.name,
                    email: ownerTu?.email || '',
                    slug: t.slug || '',
                    category: t.category || '',
                    brandSlug: t.brand_slug || t.slug || '',
                });
            }
        });
        return Array.from(ownerMap.values());
    }, [allTenants]);

    const filteredOwners = useMemo(() => {
        const q = ownerSearchQuery.toLowerCase().trim();
        if (!q) return uniqueOwners;
        return uniqueOwners.filter(o =>
            o.name.toLowerCase().includes(q) ||
            o.email.toLowerCase().includes(q) ||
            o.slug.toLowerCase().includes(q) ||
            (o.category && o.category.toLowerCase().includes(q))
        );
    }, [uniqueOwners, ownerSearchQuery]);
    const [totalSmsCount, setTotalSmsCount] = useState<number | null>(null);
    const [totalSmsUsCount, setTotalSmsUsCount] = useState<number | null>(null);
    const [smsCountsByTenant, setSmsCountsByTenant] = useState<Record<string, { total: number; week: number; month: number }>>({});
    const [smsUsCountsByTenant, setSmsUsCountsByTenant] = useState<Record<string, number>>({});
    const [appointmentsLast30, setAppointmentsLast30] = useState<number | null>(null);
    const [appointmentsByTenant, setAppointmentsByTenant] = useState<Record<string, number>>({});
    const [uniqueClients, setUniqueClients] = useState<number | null>(null);
    const [smsByMonth, setSmsByMonth] = useState<{ month_label: string; count: number }[]>([]);
    const showToast = useUIStore(s => s.showToast);
    const navigate = useNavigate();
    const [isSlugManual, setIsSlugManual] = useState(false);
    const [relinkModal, setRelinkModal] = useState<{ tenantId: string; tenantName: string } | null>(null);
    const [relinkEmail, setRelinkEmail] = useState('');
    const [isRelinking, setIsRelinking] = useState(false);
    const [resetPasswordModal, setResetPasswordModal] = useState<{ tenantId: string; tenantName: string } | null>(null);
    const [resetPasswordEmail, setResetPasswordEmail] = useState('');
    const [newPasswordInput, setNewPasswordInput] = useState('');
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [smsTwilioCost, setSmsTwilioCost] = useState<number>(() => {
        const saved = localStorage.getItem('citalink_twilio_sms_cost');
        return saved ? parseFloat(saved) : 0.0085;
    });
    const [whatsappCost, setWhatsappCost] = useState<number>(() => {
        const saved = localStorage.getItem('citalink_wa_cost');
        return saved ? parseFloat(saved) : 0.0085;
    });
    const [isCostModalOpen, setIsCostModalOpen] = useState(false);

    const getCategorySuffix = (catId: string) => {
        switch (catId) {
            case 'barbershop': return '-barber';
            case 'beauty_salon': return '-beauty';
            case 'nail_bar': return '-nails';
            case 'lashes': return '-lashes';
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
    }, []);

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

            // 3. Obtener conteos de SMS tradicionales a números +1 (USA/CA)
            try {
                const { data: smsUsLogs } = await supabase
                    .from('sms_logs')
                    .select('id, tenant_id, phone, phone_to, provider')
                    .or('provider.eq.twilio,provider.eq.sms,phone.like.+1%,phone_to.like.+1%');

                if (smsUsLogs) {
                    setTotalSmsUsCount(smsUsLogs.length);
                    const usCounts: Record<string, number> = {};
                    smsUsLogs.forEach((row: any) => {
                        if (row.tenant_id) {
                            usCounts[row.tenant_id] = (usCounts[row.tenant_id] || 0) + 1;
                        }
                    });
                    setSmsUsCountsByTenant(usCounts);
                }
            } catch (usErr) {
                console.warn("Error fetching SMS US metrics:", usErr);
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
            hasPayment: boolean;
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
                    gracePeriodEndsAt: tenant.grace_period_ends_at || null,
                    hasPayment: !!tenant.stripe_subscription_id || tenant.subscription_type === 'manual'
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
                businesses[key].hasPayment = businesses[key].hasPayment || !!tenant.stripe_subscription_id || tenant.subscription_type === 'manual';
                
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
            const { plan, isTrial, totalExtraEmployees, totalExtraBranches, paymentStatus, gracePeriodEndsAt, hasPayment } = biz;

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
                if (!isTrial && !isSuspended && hasPayment) basePrice = 649;
            } else if (plan === 'business') {
                businessCount++;
                if (!isTrial && !isSuspended && hasPayment) basePrice = 1249;
            } else if (plan === 'lite') {
                liteCount++;
                if (!isTrial && !isSuspended && hasPayment) basePrice = 349;
            }

            if (!isTrial && !isSuspended && hasPayment) {
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
        const preset = getCountryPreset(newBusiness.countryCode || 'MX');
        const res = await createTenant(
            newBusiness.name,
            newBusiness.slug,
            '',
            newBusiness.category,
            newBusiness.ownerEmail.trim().toLowerCase(),
            newBusiness.ownerPassword,
            newBusiness.timezone || preset.timezone,
            isExistingOwner && selectedOwnerId ? selectedOwnerId : undefined,
            isExistingOwner && newBusiness.brandSlug ? newBusiness.brandSlug : undefined,
            newBusiness.noTrial,
            preset.code,
            preset.currency,
            preset.currencySymbol,
            preset.phonePrefix
        );
        setIsCreating(false);
        if (res.success) {
            // Update the plan on the new tenant
            if (res.data?.id && newBusiness.plan !== 'free') {
                await supabase.from('tenants').update({ plan: newBusiness.plan }).eq('id', res.data.id);
            }
            setIsCreateModalOpen(false);
            setIsSlugManual(false);
            setNewBusiness({ name: '', slug: '', category: 'barbershop', ownerEmail: '', ownerPassword: '', monthlyPrice: '349', timezone: 'America/Mexico_City', countryCode: 'MX', brandSlug: '', plan: 'lite', noTrial: false });
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

    const handleRelinkClick = (tenant: any) => {
        setRelinkEmail('');
        setRelinkModal({ tenantId: tenant.id, tenantName: tenant.name });
    };

    const confirmRelink = async () => {
        if (!relinkModal || !relinkEmail.trim()) return;
        setIsRelinking(true);
        const res = await relinkOwner(relinkModal.tenantId, relinkEmail.trim().toLowerCase());
        setIsRelinking(false);
        if (res.success) {
            showToast(`✅ Owner re-vinculado correctamente a "${relinkModal.tenantName}"`, 'success');
            setRelinkModal(null);
            setRelinkEmail('');
        } else {
            showToast('Error: ' + (res.error || 'No se pudo re-vincular'), 'error');
        }
    };

    const handleResetPasswordClick = async (tenant: any) => {
        let ownerEmail = '';
        const { data: tu } = await supabase
            .from('tenant_users')
            .select('email')
            .eq('tenant_id', tenant.id)
            .eq('role', 'owner')
            .limit(1)
            .maybeSingle();
        if (tu?.email) {
            ownerEmail = tu.email;
        }
        setResetPasswordEmail(ownerEmail);
        setNewPasswordInput('');
        setShowNewPassword(false);
        setResetPasswordModal({ tenantId: tenant.id, tenantName: tenant.name });
    };

    const confirmResetPassword = async () => {
        if (!resetPasswordModal || !resetPasswordEmail.trim() || !newPasswordInput.trim()) return;
        setIsResettingPassword(true);
        const res = await resetOwnerPassword(resetPasswordEmail.trim().toLowerCase(), newPasswordInput.trim());
        setIsResettingPassword(false);
        if (res.success) {
            showToast(`✅ Contraseña cambiada correctamente para ${resetPasswordEmail}`, 'success');
            setResetPasswordModal(null);
            setResetPasswordEmail('');
            setNewPasswordInput('');
        } else {
            showToast('Error: ' + (res.error || 'No se pudo actualizar la contraseña'), 'error');
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
            const planNames: Record<string, string> = {
                free: 'Free',
                lite: '⚡ Esencial',
                pro: '⭐ Pro',
                business: '🚀 Business'
            };
            showToast(`Plan → ${planNames[to] || to} para ${tenantName}`, 'success');
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

            {/* Modal Re-vincular Owner */}
            {relinkModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-panel max-w-md w-full p-8 border border-white/10 shadow-2xl animate-scale-in relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-transparent"></div>
                        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-5 mx-auto">
                            <Eye size={28} />
                        </div>
                        <h3 className="text-xl font-black text-white text-center mb-1 uppercase tracking-tight">Re-vincular Owner</h3>
                        <p className="text-slate-400 text-center text-sm mb-5 leading-relaxed">
                            Asigna el correo correcto del dueño a <span className="text-white font-bold">"{relinkModal.tenantName}"</span>.
                            Esto actualizará <code className="text-cyan-400 text-xs">owner_id</code> y <code className="text-cyan-400 text-xs">tenant_users</code> automáticamente.
                        </p>
                        <input
                            type="email"
                            value={relinkEmail}
                            onChange={e => setRelinkEmail(e.target.value)}
                            placeholder="correo_correcto@ejemplo.com"
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-all outline-none text-sm mb-5"
                        />
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={confirmRelink}
                                disabled={isRelinking || !relinkEmail.trim()}
                                className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 font-black uppercase tracking-widest transition-all text-sm"
                            >
                                {isRelinking ? 'Vinculando...' : '🔗 Re-vincular Owner'}
                            </button>
                            <button
                                onClick={() => { setRelinkModal(null); setRelinkEmail(''); }}
                                className="w-full py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold uppercase tracking-widest transition-all text-sm"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Restablecer Contraseña */}
            {resetPasswordModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-panel max-w-md w-full p-8 border border-white/10 shadow-2xl animate-scale-in relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-transparent"></div>
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 mx-auto">
                            <Key size={28} />
                        </div>
                        <h3 className="text-xl font-black text-white text-center mb-1 uppercase tracking-tight">Cambiar Contraseña</h3>
                        <p className="text-slate-400 text-center text-sm mb-5 leading-relaxed">
                            Asigna una nueva contraseña de acceso para <span className="text-white font-bold">"{resetPasswordModal.tenantName}"</span>.
                        </p>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-[11px] font-bold text-slate-400 ml-1 block mb-1">Correo Electrónico del Dueño</label>
                                <input
                                    type="email"
                                    value={resetPasswordEmail}
                                    onChange={e => setResetPasswordEmail(e.target.value)}
                                    placeholder="dueno@correo.com"
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/30 transition-all outline-none text-sm"
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[11px] font-bold text-slate-400 ml-1 block">Nueva Contraseña</label>
                                    <button
                                        type="button"
                                        onClick={() => setNewPasswordInput('temp1234')}
                                        className="text-[10px] font-black text-amber-400 hover:underline uppercase tracking-wider"
                                    >
                                        ⚡ Usar temp1234
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={newPasswordInput}
                                        onChange={e => setNewPasswordInput(e.target.value)}
                                        placeholder="Mínimo 6 caracteres"
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-4 pr-10 py-3 text-white font-mono text-sm placeholder-slate-600 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/30 transition-all outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                    >
                                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={confirmResetPassword}
                                disabled={isResettingPassword || !resetPasswordEmail.trim() || !newPasswordInput.trim() || newPasswordInput.length < 6}
                                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black uppercase tracking-widest transition-all text-sm shadow-lg shadow-amber-500/20"
                            >
                                {isResettingPassword ? 'Guardando...' : '🔑 Guardar Nueva Contraseña'}
                            </button>
                            <button
                                onClick={() => { setResetPasswordModal(null); setNewPasswordInput(''); setResetPasswordEmail(''); }}
                                className="w-full py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold uppercase tracking-widest transition-all text-sm"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* HQ Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
                <div className="absolute -top-10 -left-10 w-64 h-64 bg-accent/5 rounded-full blur-3xl -z-10 animate-pulse-soft"></div>

                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-gradient-to-br from-accent/20 to-blue-600/20 border border-white/10 rounded-2xl glass-card text-accent shadow-md shrink-0">
                        <LayoutDashboard size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">CitaLink <span className="text-accent font-light italic">HQ</span></h1>
                            <span className="bg-accent text-slate-900 text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">Central</span>
                        </div>
                        <p className="text-slate-400 text-xs font-medium tracking-wide">Panel de Control Global y Desempeño de Plataforma</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <a
                        href="/Guia_Configuracion_Negocio_CitaLink.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-3.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 text-xs"
                    >
                        <Download size={14} className="text-pink-400" />
                        <span>Guía (PDF)</span>
                    </a>
                    <a
                        href="/Catalogo_CitaLink_Negocios.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold py-2 px-3.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 text-xs"
                    >
                        <Download size={14} className="text-emerald-400" />
                        <span>Catálogo</span>
                    </a>
                    <button
                        type="button"
                        onClick={() => setIsCostModalOpen(true)}
                        className="btn border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold py-2 px-3.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 text-xs"
                        title="Configurar tarifas unitarias de Twilio SMS y WhatsApp"
                    >
                        <Settings size={13} className="text-cyan-400" />
                        <span>Tarifas (${smsTwilioCost}/sms)</span>
                    </button>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="btn btn-primary font-black py-2 px-4 rounded-xl shadow-md shadow-accent/20 flex items-center gap-1.5 hover:scale-[1.02] active:scale-95 transition-all text-xs"
                    >
                        <Plus size={15} />
                        <span>Nuevo Negocio</span>
                    </button>
                </div>
            </header>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
                <StatCard
                    icon={<Building2 size={20} />}
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
                                    className="px-1.5 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 font-black uppercase text-[8px] border border-red-500/30"
                                >
                                    ⚠️ {planCounts.at_risk} RIESGO
                                </button>
                            )}
                        </div>
                    }
                    delay="0"
                />
                <StatCard
                    icon={<DollarSign size={20} />}
                    title="MRR Estimado"
                    value={`$${mrrInfo.totalMrr.toLocaleString()} MXN`}
                    color="text-emerald-400"
                    sub={`${mrrInfo.liteCount} Esen · ${mrrInfo.proCount} Pro · ${mrrInfo.businessCount} Biz`}
                    delay="1"
                />
                <StatCard
                    icon={<Calendar size={20} />}
                    title="Citas (30 días)"
                    value={appointmentsLast30 !== null ? appointmentsLast30 : '...'}
                    color="text-emerald-400"
                    sub={`Est. $${(((appointmentsLast30 || 0) * whatsappCost)).toFixed(2)} USD en msgs`}
                    delay="2"
                />
                <StatCard
                    icon={<Users size={20} />}
                    title="Clientes Únicos"
                    value={uniqueClients !== null ? uniqueClients : '...'}
                    color="text-violet-400"
                    sub="Teléfonos registrados"
                    delay="3"
                />
                <StatCard
                    icon={<Zap size={20} />}
                    title="WhatsApp Totales"
                    value={totalSmsCount !== null ? totalSmsCount : '...'}
                    color="text-emerald-400"
                    sub={
                        <button
                            type="button"
                            onClick={() => setIsCostModalOpen(true)}
                            className="hover:underline text-emerald-400 text-left block truncate"
                            title="Haz clic para ajustar la tarifa de WhatsApp"
                        >
                            Costo: $${(((totalSmsCount || 0) * whatsappCost)).toFixed(2)} USD (${whatsappCost} c/u)
                        </button>
                    }
                    delay="4"
                />
                <StatCard
                    icon={<Phone size={20} />}
                    title="SMS (+1 USA/CA)"
                    value={totalSmsUsCount !== null ? totalSmsUsCount : 0}
                    color="text-cyan-400"
                    sub={
                        <button
                            type="button"
                            onClick={() => setIsCostModalOpen(true)}
                            className="hover:underline text-cyan-400 text-left block truncate font-bold"
                            title="Haz clic para ajustar la tarifa de Twilio SMS"
                        >
                            Solo +1 · $${(((totalSmsUsCount || 0) * smsTwilioCost)).toFixed(2)} USD (${smsTwilioCost} c/u) ⚙️
                        </button>
                    }
                    delay="5"
                />
            </div>

            {/* Distribución por Categoría */}
            <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                    <h3 className="text-white font-black text-xs sm:text-sm flex items-center gap-2 uppercase tracking-tight">
                        <BarChart3 className="text-violet-400" size={15} />
                        Distribución por Categoría
                    </h3>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {allTenants.length} Negocios Totales
                    </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
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
                                <div key={cat.id} className={`p-2 px-3 rounded-xl ${cat.bg} border ${cat.border} flex items-center justify-between gap-2 transition-transform hover:scale-[1.02]`}>
                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider truncate">{cat.label}</span>
                                    <span className={`text-base font-black ${cat.color}`}>{count}</span>
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>

            {/* Historial de Crecimiento Mensual */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {/* Historial de Mensajes de WhatsApp */}
                <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col">
                    <div className="flex items-center justify-between mb-2.5">
                        <h3 className="text-white font-black text-xs sm:text-sm flex items-center gap-2 uppercase tracking-tight">
                            <Zap className="text-emerald-400" size={15} />
                            Historial Mensual WhatsApp
                        </h3>
                        <span className="text-[10px] text-slate-500 font-bold uppercase">{totalSmsCount ?? 0} Totales</span>
                    </div>
                    <div className="flex-1 max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                        {smsByMonth.length === 0 ? (
                            <div className="text-center py-4 text-slate-500 text-xs">Sin registros de WhatsApp aún.</div>
                        ) : (
                            smsByMonth.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white/[0.02] border border-white/[0.04] p-2 px-3 rounded-xl hover:bg-white/[0.04] transition-all text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500/80 animate-pulse-soft"></div>
                                        <span className="font-semibold text-slate-300 uppercase text-[11px]">{item.month_label}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 font-mono">
                                        <span className="font-black text-emerald-400">{item.count.toLocaleString()}</span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">msgs</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Historial de Registro de Negocios */}
                <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col">
                    <div className="flex items-center justify-between mb-2.5">
                        <h3 className="text-white font-black text-xs sm:text-sm flex items-center gap-2 uppercase tracking-tight">
                            <Building2 className="text-blue-400" size={15} />
                            Historial Mensual Negocios
                        </h3>
                        <span className="text-[10px] text-slate-500 font-bold uppercase">+{newThisMonth} Este Mes</span>
                    </div>
                    <div className="flex-1 max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                        {tenantsByMonth.length === 0 ? (
                            <div className="text-center py-4 text-slate-500 text-xs">Sin registros de negocios aún.</div>
                        ) : (
                            tenantsByMonth.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white/[0.02] border border-white/[0.04] p-2 px-3 rounded-xl hover:bg-white/[0.04] transition-all text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500/80"></div>
                                        <span className="font-semibold text-slate-300 uppercase text-[11px]">{item.month_label}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 font-mono">
                                        <span className="font-black text-blue-400">+{item.count}</span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">nuevos</span>
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
                                { key: 'lite', label: 'Esencial' },
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
                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3.5">
                        {filteredTenants.map((tenant, idx) => (
                            <div
                                key={tenant.id}
                                className="glass-card flex flex-col justify-between p-4 sm:p-4.5 rounded-2xl border border-white/10 hover:border-accent/30 hover:bg-white/[0.03] transition-all duration-200 group shadow-lg"
                                style={{ animationDelay: `${idx * 0.03}s` }}
                            >
                                {/* —— Cabecera y Datos Principales —— */}
                                <div className="space-y-2.5">
                                    {/* Fila 1: Logo + Nombre + Badges + Link externo */}
                                    <div className="flex items-start justify-between gap-2.5">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {/* Logo */}
                                            <div className="w-11 h-11 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-md group-hover:scale-105 transition-transform">
                                                {tenant.logoUrl ? (
                                                    <img decoding="async" loading="lazy" src={tenant.logoUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <Sparkles size={18} className="text-accent" />
                                                )}
                                            </div>

                                            {/* Nombre y Badges */}
                                            <div className="min-w-0">
                                                <h4 className="font-black text-white text-sm sm:text-base tracking-tight uppercase truncate">
                                                    {tenant.name}
                                                </h4>
                                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-[8px] font-black tracking-wider uppercase text-blue-400 border border-blue-500/20">
                                                        {getCountryPreset(tenant.countryCode || tenant.country_code).flag} {getCountryPreset(tenant.countryCode || tenant.country_code).currency}
                                                    </span>
                                                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-[8px] font-black tracking-wider uppercase text-slate-300 border border-white/10">
                                                        {(() => {
                                                            const cat = tenant.category?.toLowerCase() || '';
                                                            if (cat === 'barbershop' || cat === 'barber') return 'Barbería';
                                                            if (cat === 'beauty_salon' || cat === 'salon') return 'Salón';
                                                            if (cat === 'nail_bar') return "Nail's";
                                                            if (cat === 'spa') return 'Spa';
                                                            if (cat === 'consulting' || cat === 'clinic') return 'Clínica';
                                                            return 'Servicios';
                                                        })()}
                                                    </span>
                                                    {(() => {
                                                        const p = (tenant.plan || 'free') as PlanType;
                                                        const b = getPlanBadgeStyles(p);
                                                        return <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider uppercase border ${b.bg} ${b.text} ${b.border}`}>{p.toUpperCase()}</span>;
                                                    })()}
                                                    {(() => {
                                                        if (!tenant.trial_ends_at) return null;
                                                        const ends = new Date(tenant.trial_ends_at);
                                                        const now = new Date();
                                                        const diffTime = ends.getTime() - now.getTime();
                                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                        if (diffDays > 0) {
                                                            return (
                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider uppercase border bg-amber-500/10 text-amber-400 border-amber-500/20">
                                                                    Trial · {diffDays}d
                                                                </span>
                                                            );
                                                        } else if (tenant.plan === 'free' || !tenant.plan) {
                                                            return (
                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider uppercase border bg-red-500/10 text-red-400 border-red-500/20">
                                                                    Trial vencido
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Enlace externo */}
                                        <a
                                            href={`https://www.citalink.app/${tenant.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 transition-colors shrink-0"
                                            title="Abrir enlace de reservas"
                                        >
                                            <ExternalLink size={13} />
                                        </a>
                                    </div>

                                    {/* Fila 2: Enlace de reservas + Teléfono (en 2 columnas compactas) */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white/[0.02] border border-white/5 rounded-xl p-2">
                                        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px] truncate">
                                            <span className="text-accent font-bold text-xs">🔗</span>
                                            <span className="truncate">citalink.app/{tenant.slug}</span>
                                        </div>

                                        <div className="flex items-center gap-1.5 text-[11px]">
                                            <Phone size={11} className={tenant.phone ? 'text-emerald-400 shrink-0' : 'text-slate-500 shrink-0'} />
                                            {tenant.phone ? (
                                                <a
                                                    href={`https://wa.me/${tenant.phone.replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-slate-200 hover:text-emerald-400 font-bold transition-colors truncate flex items-center gap-1"
                                                    title="Escribir por WhatsApp"
                                                >
                                                    <span className="truncate">{tenant.phone}</span>
                                                    <MessageCircle size={10} className="text-emerald-400 shrink-0" />
                                                </a>
                                            ) : (
                                                <span className="text-slate-500 italic">Sin teléfono</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Fila 3: Dirección física (si existe) */}
                                    {tenant.address && (
                                        <p className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate px-1">
                                            <MapPin size={10} className="text-rose-400 shrink-0" />
                                            <span className="truncate">{tenant.address}</span>
                                        </p>
                                    )}
                                </div>

                                {/* —— Fila Inferior: Métricas compactas + Acciones directas —— */}
                                <div className="pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
                                    {/* Métricas */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1" title="Citas del mes y costo estimado de notificaciones">
                                            <Calendar size={9} />
                                            <span>{appointmentsByTenant[tenant.id] || 0} citas (${(((appointmentsByTenant[tenant.id] || 0) * whatsappCost)).toFixed(2)} USD)</span>
                                        </span>
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1" title="WhatsApp enviados y costo">
                                            <BarChart3 size={9} />
                                            <span>{(smsCountsByTenant[tenant.id]?.month) || 0} WA (${((((smsCountsByTenant[tenant.id]?.month) || 0) * whatsappCost)).toFixed(2)} USD)</span>
                                        </span>
                                        {(smsUsCountsByTenant[tenant.id] || 0) > 0 && (
                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1" title="SMS enviados a números +1 USA vía Twilio">
                                                <Phone size={9} />
                                                <span>{smsUsCountsByTenant[tenant.id]} SMS +1 (${(((smsUsCountsByTenant[tenant.id] || 0) * smsTwilioCost)).toFixed(2)} USD)</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Acciones */}
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setTenantToEdit(tenant)}
                                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-all group-hover:border-accent/40"
                                            title="Ver Detalle y Gestionar Negocio"
                                        >
                                            <Eye size={12} className="text-accent" />
                                            <span>Ver Detalle</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={async () => {
                                                await switchTenant(tenant.id);
                                                navigate('/admin');
                                            }}
                                            className="p-1.5 px-2 rounded-lg bg-accent hover:brightness-110 text-slate-950 font-black text-[11px] transition-all shadow-sm flex items-center gap-0.5"
                                            title="Entrar al Panel como Administrador"
                                        >
                                            <ChevronRight size={14} />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleDeleteClick(tenant)}
                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 border border-white/5 hover:border-red-500/20 transition-colors"
                                            title="Eliminar Negocio"
                                        >
                                            <Trash2 size={13} />
                                        </button>
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

            <PricingRatesModal
                isOpen={isCostModalOpen}
                onClose={() => setIsCostModalOpen(false)}
                smsTwilioCost={smsTwilioCost}
                setSmsTwilioCost={setSmsTwilioCost}
                whatsappCost={whatsappCost}
                setWhatsappCost={setWhatsappCost}
                showToast={showToast}
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
                    onSwitchTenant={async (id: string) => {
                        await switchTenant(id);
                        navigate('/admin');
                    }}
                    onResetPassword={(t: any) => {
                        handleResetPasswordClick(t);
                    }}
                    onRelinkOwner={(t: any) => {
                        handleRelinkClick(t);
                    }}
                    onDelete={(t: any) => {
                        setTenantToEdit(null);
                        handleDeleteClick(t);
                    }}
                    smsStats={smsCountsByTenant[tenantToEdit.id]}
                    apptCount={appointmentsByTenant[tenantToEdit.id] || 0}
                    smsUsCount={smsUsCountsByTenant[tenantToEdit.id] || 0}
                    smsTwilioCost={smsTwilioCost}
                    whatsappCost={whatsappCost}
                    onOpenPricingModal={() => setIsCostModalOpen(true)}
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

                                {/* País del Negocio */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-400 ml-1">País del Negocio y Divisa</label>
                                    <select
                                        value={newBusiness.countryCode}
                                        onChange={e => {
                                            const code = e.target.value;
                                            const preset = getCountryPreset(code);
                                            setNewBusiness({ ...newBusiness, countryCode: code, timezone: preset.timezone });
                                        }}
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm appearance-none cursor-pointer"
                                    >
                                        {Object.values(COUNTRY_PRESETS).map(country => (
                                            <option key={country.code} value={country.code} className="bg-slate-900 text-white">
                                                {country.flag} {country.name} ({country.currencySymbol} · {country.phonePrefix})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Zona Horaria */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-400 ml-1">Zona Horaria</label>
                                    <select
                                        value={newBusiness.timezone}
                                        onChange={e => setNewBusiness({ ...newBusiness, timezone: e.target.value })}
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/30 transition-all outline-none text-sm appearance-none"
                                    >
                                        <option value="America/Mexico_City" className="bg-slate-900">🇲🇽 México Central (CDMX, Monterrey, Guadalajara)</option>
                                        <option value="America/Tijuana" className="bg-slate-900">🇲🇽 México Pacífico (Tijuana, Mexicali)</option>
                                        <option value="America/Mazatlan" className="bg-slate-900">🇲🇽 México Montaña (Mazatlán, Culiacán)</option>
                                        <option value="America/Cancun" className="bg-slate-900">🇲🇽 México Este (Cancún)</option>
                                        <option value="America/New_York" className="bg-slate-900">🇺🇸/🇨🇦 EE.UU. & Canadá Este (New York, Miami, Toronto)</option>
                                        <option value="America/Chicago" className="bg-slate-900">🇺🇸/🇨🇦 EE.UU. & Canadá Central (Chicago, Houston, Dallas)</option>
                                        <option value="America/Denver" className="bg-slate-900">🇺🇸 EE.UU. Montaña (Denver, Phoenix)</option>
                                        <option value="America/Los_Angeles" className="bg-slate-900">🇺🇸/🇨🇦 EE.UU. & Canadá Pacífico (Los Angeles, Seattle, Vancouver)</option>
                                        <option value="Europe/Madrid" className="bg-slate-900">🇪🇸 España Península (Madrid, Barcelona)</option>
                                        <option value="Europe/Canary" className="bg-slate-900">🇪🇸 España Canarias (Tenerife, Las Palmas)</option>
                                        <option value="America/Caracas" className="bg-slate-900">🇻🇪 Venezuela (Caracas)</option>
                                        <option value="America/Bogota" className="bg-slate-900">🇨🇴/🇪🇨 Colombia / Perú / Ecuador</option>
                                        <option value="America/Santiago" className="bg-slate-900">🇨🇱 Chile</option>
                                        <option value="America/Argentina/Buenos_Aires" className="bg-slate-900">🇦🇷 Argentina</option>
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
                                            { id: 'lashes', label: 'Pestañas / Lashes', icon: <Eye size={16} />, color: 'violet' },
                                            { id: 'spa', label: 'Spa', icon: <Flower2 size={16} />, color: 'emerald' },
                                            { id: 'consulting', label: 'Clínica', icon: <Briefcase size={16} />, color: 'blue' },
                                            { id: 'other', label: 'Otro', icon: <MoreHorizontal size={16} />, color: 'slate' },
                                        ].map(cat => {
                                            const isSelected = newBusiness.category === cat.id;
                                            const colorMap: Record<string, string> = {
                                                amber: isSelected ? 'border-amber-400/50 bg-amber-400/10 text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.1)]' : 'border-white/5 text-slate-500 hover:border-amber-400/30 hover:text-amber-400',
                                                pink: isSelected ? 'border-pink-400/50 bg-pink-400/10 text-pink-400 shadow-[0_0_12px_rgba(244,114,182,0.1)]' : 'border-white/5 text-slate-500 hover:border-pink-400/30 hover:text-pink-400',
                                                rose: isSelected ? 'border-rose-400/50 bg-rose-400/10 text-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.1)]' : 'border-white/5 text-slate-500 hover:border-rose-400/30 hover:text-rose-400',
                                                violet: isSelected ? 'border-violet-400/50 bg-violet-400/10 text-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.1)]' : 'border-white/5 text-slate-500 hover:border-violet-400/30 hover:text-violet-400',
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

                            {/* ── Sección: Acceso del Dueño ── */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Users size={14} className="text-emerald-400" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Modalidad de Registro y Acceso</span>
                                </div>

                                {/* Selector Prominente de Modo: Negocio Nuevo vs Sucursal Existente */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-black/40 border border-white/10 rounded-2xl">
                                    <button
                                        type="button"
                                        onClick={() => { setIsExistingOwner(false); setSelectedOwnerId(''); setOwnerSearchQuery(''); }}
                                        className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-black text-xs transition-all ${
                                            !isExistingOwner
                                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/40 border border-emerald-400/40 scale-[1.01]'
                                                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                                        }`}
                                    >
                                        <UserPlus size={15} className={!isExistingOwner ? 'text-white' : 'text-slate-500'} />
                                        <span>1. Negocio Nuevo (Cuenta Nueva)</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => { setIsExistingOwner(true); }}
                                        className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-black text-xs transition-all ${
                                            isExistingOwner
                                                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-900/40 border border-violet-400/40 scale-[1.01]'
                                                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                                        }`}
                                    >
                                        <Building2 size={15} className={isExistingOwner ? 'text-white' : 'text-slate-500'} />
                                        <span>2. Nueva Sucursal (Dueño Existente)</span>
                                    </button>
                                </div>

                                {isExistingOwner ? (
                                    /* Existing Owner Searchable Combobox */
                                    <div className="space-y-3 p-4 bg-violet-950/20 border border-violet-500/20 rounded-2xl animate-fade-in">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-bold text-violet-300 flex items-center gap-1.5">
                                                <Search size={13} className="text-violet-400" />
                                                <span>Filtrar y Seleccionar Dueño Existente:</span>
                                            </label>
                                            {selectedOwnerId && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setSelectedOwnerId(''); setOwnerSearchQuery(''); }}
                                                    className="text-[10px] font-bold text-violet-400 hover:text-white underline cursor-pointer"
                                                >
                                                    Cambiar selección
                                                </button>
                                            )}
                                        </div>

                                        {/* Input con filtro en vivo */}
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                            <input
                                                type="text"
                                                placeholder="Escribe el nombre del negocio o correo para filtrar rápido..."
                                                value={ownerSearchQuery}
                                                onChange={e => setOwnerSearchQuery(e.target.value)}
                                                className="w-full bg-slate-900/90 border border-violet-500/30 rounded-xl pl-9 pr-8 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 outline-none text-xs font-medium"
                                            />
                                            {ownerSearchQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => setOwnerSearchQuery('')}
                                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
                                                >
                                                    <X size={13} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Lista de resultados filtrables */}
                                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                            {filteredOwners.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-slate-500 bg-white/[0.02] rounded-xl border border-white/5">
                                                    No se encontraron dueños con "{ownerSearchQuery}".
                                                </div>
                                            ) : (
                                                filteredOwners.map(owner => {
                                                    const isSelected = selectedOwnerId === owner.id;
                                                    return (
                                                        <button
                                                            key={owner.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedOwnerId(owner.id);
                                                                if (owner.brandSlug) setNewBusiness({ ...newBusiness, brandSlug: owner.brandSlug });
                                                            }}
                                                            className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-violet-600/30 border-violet-500 text-white shadow-md shadow-violet-900/40'
                                                                    : 'bg-white/[0.03] border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                                                            }`}
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <Building2 size={14} className={isSelected ? 'text-violet-300' : 'text-slate-500'} />
                                                                    <span className="text-xs font-bold truncate text-white">{owner.name}</span>
                                                                    {owner.category && (
                                                                        <span className="text-[9px] px-2 py-0.5 rounded-md bg-white/10 text-slate-300 font-mono">
                                                                            {owner.category}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {owner.email && (
                                                                    <p className="text-[10px] text-slate-400 truncate ml-5 mt-0.5">
                                                                        {owner.email}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {isSelected ? (
                                                                <div className="w-5 h-5 rounded-full bg-violet-500 text-white flex items-center justify-center shrink-0 ml-2">
                                                                    <Check size={12} />
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-violet-400 shrink-0 ml-2">
                                                                    Elegir
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>

                                        {selectedOwnerId && (
                                            <div className="p-3 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center gap-2 text-violet-200 text-xs font-bold">
                                                <Check size={16} className="text-violet-400 shrink-0" />
                                                <span>Sucursal vinculada a: <strong className="text-white">{uniqueOwners.find(o => o.id === selectedOwnerId)?.name}</strong></span>
                                            </div>
                                        )}
                                        <p className="text-[10px] text-violet-400/80 ml-1">📌 La nueva sucursal aparecerá automáticamente en el selector de sucursales del dueño.</p>
                                    </div>
                                ) : (
                                    /* New Owner: Email + Password */
                                    <div className="space-y-3 p-4 bg-emerald-950/15 border border-emerald-500/20 rounded-2xl animate-fade-in">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-300 ml-1">Correo Electrónico del Dueño</label>
                                                <input
                                                    required type="email"
                                                    className="w-full bg-slate-900/90 border border-emerald-500/30 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all outline-none text-sm"
                                                    placeholder="dueno@correo.com"
                                                    value={newBusiness.ownerEmail}
                                                    onChange={e => setNewBusiness({ ...newBusiness, ownerEmail: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-300 ml-1">Contraseña de Acceso</label>
                                                <input
                                                    required type="password" minLength={6}
                                                    className="w-full bg-slate-900/90 border border-emerald-500/30 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all outline-none text-sm"
                                                    placeholder="Mín. 6 caracteres"
                                                    value={newBusiness.ownerPassword}
                                                    onChange={e => setNewBusiness({ ...newBusiness, ownerPassword: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-emerald-400/80 ml-1">El dueño usará estas credenciales para acceder a su panel de administración.</p>
                                    </div>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="border-t border-white/5" />

                            {/* ── Sección: Plan ── */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Zap size={14} className="text-amber-400" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Plan Asignado</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2.5">
                                    {([
                                        { key: 'lite' as PlanType, label: 'Esencial', sub: 'Ilimitado (1 prof.)', price: '$349', color: 'teal' },
                                        { key: 'pro' as PlanType, label: 'Pro', sub: 'Ilimitado (2 prof.)', price: '$649', color: 'amber' },
                                        { key: 'business' as PlanType, label: 'Business', price: '$1,249', sub: 'Multi-sucursal', color: 'violet' },
                                    ]).map(p => {
                                        const isActive = newBusiness.plan === p.key;
                                        return (
                                            <button
                                                key={p.key}
                                                type="button"
                                                onClick={() => setNewBusiness({ ...newBusiness, plan: p.key, monthlyPrice: p.price.replace(/[$,]/g, '') })}
                                                className={`p-2.5 rounded-xl border text-center transition-all ${isActive
                                                    ? p.color === 'teal' ? 'border-teal-500/50 bg-teal-500/10 shadow-[0_0_20px_rgba(20,184,166,0.15)]'
                                                    : p.color === 'amber' ? 'border-amber-500/50 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                                                    : 'border-violet-500/50 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                                                    : 'border-white/5 bg-white/[0.02] hover:bg-white/5'
                                                }`}
                                            >
                                                <div className={`text-xs font-black uppercase tracking-wider ${isActive
                                                    ? p.color === 'teal' ? 'text-teal-400'
                                                    : p.color === 'amber' ? 'text-amber-400'
                                                    : 'text-violet-400'
                                                    : 'text-slate-500'
                                                }`}>{p.label}</div>
                                                <div className={`text-[10px] mt-0.5 font-bold ${isActive ? 'text-slate-200' : 'text-slate-400'}`}>{p.price}/mes</div>
                                                <div className="text-[9px] text-slate-500 mt-1 leading-tight">{p.sub}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-white/5" />

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

function StatCard({ icon, title, value, color, sub, delay }: { icon: any, title: string, value: any, color: string, sub?: React.ReactNode, delay: string }) {
    return (
        <div
            className="animate-scale-in glass-panel p-3.5 sm:p-4 rounded-2xl border border-white/10 flex items-center gap-3.5 hover:border-white/25 hover:bg-white/[0.04] transition-all shadow-md group"
            style={{ animationDelay: `0.${delay}s` }}
        >
            <div className={`w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform ${color}`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 truncate mb-0.5">{title}</p>
                <div className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">{value}</div>
                {sub && <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{sub}</div>}
            </div>
        </div>
    );
}
