
import { useState } from 'react';
import { useImageUpload } from '../../lib/store/queries/useImageUpload';
import { useStylists } from '../../lib/store/queries/useStylists';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { canAddStylist, getPlanLimits, getPlanBadgeStyles } from '../../lib/planLimits';
import { User, Phone, Plus, Edit2, Trash2, X, Upload, ImageIcon } from 'lucide-react';
import { stylistSchema } from '../../lib/schemas';
import { useUIStore } from '../../lib/store/uiStore';

export default function Staff() {
    const { uploadStylistPhoto } = useImageUpload();
    const { stylists, addStylist, removeStylist, updateStylist, isLoading } = useStylists();
    const { data: businessConfig } = useTenantData();
    const showToast = useUIStore(s => s.showToast);
    const plan = businessConfig?.plan || 'free';
    const limits = getPlanLimits(plan);
    const badge = getPlanBadgeStyles(plan);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [formName, setFormName] = useState('');
    const [formRole, setFormRole] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formImage, setFormImage] = useState('');
    const [formCommission, setFormCommission] = useState<number>(0);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const openAdd = () => {
        const check = canAddStylist(plan, stylists.length);
        if (!check.allowed) {
            showToast(check.message || 'Límite alcanzado', 'error');
            return;
        }
        if (check.message) {
            showToast(check.message, 'info');
        }
        setFormError(null);
        setEditingId(null);
        setFormName('');
        setFormRole('');
        setFormPhone('');
        setFormImage('');
        setFormCommission(0);
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
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        const result = stylistSchema.safeParse({
            name: formName,
            role: formRole,
            phone: formPhone || '',
            image: formImage || '',
            commissionRate: formCommission
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
            commissionRate: result.data.commissionRate
        };

        if (editingId !== null) {
            await updateStylist({ id: editingId, data });
        } else {
            await addStylist(data);
        }
        setIsModalOpen(false);
    };

    const handleDelete = async (id: number) => {
        if (confirm('¿Estás seguro de eliminar a este miembro del equipo?')) {
            await removeStylist(id);
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        Equipo
                        {isLoading && <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin"></div>}
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {limits.name}
                        </span>
                    </h2>
                    <p className="text-sm text-muted flex items-center gap-2 mt-1">
                        Gestiona a tus estilistas y personal.
                        <span className="text-[10px] font-bold bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                            {stylists.length}/{limits.canExpandEmployees ? '∞' : limits.maxEmployeesPerBranch}
                        </span>
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}>
                    <Plus size={20} /> <span className="hidden md:inline">Nuevo Miembro</span>
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
                    <div className="glass-panel w-full max-w-md p-6 rounded-xl animate-fade-in" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">{editingId ? 'Editar' : 'Nuevo'} Miembro</h3>
                            <button className="text-muted hover:text-white" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
                        </div>

                        {formError && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm animate-pulse-soft flex items-center gap-2">
                                <X size={16} />
                                <span>{formError}</span>
                            </div>
                        )}

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
                                    placeholder="Ej: Estilista Senior"
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

                        <div className="flex justify-end gap-3 mt-8">
                            <button className="btn btn-ghost hover:bg-white/10" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


