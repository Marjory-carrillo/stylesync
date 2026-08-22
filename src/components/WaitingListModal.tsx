import React, { useState } from 'react';
import { X, Users, Phone, Sparkles, Calendar, Plus, Trash2, MessageCircle, Search, Check } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { WaitingClient, Service } from '../lib/types/store.types';

interface WaitingListModalProps {
    isOpen: boolean;
    onClose: () => void;
    waitingList: WaitingClient[];
    services: Service[];
    businessName: string;
    onAdd: (client: { name: string; phone: string; date: string; serviceId: number }) => Promise<void>;
    onRemove: (id: string) => Promise<void>;
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const WaitingListModal: React.FC<WaitingListModalProps> = ({
    isOpen,
    onClose,
    waitingList,
    services,
    businessName,
    onAdd,
    onRemove,
    showToast
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        serviceId: services[0]?.id ? String(services[0].id) : '0'
    });

    if (!isOpen) return null;

    const filteredList = waitingList.filter(item => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
            (item.name && item.name.toLowerCase().includes(query)) ||
            (item.phone && item.phone.includes(query)) ||
            (item.date && item.date.includes(query))
        );
    });

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            showToast('Ingresa el nombre del cliente', 'error');
            return;
        }
        if (!formData.phone.trim() || formData.phone.replace(/\D/g, '').length < 8) {
            showToast('Ingresa un número de WhatsApp válido', 'error');
            return;
        }
        if (!formData.date) {
            showToast('Selecciona una fecha', 'error');
            return;
        }

        try {
            setIsSubmitting(true);
            await onAdd({
                name: formData.name.trim(),
                phone: formData.phone.trim(),
                date: formData.date,
                serviceId: Number(formData.serviceId) || (services[0]?.id || 0)
            });
            showToast('Cliente añadido a la lista de espera', 'success');
            setFormData({
                name: '',
                phone: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                serviceId: services[0]?.id ? String(services[0].id) : '0'
            });
            setShowAddForm(false);
        } catch (error: any) {
            showToast(error?.message || 'Error al añadir cliente', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`¿Deseas remover a "${name}" de la lista de espera?`)) return;
        try {
            await onRemove(id);
            showToast('Cliente removido de la lista', 'info');
        } catch (error: any) {
            showToast(error?.message || 'Error al remover cliente', 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* Modal Card */}
            <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-scale-in">
                {/* Header */}
                <div className="p-6 border-b border-white/10 bg-slate-900/90 backdrop-blur-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                            <Users size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-black text-white tracking-tight">Lista de Espera</h3>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 shadow-sm">
                                    {waitingList.length} {waitingList.length === 1 ? 'cliente' : 'clientes'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                Clientes esperando un espacio libre o cancelación
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowAddForm(prev => !prev)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                                showAddForm
                                    ? 'bg-white/10 text-white hover:bg-white/20'
                                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                            }`}
                        >
                            {showAddForm ? (
                                <>
                                    <X size={14} />
                                    <span>Cancelar</span>
                                </>
                            ) : (
                                <>
                                    <Plus size={14} />
                                    <span>Añadir</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Form to Add Client (Collapsible) */}
                {showAddForm && (
                    <form onSubmit={handleAddSubmit} className="p-6 bg-slate-950/60 border-b border-white/10 space-y-4 animate-slide-down">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Plus size={14} /> Nuevo Registro en Lista de Espera
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">Nombre del Cliente *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej. Sofia Gomez"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">WhatsApp (10 dígitos) *</label>
                                <input
                                    type="tel"
                                    required
                                    placeholder="Ej. 5512345678"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">Fecha Deseada *</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors scheme-dark"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 mb-1">Servicio de Interés</label>
                                <select
                                    value={formData.serviceId}
                                    onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                                >
                                    <option value="0">Cualquier servicio</option>
                                    {services.map(s => (
                                        <option key={s.id} value={String(s.id)}>
                                            {s.name} (${s.price})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowAddForm(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <span>Guardando...</span>
                                ) : (
                                    <>
                                        <Check size={14} />
                                        <span>Guardar en Lista</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}

                {/* Search Bar if items exist */}
                {waitingList.length > 3 && (
                    <div className="p-4 bg-slate-950/40 border-b border-white/5">
                        <div className="relative">
                            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, teléfono o fecha..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                            />
                        </div>
                    </div>
                )}

                {/* List Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-3">
                    {waitingList.length === 0 ? (
                        <div className="py-12 text-center flex flex-col items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                                <Users size={28} />
                            </div>
                            <h4 className="text-base font-bold text-white mb-1">No hay nadie en lista de espera</h4>
                            <p className="text-xs text-slate-400 max-w-sm mb-4">
                                Registra a clientes interesados cuando tu agenda esté llena para contactarlos en caso de cancelaciones.
                            </p>
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
                            >
                                <Plus size={14} />
                                <span>Añadir primer cliente</span>
                            </button>
                        </div>
                    ) : filteredList.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                            No se encontraron clientes que coincidan con "{searchQuery}".
                        </div>
                    ) : (
                        filteredList.map((item) => {
                            const svc = services.find(s => s.id === item.serviceId);
                            const cleanPhone = item.phone.replace(/\D/g, '');
                            let dateFormatted = item.date;
                            try {
                                const dObj = new Date(item.date + 'T12:00:00');
                                dateFormatted = format(dObj, "EEEE d 'de' MMMM", { locale: es });
                            } catch {
                                dateFormatted = item.date;
                            }

                            const whatsappMsg = encodeURIComponent(
                                `Hola ${item.name}, te contactamos de ${businessName || 'nuestro negocio'}. Vimos que estás en nuestra lista de espera para el día ${dateFormatted}. ¿Aún estás interesado en agendar tu cita?`
                            );

                            return (
                                <div
                                    key={item.id}
                                    className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-amber-500/30 transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                                >
                                    <div className="space-y-1.5 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-white text-sm tracking-tight truncate">
                                                {item.name.toUpperCase()}
                                            </span>
                                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
                                                <Calendar size={11} /> {dateFormatted}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                                            <span className="inline-flex items-center gap-1 text-slate-300 font-mono text-[11px]">
                                                <Phone size={11} className="text-emerald-400" /> {item.phone}
                                            </span>
                                            <span>•</span>
                                            <span className="inline-flex items-center gap-1 text-slate-300">
                                                <Sparkles size={11} className="text-violet-400" />
                                                {svc?.name || 'Cualquier servicio'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                        <a
                                            href={`https://wa.me/${cleanPhone}?text=${whatsappMsg}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5 shadow-sm"
                                            title="Enviar WhatsApp"
                                        >
                                            <MessageCircle size={14} />
                                            <span>Contactar</span>
                                        </a>

                                        <button
                                            onClick={() => handleDelete(item.id, item.name)}
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20 cursor-pointer"
                                            title="Eliminar de lista"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-slate-900/80 flex items-center justify-between text-xs text-slate-500">
                    <span>Total en espera: <strong className="text-slate-300">{waitingList.length}</strong></span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-colors cursor-pointer"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WaitingListModal;
