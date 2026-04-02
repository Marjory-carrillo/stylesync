import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useImageUpload } from '../../lib/store/queries/useImageUpload';
import { useServices } from '../../lib/store/queries/useServices';
import { Plus, Trash2, Edit2, X, Clock, DollarSign, Upload, ImageIcon } from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';
import ConfirmModal from '../../components/ConfirmModal';
import PlaceholderSVG from '../../assets/placeholder-service.svg';
import { serviceSchema } from '../../lib/schemas';

export default function Services() {
    const { t } = useTranslation();
    const { uploadServiceImage } = useImageUpload();
    const { services, addService, removeService, updateService, isLoading } = useServices();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formName, setFormName] = useState('');
    const [formDuration, setFormDuration] = useState('');
    const [formPrice, setFormPrice] = useState('');
    const [formImage, setFormImage] = useState('');
    const [formIsAddon, setFormIsAddon] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
    const [formError, setFormError] = useState<string | null>(null);

    const openAdd = () => {
        setFormError(null);
        setEditingId(null);
        setFormName('');
        setFormDuration('');
        setFormPrice('');
        setFormImage('');
        setFormIsAddon(false);
        setIsModalOpen(true);
    };

    const openEdit = (id: number) => {
        const svc = services.find(s => s.id === id);
        if (!svc) return;
        setFormError(null);
        setEditingId(id);
        setFormName(svc.name);
        setFormDuration(String(svc.duration));
        setFormPrice(String(svc.price));
        setFormImage(svc.image || '');
        setFormIsAddon(svc.isAddon ?? false);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        const result = serviceSchema.safeParse({
            name: formName,
            duration: Number(formDuration),
            price: Number(formPrice),
            image: formImage || '',
            isAddon: formIsAddon,
        });

        if (!result.success) {
            setFormError(result.error.issues[0].message);
            return;
        }
        setFormError(null);

        if (editingId !== null) {
            await updateService({ id: editingId, data: result.data });
        } else {
            await addService(result.data);
        }
        setIsModalOpen(false);
    };

    const handleDelete = (id: number) => {
        setConfirmDelete({ open: true, id });
    };

    const confirmDeleteAction = async () => {
        if (confirmDelete.id !== null) {
            await removeService(confirmDelete.id);
        }
        setConfirmDelete({ open: false, id: null });
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        {t('services.title')}
                    </h2>
                    <p className="text-sm text-muted">Administra el catálogo de servicios ofrecidos.</p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}>
                    <Plus size={20} /> <span className="hidden md:inline">{t('services.new_service')}</span>
                </button>
            </div>

            <div className="glass-card overflow-hidden rounded-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="p-4 font-semibold text-white w-20">Imagen</th>
                                <th className="p-4 font-semibold text-white">{t('services.table.name')}</th>
                                <th className="p-4 font-semibold text-white">{t('services.table.duration')}</th>
                                <th className="p-4 font-semibold text-white">{t('services.table.price')}</th>
                                <th className="p-4 font-semibold text-white text-center">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="p-4"><Skeleton className="w-12 h-12 rounded-lg" /></td>
                                        <td className="p-4"><Skeleton className="h-4 w-32" /></td>
                                        <td className="p-4"><Skeleton className="h-4 w-20" /></td>
                                        <td className="p-4"><Skeleton className="h-4 w-16" /></td>
                                        <td className="p-4"><Skeleton className="h-8 w-16 mx-auto rounded-full" /></td>
                                    </tr>
                                ))
                            ) : services.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-muted">
                                        No hay servicios registrados. Click en "Nuevo Servicio" para empezar.
                                    </td>
                                </tr>
                            ) : services.map(service => (
                                <tr key={service.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-4">
                                        <div className="w-12 h-12 rounded-lg bg-slate-800 overflow-hidden border border-white/10">
                                            <img
                                                src={service.image || PlaceholderSVG}
                                                alt=""
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.currentTarget.src = PlaceholderSVG; }}
                                            />
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-white mb-1">{service.name}</div>
                                        {service.isAddon && (
                                            <span className="inline-flex py-0.5 px-2 rounded font-bold text-[10px] uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                                Servicio Adicional
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-muted">
                                            <Clock size={16} />
                                            <span>{service.duration} {t('services.table.min')}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-accent flex items-center gap-1">
                                            <DollarSign size={16} />
                                            <span>{service.price}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-2 justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 hover:bg-white/10 rounded-full text-muted hover:text-white transition-colors" title="Editar" aria-label="Editar" onClick={() => openEdit(service.id)}>
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                className="p-2 hover:bg-red-500/20 rounded-full text-muted hover:text-red-500 transition-colors"
                                                title="Eliminar"
                                                aria-label="Eliminar"
                                                onClick={() => handleDelete(service.id)}
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                    <div className="glass-panel w-full max-w-md p-6 rounded-xl animate-fade-in" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">{editingId ? 'Editar' : 'Nuevo'} Servicio</h3>
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
                                    placeholder="Ej: Corte de Cabello"
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent transition-colors"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-muted mb-1 block">Duración (min)</label>
                                    <input
                                        type="number"
                                        value={formDuration}
                                        onChange={e => setFormDuration(e.target.value)}
                                        placeholder="30"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted mb-1 block">Precio ($)</label>
                                    <input
                                        type="number"
                                        value={formPrice}
                                        onChange={e => setFormPrice(e.target.value)}
                                        placeholder="25"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted mb-1 block">Imagen del Servicio</label>
                                <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/10">
                                    <div className="w-16 h-16 rounded-lg bg-black/20 flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
                                        {formImage ? (
                                            <img src={formImage} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <ImageIcon className="text-muted" size={24} />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex gap-2">
                                            <label className="btn btn-secondary py-2 text-sm cursor-pointer flex items-center gap-2">
                                                <Upload size={16} />
                                                {uploading ? 'Subiendo...' : 'Subir Imagen'}
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        setUploading(true);
                                                        const url = await uploadServiceImage(file);
                                                        if (url) setFormImage(url);
                                                        setUploading(false);
                                                    }}
                                                    disabled={uploading}
                                                />
                                            </label>
                                            {formImage && (
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost hover:bg-red-500/10 hover:text-red-500 p-2"
                                                    onClick={() => setFormImage('')}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* isAddon Toggle */}
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                <label className="flex items-start justify-between cursor-pointer group">
                                    <div>
                                        <div className="font-medium text-white group-hover:text-accent transition-colors">Servicio Adicional (Extra)</div>
                                        <div className="text-xs text-muted mt-1 w-5/6">
                                            Actívalo si este servicio no se puede agendar solo, sino que se ofrece como un "extra" a otro servicio principal.
                                        </div>
                                    </div>
                                    <div className="relative inline-flex items-center h-6 w-11 rounded-full flex-shrink-0 transition-colors duration-200 mt-1" style={{ backgroundColor: formIsAddon ? 'var(--color-accent)' : '#334155' }}>
                                        <input 
                                            type="checkbox" 
                                            className="sr-only" 
                                            checked={formIsAddon}
                                            onChange={(e) => setFormIsAddon(e.target.checked)}
                                        />
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${formIsAddon ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <button className="btn btn-ghost hover:bg-white/10" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleSave}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmDelete.open}
                title="Eliminar Servicio"
                message="¿Estás seguro de que deseas eliminar este servicio? Esta acción no se puede deshacer y el servicio ya no estará disponible para nuevas reservas."
                confirmLabel="Eliminar"
                onConfirm={confirmDeleteAction}
                onCancel={() => setConfirmDelete({ open: false, id: null })}
                danger
            />
        </div>
    );
}


