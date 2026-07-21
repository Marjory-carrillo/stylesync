
import { useState } from 'react';
import { useImageUpload } from '../../lib/store/queries/useImageUpload';
import { useStylists } from '../../lib/store/queries/useStylists';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useServices } from '../../lib/store/queries/useServices';
import { canAddStylist, getPlanLimits, getPlanBadgeStyles, getEffectiveMaxEmployees } from '../../lib/planLimits';
import { User, Phone, Plus, Edit2, Trash2, X, Upload, ImageIcon, Zap, Crown, ArrowRight, ExternalLink } from 'lucide-react';
import { stylistSchema } from '../../lib/schemas';
import { useStripeCheckout } from '../../lib/store/queries/useStripeCheckout';
import type { WeekSchedule } from '../../lib/types/store.types';
import ConfirmModal from '../../components/ConfirmModal';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo'
};
const DEFAULT_STAFF_SCHEDULE: WeekSchedule = {
    monday: { open: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
    tuesday: { open: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
    wednesday: { open: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
    thursday: { open: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
    friday: { open: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
    saturday: { open: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' },
    sunday: { open: false, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' }
};

export default function Staff() {
    const { uploadStylistPhoto } = useImageUpload();
    const { stylists, addStylist, removeStylist, updateStylist, isLoading } = useStylists();
    const { data: businessConfig } = useTenantData();
    const plan = businessConfig?.plan || 'free';
    const trialEndsAt = businessConfig?.trialEndsAt || null;
    const limits = getPlanLimits(plan);
    const badge = getPlanBadgeStyles(plan);
    const extraEmployeesPaid = businessConfig?.extraEmployeesPaid || 0;
    const hasStripeCustomer = !!(businessConfig as any)?.stripeCustomerId;
    const { openBillingPortal, isPortalLoading, redirectToCheckout, isCheckoutLoading } = useStripeCheckout();
    const inTrial = trialEndsAt ? new Date(trialEndsAt) > new Date() : false;
    const effectiveMaxEmployees = getEffectiveMaxEmployees(plan, extraEmployeesPaid);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState<{ type: 'upgrade' | 'extra'; message: string } | null>(null);

    // Custom confirm dialog state
    const [customConfirm, setCustomConfirm] = useState<{
        open: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        onConfirm: () => void;
        danger?: boolean;
    }>({
        open: false,
        title: '',
        message: '',
        onConfirm: () => {},
        danger: false
    });

    const [formName, setFormName] = useState('');
    const [formRole, setFormRole] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formImage, setFormImage] = useState('');
    const [formCommission, setFormCommission] = useState<number>(0);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'schedule' | 'services'>('profile');
    const [formUseCustomSchedule, setFormUseCustomSchedule] = useState(false);
    const [formSchedule, setFormSchedule] = useState<WeekSchedule>(DEFAULT_STAFF_SCHEDULE);
    const [formServiceIds, setFormServiceIds] = useState<number[]>([]);
    const { services } = useServices();

    const openAdd = () => {
        const check = canAddStylist(plan, stylists.length, trialEndsAt, extraEmployeesPaid);
        if (!check.allowed) {
            // Hard limit (Free plan) — show upgrade modal
            setShowUpgradeModal({ type: 'upgrade', message: check.message || 'Límite alcanzado' });
            return;
        }
        if (check.message) {
            // Soft limit (Pro/Business) — warn about extra cost but allow
            setShowUpgradeModal({ type: 'extra', message: check.message });
            return;
        }
        setFormError(null);
        setEditingId(null);
        setFormName('');
        setFormRole('');
        setFormPhone('');
        setFormImage('');
        setFormCommission(0);
        setActiveTab('profile');
        setFormUseCustomSchedule(false);
        setFormSchedule(DEFAULT_STAFF_SCHEDULE);
        setFormServiceIds([]);
        setIsModalOpen(true);
    };

    const proceedAfterWarning = () => {
        setShowUpgradeModal(null);
        setFormError(null);
        setEditingId(null);
        setFormName('');
        setFormRole('');
        setFormPhone('');
        setFormImage('');
        setFormCommission(0);
        setActiveTab('profile');
        setFormUseCustomSchedule(false);
        setFormSchedule(DEFAULT_STAFF_SCHEDULE);
        setFormServiceIds([]);
        setIsModalOpen(true);
    };

    const openEdit = (id: number) => {
        const stylist = stylists.find(s => s.id === id);
        if (!stylist) return;
        setFormError(null);
        setEditingId(id);
        setFormName(stylist.name);
        setFormRole(stylist.role);
        setFormPhone(stylist.phone);
        setFormImage(stylist.image || '');
        setFormCommission(stylist.commissionRate || 0);
        setActiveTab('profile');
        if (stylist.schedule && typeof stylist.schedule === 'object' && Object.keys(stylist.schedule).length > 0) {
            setFormUseCustomSchedule(true);
            setFormSchedule(stylist.schedule as WeekSchedule);
        } else {
            setFormUseCustomSchedule(false);
            setFormSchedule(DEFAULT_STAFF_SCHEDULE);
        }
        setFormServiceIds(stylist.serviceIds || []);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        const result = stylistSchema.safeParse({
            name: formName,
            role: formRole,
            phone: formPhone || '',
            image: formImage || '',
            commissionRate: formCommission,
            schedule: formUseCustomSchedule ? formSchedule : null,
            serviceIds: formServiceIds
        });

        if (!result.success) {
            setFormError(result.error.issues[0].message);
            return;
        }
        setFormError(null);

        const data = {
            name: result.data.name,
            role: result.data.role,
            phone: result.data.phone || '',
            image: result.data.image || '',
            commissionRate: result.data.commissionRate,
            schedule: formUseCustomSchedule ? formSchedule : null,
            serviceIds: formServiceIds
        };

        if (editingId !== null) {
            await updateStylist({ id: editingId, data });
        } else {
            await addStylist(data);
        }
        setIsModalOpen(false);
    };

    const handleDelete = (id: number) => {
        const person = stylists.find(s => s.id === id);
        setCustomConfirm({
            open: true,
            title: '¿Eliminar Profesional?',
            message: `¿Estás seguro de que quieres eliminar a ${person?.name || 'este profesional'}? Esta acción no se puede deshacer y borrará su asignación de servicios y horarios.`,
            confirmLabel: 'Sí, Eliminar',
            cancelLabel: 'Cancelar',
            danger: true,
            onConfirm: async () => {
                await removeStylist(id);
            }
        });
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        Profesionales
                        {isLoading && <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin"></div>}
                        {inTrial ? (
                            <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                🎁 Trial
                            </span>
                        ) : (
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}>
                                {limits.name}
                            </span>
                        )}
                    </h2>
                    <p className="text-sm text-muted flex items-center gap-2 mt-1">
                        Gestiona a tus profesionales y personal.
                        <span className="text-[10px] font-bold bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                            {stylists.length}/{inTrial ? 2 : effectiveMaxEmployees}
                        </span>
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}>
                    <Plus size={20} /> <span className="hidden md:inline">Nuevo Profesional</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stylists.map(person => (
                    <div key={person.id} className="glass-card p-6 relative group hover:bg-slate-800/50 transition-colors">
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 hover:bg-white/10 rounded-full text-muted hover:text-white transition-colors" onClick={() => openEdit(person.id)} title="Editar">
                                <Edit2 size={16} />
                            </button>
                            <button className="p-2 hover:bg-red-500/20 rounded-full text-muted hover:text-red-500 transition-colors" onClick={() => handleDelete(person.id)} title="Eliminar">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="flex flex-col items-center">
                            <div className="w-24 h-24 rounded-full mb-4 flex items-center justify-center overflow-hidden border-2 border-accent/20 shadow-glow">
                                {person.image ? (
                                    <img src={person.image} alt={person.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                        <User size={40} className="text-muted" />
                                    </div>
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-1">{person.name}</h3>
                            <p className="text-accent text-sm font-medium mb-2">{person.role}</p>

                            <div className="flex items-center gap-2 mb-4">
                                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-2 py-1 rounded-md border border-emerald-500/20">
                                    {person.commissionRate || 0}% COMISIÓN
                                </span>
                            </div>

                            {person.phone && (
                                <div className="flex items-center gap-2 text-sm text-muted bg-white/5 py-1 px-3 rounded-full">
                                    <Phone size={14} /> <span>{person.phone}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                    <div className="glass-panel w-full max-w-lg p-6 rounded-xl animate-fade-in" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white">{editingId ? 'Editar' : 'Nuevo'} Profesional</h3>
                            <button className="text-muted hover:text-white" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex gap-4 border-b border-white/10 mb-6">
                            <button
                                type="button"
                                onClick={() => setActiveTab('profile')}
                                className={`pb-2 font-bold text-sm border-b-2 transition-all ${activeTab === 'profile' ? 'border-accent text-white' : 'border-transparent text-slate-500'}`}
                            >
                                Perfil
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('schedule')}
                                className={`pb-2 font-bold text-sm border-b-2 transition-all ${activeTab === 'schedule' ? 'border-accent text-white' : 'border-transparent text-slate-500'}`}
                            >
                                Horario de Trabajo
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('services')}
                                className={`pb-2 font-bold text-sm border-b-2 transition-all ${activeTab === 'services' ? 'border-accent text-white' : 'border-transparent text-slate-500'}`}
                            >
                                Servicios Asignados
                            </button>
                        </div>

                        {formError && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm animate-pulse-soft flex items-center gap-2">
                                <X size={16} />
                                <span>{formError}</span>
                            </div>
                        )}

                        {activeTab === 'profile' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-muted mb-1 block">Nombre</label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        placeholder="Ej: Ana García"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted mb-1 block">Rol / Cargo</label>
                                    <input
                                        type="text"
                                        value={formRole}
                                        onChange={e => setFormRole(e.target.value)}
                                        placeholder="Ej: Barbero Senior"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted mb-1 block">Teléfono</label>
                                    <input
                                        type="text"
                                        value={formPhone}
                                        onChange={e => setFormPhone(e.target.value)}
                                        placeholder="555-0000"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted mb-1 block">% Comisión (Nómina)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0" max="100"
                                            value={formCommission}
                                            onChange={e => setFormCommission(Number(e.target.value))}
                                            placeholder="0"
                                            className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent transition-colors pr-10"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted mb-1 block">URL de Foto</label>
                                    <input
                                        type="text"
                                        value={formImage}
                                        onChange={e => setFormImage(e.target.value)}
                                        placeholder="https://..."
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent transition-colors"
                                    />
                                    <div className="mt-2 text-xs text-muted">O sube una imagen:</div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                            {formImage ? (
                                                <img src={formImage} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon size={20} className="text-muted" />
                                            )}
                                        </div>
                                        <label className="btn btn-sm bg-white/5 hover:bg-white/10 text-white cursor-pointer flex items-center gap-2 border border-white/10">
                                            <Upload size={14} />
                                            {uploadingImage ? 'Subiendo...' : 'Subir Foto'}
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                disabled={uploadingImage}
                                                onChange={async (e) => {
                                                    if (e.target.files && e.target.files[0]) {
                                                        setUploadingImage(true);
                                                        try {
                                                            const url = await uploadStylistPhoto(e.target.files[0]);
                                                            if (url) setFormImage(url);
                                                        } finally {
                                                            setUploadingImage(false);
                                                        }
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'schedule' && (
                            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10 mb-2">
                                    <input
                                        type="checkbox"
                                        id="useCustomSchedule"
                                        checked={formUseCustomSchedule}
                                        onChange={e => setFormUseCustomSchedule(e.target.checked)}
                                        className="w-4 h-4 rounded bg-slate-900 border-white/10 text-accent focus:ring-accent cursor-pointer"
                                    />
                                    <label htmlFor="useCustomSchedule" className="text-sm font-semibold text-white cursor-pointer select-none">
                                        Personalizar horario de este profesional
                                    </label>
                                </div>

                                {!formUseCustomSchedule ? (
                                    <div className="p-4 bg-white/5 border border-dashed border-white/10 rounded-xl text-center text-slate-400 text-xs leading-relaxed space-y-1">
                                        <p className="font-bold text-slate-300">Respaldo Activo (Fallback)</p>
                                        <p>Este profesional heredará automáticamente el horario general de apertura y descanso configurado para el salón.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {DAYS.map(day => {
                                            const daySched = formSchedule[day] || { open: false, start: '09:00', end: '18:00' };
                                            return (
                                                <div key={day} className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-bold text-white">{DAY_LABELS[day]}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-slate-400">{daySched.open ? 'Laborable' : 'Descanso'}</span>
                                                            <input
                                                                type="checkbox"
                                                                checked={daySched.open}
                                                                onChange={e => {
                                                                    const open = e.target.checked;
                                                                    setFormSchedule(prev => ({
                                                                        ...prev,
                                                                        [day]: { ...daySched, open }
                                                                    }));
                                                                }}
                                                                className="w-4 h-4 rounded bg-slate-900 border-white/10 text-accent focus:ring-accent cursor-pointer"
                                                            />
                                                        </div>
                                                    </div>

                                                    {daySched.open && (
                                                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                                                            <div className="space-y-1">
                                                                <span className="text-[10px] uppercase font-bold text-slate-500">Horario de Trabajo</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <input
                                                                        type="text"
                                                                        value={daySched.start}
                                                                        onChange={e => {
                                                                            const start = e.target.value;
                                                                            setFormSchedule(prev => ({
                                                                                ...prev,
                                                                                [day]: { ...daySched, start }
                                                                            }));
                                                                        }}
                                                                        placeholder="09:00"
                                                                        className="w-full text-center bg-slate-950/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                                                                    />
                                                                    <span className="text-slate-500 text-xs">a</span>
                                                                    <input
                                                                        type="text"
                                                                        value={daySched.end}
                                                                        onChange={e => {
                                                                            const end = e.target.value;
                                                                            setFormSchedule(prev => ({
                                                                                ...prev,
                                                                                [day]: { ...daySched, end }
                                                                            }));
                                                                        }}
                                                                        placeholder="18:00"
                                                                        className="w-full text-center bg-slate-950/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div className="space-y-1">
                                                                <span className="text-[10px] uppercase font-bold text-slate-500">Comida / Descanso</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <input
                                                                        type="text"
                                                                        value={daySched.breakStart || ''}
                                                                        onChange={e => {
                                                                            const breakStart = e.target.value || undefined;
                                                                            setFormSchedule(prev => ({
                                                                                ...prev,
                                                                                [day]: { ...daySched, breakStart }
                                                                            }));
                                                                        }}
                                                                        placeholder="13:00"
                                                                        className="w-full text-center bg-slate-950/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                                                                    />
                                                                    <span className="text-slate-500 text-xs">a</span>
                                                                    <input
                                                                        type="text"
                                                                        value={daySched.breakEnd || ''}
                                                                        onChange={e => {
                                                                            const breakEnd = e.target.value || undefined;
                                                                            setFormSchedule(prev => ({
                                                                                ...prev,
                                                                                [day]: { ...daySched, breakEnd }
                                                                            }));
                                                                        }}
                                                                        placeholder="14:00"
                                                                        className="w-full text-center bg-slate-950/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'services' && (
                            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="p-4 bg-white/5 border border-dashed border-white/10 rounded-xl text-center text-slate-400 text-xs leading-relaxed">
                                    <p className="font-bold text-slate-300 mb-1">Especialización de Servicios</p>
                                    <p>Selecciona los servicios que este profesional puede realizar. Si no marcas ninguno, se asumirá que está capacitado para realizar <strong>todos</strong> los servicios.</p>
                                </div>

                                {/* Standard Services Group */}
                                <div className="space-y-2">
                                    <h4 className="text-xs uppercase font-bold tracking-wider text-accent">Servicios principales</h4>
                                    {services.filter(s => !s.isAddon).length === 0 ? (
                                        <p className="text-xs text-slate-500 italic pl-1">No hay servicios principales creados.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {services.filter(s => !s.isAddon).map(service => {
                                                const isChecked = formServiceIds.includes(Number(service.id));
                                                return (
                                                    <label key={service.id} className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl cursor-pointer transition-colors select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                const sId = Number(service.id);
                                                                if (isChecked) {
                                                                    setFormServiceIds(prev => prev.filter(id => id !== sId));
                                                                } else {
                                                                    setFormServiceIds(prev => [...prev, sId]);
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded bg-slate-900 border-white/10 text-accent focus:ring-accent cursor-pointer"
                                                        />
                                                        <div className="text-left">
                                                            <p className="text-sm font-semibold text-white leading-tight">{service.name}</p>
                                                            <p className="text-xs text-slate-400 font-medium">${service.price} MXN • {service.duration} min</p>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Addon Services Group */}
                                <div className="space-y-2 pt-2 border-t border-white/5">
                                    <h4 className="text-xs uppercase font-bold tracking-wider text-emerald-400">Servicios adicionales (Add-ons)</h4>
                                    {services.filter(s => s.isAddon).length === 0 ? (
                                        <p className="text-xs text-slate-500 italic pl-1">No hay servicios adicionales creados.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {services.filter(s => s.isAddon).map(service => {
                                                const isChecked = formServiceIds.includes(Number(service.id));
                                                return (
                                                    <label key={service.id} className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl cursor-pointer transition-colors select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                const sId = Number(service.id);
                                                                if (isChecked) {
                                                                    setFormServiceIds(prev => prev.filter(id => id !== sId));
                                                                } else {
                                                                    setFormServiceIds(prev => [...prev, sId]);
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded bg-slate-900 border-white/10 text-accent focus:ring-accent cursor-pointer"
                                                        />
                                                        <div className="text-left">
                                                            <p className="text-sm font-semibold text-white leading-tight">{service.name}</p>
                                                            <p className="text-xs text-slate-400 font-medium">${service.price} MXN • {service.duration} min</p>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 mt-6 border-t border-white/10 pt-4">
                            <button type="button" className="btn btn-ghost hover:bg-white/10" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                            <button type="button" className="btn btn-primary" onClick={handleSave}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Upgrade / Extra Cost Modal ── */}
            {showUpgradeModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                    <div className="glass-panel max-w-sm w-full p-8 border border-white/10 shadow-2xl animate-scale-in relative overflow-hidden">

                        {/* Top gradient bar */}
                        <div className={`absolute top-0 left-0 w-full h-1 ${showUpgradeModal.type === 'upgrade' ? 'bg-gradient-to-r from-violet-500 to-amber-500' : 'bg-gradient-to-r from-amber-500 to-emerald-500'}`} />

                        {/* Icon */}
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 mx-auto ${showUpgradeModal.type === 'upgrade' ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                            {showUpgradeModal.type === 'upgrade'
                                ? <Crown size={32} className="text-violet-400" />
                                : <Zap size={32} className="text-amber-400" />
                            }
                        </div>

                        <h3 className="text-xl font-black text-white text-center mb-2 uppercase tracking-tight">
                            {showUpgradeModal.type === 'upgrade' ? 'Límite Alcanzado' : 'Empleado Adicional'}
                        </h3>

                        <p className="text-slate-400 text-center text-sm mb-6 leading-relaxed">
                            {showUpgradeModal.message}
                        </p>

                        {showUpgradeModal.type === 'upgrade' ? (
                            /* Hard block — must upgrade or buy extra */
                            <div className="space-y-3">
                                {hasStripeCustomer ? (
                                    /* Has Stripe subscription — send to portal to add extras */
                                    <>
                                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">Profesional Extra</p>
                                            <p className="text-2xl font-black text-white">+$349<span className="text-sm font-medium text-slate-400">/mes</span></p>
                                            <p className="text-xs text-slate-400 mt-1">Agrega profesionales desde tu portal de facturación</p>
                                        </div>
                                        <button
                                            onClick={() => { setShowUpgradeModal(null); openBillingPortal(); }}
                                            disabled={isPortalLoading}
                                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm uppercase tracking-wider transition-all hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <ExternalLink size={16} /> Agregar Profesional Extra
                                        </button>
                                    </>
                                ) : (
                                    /* No Stripe — needs to subscribe first */
                                    <>
                                        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 text-center">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-1">Plan Pro</p>
                                            <p className="text-2xl font-black text-white">$899<span className="text-sm font-medium text-slate-400">/mes</span></p>
                                            <p className="text-xs text-slate-400 mt-1">2 profesionales incluidos + $349 c/u extra</p>
                                        </div>
                                        <button
                                            onClick={() => { setShowUpgradeModal(null); redirectToCheckout('pro'); }}
                                            disabled={isCheckoutLoading}
                                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-black text-sm uppercase tracking-wider transition-all hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            ⭐ Actualizar a Pro
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => setShowUpgradeModal(null)}
                                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-sm transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        ) : (
                            /* Soft warning — allow but warn cost */
                            <div className="space-y-3">
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                                    <p className="text-xs text-amber-400 font-bold">+$349/mes por este empleado adicional</p>
                                </div>
                                <button
                                    onClick={proceedAfterWarning}
                                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                                >
                                    Continuar de todas formas <ArrowRight size={16} />
                                </button>
                                <button
                                    onClick={() => setShowUpgradeModal(null)}
                                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-sm transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={customConfirm.open}
                title={customConfirm.title}
                message={customConfirm.message}
                confirmLabel={customConfirm.confirmLabel}
                cancelLabel={customConfirm.cancelLabel}
                onConfirm={() => {
                    customConfirm.onConfirm();
                    setCustomConfirm(prev => ({ ...prev, open: false }));
                }}
                onCancel={() => setCustomConfirm(prev => ({ ...prev, open: false }))}
                danger={customConfirm.danger}
            />
        </div>
    );
}


