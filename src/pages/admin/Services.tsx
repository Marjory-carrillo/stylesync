import { useState } from 'react';
import { useStore } from '../../lib/store';
import { Plus, Trash2, Edit2, X, Clock, DollarSign, Upload, ImageIcon } from 'lucide-react';

export default function Services() {
    const { services, addService, removeService, updateService, uploadServiceImage } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formName, setFormName] = useState('');
    const [formDuration, setFormDuration] = useState('');
    const [formPrice, setFormPrice] = useState('');
    const [formImage, setFormImage] = useState('');
    const [uploading, setUploading] = useState(false);

    const openAdd = () => {
        setEditingId(null);
        setFormName('');
        setFormDuration('');
        setFormPrice('');
        setFormImage('');
        setIsModalOpen(true);
    };

    const openEdit = (id: number) => {
        const svc = services.find(s => s.id === id);
        if (!svc) return;
        setEditingId(id);
        setFormName(svc.name);
        setFormDuration(String(svc.duration));
        setFormPrice(String(svc.price));
        setFormImage(svc.image || '');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formName || !formDuration || !formPrice) return;
        if (editingId !== null) {
            await updateService(editingId, { name: formName, duration: Number(formDuration), price: Number(formPrice), image: formImage });
        } else {
            await addService({ name: formName, duration: Number(formDuration), price: Number(formPrice), image: formImage });
        }
        setIsModalOpen(false);
    };

    const handleDelete = async (id: number) => {
        if (confirm('¿Estás seguro de eliminar este servicio?')) {
            await removeService(id);
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white">Servicios</h2>
                    <p className="text-sm text-muted">Administra el catálogo de servicios ofrecidos.</p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}>
                    <Plus size={20} /> <span className="hidden md:inline">Nuevo Servicio</span>
                </button>
            </div>

            <div className="glass-card overflow-hidden rounded-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="p-4 font-semibold text-white w-20">Imagen</th>
                                <th className="p-4 font-semibold text-white">Nombre</th>
                                <th className="p-4 font-semibold text-white">Duración</th>
                                <th className="p-4 font-semibold text-white">Precio</th>
                                <th className="p-4 font-semibold text-white text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {services.map(service => (
                                <tr key={service.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="p-4">
                                        <div className="w-12 h-12 rounded-lg bg-slate-800 overflow-hidden border border-white/10">
                                            <img
                                                src={service.image || 'https://via.placeholder.com/40?text=?'}
                                                alt=""
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/40?text=?'; }}
                                            />
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-white">{service.name}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-muted">
                                            <Clock size={16} />
                                            <span>{service.duration} min</span>
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
                                            <button className="p-2 hover:bg-white/10 rounded-full text-muted hover:text-white transition-colors" title="Editar" onClick={() => openEdit(service.id)}>
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                className="p-2 hover:bg-red-500/20 rounded-full text-muted hover:text-red-500 transition-colors"
                                                title="Eliminar"
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


