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

                        <div className="grid grid-cols-2 gap-3 mb-4 relative z-10">
                            <div className="bg-black/40 backdrop-blur-md rounded-xl p-3 border border-white/5 shadow-inner">
                                <span className="block text-[8px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Visitas</span>
                                <span className="text-xl font-black text-white tracking-tighter">{client.totalVisits}</span>
                            </div>
                            <div className="bg-black/40 backdrop-blur-md rounded-xl p-3 border border-white/5 shadow-inner">
                                <span className="block text-[8px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Invertido</span>
                                <span className="text-xl font-black text-emerald-400 tracking-tighter">${client.totalSpent}</span>
                            </div>
                        </div>

                        {/* Most Frequent Service */}
                        <div className="mb-6 relative z-10 bg-accent/5 backdrop-blur-md rounded-xl p-3 border border-accent/10 shadow-inner">
                            <span className="block text-[8px] text-accent/70 font-black uppercase tracking-[0.2em] mb-1">Servicio Favorito</span>
                            <span className="text-xs font-bold text-white truncate block">
                                {client.mainService || <span className="opacity-30 italic">Sin datos suficientes</span>}
                            </span>
                        </div>

                        <div className="pt-4 border-t border-white/5 relative z-10">
                            <div className="flex items-center justify-between">
                                <span className="text-[8px] text-slate-600 font-black uppercase tracking-[0.2em]">Última Visita</span>
                                <span className="text-[9px] text-accent font-black bg-accent/5 border border-accent/20 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                                    {client.lastVisit ? format(parse(client.lastVisit, 'yyyy-MM-dd', new Date()), 'd MMM yyyy', { locale: es }) : 'N/A'}
                                </span>
                            </div>
                        </div>

                        <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
                            <User size={80} />
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
