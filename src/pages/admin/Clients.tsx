// Force Vercel rebuild
import { useState, useMemo } from 'react';
import { useClients } from '../../lib/store/queries/useClients';
import { Search, User, Phone, ChevronRight } from 'lucide-react';
import { parse, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '../../components/ui/Skeleton';
import Pagination from '../../components/Pagination';

export default function Clients() {
    const { clients: dbClients, isPending: clientsPending } = useClients();

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {isLoading ? (
                    Array(6).fill(0).map((_, i) => (
                        <div key={i} className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 p-6 rounded-2xl space-y-6">
                            <div className="flex items-center gap-5">
                                <Skeleton className="w-16 h-16 rounded-3xl" />
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Skeleton className="h-16 rounded-2xl" />
                                <Skeleton className="h-16 rounded-2xl" />
                            </div>
                            <Skeleton className="h-12 rounded-xl" />
                        </div>
                    ))
                ) : filteredClients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(client => (
                    <div key={client.phone} className="liquid-glass p-8 group hover:border-accent/40 transition-all duration-700 shadow-2xl hover:shadow-accent/10">
                        {/* Status Dots decoration */}
                        <div className="absolute top-4 right-4 flex gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent/30"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-accent/20"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-accent/10"></div>
                        </div>

                        <div className="flex items-center gap-5 mb-8 relative z-10">
                            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-slate-800 to-black flex items-center justify-center text-accent font-black text-2xl shadow-2xl border border-white/10 group-hover:scale-110 transition-transform duration-500">
                                {client.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-black text-white text-xl tracking-tighter uppercase mb-1.5">{client.name}</h3>
                                <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 tracking-[0.2em] bg-white/5 px-3 py-1 rounded-full border border-white/5">
                                    <Phone size={12} className="opacity-50" />
                                    <span>{client.phone}</span>
                                </div>
                            </div>
                        </div>

                        {/* Highlights Grid - Liquid Glass Style */}
                        <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
                            <div className="bg-white/5 backdrop-blur-2xl rounded-[2rem] p-5 border border-white/10 shadow-inner group/stat hover:bg-white/10 transition-all duration-500">
                                <span className="block text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 group-hover/stat:text-accent transition-colors">Visitas</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-black text-white tracking-tighter tabular-nums">{Number(client.totalVisits) || 0}</span>
                                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">Total</span>
                                </div>
                            </div>
                            <div className="bg-white/5 backdrop-blur-2xl rounded-[2rem] p-5 border border-white/10 shadow-inner group/stat hover:bg-emerald-500/10 transition-all duration-500">
                                <span className="block text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 group-hover/stat:text-emerald-400 transition-colors">Invertido</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-sm font-black text-emerald-500 opacity-70 mb-0.5">$</span>
                                    <span className="text-3xl font-black text-emerald-400 tracking-tighter tabular-nums">{Number(client.totalSpent) || 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Favorite Service with Premium styling */}
                        <div className="mb-8 relative z-10">
                            <div className="bg-gradient-to-br from-white/5 to-transparent rounded-3xl p-5 border border-white/10 shadow-xl overflow-hidden relative group/service">
                                <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-accent/5 to-transparent opacity-0 group-hover/service:opacity-100 transition-opacity"></div>
                                <span className="block text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-3">Servicio Preferido</span>
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_10px_rgba(var(--hue-accent),0.5)] animate-pulse-soft"></div>
                                    <span className="text-sm font-black text-white uppercase tracking-tight truncate block">
                                        {client.mainService || <span className="opacity-20 italic font-normal normal-case tracking-normal">Sin historial</span>}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-5 border-t border-white/5 relative z-10 flex items-center justify-between">
                            <div>
                                <span className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em] block mb-2">Última Actividad</span>
                                <span className="text-[10px] text-accent font-black uppercase tracking-[0.15em] bg-accent/10 px-4 py-1.5 rounded-full border border-accent/20">
                                    {client.lastVisit ? format(parse(client.lastVisit, 'yyyy-MM-dd', new Date()), 'd MMM yyyy', { locale: es }) : 'RECIÉN REGISTRADO'}
                                </span>
                            </div>
                            <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-slate-700 hover:text-white transition-colors cursor-pointer group-hover:bg-accent/10 group-hover:border-accent/20">
                                <ChevronRight size={18} />
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
