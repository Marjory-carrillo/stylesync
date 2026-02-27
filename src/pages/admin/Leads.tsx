import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users, Mail, Phone, Building2, Calendar, Search, AlertCircle, RefreshCw } from 'lucide-react';

interface Lead {
    id: string;
    business_name: string;
    business_type: string;
    employee_count: string;
    contact_name: string;
    email: string;
    phone: string;
    status: string;
    created_at: string;
}

export default function Leads() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        try {
            setLoading(true);
            setError(null);
            const { data, error: supabaseError } = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false });

            if (supabaseError) throw supabaseError;
            setLeads(data || []);
        } catch (err: any) {
            console.error("Error fetching leads:", err);
            setError(err.message || "Error al conectar con la base de datos.");
        } finally {
            setLoading(false);
        }
    };

    const updateLeadStatus = async (id: string, currentStatus: string) => {
        const statuses = ['nuevo', 'contactado', 'prueba_iniciada', 'rechazado'];
        const currentIndex = statuses.indexOf(currentStatus);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];

        try {
            const { error: updateError } = await supabase
                .from('leads')
                .update({ status: nextStatus })
                .eq('id', id);

            if (updateError) throw updateError;

            // Update local state
            setLeads(leads.map(lead =>
                lead.id === id ? { ...lead, status: nextStatus } : lead
            ));
        } catch (err: any) {
            console.error("Error updating lead status:", err);
            alert("No se pudo actualizar el estado: " + err.message);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'nuevo':
                return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
            case 'contactado':
                return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'prueba_iniciada':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'rechazado':
                return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
            default:
                return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'nuevo': return 'Nuevo Lead';
            case 'contactado': return 'Contactado';
            case 'prueba_iniciada': return 'En Prueba (14 días)';
            case 'rechazado': return 'Rechazado';
            default: return status;
        }
    };

    const filteredLeads = leads.filter(lead =>
        lead.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-fade-in" style={{ color: 'white' }}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight" style={{ margin: 0 }}>Prospectos y Trials</h1>
                    <p style={{ color: '#94a3b8', marginTop: '8px' }}>
                        Gestiona los negocios interesados en CitaLink y sus pruebas VIP de 14 días.
                    </p>
                </div>
                <button
                    onClick={fetchLeads}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#1e293b] hover:bg-[#334155] text-white rounded-xl transition-all border border-white/10 shadow-lg font-bold"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar Datos
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-center gap-4 text-red-400 shadow-xl">
                    <AlertCircle className="w-6 h-6 flex-shrink-0" />
                    <p className="font-medium text-sm">Error: {error}</p>
                </div>
            )}

            {/* Search Bar - Definitivamente Oscuro */}
            <div className="relative group max-w-2xl">
                <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                </div>
                <input
                    type="text"
                    placeholder="Buscar por negocio, nombre o correo..."
                    className="w-full bg-[#1e293b] border border-white/10 rounded-[1.2rem] pl-16 pr-8 py-4.5 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-all font-semibold shadow-2xl py-4"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Leads Table - Premium Dark Style */}
            <div className="bg-[#1e293b] rounded-[1.5rem] border border-white/10 shadow-2xl overflow-hidden shadow-violet-500/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-[10px] uppercase tracking-[0.2em]">
                                <th className="p-6 font-black">Negocio</th>
                                <th className="p-6 font-black">Información de Contacto</th>
                                <th className="p-6 font-black">Equipo</th>
                                <th className="p-6 font-black">Registro</th>
                                <th className="p-6 font-black text-center">Estado / Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {(loading && leads.length === 0) ? (
                                <tr>
                                    <td colSpan={5} className="p-24 text-center">
                                        <div className="flex flex-col items-center gap-5">
                                            <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
                                            <p className="text-slate-400 font-bold tracking-wide">Sincronizando con la nube...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-24 text-center">
                                        <div className="flex flex-col items-center gap-4 max-w-xs mx-auto">
                                            <div className="p-5 bg-white/5 rounded-full border border-white/5 text-slate-700">
                                                <Users size={40} strokeWidth={1.5} />
                                            </div>
                                            <h3 className="text-white font-black text-xl">Sin Datos</h3>
                                            <p className="text-slate-500 text-sm leading-relaxed">No se encontraron prospectos que coincidan con tu búsqueda actual.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLeads.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-6">
                                            <div className="font-black text-white text-base flex items-center gap-3 uppercase">
                                                <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center border border-violet-500/20 group-hover:scale-110 transition-transform shadow-lg shadow-violet-500/5">
                                                    <Building2 className="w-5 h-5 text-violet-400" />
                                                </div>
                                                {lead.business_name}
                                            </div>
                                            <div className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-widest ml-[52px] flex items-center gap-2">
                                                <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.6)]"></span>
                                                {lead.business_type === 'barbershop' ? 'Barbería' :
                                                    lead.business_type === 'salon' ? 'Salón de Belleza' :
                                                        lead.business_type === 'spa' ? 'Spa' :
                                                            lead.business_type === 'clinic' ? 'Clínica' : 'Otro'}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="font-bold text-white mb-2 text-sm uppercase">{lead.contact_name}</div>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium lowercase">
                                                    <Mail className="w-3.5 h-3.5 text-slate-500" /> {lead.email}
                                                </div>
                                                {lead.phone && (
                                                    <a
                                                        href={`https://wa.me/${lead.phone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(lead.contact_name)},%20te%20escribo%20de%20CitaLink%20por%20tu%20solicitud%20de%20acceso...`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-all font-bold group/wa w-fit"
                                                        title="Enviar mensaje por WhatsApp"
                                                    >
                                                        <Phone className="w-3.5 h-3.5 group-hover/wa:scale-110 transition-transform" />
                                                        {lead.phone}
                                                        <span className="bg-emerald-500/10 text-[9px] px-2 py-0.5 rounded border border-emerald-500/20 ml-1">WHATSAPP</span>
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2.5 px-4 py-2 bg-white/5 rounded-xl border border-white/5 w-fit text-slate-300 font-bold">
                                                <Users className="w-4 h-4 text-slate-500" />
                                                <span className="text-xs">{lead.employee_count} {lead.employee_count === '1' ? 'Persona' : 'Personas'}</span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2 text-slate-500 font-medium">
                                                <Calendar className="w-4 h-4 text-slate-600" />
                                                <span className="text-xs">{format(new Date(lead.created_at), "d MMM, yyyy", { locale: es })}</span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex justify-center">
                                                <button
                                                    onClick={() => updateLeadStatus(lead.id, lead.status)}
                                                    className={`px-5 py-2.5 text-[10px] font-black tracking-[0.15em] uppercase rounded-xl border shadow-xl transition-all hover:brightness-125 focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1e293b] ${getStatusStyle(lead.status)}`}
                                                >
                                                    {getStatusText(lead.status)}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
