// Force Vercel rebuild
import { useState, useMemo } from 'react';
import { useClients } from '../../lib/store/queries/useClients';
import { Search, User, Phone } from 'lucide-react';
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
            history: []
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
                ) : filteredClients.length === 0 ? (
                    <div className="col-span-full h-64 flex flex-col items-center justify-center bg-black/20 rounded-[2rem] border border-dashed border-white/5">
                        <User size={48} className="text-slate-700 mb-4" />
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No se encontraron clientes</p>
                    </div>
                ) : filteredClients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(client => (
                    <div key={client.phone} className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 p-6 rounded-[2rem] group hover:border-accent/30 transition-all duration-500 relative overflow-hidden shadow-2xl">

                        {/* Dynamic Background Glow */}
                        <div className="absolute -left-10 -top-10 w-32 h-32 bg-accent/5 blur-[50px] rounded-full group-hover:bg-accent/10 transition-all duration-700"></div>

                        <div className="flex items-start justify-between mb-6 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-black flex items-center justify-center text-white font-black text-xl shadow-xl border border-white/10 relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
                                    <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <span className="relative z-10 text-accent">{client.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-white text-lg tracking-tight leading-none mb-1.5 uppercase">{client.name}</h3>
                                    <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 tracking-widest bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                                        <Phone size={10} className="opacity-50" />
                                        <span>{client.phone}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Highlights Grid - Enhanced Visibility */}
                        <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                            <div className="bg-gradient-to-br from-slate-800/50 to-black/50 backdrop-blur-xl rounded-3xl p-5 border border-white/5 shadow-2xl group/stat hover:border-accent/30 transition-all duration-500">
                                <span className="block text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 group-hover/stat:text-accent transition-colors">Total Visitas</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-black text-white tracking-tighter tabular-nums">{client.totalVisits || 0}</span>
                                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">Visitas</span>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-slate-800/50 to-black/50 backdrop-blur-xl rounded-3xl p-5 border border-white/5 shadow-2xl group/stat hover:border-emerald-500/30 transition-all duration-500">
                                <span className="block text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 group-hover/stat:text-emerald-400 transition-colors">Invertido</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-sm font-black text-emerald-500 opacity-70 tracking-tighter">$</span>
                                    <span className="text-3xl font-black text-emerald-400 tracking-tighter tabular-nums">{client.totalSpent || 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Favorite Service with Premium styling */}
                        <div className="mb-6 relative z-10">
                            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-inner group-hover:border-accent/20 transition-all duration-500 overflow-hidden relative">
                                {/* Service badge background decoration */}
                                <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-accent/5 to-transparent pointer-events-none"></div>
                                <span className="block text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2">Servicio Preferido</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse-soft"></div>
                                    <span className="text-sm font-black text-white uppercase tracking-tight truncate block">
                                        {client.mainService || <span className="opacity-20 italic font-normal normal-case">Sin datos previos</span>}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/5 relative z-10 flex items-center justify-between">
                            <div>
                                <span className="text-[8px] text-slate-600 font-black uppercase tracking-[0.2em] block mb-1">Última Visita</span>
                                <span className="text-[10px] text-accent font-black uppercase tracking-widest bg-accent/5 px-3 py-1 rounded-full border border-accent/20">
                                    {client.lastVisit ? format(parse(client.lastVisit, 'yyyy-MM-dd', new Date()), 'd MMM yyyy', { locale: es }) : 'RECIÉN REGISTRADO'}
                                </span>
                            </div>
                        </div>

                        <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.08] transition-all duration-700 pointer-events-none rotate-12 scale-150 transform">
                            <User size={100} />
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
