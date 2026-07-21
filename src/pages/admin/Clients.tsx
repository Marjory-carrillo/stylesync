// Force Vercel rebuild
import { useState, useMemo } from 'react';
import { useClients } from '../../lib/store/queries/useClients';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { Search, User, Phone, ChevronRight, Trash2, MessageCircle, Plus, Check, Copy } from 'lucide-react';
import { parse, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '../../components/ui/Skeleton';
import Pagination from '../../components/Pagination';
import { ClientHistoryModal } from '../../components/ClientHistoryModal';

export default function Clients() {
    const { clients: dbClients, isPending: clientsPending, deleteClient, isDeleting, createClient, isCreating } = useClients();
    const { data: tenant } = useTenantData();

    const isLoading = clientsPending;
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [historyModal, setHistoryModal] = useState<{ open: boolean; phone: string }>({ open: false, phone: '' });

    // Modales y formularios
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');

    const tenantName = tenant?.name || '';
    const bookingUrl = useMemo(() => {
        if (!tenant?.slug) return '';
        return `${window.location.origin}/reserva/${tenant.slug}`;
    }, [tenant?.slug]);

    const invitationTemplate = useMemo(() => {
        return `¡Hola! Te compartimos nuestro nuevo sistema de reservas en línea. Ahora puedes agendar tus citas al instante en el siguiente enlace:\n\n🔗 ${bookingUrl}\n\nEs rápido, cómodo y puedes elegir a tu profesional y horario favorito. ¡Te esperamos en ${tenantName}!`;
    }, [bookingUrl, tenantName]);

    const [isCopiedTemplate, setIsCopiedTemplate] = useState(false);
    const handleCopyTemplate = () => {
        navigator.clipboard.writeText(invitationTemplate);
        setIsCopiedTemplate(true);
        setTimeout(() => setIsCopiedTemplate(false), 2000);
    };

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClientName.trim() || !newClientPhone.trim()) return;

        try {
            await createClient({ name: newClientName, phone: newClientPhone });
            setNewClientName('');
            setNewClientPhone('');
            setIsAddModalOpen(false);
        } catch (err) {
            // Error managed in useClients hook
        }
    };

    const PAGE_SIZE = 12;

    const clients = useMemo(() => {
        return dbClients.map(c => ({
            ...c,
            history: [],
            // Asegurar valores por defecto para campos que pueden ser null
            totalVisits: Number(c.totalVisits) || 0,
            totalSpent: Number(c.totalSpent) || 0,
            lastVisit: c.lastVisit || null,
            mainService: c.mainService || null,
            noShowCount: Number(c.noShowCount) || 0
        }));
    }, [dbClients]);

    const filteredClients = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return clients.filter(c =>
            c.name.toLowerCase().includes(lowerSearch) ||
            c.phone.includes(lowerSearch)
        );
    }, [clients, searchTerm]);

    return (
        <div className="animate-fade-in space-y-6">
            <header className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white mb-1">Clientes</h2>
                    <p className="text-muted">Gestión e historial de tus {filteredClients.length} clientes activos.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wide transition-all shadow-lg shadow-violet-500/10 flex items-center gap-2"
                >
                    <Plus size={14} /> Registrar Cliente
                </button>
            </header>

            {/* Launch Campaign / Invitation Card */}
            <div className="glass-panel p-5 bg-gradient-to-br from-violet-600/10 via-slate-900 to-slate-900 border border-violet-500/20 rounded-2xl relative overflow-hidden">
                <div className="relative z-10 space-y-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-[10px] font-black uppercase tracking-wider border border-violet-500/20">
                        📢 Campaña de Lanzamiento
                    </span>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight mt-1.5">Anuncia tu Link de Reservas</h3>
                    <p className="text-slate-400 text-xs max-w-2xl leading-relaxed">
                        Copia esta plantilla de invitación y compártela en tus redes sociales (Instagram, Facebook) o WhatsApp para que tus clientes comiencen a agendar solos.
                    </p>
                </div>

                <div className="bg-black/35 border border-white/[0.04] p-4 rounded-xl text-slate-300 text-xs mt-4 leading-relaxed font-mono relative pr-12">
                    <p className="whitespace-pre-wrap">{invitationTemplate}</p>
                    <button
                        onClick={handleCopyTemplate}
                        className="absolute right-3 top-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                        title="Copiar plantilla"
                    >
                        {isCopiedTemplate ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="glass-panel p-4 rounded-xl flex items-center gap-3 border border-white/5">
                <Search className="text-muted" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por nombre o teléfono..."
                    className="bg-transparent border-none outline-none text-white w-full placeholder:text-slate-500 focus:ring-0"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                    }}
                />
            </div>

            {/* Clients Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {isLoading ? (
                    Array(4).fill(0).map((_, i) => (
                        <div key={i} className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 p-4 rounded-2xl space-y-3">
                            <div className="flex items-center gap-3">
                                <Skeleton className="w-10 h-10 rounded-2xl" />
                                <div className="space-y-1.5">
                                    <Skeleton className="h-4 w-28" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <Skeleton className="h-10 rounded-xl" />
                                <Skeleton className="h-10 rounded-xl" />
                            </div>
                            <Skeleton className="h-8 rounded-lg" />
                        </div>
                    ))
                ) : filteredClients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(client => {
                    const isBlocked = client.noShowCount > 0;
                    return (
                    <div key={client.phone} className="liquid-glass p-4 group hover:border-accent/40 transition-all duration-700 shadow-lg hover:shadow-accent/10">
                        {/* Status Dots decoration */}
                        <div className="absolute top-4 right-4 flex gap-1.5">
                            {isBlocked ? (
                                <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[9px] font-black tracking-widest border border-red-500/20">
                                    BLOQUEADO ({client.noShowCount})
                                </span>
                            ) : (
                                <>
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent/30"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent/20"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent/10"></div>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-3 mb-3 relative z-10">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-black flex items-center justify-center text-accent font-black text-lg shadow-xl border border-white/10 group-hover:scale-110 transition-transform duration-500">
                                {client.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-black text-white text-sm tracking-tighter uppercase leading-tight">{client.name}</h3>
                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 tracking-wider mt-0.5">
                                    <Phone size={9} className="opacity-50" />
                                    <span>{client.phone}</span>
                                </div>
                            </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-2 gap-2 mb-3 relative z-10">
                            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                                <span className="block text-[8px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Visitas</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-lg font-black text-white tracking-tighter tabular-nums">{Number(client.totalVisits) || 0}</span>
                                    <span className="text-[8px] text-slate-600 font-bold uppercase">Total</span>
                                </div>
                            </div>
                            <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                                <span className="block text-[8px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Invertido</span>
                                <div className="flex items-baseline gap-0.5">
                                    <span className="text-xs font-black text-emerald-500 opacity-70">$</span>
                                    <span className="text-lg font-black text-emerald-400 tracking-tighter tabular-nums">{Number(client.totalSpent) || 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Favorite Service */}
                        <div className="mb-3 relative z-10">
                            <div className="bg-white/5 rounded-xl px-3 py-2 border border-white/5 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft shrink-0"></div>
                                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest shrink-0">Servicio:</span>
                                <span className="text-xs font-black text-white uppercase tracking-tight truncate">
                                    {client.mainService || <span className="opacity-30 italic font-normal normal-case tracking-normal">Sin historial</span>}
                                </span>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-white/5 relative z-10 flex items-center justify-between">
                            <span className="text-[8px] text-accent font-black uppercase tracking-widest bg-accent/10 px-2.5 py-1 rounded-full border border-accent/15">
                                {client.lastVisit ? format(parse(client.lastVisit, 'yyyy-MM-dd', new Date()), 'd MMM yyyy', { locale: es }) : 'RECIÉN REG.'}
                            </span>
                            <div className="flex items-center gap-2">
                                {bookingUrl && (
                                    <a
                                        href={`https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                            `¡Hola ${client.name}! Te compartimos el nuevo sistema de reservas en línea de ${tenantName || 'nuestro negocio'}. Puedes agendar tu cita al instante aquí:\n\n🔗 ${bookingUrl}\n\n¡Te esperamos!`
                                        )}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/20 transition-all flex items-center justify-center"
                                        title="Invitar por WhatsApp"
                                    >
                                        <MessageCircle size={14} />
                                    </a>
                                )}
                                <button
                                    onClick={() => {
                                        if (window.confirm(`¿Estás seguro de que quieres eliminar a ${client.name}? Esta acción no se puede deshacer.`)) {
                                            deleteClient(client.id);
                                        }
                                    }}
                                    disabled={isDeleting}
                                    className="p-2 bg-red-500/5 hover:bg-red-500/20 text-red-500/40 hover:text-red-500 rounded-xl border border-white/5 hover:border-red-500/30 transition-all"
                                    title="Eliminar cliente"
                                >
                                    <Trash2 size={14} />
                                </button>
                                <button
                                    onClick={() => setHistoryModal({ open: true, phone: client.phone })}
                                    className="p-2 bg-white/5 rounded-xl border border-white/5 text-slate-700 hover:text-white transition-colors cursor-pointer group-hover:bg-accent/10 group-hover:border-accent/20"
                                    title="Ver historial"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Large Background Decorative Icon */}
                        <div className="absolute -bottom-6 -right-6 p-8 opacity-[0.03] group-hover:opacity-[0.1] transition-all duration-700 pointer-events-none rotate-[-15deg] scale-150 transform">
                            <User size={120} strokeWidth={1} />
                        </div>
                    </div>
                )})}
            </div>

            {filteredClients.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={Math.ceil(filteredClients.length / PAGE_SIZE)}
                    onPageChange={setCurrentPage}
                />
            )}

            {filteredClients.length === 0 && (
                <div className="py-20 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-muted">
                        <User size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No se encontraron clientes</h3>
                    <p className="text-muted">Intenta con otro término de búsqueda.</p>
                </div>
            )}

            <ClientHistoryModal
                isOpen={historyModal.open}
                onClose={() => setHistoryModal({ open: false, phone: '' })}
                clientPhone={historyModal.phone}
            />

            {/* Modal de Registro Manual de Clientes */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
                    <div className="relative w-full max-w-md bg-[#0a0f1a] border border-white/10 rounded-2xl p-6 shadow-2xl animate-scale-in flex flex-col">
                        <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4">
                            Registrar Nuevo Cliente
                        </h3>

                        <form onSubmit={handleCreateClient} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre Completo</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                    value={newClientName}
                                    onChange={e => setNewClientName(e.target.value)}
                                    placeholder="Ej. Juan Pérez"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teléfono / WhatsApp</label>
                                <input
                                    type="tel"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40"
                                    value={newClientPhone}
                                    onChange={e => setNewClientPhone(e.target.value)}
                                    placeholder="Ej. 3312345678"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNewClientName('');
                                        setNewClientPhone('');
                                        setIsAddModalOpen(false);
                                    }}
                                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-xs uppercase transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-2"
                                >
                                    {isCreating ? 'Registrando...' : 'Registrar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
