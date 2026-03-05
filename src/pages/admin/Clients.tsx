import { useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { Search, User, Phone } from 'lucide-react';
import { parse, format } from 'date-fns';
import { es } from 'date-fns/locale';
import Pagination from '../../components/Pagination';

interface ClientStats {
    phone: string;
    name: string;
    totalVisits: number;
    totalSpent: number;
    lastVisit: string;
    history: { date: string; serviceName: string; price: number }[];
}

export default function Clients() {
    const { clients: dbClients, appointments, services, updateClientNotes, updateClientTags } = useStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [editingNotes, setEditingNotes] = useState<string | null>(null);
    const [tempNotes, setTempNotes] = useState('');

    const PAGE_SIZE = 12;

    const clients = useMemo(() => {
        const clientMap = new Map<string, ClientStats>();

        // Sort appointments by date desc to get latest name/visit first if we iterate
        // Actually, let's just iterate and build.
        const sortedAppts = [...appointments].sort((a, b) =>
            new Date(b.date + 'T' + b.time).getTime() - new Date(a.date + 'T' + a.time).getTime()
        );

        sortedAppts.forEach(appt => {
            if (appt.status === 'cancelada') return;

            const service = services.find(s => s.id === appt.serviceId);
            const price = service?.price || 0;
            const serviceName = service?.name || 'Servicio eliminado';

            if (!clientMap.has(appt.clientPhone)) {
                clientMap.set(appt.clientPhone, {
                    phone: appt.clientPhone,
                    name: appt.clientName, // Most recent due to sort
                    totalVisits: 0,
                    totalSpent: 0,
                    lastVisit: appt.date,
                    history: []
                });
            }

            const client = clientMap.get(appt.clientPhone)!;
            client.totalVisits += 1;
            client.totalSpent += price;
            // Keep history limited or full? Let's keep full for now, slice later.
            client.history.push({ date: appt.date, serviceName, price });
        });

        return Array.from(clientMap.values()).map(visitStats => {
            const dbRef = dbClients.find(c => c.phone === visitStats.phone);
            return {
                ...visitStats,
                id: dbRef?.id || '',
                name: dbRef?.name || visitStats.name, // base name on DB if available
                notes: dbRef?.notes || '',
                tags: dbRef?.tags || []
            };
        });
    }, [appointments, services, dbClients]);

    const filteredClients = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        return clients.filter(c =>
            c.name.toLowerCase().includes(lowerSearch) ||
            c.phone.includes(lowerSearch) ||
            c.tags.some(t => t.toLowerCase().includes(lowerSearch))
        );
    }, [clients, searchTerm]);

    const handleSaveNotes = async (id: string) => {
        if (!id) return;
        await updateClientNotes(id, tempNotes);
        setEditingNotes(null);
    };

    const toggleTag = async (clientId: string, tags: string[], tag: string) => {
        if (!clientId) return;
        const newTags = tags.includes(tag)
            ? tags.filter(t => t !== tag)
            : [...tags, tag];
        await updateClientTags(clientId, newTags);
    };

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
                {filteredClients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(client => (
                    <div key={client.phone} className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 p-8 rounded-[2.5rem] group hover:border-accent/30 transition-all duration-500 relative overflow-hidden shadow-2xl">

                        {/* Dynamic Background Glow */}
                        <div className="absolute -left-10 -top-10 w-32 h-32 bg-accent/5 blur-[50px] rounded-full group-hover:bg-accent/10 transition-all duration-700"></div>

                        <div className="flex items-start justify-between mb-8 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-slate-800 to-black flex items-center justify-center text-white font-black text-2xl shadow-xl border border-white/10 relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
                                    <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <span className="relative z-10 text-accent">{client.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-white text-xl tracking-tight leading-none mb-2 uppercase">{client.name}</h3>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 tracking-widest bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                                        <Phone size={12} className="opacity-50" />
                                        <span>{client.phone}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
                            <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/5 shadow-inner">
                                <span className="block text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Visitas</span>
                                <span className="text-2xl font-black text-white tracking-tighter">{client.totalVisits}</span>
                            </div>
                            <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/5 shadow-inner">
                                <span className="block text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1">Invertido</span>
                                <span className="text-2xl font-black text-emerald-400 tracking-tighter">${client.totalSpent}</span>
                            </div>
                        </div>

                        {/* Interactive Tags */}
                        {client.id && (
                            <div className="mb-6 relative z-10">
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600 block mb-3 pl-1">CLASIFICACIÓN</span>
                                <div className="flex flex-wrap gap-2">
                                    {['VIP', 'Frecuente', 'Nuevo'].map(tag => {
                                        const isActive = client.tags.includes(tag);
                                        return (
                                            <button
                                                key={tag}
                                                onClick={() => toggleTag(client.id, client.tags, tag)}
                                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all duration-300 uppercase tracking-widest ${isActive
                                                    ? 'bg-accent text-white border-transparent shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]'
                                                    : 'bg-white/5 text-slate-500 border-white/5 hover:border-white/20 hover:text-white'
                                                    }`}
                                            >
                                                {tag}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Notes Section */}
                        {client.id && (
                            <div className="mb-8 relative z-10 bg-black/30 backdrop-blur-md rounded-[1.5rem] p-4 border border-white/5 shadow-inner">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em]">Notas Internas</span>
                                    {editingNotes !== client.id ? (
                                        <button
                                            onClick={() => { setEditingNotes(client.id); setTempNotes(client.notes); }}
                                            className="text-[10px] font-black text-accent hover:text-white transition-colors uppercase tracking-widest"
                                        >
                                            Editar
                                        </button>
                                    ) : (
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => handleSaveNotes(client.id)}
                                                className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-widest"
                                            >
                                                Listo
                                            </button>
                                            <button
                                                onClick={() => setEditingNotes(null)}
                                                className="text-[10px] font-black text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
                                            >
                                                X
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {editingNotes === client.id ? (
                                    <textarea
                                        value={tempNotes}
                                        onChange={e => setTempNotes(e.target.value)}
                                        placeholder="Preferencias, alergias, estilo..."
                                        className="w-full bg-slate-900/50 rounded-xl p-3 text-xs text-white border border-white/10 focus:border-accent outline-none min-h-[80px] resize-none transition-all placeholder:text-slate-700"
                                        autoFocus
                                    />
                                ) : (
                                    <p className="text-xs text-slate-400 leading-relaxed px-1">
                                        {client.notes || <span className="opacity-20 italic font-medium">Sin notas registradas</span>}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="pt-6 border-t border-white/5 relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">Última Visita</span>
                                <span className="text-[10px] text-accent font-black bg-accent/5 border border-accent/20 px-3 py-1 rounded-full uppercase tracking-widest">
                                    {format(parse(client.lastVisit, 'yyyy-MM-dd', new Date()), 'd MMM yyyy', { locale: es })}
                                </span>
                            </div>

                            <div className="space-y-2.5">
                                {client.history.slice(0, 2).map((visit, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-[10px] p-3 rounded-xl bg-white/[0.02] border border-white/5 group-hover:bg-white/[0.04] transition-all">
                                        <span className="text-slate-400 font-bold uppercase tracking-tight">{visit.serviceName}</span>
                                        <span className="text-slate-600 font-mono">{visit.date}</span>
                                    </div>
                                ))}
                                {client.history.length > 2 && (
                                    <p className="text-center text-[9px] text-slate-600 mt-4 font-black uppercase tracking-[0.3em] opacity-50">
                                        + {client.history.length - 2} VISITAS ADICIONALES
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Decorative background element */}
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                            <User size={120} />
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
