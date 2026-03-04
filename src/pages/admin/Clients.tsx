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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(client => (
                    <div key={client.phone} className="glass-card p-6 rounded-2xl group hover:border-accent/40 transition-all duration-300 relative overflow-hidden">

                        <div className="flex items-start justify-between mb-6 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold text-lg shadow-lg border border-white/10">
                                    {client.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg group-hover:text-accent transition-colors">{client.name}</h3>
                                    <div className="flex items-center gap-2 text-sm text-muted">
                                        <Phone size={14} />
                                        <span>{client.phone}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                            <div className="bg-black/20 rounded-xl p-3 text-center border border-white/5">
                                <span className="block text-xs text-muted uppercase tracking-wider mb-1">Visitas</span>
                                <span className="text-xl font-bold text-white">{client.totalVisits}</span>
                            </div>
                            <div className="bg-black/20 rounded-xl p-3 text-center border border-white/5">
                                <span className="block text-xs text-muted uppercase tracking-wider mb-1">Invertido</span>
                                <span className="text-xl font-bold text-emerald-400">${client.totalSpent}</span>
                            </div>
                        </div>

                        {/* Interactive Tags */}
                        {client.id && (
                            <div className="mb-4 relative z-10">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted block mb-2">Etiquetas</span>
                                <div className="flex flex-wrap gap-2">
                                    {['VIP', 'Frecuente', 'Nuevo'].map(tag => {
                                        const isActive = client.tags.includes(tag);
                                        return (
                                            <button
                                                key={tag}
                                                onClick={() => toggleTag(client.id, client.tags, tag)}
                                                className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${isActive
                                                    ? 'bg-accent/20 text-accent border-accent/30'
                                                    : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'
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
                            <div className="mb-6 relative z-10 bg-black/20 rounded-xl p-3 border border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Notas Internas</span>
                                    {editingNotes !== client.id ? (
                                        <button
                                            onClick={() => { setEditingNotes(client.id); setTempNotes(client.notes); }}
                                            className="text-[10px] font-bold text-accent hover:text-white transition-colors"
                                        >
                                            Editar
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleSaveNotes(client.id)}
                                                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                                            >
                                                Guardar
                                            </button>
                                            <button
                                                onClick={() => setEditingNotes(null)}
                                                className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {editingNotes === client.id ? (
                                    <textarea
                                        value={tempNotes}
                                        onChange={e => setTempNotes(e.target.value)}
                                        placeholder="Preferencias, alergias, estilo de corte..."
                                        className="w-full bg-black/40 rounded-lg p-2 text-sm text-white border border-white/10 focus:border-accent outline-none min-h-[60px] resize-none"
                                    />
                                ) : (
                                    <p className="text-sm text-slate-300 min-h-[20px]">
                                        {client.notes || <span className="opacity-40 italic">Sin notas registradas</span>}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="pt-4 border-t border-white/10 relative z-10">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs text-muted font-medium uppercase tracking-wider">Última Visita</span>
                                <span className="text-xs text-white font-bold bg-white/5 px-2 py-1 rounded">
                                    {format(parse(client.lastVisit, 'yyyy-MM-dd', new Date()), 'd MMM yyyy', { locale: es })}
                                </span>
                            </div>

                            <div className="space-y-2">
                                {client.history.slice(0, 2).map((visit, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs p-2 rounded bg-white/5">
                                        <span className="text-gray-300 font-medium">{visit.serviceName}</span>
                                        <span className="text-slate-500">{visit.date}</span>
                                    </div>
                                ))}
                                {client.history.length > 2 && (
                                    <p className="text-center text-xs text-muted mt-2 italic">
                                        + {client.history.length - 2} visitas anteriores
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
