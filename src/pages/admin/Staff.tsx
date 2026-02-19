
import { useState } from 'react';
import { useStore } from '../../lib/store';
import { User, Phone, Plus, Edit2, Trash2, X } from 'lucide-react';

export default function Staff() {
    const { stylists, addStylist, removeStylist, updateStylist } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [formName, setFormName] = useState('');
    const [formRole, setFormRole] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formImage, setFormImage] = useState('');

    const openAdd = () => {
        setEditingId(null);
        setFormName('');
        setFormRole('');
        setFormPhone('');
        setFormImage('');
        setIsModalOpen(true);
    };

    const openEdit = (id: number) => {
        const stylist = stylists.find(s => s.id === id);
        if (!stylist) return;
        setEditingId(id);
        setFormName(stylist.name);
        setFormRole(stylist.role);
        setFormPhone(stylist.phone);
        setFormImage(stylist.image || '');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formName || !formRole) return;

        const data = {
            name: formName,
            role: formRole,
            phone: formPhone,
            image: formImage
        };

        if (editingId !== null) {
            await updateStylist(editingId, data);
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
                    <h2 className="text-2xl font-bold text-white">Equipo</h2>
                    <p className="text-sm text-muted">Gestiona a tus estilistas y personal.</p>
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
                            <p className="text-accent text-sm font-medium mb-4">{person.role}</p>

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
                                <label className="text-sm font-medium text-muted mb-1 block">URL de Foto</label>
                                <input
                                    type="text"
                                    value={formImage}
                                    onChange={e => setFormImage(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent transition-colors"
                                />
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


