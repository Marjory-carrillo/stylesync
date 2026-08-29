import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSuperAdmin } from '../../lib/store/queries/useSuperAdmin';
import { useUIStore } from '../../lib/store/uiStore';
import { format, differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Building2, Users, Search, MessageCircle, ExternalLink,
    Clock, Shield, Copy, Check, Plus,
    RefreshCw, Globe, MapPin, Mail, Phone, Calendar,
    AlertTriangle, ChevronDown,
    Eye, Scissors, Flower2, Dog, Briefcase, Store,
    Sliders, Zap, Loader2, X, MoreHorizontal, CheckCircle2
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import { COUNTRY_PRESETS, getCountryPreset } from '../../lib/pricingConfig';
import type { PlanType } from '../../lib/planLimits';
import { supabase } from '../../lib/supabaseClient';

interface TenantWithUsers {
    id: string;
    name: string;
    slug: string;
    category: string;
    address?: string;
    phone?: string;
    plan?: string;
    trial_ends_at?: string | null;
    created_at?: string;
    registration_source?: 'landing' | 'direct' | 'web' | 'manual' | null;
    primary_color?: string;
    logo_url?: string;
    owner_id?: string;
    tenant_users?: Array<{ email: string; role: string }>;
    contact_name?: string;
}

const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string }> = {
    barbershop: { label: 'Barbería', icon: Scissors, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    nail_bar: { label: "Salón de Uñas", icon: Sparkles, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
    nails: { label: "Salón de Uñas", icon: Sparkles, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
    beauty_salon: { label: 'Salón de Belleza', icon: Sparkles, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
    lashes: { label: 'Pestañas & Cejas', icon: Eye, color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20' },
    spa: { label: 'Spa & Estética', icon: Flower2, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
    pet_grooming: { label: 'Peluquería Canina', icon: Dog, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    consulting: { label: 'Consultorio', icon: Briefcase, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    other: { label: 'Otro Giro', icon: Store, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
};

import { Sparkles } from 'lucide-react';

export default function CitalinkClients() {
    const { allTenants, isLoading, fetchAllTenants, createTenant, setTrialEndDate, updateTenant, deleteTenant, switchTenant } = useSuperAdmin();
    const { showToast } = useUIStore();
    const navigate = useNavigate();

    // ── Create New Business Modal State ──
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newBusiness, setNewBusiness] = useState({
        name: '',
        slug: '',
        category: 'barbershop',
        ownerEmail: '',
        ownerPassword: '',
        monthlyPrice: '349',
        timezone: 'America/Mexico_City',
        countryCode: 'MX',
        brandSlug: '',
        plan: 'lite' as PlanType,
        noTrial: false
    });
    const [isExistingOwner, setIsExistingOwner] = useState(false);
    const [selectedOwnerId, setSelectedOwnerId] = useState('');
    const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
    const [isSlugManual, setIsSlugManual] = useState(false);

    // Lista única de dueños existentes para vincular sucursales
    const uniqueOwners = useMemo(() => {
        const ownerMap = new Map<string, { id: string; name: string; email: string; slug: string; category?: string; brandSlug?: string }>();
        allTenants.forEach((t: any) => {
            const ownerEmail = t.tenant_users?.find((u: any) => u.role === 'owner')?.email || t.owner_email;
            if (t.owner_id && !ownerMap.has(t.owner_id)) {
                ownerMap.set(t.owner_id, {
                    id: t.owner_id,
                    name: t.name,
                    email: ownerEmail || '',
                    slug: t.slug,
                    category: t.category,
                    brandSlug: t.brand_slug
                });
            }
        });
        return Array.from(ownerMap.values());
    }, [allTenants]);

    const filteredOwners = useMemo(() => {
        if (!ownerSearchQuery.trim()) return uniqueOwners;
        const q = ownerSearchQuery.toLowerCase();
        return uniqueOwners.filter(o => o.name.toLowerCase().includes(q) || o.email.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q));
    }, [uniqueOwners, ownerSearchQuery]);

    const updateNewBusinessSlug = (businessName: string, _catId?: string) => {
        if (isSlugManual) return;
        const base = businessName.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
        setNewBusiness(prev => ({ ...prev, slug: base }));
    };

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
            if (res.data?.id && newBusiness.plan !== 'lite') {
                await supabase.from('tenants').update({ plan: newBusiness.plan }).eq('id', res.data.id);
            }
            setIsCreateModalOpen(false);
            setIsSlugManual(false);
            setNewBusiness({ name: '', slug: '', category: 'barbershop', ownerEmail: '', ownerPassword: '', monthlyPrice: '349', timezone: 'America/Mexico_City', countryCode: 'MX', brandSlug: '', plan: 'lite', noTrial: false });
            setIsExistingOwner(false);
            setSelectedOwnerId('');
            if (fetchAllTenants) fetchAllTenants();
            showToast(
                isExistingOwner
                    ? `Sucursal creada y asignada al dueño existente.`
                    : res.accountCreated
                        ? `Negocio creado. Cuenta creada para ${newBusiness.ownerEmail}`
                        : 'Negocio creado con éxito.',
                'success'
            );
        } else {
            showToast(res.error || 'Error al crear el negocio', 'error');
        }
    };

    // Recargar lista al montar
    useEffect(() => {
        if (fetchAllTenants) fetchAllTenants();
    }, [fetchAllTenants]);

    // ── Tabs: 'landing' (Web) | 'direct' (Presencial) | 'all' (Todos) ──
    const [activeTab, setActiveTab] = useState<'all' | 'landing' | 'direct'>('all');

    // ── Search & Filter State ──
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'evaluating' | 'expiring' | 'expired' | 'subscribed'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    // ── WhatsApp Modal State ──
    const [selectedTenantForWa, setSelectedTenantForWa] = useState<TenantWithUsers | null>(null);
    const [customWaMessage, setCustomWaMessage] = useState('');
    const [selectedTemplateIdx, setSelectedTemplateIdx] = useState<number>(0);

    // ── Trial Management / Confirmation Modal State ──
    const [trialModalTenant, setTrialModalTenant] = useState<TenantWithUsers | null>(null);
    const [trialActionType, setTrialActionType] = useState<'add' | 'subtract' | 'reset_standard' | 'expire_now' | 'custom_days'>('add');
    const [daysDelta, setDaysDelta] = useState<number>(7);
    const [customDaysInput, setCustomDaysInput] = useState<number>(30);
    const [isSavingTrial, setIsSavingTrial] = useState(false);

    // ── Change Plan Modal State ──
    const [planModalTenant, setPlanModalTenant] = useState<TenantWithUsers | null>(null);
    const [newPlan, setNewPlan] = useState<string>('pro');
    const [isSavingPlan, setIsSavingPlan] = useState(false);

    // ── Delete Confirm State ──
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; tenant: TenantWithUsers | null }>({
        open: false,
        tenant: null
    });

    const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

    // ── Helper: Días restantes de prueba y estado adaptativo ──
    const getTrialInfo = (tenant: TenantWithUsers) => {
        if (!tenant.trial_ends_at) {
            return {
                status: 'subscribed' as const,
                daysLeft: 0,
                totalDays: 30,
                progressPercent: 100,
                label: 'Plan Activo',
                badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                isExpired: false
            };
        }

        const now = new Date();
        const trialEnd = new Date(tenant.trial_ends_at);
        const createdAt = tenant.created_at ? new Date(tenant.created_at) : new Date(trialEnd.getTime() - 30 * 86400000);
        
        const totalDurationDays = Math.max(1, differenceInDays(trialEnd, createdAt) || 30);
        const daysLeft = differenceInDays(trialEnd, now);
        const daysPassed = Math.max(0, totalDurationDays - daysLeft);
        const progressPercent = Math.min(100, Math.max(0, Math.round((daysPassed / totalDurationDays) * 100)));

        if (daysLeft < 0) {
            return {
                status: 'expired' as const,
                daysLeft: 0,
                totalDays: totalDurationDays,
                progressPercent: 100,
                label: 'Prueba Vencida',
                badgeColor: 'bg-red-500/10 text-red-400 border-red-500/30',
                isExpired: true
            };
        }

        if (daysLeft <= 5) {
            return {
                status: 'expiring' as const,
                daysLeft,
                totalDays: totalDurationDays,
                progressPercent,
                label: `¡Por Vencer! (${daysLeft} ${daysLeft === 1 ? 'día' : 'días'})`,
                badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-500/30 animate-pulse',
                isExpired: false
            };
        }

        if (daysPassed <= 7) {
            return {
                status: 'new' as const,
                daysLeft,
                totalDays: totalDurationDays,
                progressPercent,
                label: `Recién Creado (${daysLeft} días rest.)`,
                badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
                isExpired: false
            };
        }

        return {
            status: 'evaluating' as const,
            daysLeft,
            totalDays: totalDurationDays,
            progressPercent,
            label: `En Prueba (${daysLeft} días rest.)`,
            badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
            isExpired: false
        };
    };

    // ── Origen del negocio ──
    const getRegistrationSource = (tenant: TenantWithUsers): 'landing' | 'direct' => {
        if (tenant.registration_source === 'landing' || tenant.registration_source === 'web') {
            return 'landing';
        }
        if (tenant.registration_source === 'direct' || tenant.registration_source === 'manual') {
            return 'direct';
        }
        return 'direct';
    };

    // ── Lista de Negocios y Métricas ──
    const tenantList = useMemo(() => (allTenants || []) as TenantWithUsers[], [allTenants]);

    const stats = useMemo(() => {
        let total = tenantList.length;
        let landingCount = 0;
        let directCount = 0;
        let activeTrials = 0;
        let expiringTrials = 0;
        let expiredTrials = 0;

        tenantList.forEach(t => {
            const src = getRegistrationSource(t);
            if (src === 'landing') landingCount++;
            else directCount++;

            const trial = getTrialInfo(t);
            if (trial.status === 'expiring') {
                expiringTrials++;
                activeTrials++;
            } else if (trial.status === 'new' || trial.status === 'evaluating') {
                activeTrials++;
            } else if (trial.status === 'expired') {
                expiredTrials++;
            }
        });

        return { total, landingCount, directCount, activeTrials, expiringTrials, expiredTrials };
    }, [tenantList]);

    const filteredTenants = useMemo(() => {
        return tenantList.filter(t => {
            // Tab filter
            const src = getRegistrationSource(t);
            if (activeTab === 'landing' && src !== 'landing') return false;
            if (activeTab === 'direct' && src !== 'direct') return false;

            // Trial status filter
            const trial = getTrialInfo(t);
            if (statusFilter === 'new' && trial.status !== 'new') return false;
            if (statusFilter === 'evaluating' && trial.status !== 'evaluating') return false;
            if (statusFilter === 'expiring' && trial.status !== 'expiring') return false;
            if (statusFilter === 'expired' && trial.status !== 'expired') return false;
            if (statusFilter === 'subscribed' && trial.status !== 'subscribed') return false;

            // Category filter
            if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;

            // Search term
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const nameMatch = t.name?.toLowerCase().includes(term);
                const slugMatch = t.slug?.toLowerCase().includes(term);
                const phoneMatch = t.phone?.toLowerCase().includes(term);
                const emailMatch = t.tenant_users?.some(u => u.email?.toLowerCase().includes(term));
                const addressMatch = t.address?.toLowerCase().includes(term);
                if (!nameMatch && !slugMatch && !phoneMatch && !emailMatch && !addressMatch) return false;
            }

            return true;
        });
    }, [tenantList, activeTab, statusFilter, categoryFilter, searchTerm]);

    // ── Copiar link público ──
    const handleCopySlug = (slug: string) => {
        const url = `https://www.citalink.app/${slug}`;
        navigator.clipboard.writeText(url);
        setCopiedSlug(slug);
        showToast('¡Link copiado al portapapeles!', 'success');
        setTimeout(() => setCopiedSlug(null), 2500);
    };

    // ── Abrir Modal de Prueba con Acción Preseleccionada ──
    const openTrialModal = (tenant: TenantWithUsers, preselectedDays: number = 7) => {
        setTrialModalTenant(tenant);
        setTrialActionType('add');
        setDaysDelta(preselectedDays);
        setCustomDaysInput(preselectedDays);
    };

    // ── Calcular Nueva Fecha para Vista Previa en Modal ──
    const calculateNewTrialEnd = () => {
        if (!trialModalTenant) return null;
        const now = new Date();
        let currentEnd = trialModalTenant.trial_ends_at ? new Date(trialModalTenant.trial_ends_at) : now;
        if (currentEnd < now) currentEnd = now;

        if (trialActionType === 'add') {
            return addDays(currentEnd, daysDelta);
        } else if (trialActionType === 'subtract') {
            const result = addDays(currentEnd, -daysDelta);
            return result < now ? now : result;
        } else if (trialActionType === 'reset_standard') {
            return addDays(now, 30);
        } else if (trialActionType === 'expire_now') {
            return new Date(now.getTime() - 86400000); // Ayer (vencido)
        } else if (trialActionType === 'custom_days') {
            return addDays(now, Math.max(0, customDaysInput));
        }
        return currentEnd;
    };

    // ── Aplicar Ajuste de Prueba en Supabase ──
    const handleConfirmTrialAdjustment = async () => {
        if (!trialModalTenant) return;
        const newEnd = calculateNewTrialEnd();
        if (!newEnd) return;

        setIsSavingTrial(true);
        try {
            const res = await setTrialEndDate(trialModalTenant.id, newEnd.toISOString());
            if (res.success) {
                const daysRemaining = Math.max(0, differenceInDays(newEnd, new Date()));
                showToast(`Período de prueba actualizado para "${trialModalTenant.name}" (${daysRemaining} días restantes)`, 'success');
                setTrialModalTenant(null);
            } else {
                showToast(res.error || 'Error al actualizar período de prueba', 'error');
            }
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setIsSavingTrial(false);
        }
    };

    // ── Iniciar sesión en panel del negocio (Switch Tenant) ──
    const handleImpersonate = (tenant: TenantWithUsers) => {
        switchTenant(tenant.id);
        showToast(`Entrando al panel de "${tenant.name}"...`, 'info');
        navigate('/admin');
    };

    // ── Cambiar Plan ──
    const handleSavePlan = async () => {
        if (!planModalTenant) return;
        setIsSavingPlan(true);
        try {
            const res = await updateTenant(planModalTenant.id, { plan: newPlan });
            if (res.success) {
                showToast(`Plan actualizado a "${newPlan.toUpperCase()}"`, 'success');
                setPlanModalTenant(null);
            } else {
                showToast(res.error || 'Error al actualizar plan', 'error');
            }
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setIsSavingPlan(false);
        }
    };

    // ── WhatsApp Templates Dinámicas ──
    const getWaTemplates = (tenant: TenantWithUsers) => {
        const trial = getTrialInfo(tenant);
        const slugUrl = `citalink.app/${tenant.slug}`;

        return [
            {
                title: '👋 1. Bienvenida & Configuración Rápida',
                desc: 'Ideal para negocios recién creados (primeros 7 días).',
                text: `¡Hola! Te escribe el equipo de soporte de CitaLink respecto a tu nuevo negocio *${tenant.name}*. 🚀\n\nQueremos darte la bienvenida y recordarte que ya tienes tu link de reservas activo en: https://www.${slugUrl}\n\n¿Te gustaría que te apoyemos a cargar tus servicios, colaboradores o personalizar tu marca en unos minutos? Estamos a tu orden.`
            },
            {
                title: '📊 2. Seguimiento de Citas & Recordatorios',
                desc: 'Para negocios a mitad de su período de prueba.',
                text: `¡Hola! ¿Cómo va todo en *${tenant.name}*? 💈✨\n\nTe contacto de CitaLink para ver cómo ha sido tu experiencia con la agenda y los recordatorios por WhatsApp. Te quedan *${trial.daysLeft} días de prueba gratuita*.\n\n¿Tienes alguna duda o te gustaría activar alguna función adicional como anticipos bancarios o colaboradores?`
            },
            {
                title: '⚡ 3. Cierre / Prueba por Vencer',
                desc: 'Para negocios con 5 días o menos de prueba.',
                text: `¡Hola! Tu período de prueba gratuita en CitaLink para *${tenant.name}* está por concluir (quedan *${trial.daysLeft} días*). ⏳\n\nPara que tus clientes sigan agendando sin interrupciones y mantengas tu link activo (https://www.${slugUrl}), ¿te gustaría que te activemos tu suscripción mensual o anual con un descuento especial?`
            },
            {
                title: '🎁 4. Reactivación / Extensión de Prueba',
                desc: 'Para negocios con la prueba vencida que no han suscrito.',
                text: `¡Hola! Notamos que tu prueba gratuita en CitaLink para *${tenant.name}* finalizó. Sabemos que el día a día en el negocio es ocupado.\n\n¿Te gustaría que te regalemos *7 días adicionales de cortesía* para que puedas probarlo con tus clientes con calma? Solo respóndeme este mensaje y te la reactivamos al instante. 🙌`
            }
        ];
    };

    const openWhatsAppModal = (tenant: TenantWithUsers) => {
        setSelectedTenantForWa(tenant);
        const templates = getWaTemplates(tenant);
        const trial = getTrialInfo(tenant);
        
        let defaultIdx = 0;
        if (trial.status === 'new') defaultIdx = 0;
        else if (trial.status === 'evaluating') defaultIdx = 1;
        else if (trial.status === 'expiring') defaultIdx = 2;
        else if (trial.status === 'expired') defaultIdx = 3;

        setSelectedTemplateIdx(defaultIdx);
        setCustomWaMessage(templates[defaultIdx].text);
    };

    const sendWhatsAppMessage = () => {
        if (!selectedTenantForWa?.phone) return;
        let cleanPhone = selectedTenantForWa.phone.replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = `52${cleanPhone}`;
        const encoded = encodeURIComponent(customWaMessage);
        window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
        setSelectedTenantForWa(null);
    };

    return (
        <div className="w-full min-h-screen bg-[#070b14] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
            
            {/* ══ HEADER (FULL WIDTH) ══ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/20 shrink-0">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-2.5">
                            Clientes CitaLink
                            <span className="text-xs bg-cyan-500/20 text-cyan-400 font-bold px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                                {stats.total} Negocios
                            </span>
                        </h1>
                        <p className="text-xs text-slate-400">
                            Centro de control maestro: segmentación por origen, seguimiento adaptativo de pruebas y contacto directo
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchAllTenants && fetchAllTenants()}
                        className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                        title="Refrescar lista"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin text-cyan-400' : ''} />
                    </button>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                    >
                        <Plus size={16} />
                        Alta Presencial / Manual
                    </button>
                </div>
            </div>

            {/* ══ STATS CARDS (FULL WIDTH GRID) ══ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 w-full">
                <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-white/5 bg-[#0d131f] space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Clientes</span>
                    <p className="text-2xl sm:text-3xl font-black text-white">{stats.total}</p>
                    <span className="text-[10px] text-slate-500">Negocios registrados</span>
                </div>
                <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 space-y-1">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest block flex items-center gap-1">
                        <Globe size={11} /> Landing Page
                    </span>
                    <p className="text-2xl sm:text-3xl font-black text-cyan-300">{stats.landingCount}</p>
                    <span className="text-[10px] text-cyan-400/60">Auto-registros web</span>
                </div>
                <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 space-y-1">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block flex items-center gap-1">
                        <Users size={11} /> Presenciales
                    </span>
                    <p className="text-2xl sm:text-3xl font-black text-purple-300">{stats.directCount}</p>
                    <span className="text-[10px] text-purple-400/60">Altas directas SuperAdmin</span>
                </div>
                <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-1">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block flex items-center gap-1">
                        <Clock size={11} /> En Prueba Activa
                    </span>
                    <p className="text-2xl sm:text-3xl font-black text-amber-300">{stats.activeTrials}</p>
                    <span className="text-[10px] text-amber-400/60">Evaluando sistema</span>
                </div>
                <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-orange-500/20 bg-orange-500/5 space-y-1">
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest block flex items-center gap-1">
                        <AlertTriangle size={11} /> Por Vencer
                    </span>
                    <p className="text-2xl sm:text-3xl font-black text-orange-300">{stats.expiringTrials}</p>
                    <span className="text-[10px] text-orange-400/60">Últimos 5 días de trial</span>
                </div>
            </div>

            {/* ══ TABS & FILTERS BAR (FULL WIDTH) ══ */}
            <div className="space-y-4 w-full">
                {/* Segmented Tabs */}
                <div className="flex items-center gap-2 p-1.5 bg-[#0a0e17] border border-white/10 rounded-2xl w-full sm:w-fit overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                            activeTab === 'all'
                                ? 'bg-white/10 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Building2 size={14} />
                        Todos los Negocios ({stats.total})
                    </button>
                    <button
                        onClick={() => setActiveTab('landing')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                            activeTab === 'landing'
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-500/10'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Globe size={14} className="text-cyan-400" />
                        Registro Online / Landing ({stats.landingCount})
                    </button>
                    <button
                        onClick={() => setActiveTab('direct')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                            activeTab === 'direct'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-md shadow-purple-500/10'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Users size={14} className="text-purple-400" />
                        Registro Presencial / Manual ({stats.directCount})
                    </button>
                </div>

                {/* Search & Quick Dropdown Filters (Full Width Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 w-full">
                    <div className="relative md:col-span-6">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar por negocio, slug, teléfono, correo o ciudad..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0d131f] border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-500/40 transition-all placeholder:text-slate-500"
                        />
                    </div>

                    <div className="relative md:col-span-3">
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as any)}
                            className="w-full bg-[#0d131f] border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-500/40 transition-all appearance-none cursor-pointer"
                        >
                            <option value="all">⚡ Todos los Estados de Prueba</option>
                            <option value="new">🟢 Recién Registrados (Días 1-7)</option>
                            <option value="evaluating">🟡 En Evaluación (Mitad de Prueba)</option>
                            <option value="expiring">🔴 Por Vencer (Últimos 5 días)</option>
                            <option value="expired">⏰ Prueba Vencida</option>
                            <option value="subscribed">⭐ Plan Activo / Suscrito</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>

                    <div className="relative md:col-span-3">
                        <select
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value)}
                            className="w-full bg-[#0d131f] border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-500/40 transition-all appearance-none cursor-pointer"
                        >
                            <option value="all">🏷️ Todos los Giros / Rubros</option>
                            <option value="barbershop">Barbería</option>
                            <option value="nail_bar">Salón de Uñas</option>
                            <option value="beauty_salon">Salón de Belleza</option>
                            <option value="lashes">Pestañas & Cejas</option>
                            <option value="spa">Spa & Estética</option>
                            <option value="pet_grooming">Peluquería Canina</option>
                            <option value="consulting">Consultorio</option>
                            <option value="other">Otro Giro</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* ══ CLIENTS LIST / FULL WIDTH RESPONSIVE GRID ══ */}
            {isLoading ? (
                <div className="w-full p-16 text-center text-slate-400 space-y-3 glass-panel rounded-3xl border border-white/5">
                    <RefreshCw size={32} className="animate-spin mx-auto text-cyan-400" />
                    <p className="text-xs uppercase font-bold tracking-widest">Cargando negocios registrados...</p>
                </div>
            ) : filteredTenants.length === 0 ? (
                <div className="w-full glass-panel p-16 text-center rounded-3xl border border-white/5 space-y-4">
                    <Building2 size={48} className="mx-auto text-slate-600" />
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold text-white">No se encontraron negocios</h3>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                            {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                                ? 'Prueba ajustando los filtros de búsqueda o el estado de prueba seleccionado.'
                                : activeTab === 'landing'
                                ? 'Aún no hay negocios auto-registrados desde la landing page. Comparte el enlace https://www.citalink.app/register para recibir nuevos registros.'
                                : 'Aún no hay negocios registrados en esta sección.'}
                        </p>
                    </div>
                    {activeTab === 'landing' && (
                        <button
                            onClick={() => window.open('https://www.citalink.app/register', '_blank')}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-xs border border-cyan-500/30 transition-colors"
                        >
                            <ExternalLink size={13} />
                            Ver Formulario de Registro Online
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 w-full">
                    {filteredTenants.map(tenant => {
                        const trial = getTrialInfo(tenant);
                        const source = getRegistrationSource(tenant);
                        const cat = CATEGORY_MAP[tenant.category] || CATEGORY_MAP['other'];
                        const CatIcon = cat.icon;
                        const ownerEmail = tenant.tenant_users?.[0]?.email || 'No registrado';
                        const createdDateFormatted = tenant.created_at
                            ? format(new Date(tenant.created_at), "d 'de' MMMM, yyyy", { locale: es })
                            : 'Fecha no registrada';

                        return (
                            <div
                                key={tenant.id}
                                className="glass-panel p-5 rounded-3xl border border-white/10 hover:border-white/20 bg-[#0d131f] flex flex-col justify-between space-y-4 transition-all duration-300 group hover:shadow-xl hover:shadow-cyan-500/5 relative overflow-hidden"
                            >
                                {/* Top Banner Glow */}
                                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
                                    source === 'landing'
                                        ? 'from-cyan-500 to-blue-500'
                                        : 'from-purple-500 to-indigo-500'
                                }`} />

                                <div className="space-y-3.5">
                                    {/* Badges Bar: Origen + Categoría + Estado de Prueba */}
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                            {source === 'landing' ? (
                                                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                                                    <Globe size={10} /> Landing Web
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30">
                                                    <Users size={10} /> Presencial
                                                </span>
                                            )}
                                            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border ${cat.color}`}>
                                                <CatIcon size={10} /> {cat.label}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => openTrialModal(tenant, 7)}
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${trial.badgeColor}`}
                                            title="Clic para ajustar días de prueba"
                                        >
                                            {trial.label}
                                        </button>
                                    </div>

                                    {/* Business Name & Slug */}
                                    <div>
                                        <h3 className="text-lg font-black text-white capitalize tracking-tight group-hover:text-cyan-300 transition-colors">
                                            {tenant.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <a
                                                href={`https://www.citalink.app/${tenant.slug}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-mono"
                                            >
                                                citalink.app/{tenant.slug}
                                                <ExternalLink size={11} />
                                            </a>
                                            <button
                                                onClick={() => handleCopySlug(tenant.slug)}
                                                className="text-slate-500 hover:text-white transition-colors"
                                                title="Copiar link de reservas"
                                            >
                                                {copiedSlug === tenant.slug ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Owner & Contact Details */}
                                    <div className="p-3 bg-white/5 rounded-2xl border border-white/5 space-y-2 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                                                <Phone size={12} className="text-slate-500" />
                                                {tenant.phone ? tenant.phone : 'Sin teléfono'}
                                            </span>
                                            {tenant.phone && (
                                                <button
                                                    onClick={() => openWhatsAppModal(tenant)}
                                                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-lg transition-colors border border-emerald-500/20"
                                                >
                                                    <MessageCircle size={12} />
                                                    WhatsApp
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5 text-slate-400 truncate">
                                            <Mail size={12} className="text-slate-500 shrink-0" />
                                            <span className="truncate">{ownerEmail}</span>
                                        </div>

                                        {tenant.address && (
                                            <div className="flex items-start gap-1.5 text-slate-400 text-[11px] leading-tight">
                                                <MapPin size={12} className="text-slate-500 shrink-0 mt-0.5" />
                                                <span className="truncate">{tenant.address}</span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-1 border-t border-white/5">
                                            <Calendar size={11} />
                                            <span>Registrado el {createdDateFormatted}</span>
                                        </div>
                                    </div>

                                    {/* ══ TRIAL PROGRESS & ADAPTIVE TRACKER ══ */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-[10px] font-bold">
                                            <button
                                                onClick={() => openTrialModal(tenant, 7)}
                                                className="text-slate-400 hover:text-cyan-300 uppercase tracking-wider flex items-center gap-1 transition-colors"
                                            >
                                                <Sliders size={11} /> Período de Prueba
                                            </button>
                                            <span className={trial.isExpired ? 'text-red-400' : 'text-slate-300'}>
                                                {trial.isExpired ? 'Vencida' : `${trial.daysLeft} de ${trial.totalDays} días restantes`}
                                            </span>
                                        </div>
                                        <div 
                                            onClick={() => openTrialModal(tenant, 7)}
                                            className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden cursor-pointer hover:h-2 transition-all"
                                            title="Clic para ajustar o corregir período de prueba"
                                        >
                                            <div
                                                className={`h-full transition-all duration-500 ${
                                                    trial.isExpired
                                                        ? 'bg-red-500'
                                                        : trial.status === 'expiring'
                                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                                                        : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                                                }`}
                                                style={{ width: `${trial.progressPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ══ QUICK ACTIONS BAR ══ */}
                                <div className="space-y-2 pt-2 border-t border-white/5">
                                    {/* Action Buttons: Entrar al panel + Botones con Confirmación */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleImpersonate(tenant)}
                                            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold text-xs border border-cyan-500/30 transition-all hover:scale-[1.02]"
                                        >
                                            <Eye size={13} />
                                            Entrar al Panel
                                        </button>

                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => openTrialModal(tenant, 7)}
                                                className="flex-1 flex items-center justify-center py-2 px-1.5 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 font-bold text-[11px] border border-white/5 transition-colors"
                                                title="Extender o ajustar días de prueba (con confirmación)"
                                            >
                                                +7d
                                            </button>
                                            <button
                                                onClick={() => openTrialModal(tenant, 15)}
                                                className="flex-1 flex items-center justify-center py-2 px-1.5 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 font-bold text-[11px] border border-white/5 transition-colors"
                                                title="Extender o ajustar días de prueba (con confirmación)"
                                            >
                                                +15d
                                            </button>
                                            <button
                                                onClick={() => openTrialModal(tenant, 30)}
                                                className="flex-1 flex items-center justify-center py-2 px-1.5 rounded-xl bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 font-bold text-[11px] border border-white/5 transition-colors"
                                                title="Extender o ajustar días de prueba (con confirmación)"
                                            >
                                                +30d
                                            </button>
                                        </div>
                                    </div>

                                    {/* Secondary Actions: Cambiar Plan / Ajustar Días / Eliminar */}
                                    <div className="flex items-center justify-between text-[11px] pt-1">
                                        <button
                                            onClick={() => {
                                                setPlanModalTenant(tenant);
                                                setNewPlan(tenant.plan || 'pro');
                                            }}
                                            className="text-slate-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition-colors"
                                        >
                                            <Shield size={12} /> Plan: <span className="text-white uppercase">{tenant.plan || 'Free'}</span>
                                        </button>

                                        <button
                                            onClick={() => openTrialModal(tenant, 7)}
                                            className="text-slate-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors"
                                        >
                                            <Clock size={11} /> Ajustar Días
                                        </button>

                                        <button
                                            onClick={() => setDeleteConfirm({ open: true, tenant })}
                                            className="text-red-400/60 hover:text-red-400 transition-colors"
                                            title="Eliminar Negocio"
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ══ MODAL DE GESTIÓN & CONFIRMACIÓN DE PERÍODO DE PRUEBA ══ */}
            {trialModalTenant && (() => {
                const currentTrial = getTrialInfo(trialModalTenant);
                const newEndDate = calculateNewTrialEnd();
                const newDaysRemaining = newEndDate ? Math.max(0, differenceInDays(newEndDate, new Date())) : 0;
                const currentEndDateStr = trialModalTenant.trial_ends_at
                    ? format(new Date(trialModalTenant.trial_ends_at), "d 'de' MMMM, yyyy", { locale: es })
                    : 'Sin fecha establecida';
                const newEndDateStr = newEndDate
                    ? format(newEndDate, "d 'de' MMMM, yyyy", { locale: es })
                    : 'Sin fecha';

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                        <div className="bg-[#0d131f] border border-white/10 rounded-[2.2rem] w-full max-w-lg p-6 sm:p-7 space-y-6 shadow-2xl relative overflow-hidden">
                            {/* Top Accent Line */}
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />

                            <div className="flex items-center justify-between pb-3 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-white">Ajustar Período de Prueba</h3>
                                        <p className="text-xs text-slate-400">{trialModalTenant.name}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setTrialModalTenant(null)}
                                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Current Status Box */}
                            <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between text-xs">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Estado Actual</span>
                                    <p className="font-bold text-white mt-0.5">
                                        {currentTrial.isExpired ? 'Prueba Vencida' : `${currentTrial.daysLeft} días restantes`}
                                    </p>
                                    <span className="text-[10px] text-slate-400">Vence: {currentEndDateStr}</span>
                                </div>
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border ${currentTrial.badgeColor}`}>
                                    {currentTrial.label}
                                </span>
                            </div>

                            {/* Action Options */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    ¿Qué deseas hacer?
                                </label>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <button
                                        onClick={() => setTrialActionType('add')}
                                        className={`p-3 rounded-xl border text-left font-bold transition-all ${
                                            trialActionType === 'add'
                                                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 ring-1 ring-cyan-500/40'
                                                : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                                        }`}
                                    >
                                        ➕ Sumar Días
                                    </button>

                                    <button
                                        onClick={() => setTrialActionType('subtract')}
                                        className={`p-3 rounded-xl border text-left font-bold transition-all ${
                                            trialActionType === 'subtract'
                                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/40'
                                                : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                                        }`}
                                    >
                                        ➖ Restar / Quitar Días
                                    </button>

                                    <button
                                        onClick={() => setTrialActionType('reset_standard')}
                                        className={`p-3 rounded-xl border text-left font-bold transition-all ${
                                            trialActionType === 'reset_standard'
                                                ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 ring-1 ring-purple-500/40'
                                                : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                                        }`}
                                    >
                                        🔄 Reiniciar a 30 Días
                                    </button>

                                    <button
                                        onClick={() => setTrialActionType('expire_now')}
                                        className={`p-3 rounded-xl border text-left font-bold transition-all ${
                                            trialActionType === 'expire_now'
                                                ? 'bg-red-500/20 border-red-500/50 text-red-300 ring-1 ring-red-500/40'
                                                : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                                        }`}
                                    >
                                        ⏰ Vencer Prueba Ahora
                                    </button>
                                </div>

                                {/* Quantity selector if Add or Subtract */}
                                {(trialActionType === 'add' || trialActionType === 'subtract') && (
                                    <div className="space-y-2 pt-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                            Cantidad de Días a {trialActionType === 'add' ? 'Sumar' : 'Restar'}:
                                        </span>
                                        <div className="flex gap-2">
                                            {[7, 15, 30, 60].map(d => (
                                                <button
                                                    key={d}
                                                    onClick={() => setDaysDelta(d)}
                                                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                                                        daysDelta === d
                                                            ? 'bg-white/20 text-white border-white/40'
                                                            : 'bg-white/5 text-slate-400 border-white/5 hover:border-white/20'
                                                    }`}
                                                >
                                                    {trialActionType === 'add' ? `+${d}d` : `-${d}d`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Result Preview Box */}
                            <div className="p-4 bg-black/40 rounded-2xl border border-white/10 space-y-1 text-xs">
                                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider block">
                                    Resultado tras Confirmar:
                                </span>
                                <p className="text-white font-bold text-sm">
                                    {trialActionType === 'expire_now'
                                        ? '🔴 La prueba quedará marcada como Vencida inmediatamente.'
                                        : `🟢 Quedarán ${newDaysRemaining} días de prueba (Vence el ${newEndDateStr})`}
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-1">
                                <button
                                    onClick={() => setTrialModalTenant(null)}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmTrialAdjustment}
                                    disabled={isSavingTrial}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                >
                                    {isSavingTrial ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                                    Confirmar y Aplicar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ══ MODAL: WHATSAPP CON PLANTILLAS INTELIGENTES ══ */}
            {selectedTenantForWa && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0d131f] border border-white/10 rounded-[2rem] w-full max-w-xl p-6 space-y-5 shadow-2xl">
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                                    <MessageCircle size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-white">Contactar por WhatsApp</h3>
                                    <p className="text-xs text-slate-400">{selectedTenantForWa.name} ({selectedTenantForWa.phone})</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedTenantForWa(null)}
                                className="text-slate-500 hover:text-white text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Plantillas Seleccionables */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Elige una Plantilla de Seguimiento:
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {getWaTemplates(selectedTenantForWa).map((tmpl, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setSelectedTemplateIdx(idx);
                                            setCustomWaMessage(tmpl.text);
                                        }}
                                        className={`p-2.5 rounded-xl text-left border transition-all text-xs ${
                                            selectedTemplateIdx === idx
                                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/40'
                                                : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                                        }`}
                                    >
                                        <p className="font-bold truncate">{tmpl.title}</p>
                                        <p className="text-[10px] text-slate-500 line-clamp-1">{tmpl.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Mensaje Editable */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Mensaje a Enviar:
                            </label>
                            <textarea
                                rows={6}
                                value={customWaMessage}
                                onChange={e => setCustomWaMessage(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-emerald-500/40 transition-all resize-none custom-scrollbar font-mono leading-relaxed"
                            />
                        </div>

                        {/* Botones de Acción */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setSelectedTenantForWa(null)}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={sendWhatsAppMessage}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
                            >
                                <MessageCircle size={15} />
                                Abrir WhatsApp Web / App
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ MODAL: CAMBIAR PLAN ══ */}
            {planModalTenant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0d131f] border border-white/10 rounded-[2rem] w-full max-w-md p-6 space-y-5 shadow-2xl">
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-white">Asignar Plan</h3>
                                    <p className="text-xs text-slate-400">{planModalTenant.name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setPlanModalTenant(null)}
                                className="text-slate-500 hover:text-white text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                Selecciona el Plan:
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'lite', name: 'Esencial ($349/m)' },
                                    { id: 'pro', name: 'Pro ($649/m)' },
                                    { id: 'business', name: 'Business ($1,249/m)' },
                                ].map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setNewPlan(p.id)}
                                        className={`p-3 rounded-xl text-center border transition-all text-xs font-bold ${
                                            newPlan === p.id
                                                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 ring-1 ring-cyan-500/40'
                                                : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                                        }`}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setPlanModalTenant(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSavePlan}
                                disabled={isSavingPlan}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black text-xs uppercase tracking-wider transition-all hover:scale-105"
                            >
                                {isSavingPlan ? 'Guardando...' : 'Guardar Plan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ MODAL: ALTA PRESENCIAL / MANUAL DE NUEVO NEGOCIO ══ */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#0b101b] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl relative custom-scrollbar">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl text-slate-950 shadow-lg shadow-cyan-500/20">
                                    <Plus size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white tracking-tight uppercase">Alta Presencial / Nuevo Negocio</h3>
                                    <p className="text-slate-500 text-xs">Configuración instantánea de instancia SaaS para el cliente</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-slate-500 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateBusiness} className="space-y-5">
                            {/* Datos Básicos */}
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-400 ml-1">Nombre Comercial del Negocio *</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-all outline-none text-sm"
                                        placeholder="Ej. Barbería El Corte / Studio Glamour"
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
                                    <label className="text-[11px] font-bold text-slate-400 ml-1">URL Personalizada de Reservas</label>
                                    <div className="flex">
                                        <div className="bg-white/[0.03] border border-white/[0.08] border-r-0 rounded-l-xl px-3.5 py-3 text-slate-500 text-xs font-medium shrink-0 flex items-center">citalink.app/</div>
                                        <input
                                            required
                                            type="text"
                                            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-r-xl px-3 py-3 text-cyan-300 font-mono text-sm focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-all outline-none"
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

                                {/* País y Divisa */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-400 ml-1">País del Negocio y Divisa</label>
                                        <select
                                            value={newBusiness.countryCode}
                                            onChange={e => {
                                                const code = e.target.value;
                                                const preset = getCountryPreset(code);
                                                setNewBusiness({ ...newBusiness, countryCode: code, timezone: preset.timezone });
                                            }}
                                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-all outline-none text-sm appearance-none cursor-pointer"
                                        >
                                            {Object.values(COUNTRY_PRESETS).map(country => (
                                                <option key={country.code} value={country.code} className="bg-slate-900 text-white">
                                                    {country.flag} {country.name} ({country.currencySymbol} · {country.phonePrefix})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-400 ml-1">Zona Horaria</label>
                                        <select
                                            value={newBusiness.timezone}
                                            onChange={e => setNewBusiness({ ...newBusiness, timezone: e.target.value })}
                                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/30 transition-all outline-none text-sm appearance-none cursor-pointer"
                                        >
                                            <option value="America/Mexico_City" className="bg-slate-900">🇲🇽 México Central (CDMX, GDL, MTY)</option>
                                            <option value="America/Tijuana" className="bg-slate-900">🇲🇽 México Pacífico (Tijuana, Mexicali)</option>
                                            <option value="America/Cancun" className="bg-slate-900">🇲🇽 México Este (Cancún)</option>
                                            <option value="America/New_York" className="bg-slate-900">🇺🇸 EE.UU. Este (New York, Miami)</option>
                                            <option value="America/Chicago" className="bg-slate-900">🇺🇸 EE.UU. Central (Chicago, Houston)</option>
                                            <option value="America/Los_Angeles" className="bg-slate-900">🇺🇸 EE.UU. Pacífico (Los Angeles)</option>
                                            <option value="Europe/Madrid" className="bg-slate-900">🇪🇸 España (Madrid, Barcelona)</option>
                                            <option value="America/Bogota" className="bg-slate-900">🇨🇴/🇪🇨 Colombia / Perú / Ecuador</option>
                                            <option value="America/Santiago" className="bg-slate-900">🇨🇱 Chile</option>
                                            <option value="America/Argentina/Buenos_Aires" className="bg-slate-900">🇦🇷 Argentina</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Categoría */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-400 ml-1">Categoría / Rubro</label>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                        {[
                                            { id: 'barbershop', label: 'Barbería', icon: <Scissors size={15} /> },
                                            { id: 'beauty_salon', label: 'Salón', icon: <Sparkles size={15} /> },
                                            { id: 'nail_bar', label: "Nails", icon: <Sparkles size={15} /> },
                                            { id: 'lashes', label: 'Lashes', icon: <Eye size={15} /> },
                                            { id: 'spa', label: 'Spa', icon: <Flower2 size={15} /> },
                                            { id: 'pet_grooming', label: 'Mascotas', icon: <Dog size={15} /> },
                                            { id: 'consulting', label: 'Clínica', icon: <Briefcase size={15} /> },
                                            { id: 'other', label: 'Otro', icon: <MoreHorizontal size={15} /> },
                                        ].map(cat => {
                                            const isSelected = newBusiness.category === cat.id;
                                            return (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setNewBusiness({ ...newBusiness, category: cat.id });
                                                        updateNewBusinessSlug(newBusiness.name, cat.id);
                                                    }}
                                                    className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border transition-all cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                                                            : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/20 hover:text-white'
                                                    }`}
                                                >
                                                    {cat.icon}
                                                    <span className="text-[9px] font-bold uppercase tracking-wider leading-none">{cat.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Acceso del Dueño */}
                            <div className="space-y-3 pt-3 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                    <Users size={14} className="text-emerald-400" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Modalidad de Registro y Acceso</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 border border-white/10 rounded-2xl">
                                    <button
                                        type="button"
                                        onClick={() => { setIsExistingOwner(false); setSelectedOwnerId(''); setOwnerSearchQuery(''); }}
                                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
                                            !isExistingOwner ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <Plus size={14} /> Dueño Nuevo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsExistingOwner(true)}
                                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${
                                            isExistingOwner ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <Building2 size={14} /> Sucursal de Dueño Existente
                                    </button>
                                </div>

                                {!isExistingOwner ? (
                                    <div className="space-y-3 p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl animate-fade-in">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-300 ml-1">Correo Electrónico del Dueño *</label>
                                                <input
                                                    required
                                                    type="email"
                                                    className="w-full bg-slate-900/90 border border-emerald-500/30 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500/40 outline-none text-sm"
                                                    placeholder="dueno@correo.com"
                                                    value={newBusiness.ownerEmail}
                                                    onChange={e => setNewBusiness({ ...newBusiness, ownerEmail: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-300 ml-1">Contraseña de Acceso *</label>
                                                <input
                                                    required
                                                    type="password"
                                                    minLength={6}
                                                    className="w-full bg-slate-900/90 border border-emerald-500/30 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500/40 outline-none text-sm"
                                                    placeholder="Mín. 6 caracteres"
                                                    value={newBusiness.ownerPassword}
                                                    onChange={e => setNewBusiness({ ...newBusiness, ownerPassword: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-emerald-400/80 ml-1">El cliente utilizará estas credenciales para acceder inmediatamente a su panel.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 p-4 bg-violet-950/20 border border-violet-500/20 rounded-2xl animate-fade-in">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                                            <input
                                                type="text"
                                                placeholder="Buscar dueño por nombre o email..."
                                                value={ownerSearchQuery}
                                                onChange={e => setOwnerSearchQuery(e.target.value)}
                                                className="w-full bg-slate-900/90 border border-violet-500/30 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-violet-500/40 outline-none"
                                            />
                                        </div>
                                        <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar">
                                            {filteredOwners.map(owner => (
                                                <button
                                                    key={owner.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedOwnerId(owner.id);
                                                        if (owner.brandSlug) setNewBusiness({ ...newBusiness, brandSlug: owner.brandSlug });
                                                    }}
                                                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between text-xs ${
                                                        selectedOwnerId === owner.id
                                                            ? 'bg-violet-600/30 border-violet-500 text-white'
                                                            : 'bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/10'
                                                    }`}
                                                >
                                                    <span className="font-bold truncate">{owner.name} ({owner.email})</span>
                                                    {selectedOwnerId === owner.id && <Check size={14} className="text-violet-400" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Plan Asignado */}
                            <div className="space-y-3 pt-3 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                    <Zap size={14} className="text-amber-400" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Plan Asignado (30 Días de Prueba Incluidos)</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2.5">
                                    {[
                                        { key: 'lite' as PlanType, label: 'Esencial', sub: '1 Profesional', price: '$349' },
                                        { key: 'pro' as PlanType, label: 'Pro', sub: 'Multi-Staff', price: '$649' },
                                        { key: 'business' as PlanType, label: 'Business', sub: 'Sucursales', price: '$1,249' },
                                    ].map(p => {
                                        const isActive = newBusiness.plan === p.key;
                                        return (
                                            <button
                                                key={p.key}
                                                type="button"
                                                onClick={() => setNewBusiness({ ...newBusiness, plan: p.key, monthlyPrice: p.price.replace(/[$,]/g, '') })}
                                                className={`p-3 rounded-xl border text-center transition-all ${
                                                    isActive
                                                        ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)] text-white'
                                                        : 'border-white/5 bg-white/[0.02] text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                <div className={`text-xs font-black uppercase tracking-wider ${isActive ? 'text-cyan-300' : 'text-slate-300'}`}>{p.label}</div>
                                                <div className="text-[10px] mt-0.5 font-bold text-cyan-400">{p.price}/mes</div>
                                                <div className="text-[9px] text-slate-500 mt-0.5">{p.sub}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Botones de Acción */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-5 py-3 rounded-2xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                >
                                    {isCreating ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Creando Instancia...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={16} />
                                            Crear Instancia SaaS
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══ MODAL DE CONFIRMACIÓN PARA ELIMINAR ══ */}
            <ConfirmModal
                isOpen={deleteConfirm.open}
                title="¿Eliminar Negocio Permanentemente?"
                message={`Esta acción eliminará "${deleteConfirm.tenant?.name}" y todos sus servicios, colaboradores y citas asociadas. No se puede deshacer.`}
                confirmLabel="Sí, Eliminar Negocio"
                cancelLabel="Cancelar"
                danger={true}
                onConfirm={async () => {
                    if (deleteConfirm.tenant) {
                        await deleteTenant(deleteConfirm.tenant.id);
                        showToast('Negocio eliminado', 'info');
                    }
                    setDeleteConfirm({ open: false, tenant: null });
                }}
                onCancel={() => setDeleteConfirm({ open: false, tenant: null })}
            />
        </div>
    );
}
