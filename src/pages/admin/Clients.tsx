// Force Vercel rebuild
import { useState, useMemo } from 'react';
import { useClients } from '../../lib/store/queries/useClients';
import { Search, User, Phone, ChevronRight, Trash2 } from 'lucide-react';
import { parse, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '../../components/ui/Skeleton';
import Pagination from '../../components/Pagination';

export default function Clients() {
    const { clients: dbClients, isPending: clientsPending, deleteClient, isDeleting } = useClients();

    const isLoading = clientsPending;
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const PAGE_SIZE = 12;

    const clients = useMemo(() => {
        return dbClients.map(c => ({
            ...c,
            history: [],
            // Asegurar valores por defecto para campos que pueden ser null
            totalVisits: Number(c.totalVisits) || 0,
            totalSpent: Number(c.totalSpent) || 0,
            lastVisit: c.lastVisit || null,
            mainService: c.mainService || null
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
            </header>

            {/* Search Bar */}
            <div className="glass-panel p-4 rounded-xl flex items-center gap-3 mb-6 border border-white/5">
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
                ) : filteredClients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(client => (
                    <div key={client.phone} className="liquid-glass p-4 group hover:border-accent/40 transition-all duration-700 shadow-lg hover:shadow-accent/10">
                        {/* Status Dots decoration */}
                        <div className="absolute top-4 right-4 flex gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent/30"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-accent/20"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-accent/10"></div>
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
                                <div className="p-2 bg-white/5 rounded-xl border border-white/5 text-slate-700 hover:text-white transition-colors cursor-pointer group-hover:bg-accent/10 group-hover:border-accent/20">
                                    <ChevronRight size={14} />
                                </div>
                            </div>
                        </div>

                        {/* Large Background Decorative Icon */}
                        <div className="absolute -bottom-6 -right-6 p-8 opacity-[0.03] group-hover:opacity-[0.1] transition-all duration-700 pointer-events-none rotate-[-15deg] scale-150 transform">
                            <User size={120} strokeWidth={1} />
                        </div>
                    </div>
                ))}
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
        </div>
    );
}
