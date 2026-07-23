import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useImageUpload } from '../../lib/store/queries/useImageUpload';
import { useServices } from '../../lib/store/queries/useServices';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useCatalog, MAX_CATALOG_IMAGES_PER_SERVICE } from '../../lib/store/queries/useCatalog';
import { Plus, Trash2, Edit2, X, Clock, DollarSign, Upload, ImageIcon, Images, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';
import ConfirmModal from '../../components/ConfirmModal';
import PlaceholderSVG from '../../assets/placeholder-service.svg';
import { serviceSchema } from '../../lib/schemas';

// ── Sub-componente: Galería de un servicio ────────────────────────────────
function ServiceCatalogGallery({ serviceId }: { serviceId: number }) {
    const { uploadCatalogImage } = useImageUpload();
    const { items, addItem, removeItem, updateItem, isAdding } = useCatalog(serviceId);
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
    const [uploadingIdx, setUploadingIdx] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const canAddMore = items.length < MAX_CATALOG_IMAGES_PER_SERVICE;

    const handleFiles = async (files: FileList) => {
        const remaining = MAX_CATALOG_IMAGES_PER_SERVICE - items.length;
        const toUpload = Array.from(files).slice(0, remaining);
        setUploadingIdx(true);
        for (const file of toUpload) {
            const url = await uploadCatalogImage(file);
            if (url) {
                await addItem({ imageUrl: url, serviceId });
            }
        }
        setUploadingIdx(false);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 font-medium">
                    <span className="text-white font-bold">{items.length}</span> / {MAX_CATALOG_IMAGES_PER_SERVICE} fotos
                </p>
                {canAddMore && (
                    <label className={`cursor-pointer flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                        uploadingIdx || isAdding
                            ? 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                            : 'bg-accent/10 border-accent/30 text-accent hover:bg-accent/20'
                    }`}>
                        {uploadingIdx || isAdding ? (
                            <><Loader2 size={12} className="animate-spin" /> Subiendo...</>
                        ) : (
                            <><Upload size={12} /> Subir fotos</>
                        )}
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={uploadingIdx || isAdding || !canAddMore}
                            onChange={e => e.target.files && handleFiles(e.target.files)}
                        />
                    </label>
                )}
            </div>

            {items.length === 0 ? (
                <div
                    className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-accent/40 transition-colors group"
                    onClick={() => fileRef.current?.click()}
                >
                    <Images size={28} className="mx-auto text-slate-600 group-hover:text-accent transition-colors mb-2" />
                    <p className="text-xs text-slate-500">Toca para subir fotos de diseños</p>
                    <p className="text-[10px] text-slate-600 mt-1">Hasta {MAX_CATALOG_IMAGES_PER_SERVICE} imágenes · JPG, PNG, WEBP</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {items.map(item => (
                        <div key={item.id} className="flex gap-3 p-3 bg-white/[0.02] border border-white/10 rounded-xl items-center">
                            {/* Imagen */}
                            <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/5 shrink-0 bg-slate-900">
                                <img src={item.imageUrl} alt="Diseño" className="w-full h-full object-cover" />
                            </div>

                            {/* Inputs Modificables Inline */}
                            <div className="flex-1 space-y-1.5 min-w-0">
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        defaultValue={item.price ? String(item.price) : ''}
                                        id={`price-${item.id}`}
                                        placeholder="Precio ($)"
                                        className="w-20 bg-slate-900/50 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-accent"
                                    />
                                    <input
                                        type="text"
                                        defaultValue={item.description || ''}
                                        id={`desc-${item.id}`}
                                        placeholder="Descripción / Notas..."
                                        className="flex-1 bg-slate-900/50 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-accent"
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const priceVal = (document.getElementById(`price-${item.id}`) as HTMLInputElement)?.value;
                                            const descVal = (document.getElementById(`desc-${item.id}`) as HTMLInputElement)?.value;
                                            await updateItem({
                                                id: item.id,
                                                description: descVal ?? '',
                                                price: priceVal ? Number(priceVal) : null
                                            });
                                        }}
                                        className="px-2.5 py-1 bg-violet-500/20 border border-violet-500/30 hover:bg-violet-500/30 text-violet-300 font-bold rounded-lg text-[9px] transition-colors"
                                    >
                                        Guardar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmRemove(item.id)}
                                        className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 font-bold rounded-lg text-[9px] transition-colors"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmModal
                isOpen={!!confirmRemove}
                title="Eliminar foto"
                message="¿Eliminar esta foto del catálogo? Esta acción no se puede deshacer."
                confirmLabel="Eliminar"
                danger
                onConfirm={async () => {
                    if (confirmRemove) await removeItem(confirmRemove);
                    setConfirmRemove(null);
                }}
                onCancel={() => setConfirmRemove(null)}
            />
        </div>
    );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function Services() {
    const { t } = useTranslation();
    const { uploadServiceImage } = useImageUpload();
    const { services, addService, removeService, updateService, isLoading } = useServices();
    const { data: tenantConfig } = useTenantData();
    const businessConfig = tenantConfig || {} as any;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formName, setFormName] = useState('');
    const [formDuration, setFormDuration] = useState('');
    const [formPrice, setFormPrice] = useState('');
    const [formPriceType, setFormPriceType] = useState<'fixed' | 'no_price' | 'range'>('fixed');
    const [formMinPrice, setFormMinPrice] = useState('');
    const [formMaxPrice, setFormMaxPrice] = useState('');
    const [formImage, setFormImage] = useState('');
    const [formIsAddon, setFormIsAddon] = useState(false);
    const [formEnableQuoter, setFormEnableQuoter] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
    const [formError, setFormError] = useState<string | null>(null);
    const [expandedCatalog, setExpandedCatalog] = useState<number | null>(null);

    const openAdd = () => {
        setFormError(null);
        setEditingId(null);
        setFormName('');
        setFormDuration('');
        setFormPrice('');
        setFormPriceType('fixed');
        setFormMinPrice('');
        setFormMaxPrice('');
        setFormImage('');
        setFormIsAddon(false);
        setFormEnableQuoter(false);
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
        setFormPriceType(svc.priceType || 'fixed');
        setFormMinPrice(svc.minPrice !== undefined ? String(svc.minPrice) : '');
        setFormMaxPrice(svc.maxPrice !== undefined ? String(svc.maxPrice) : '');
        setFormImage(svc.image || '');
        setFormIsAddon(svc.isAddon ?? false);
        setFormEnableQuoter(svc.enableQuoter ?? false);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        const calculatedPrice = formPriceType === 'no_price' ? 0 : (formPriceType === 'range' ? (Number(formMinPrice) || 0) : (Number(formPrice) || 0));

        const result = serviceSchema.safeParse({
            name: formName,
            duration: Number(formDuration),
            price: calculatedPrice,
            priceType: formPriceType,
            minPrice: formPriceType === 'range' ? (Number(formMinPrice) || 0) : undefined,
            maxPrice: formPriceType === 'range' ? (Number(formMaxPrice) || 0) : undefined,
            image: formImage || '',
            isAddon: formIsAddon,
            enableQuoter: formEnableQuoter,
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
                                <th className="p-4 font-semibold text-white text-center">Galería</th>
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
                                        <td className="p-4"><Skeleton className="h-8 w-16 mx-auto rounded-full" /></td>
                                    </tr>
                                ))
                            ) : services.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-muted">
                                        No hay servicios registrados. Click en "Nuevo Servicio" para empezar.
                                    </td>
                                </tr>
                            ) : services.map(service => (
                                <>
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
                                            {service.priceType === 'no_price' ? (
                                                <span className="inline-flex py-0.5 px-2.5 rounded-full font-bold text-[11px] bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                                                    A cotizar
                                                </span>
                                            ) : service.priceType === 'range' ? (
                                                <span className="font-bold text-purple-300 text-sm">
                                                    ${service.minPrice} - ${service.maxPrice}
                                                </span>
                                            ) : (
                                                <div className="font-bold text-accent flex items-center gap-1">
                                                    <DollarSign size={16} />
                                                    <span>{service.price}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => setExpandedCatalog(expandedCatalog === service.id ? null : service.id)}
                                                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                                                    expandedCatalog === service.id
                                                        ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                                                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                                                }`}
                                            >
                                                <Images size={13} />
                                                <span className="hidden sm:inline">Galería</span>
                                                {expandedCatalog === service.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                            </button>
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

                                    {/* ── Catalog Gallery Row ── */}
                                    {expandedCatalog === service.id && (
                                        <tr key={`catalog-${service.id}`} className="bg-white/[0.02]">
                                            <td colSpan={6} className="px-4 pb-5 pt-3">
                                                <div className="border border-white/10 rounded-2xl p-4 bg-slate-950/30">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Images size={15} className="text-violet-400" />
                                                        <p className="text-xs font-bold text-white uppercase tracking-wider">
                                                            Galería de Diseños — {service.name}
                                                        </p>
                                                        <span className="text-[10px] text-slate-500 ml-auto">
                                                            Estas fotos son visibles para las clientas en la app de reservas
                                                        </span>
                                                    </div>
                                                    <ServiceCatalogGallery serviceId={service.id} />
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
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

                            {/* Tipo de Precio Selector */}
                            <div>
                                <label className="text-sm font-medium text-muted mb-2 block">Tipo de Precio</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormPriceType('fixed')}
                                        className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all ${formPriceType === 'fixed' ? 'bg-accent/15 border-accent text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}
                                    >
                                        Precio Fijo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormPriceType('no_price')}
                                        className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all ${formPriceType === 'no_price' ? 'bg-cyan-400/15 border-cyan-400 text-cyan-300' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}
                                    >
                                        Sin Precio (A cotizar)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormPriceType('range')}
                                        className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all ${formPriceType === 'range' ? 'bg-purple-400/15 border-purple-400 text-purple-300' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}
                                    >
                                        Rango Precios
                                    </button>
                                </div>
                            </div>

                            {formPriceType === 'fixed' && (
                                <div>
                                    <label className="text-sm font-medium text-muted mb-1 block">Precio ($ MXN)</label>
                                    <input
                                        type="number"
                                        value={formPrice}
                                        onChange={e => setFormPrice(e.target.value)}
                                        placeholder="250"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                            )}

                            {formPriceType === 'no_price' && (
                                <div className="p-3 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-xs text-cyan-200">
                                    💡 Se ocultará el precio en la app de cliente. La profesional registrará el monto cobrado al finalizar la cita.
                                </div>
                            )}

                            {formPriceType === 'range' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium text-muted mb-1 block">Precio Mínimo ($)</label>
                                        <input
                                            type="number"
                                            value={formMinPrice}
                                            onChange={e => setFormMinPrice(e.target.value)}
                                            placeholder="300"
                                            className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-muted mb-1 block">Precio Máximo ($)</label>
                                        <input
                                            type="number"
                                            value={formMaxPrice}
                                            onChange={e => setFormMaxPrice(e.target.value)}
                                            placeholder="600"
                                            className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent transition-colors"
                                        />
                                    </div>
                                </div>
                            )}
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

                            {/* enableQuoter Toggle (Only for Nail Bars) */}
                            {businessConfig.category === 'nail_bar' && !formIsAddon && (
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    <label className="flex items-start justify-between cursor-pointer group">
                                        <div>
                                            <div className="font-medium text-white group-hover:text-accent transition-colors">Activar Cotizador de Uñas</div>
                                            <div className="text-xs text-muted mt-1 w-5/6">
                                                Activa la calculadora interactiva (técnica, largo, estilos, cristales) para este servicio en la app de reservas.
                                            </div>
                                        </div>
                                        <div className="relative inline-flex items-center h-6 w-11 rounded-full flex-shrink-0 transition-colors duration-200 mt-1" style={{ backgroundColor: formEnableQuoter ? 'var(--color-accent)' : '#334155' }}>
                                            <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={formEnableQuoter}
                                                onChange={(e) => setFormEnableQuoter(e.target.checked)}
                                            />
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${formEnableQuoter ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </div>
                                    </label>
                                </div>
                            )}
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
