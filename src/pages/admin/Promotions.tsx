import { useState, useMemo } from 'react';
import { usePromotions } from '../../lib/store/queries/usePromotions';
import { useServices } from '../../lib/store/queries/useServices';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useUIStore } from '../../lib/store/uiStore';
import type { Promotion } from '../../lib/types/store.types';
import {
    Tag,
    Plus,
    Flame,
    Calendar,
    Percent,
    DollarSign,
    Check,
    X,
    Trash2,
    Edit3,
    CheckCircle2,
    Shield,
    Search
} from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';

const DAY_OPTIONS = [
    { key: 'monday', label: 'Lunes', short: 'LUN' },
    { key: 'tuesday', label: 'Martes', short: 'MAR' },
    { key: 'wednesday', label: 'Miércoles', short: 'MIÉ' },
    { key: 'thursday', label: 'Jueves', short: 'JUE' },
    { key: 'friday', label: 'Viernes', short: 'VIE' },
    { key: 'saturday', label: 'Sábado', short: 'SÁB' },
    { key: 'sunday', label: 'Domingo', short: 'DOM' },
];

export default function Promotions() {
    const { promotions, addPromotion, updatePromotion, togglePromotionActive, deletePromotion, isAdding, isUpdating } = usePromotions();
    const { services = [] } = useServices();
    const { data: tenantConfig } = useTenantData();
    const { showToast } = useUIStore();

    const currencySymbol = tenantConfig?.currencySymbol || '$';

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
    const [promoToDelete, setPromoToDelete] = useState<Promotion | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [discountType, setDiscountType] = useState<'fixed_price' | 'fixed_discount' | 'percentage'>('fixed_price');
    const [discountValue, setDiscountValue] = useState<string>('140');
    const [selectedDays, setSelectedDays] = useState<string[]>(['tuesday', 'thursday']);
    const [applyToAllServices, setApplyToAllServices] = useState<boolean>(false);
    const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
    const [commissionPolicy, setCommissionPolicy] = useState<'charged_price' | 'regular_price'>('charged_price');
    const [serviceSearch, setServiceSearch] = useState('');

    // Helpers de días rápidos y cálculo simulado
    const setWeekdays = () => setSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
    const setWeekend = () => setSelectedDays(['saturday', 'sunday']);
    const setAllDays = () => setSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

    const getSimulatedPrice = (originalPrice: number) => {
        const val = parseFloat(discountValue) || 0;
        if (discountType === 'fixed_price') return Math.min(originalPrice, val > 0 ? val : originalPrice);
        if (discountType === 'fixed_discount') return Math.max(0, originalPrice - val);
        if (discountType === 'percentage') return Math.max(0, Math.round(originalPrice * (1 - val / 100)));
        return originalPrice;
    };

    const filteredServices = useMemo(() => {
        const list = services || [];
        if (!serviceSearch.trim()) return list;
        return list.filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase()));
    }, [services, serviceSearch]);

    // Stats
    const activePromosCount = useMemo(() => promotions.filter(p => p.isActive).length, [promotions]);
    const promoDaysCount = useMemo(() => {
        const uniqueDays = new Set<string>();
        promotions.filter(p => p.isActive).forEach(p => p.daysOfWeek.forEach(d => uniqueDays.add(d)));
        return uniqueDays.size;
    }, [promotions]);

    const openCreateModal = () => {
        setEditingPromotion(null);
        setName('');
        setDescription('');
        setDiscountType('fixed_price');
        setDiscountValue('140');
        setSelectedDays(['tuesday', 'thursday']);
        setApplyToAllServices(false);
        // Preseleccionar el primer servicio disponible
        setSelectedServiceIds(services.length > 0 ? [services[0].id] : []);
        setCommissionPolicy('charged_price');
        setServiceSearch('');
        setIsModalOpen(true);
    };

    const openEditModal = (promo: Promotion) => {
        setEditingPromotion(promo);
        setName(promo.name);
        setDescription(promo.description || '');
        setDiscountType(promo.discountType);
        setDiscountValue(String(promo.discountValue));
        setSelectedDays(promo.daysOfWeek || []);
        const toAll = !promo.serviceIds || promo.serviceIds.length === 0;
        setApplyToAllServices(toAll);
        setSelectedServiceIds(promo.serviceIds || []);
        setCommissionPolicy(promo.commissionPolicy || 'charged_price');
        setServiceSearch('');
        setIsModalOpen(true);
    };

    const toggleDay = (dayKey: string) => {
        setSelectedDays(prev => 
            prev.includes(dayKey) ? prev.filter(d => d !== dayKey) : [...prev, dayKey]
        );
    };

    const toggleService = (serviceId: number) => {
        setSelectedServiceIds(prev => 
            prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
        );
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        const numVal = parseFloat(discountValue);
        if (isNaN(numVal) || numVal <= 0) {
            showToast('Ingresa un valor de descuento válido mayor a cero', 'error');
            return;
        }

        if (selectedDays.length === 0) {
            showToast('Selecciona al menos un día de la semana', 'error');
            return;
        }

        if (!applyToAllServices && selectedServiceIds.length === 0) {
            showToast('Selecciona al menos un servicio o marca "Aplica a todos los servicios"', 'error');
            return;
        }

        try {
            const payload = {
                name: name.trim() || 'Promoción especial',
                description: description.trim(),
                discountType,
                discountValue: numVal,
                daysOfWeek: selectedDays,
                serviceIds: applyToAllServices ? [] : selectedServiceIds,
                commissionPolicy,
                isActive: editingPromotion ? editingPromotion.isActive : true,
            };

            if (editingPromotion) {
                await updatePromotion({ id: editingPromotion.id, data: payload });
            } else {
                await addPromotion(payload as any);
            }
            setIsModalOpen(false);
        } catch (_) {}
    };

    const handleDelete = async () => {
        if (!promoToDelete) return;
        try {
            await deletePromotion(promoToDelete.id);
            setPromoToDelete(null);
        } catch (_) {}
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
                            <Flame size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                                Promociones y Descuentos
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold uppercase tracking-wider">
                                    Herramientas
                                </span>
                            </h1>
                            <p className="text-sm text-slate-400">
                                Configura ofertas por días especiales (ej. Martes y Jueves) para llenar tu agenda en días de baja demanda.
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={openCreateModal}
                    className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm transition-all duration-300 shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
                >
                    <Plus size={18} />
                    <span>Nueva Promoción</span>
                </button>
            </div>

            {/* Tarjetas de Estadísticas Rápidas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                        <Flame size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Promociones Activas</p>
                        <h3 className="text-2xl font-black text-white">{activePromosCount}</h3>
                    </div>
                </div>

                <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Días con Promo a la Semana</p>
                        <h3 className="text-2xl font-black text-white">{promoDaysCount} días</h3>
                    </div>
                </div>

                <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                        <Shield size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Políticas de Nómina</p>
                        <h3 className="text-base font-bold text-white">Automático en Comisiones</h3>
                    </div>
                </div>
            </div>

            {/* Listado de Promociones */}
            {promotions.length === 0 ? (
                <div className="text-center py-16 px-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
                    <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-4">
                        <Tag size={28} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">No tienes promociones configuradas</h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                        Crea tu primera promoción por días para incentivar a tus clientes a agendar en días lentos (por ejemplo: Martes y Jueves de Corte).
                    </p>
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 inline-flex items-center gap-2 cursor-pointer"
                    >
                        <Plus size={18} />
                        <span>Crear mi primera promoción</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {promotions.map((promo) => {
                        const targetServices = promo.serviceIds && promo.serviceIds.length > 0
                            ? services.filter(s => promo.serviceIds.includes(s.id))
                            : [];

                        return (
                            <div
                                key={promo.id}
                                className={`rounded-3xl border transition-all duration-300 p-6 flex flex-col justify-between ${
                                    promo.isActive
                                        ? 'bg-white/[0.04] border-white/15 hover:border-amber-500/40 shadow-xl shadow-black/20'
                                        : 'bg-white/[0.01] border-white/5 opacity-60'
                                }`}
                            >
                                <div>
                                    {/* Header de la tarjeta */}
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                                                <Flame size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-base leading-snug">{promo.name}</h3>
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                                                    promo.isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700/50 text-slate-400 border border-white/10'
                                                }`}>
                                                    {promo.isActive ? 'Activa' : 'Pausada'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Switch rápido de activar/pausar */}
                                        <button
                                            type="button"
                                            onClick={() => togglePromotionActive({ id: promo.id, isActive: !promo.isActive })}
                                            className={`w-12 h-6 rounded-full transition-colors p-0.5 flex items-center cursor-pointer shrink-0 ${
                                                promo.isActive ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
                                            }`}
                                            title={promo.isActive ? 'Pausar promoción' : 'Activar promoción'}
                                        >
                                            <div className="w-5 h-5 rounded-full bg-slate-950 shadow-md" />
                                        </button>
                                    </div>

                                    {/* Días aplicables */}
                                    <div className="mb-4">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Días aplicables:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {DAY_OPTIONS.map(d => {
                                                const isSelected = promo.daysOfWeek?.includes(d.key);
                                                return (
                                                    <span
                                                        key={d.key}
                                                        className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${
                                                            isSelected
                                                                ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                                                                : 'bg-white/5 border-white/5 text-slate-600'
                                                        }`}
                                                    >
                                                        {d.short}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Beneficio / Precio */}
                                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 mb-4">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Beneficio al cliente:</p>
                                        <div className="text-lg font-black text-amber-300 mt-0.5">
                                            {promo.discountType === 'fixed_price' && (
                                                <span>Precio especial: {currencySymbol}{promo.discountValue}</span>
                                            )}
                                            {promo.discountType === 'fixed_discount' && (
                                                <span>Descuento directo: -{currencySymbol}{promo.discountValue}</span>
                                            )}
                                            {promo.discountType === 'percentage' && (
                                                <span>{promo.discountValue}% de descuento</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Servicios participantes */}
                                    <div className="mb-4">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Servicios participantes:</p>
                                        {promo.serviceIds && promo.serviceIds.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                                                {targetServices.map(s => (
                                                    <span key={s.id} className="text-xs px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-medium">
                                                        {s.name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-semibold inline-block">
                                                ✨ Aplica a todos los servicios
                                            </span>
                                        )}
                                    </div>

                                    {/* Política de Nómina */}
                                    <div className="flex items-center gap-2 text-xs text-slate-400 py-1 border-t border-white/10 mb-4">
                                        <Shield size={14} className="text-amber-400 shrink-0" />
                                        <span>
                                            Nómina:{' '}
                                            <strong className="text-slate-200">
                                                {promo.commissionPolicy === 'regular_price'
                                                    ? 'Negocio absorbe el descuento'
                                                    : 'Comisión s/ monto cobrado'}
                                            </strong>
                                        </span>
                                    </div>
                                </div>

                                {/* Acciones inferiores */}
                                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(promo)}
                                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                                        title="Editar promoción"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPromoToDelete(promo)}
                                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all cursor-pointer"
                                        title="Eliminar promoción"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal de Creación / Edición Responsivo y Centrado */}
            {isModalOpen && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div 
                        className="w-full max-w-xl bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        <form onSubmit={handleSave} className="flex flex-col h-full min-h-0 overflow-hidden">
                            {/* Header Fijo */}
                            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/40 shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
                                        <Flame size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base sm:text-lg font-black text-white truncate">
                                                {editingPromotion ? 'Editar Promoción' : 'Nueva Promoción'}
                                            </h3>
                                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 shrink-0">
                                                🔥 Oferta
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 truncate">Configura el precio especial para días específicos</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer shrink-0 active:scale-95"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Cuerpo con Scroll Suave */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar min-h-0">
                                {/* Nombre de la promo */}
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                                        <Tag size={13} className="text-amber-400" />
                                        <span>Nombre de la Promoción *</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="ej. Martes y Jueves de Corte"
                                        className="w-full px-4 py-2.5 sm:py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm font-medium transition-colors"
                                    />
                                </div>

                                {/* Días aplicables */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                            <Calendar size={13} className="text-amber-400" />
                                            <span>¿Qué días aplica? *</span>
                                        </label>
                                        <div className="flex items-center gap-1 text-[11px]">
                                            <button
                                                type="button"
                                                onClick={setWeekdays}
                                                className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-amber-300 transition-colors"
                                            >
                                                L-V
                                            </button>
                                            <button
                                                type="button"
                                                onClick={setWeekend}
                                                className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-amber-300 transition-colors"
                                            >
                                                S-D
                                            </button>
                                            <button
                                                type="button"
                                                onClick={setAllDays}
                                                className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-amber-300 transition-colors"
                                            >
                                                Todos
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                                        {DAY_OPTIONS.map(d => {
                                            const isSelected = selectedDays.includes(d.key);
                                            return (
                                                <button
                                                    key={d.key}
                                                    type="button"
                                                    onClick={() => toggleDay(d.key)}
                                                    className={`py-2.5 sm:py-3 px-1 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 active:scale-95 ${
                                                        isSelected
                                                            ? 'bg-gradient-to-b from-amber-500/25 to-amber-500/10 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)] font-black'
                                                            : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                                                    }`}
                                                >
                                                    <span className="text-[10px] sm:text-xs uppercase font-bold tracking-tight">{d.short}</span>
                                                    {isSelected ? (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                                    ) : (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Tipo de Descuento y Valor */}
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                                        Tipo de Beneficio / Precio Especial *
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setDiscountType('fixed_price')}
                                            className={`p-2.5 sm:p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 active:scale-95 ${
                                                discountType === 'fixed_price'
                                                    ? 'bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/10'
                                                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                                            }`}
                                        >
                                            <DollarSign size={16} className={discountType === 'fixed_price' ? 'text-amber-400' : ''} />
                                            <span className="text-[11px] sm:text-xs">Precio Fijo</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setDiscountType('fixed_discount')}
                                            className={`p-2.5 sm:p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 active:scale-95 ${
                                                discountType === 'fixed_discount'
                                                    ? 'bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/10'
                                                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                                            }`}
                                        >
                                            <Tag size={16} className={discountType === 'fixed_discount' ? 'text-amber-400' : ''} />
                                            <span className="text-[11px] sm:text-xs">Descuento ($)</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setDiscountType('percentage')}
                                            className={`p-2.5 sm:p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 active:scale-95 ${
                                                discountType === 'percentage'
                                                    ? 'bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/10'
                                                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                                            }`}
                                        >
                                            <Percent size={16} className={discountType === 'percentage' ? 'text-amber-400' : ''} />
                                            <span className="text-[11px] sm:text-xs">Porcentaje (%)</span>
                                        </button>
                                    </div>

                                    <div className="relative mt-2">
                                        <input
                                            type="number"
                                            step="any"
                                            required
                                            min="1"
                                            value={discountValue}
                                            onChange={e => setDiscountValue(e.target.value)}
                                            className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-lg focus:outline-none focus:border-amber-500 pr-10"
                                            placeholder={discountType === 'percentage' ? 'ej. 20' : 'ej. 140'}
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-400">
                                            {discountType === 'percentage' ? '%' : currencySymbol}
                                        </span>
                                    </div>

                                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
                                        {discountType === 'fixed_price' && (
                                            <p>💡 <strong>Precio Fijo:</strong> El cliente pagará exactamente <strong className="text-white">{currencySymbol}{discountValue || 0}</strong> en los días elegidos (ej. Si el corte regular cuesta {currencySymbol}180, quedará en {currencySymbol}{discountValue || 0}).</p>
                                        )}
                                        {discountType === 'fixed_discount' && (
                                            <p>💡 <strong>Descuento Directo:</strong> Se restarán <strong className="text-white">{currencySymbol}{discountValue || 0}</strong> al precio normal del servicio (ej. Si cuesta {currencySymbol}180, quedará en {currencySymbol}{Math.max(0, 180 - (parseFloat(discountValue) || 0))}).</p>
                                        )}
                                        {discountType === 'percentage' && (
                                            <p>💡 <strong>Porcentaje:</strong> Se aplicará un <strong className="text-white">{discountValue || 0}% de descuento</strong> sobre el total del servicio.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Servicios participantes */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                            Servicios participantes *
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setApplyToAllServices(!applyToAllServices)}
                                            className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
                                        >
                                            {applyToAllServices ? 'Elegir servicios específicos' : 'Seleccionar todos los servicios'}
                                        </button>
                                    </div>

                                    {applyToAllServices ? (
                                        <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium flex items-center gap-2">
                                            <CheckCircle2 size={16} className="shrink-0" />
                                            <span>Esta promoción aplicará automáticamente a todo el catálogo de servicios en los días marcados.</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {/* Buscador de servicios si hay más de 4 */}
                                            {services.length > 4 && (
                                                <div className="relative">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                                    <input
                                                        type="text"
                                                        value={serviceSearch}
                                                        onChange={e => setServiceSearch(e.target.value)}
                                                        placeholder="Buscar servicio..."
                                                        className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                                                    />
                                                </div>
                                            )}

                                            <div className="max-h-52 overflow-y-auto space-y-1.5 p-2 rounded-2xl bg-white/[0.02] border border-white/10 custom-scrollbar">
                                                {filteredServices.length === 0 ? (
                                                    <p className="text-xs text-slate-500 text-center py-4">No se encontraron servicios</p>
                                                ) : (
                                                    filteredServices.map(s => {
                                                        const isChecked = selectedServiceIds.includes(s.id);
                                                        const simulated = getSimulatedPrice(s.price);

                                                        return (
                                                            <button
                                                                key={s.id}
                                                                type="button"
                                                                onClick={() => toggleService(s.id)}
                                                                className={`w-full p-3 rounded-2xl text-left text-xs transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99] ${
                                                                    isChecked
                                                                        ? 'bg-amber-500/15 text-white border border-amber-400/40 shadow-sm'
                                                                        : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/5'
                                                                }`}
                                                            >
                                                                <div className="min-w-0">
                                                                    <p className="font-bold text-slate-100 truncate">{s.name}</p>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <span className="text-[11px] text-slate-400">Regular: {currencySymbol}{s.price}</span>
                                                                        {isChecked && (
                                                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                                                Promo: {currencySymbol}{simulated}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                                                                    isChecked
                                                                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                                                                        : 'bg-white/10 text-slate-500'
                                                                }`}>
                                                                    {isChecked ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
                                                                </div>
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Política de Nómina y Comisiones */}
                                <div className="space-y-2 p-4 rounded-2xl bg-white/5 border border-white/10">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
                                        <Shield size={14} className="text-amber-400" />
                                        <span>Política de Nómina y Comisiones</span>
                                    </label>
                                    <p className="text-[11px] text-slate-400 mb-3">
                                        Define cómo se calcula el pago de comisión al especialista durante esta promoción:
                                    </p>

                                    <div className="space-y-2">
                                        <label className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                                            commissionPolicy === 'charged_price'
                                                ? 'bg-amber-500/10 border-amber-400/50 shadow-sm'
                                                : 'bg-white/[0.02] hover:bg-white/5 border-white/10'
                                        }`}>
                                            <input
                                                type="radio"
                                                name="commissionPolicy"
                                                value="charged_price"
                                                checked={commissionPolicy === 'charged_price'}
                                                onChange={() => setCommissionPolicy('charged_price')}
                                                className="mt-1 accent-amber-500"
                                            />
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-xs font-bold text-white">Comisión sobre precio con descuento</p>
                                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                        Popular
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    El especialista comisiona sobre el monto realmente cobrado al cliente. Ambos comparten el esfuerzo de la oferta.
                                                </p>
                                            </div>
                                        </label>

                                        <label className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                                            commissionPolicy === 'regular_price'
                                                ? 'bg-amber-500/10 border-amber-400/50 shadow-sm'
                                                : 'bg-white/[0.02] hover:bg-white/5 border-white/10'
                                        }`}>
                                            <input
                                                type="radio"
                                                name="commissionPolicy"
                                                value="regular_price"
                                                checked={commissionPolicy === 'regular_price'}
                                                onChange={() => setCommissionPolicy('regular_price')}
                                                className="mt-1 accent-amber-500"
                                            />
                                            <div>
                                                <p className="text-xs font-bold text-white">El negocio absorbe el descuento</p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    El colaborador comisiona sobre el precio base de lista como si no hubiera descuento. El negocio asume la diferencia.
                                                </p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Fijo de Acciones */}
                            <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-950/70 backdrop-blur-md flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs sm:text-sm cursor-pointer transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAdding || isUpdating}
                                    className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/25 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                                >
                                    <Flame size={16} className="text-slate-950 fill-slate-950" />
                                    <span>{isAdding || isUpdating ? 'Guardando...' : editingPromotion ? 'Actualizar Promoción' : 'Crear Promoción'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación de Eliminación */}
            {promoToDelete && (
                <ConfirmModal
                    isOpen={true}
                    title="¿Eliminar promoción?"
                    message={`¿Estás seguro de que deseas eliminar la promoción "${promoToDelete.name}"? Los servicios volverán a su precio regular en los días correspondientes.`}
                    confirmLabel="Sí, eliminar"
                    cancelLabel="Cancelar"
                    danger={true}
                    onConfirm={handleDelete}
                    onCancel={() => setPromoToDelete(null)}
                />
            )}
        </div>
    );
}
