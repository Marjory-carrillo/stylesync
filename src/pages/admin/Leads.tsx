import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users, Mail, Phone, Building2, Calendar, Search, AlertCircle, RefreshCw, Filter, ArrowRight } from 'lucide-react';

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
                return 'bg-violet-500/10 text-violet-400 border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.1)]';
            case 'contactado':
                return 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]';
            case 'prueba_iniciada':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]';
            case 'rechazado':
                return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
            default:
                return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'nuevo': return 'Nuevo';
            case 'contactado': return 'Contactado';
            case 'prueba_iniciada': return 'Trial Activo';
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
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
                        <Users className="text-accent" size={36} />
                        Prospectos y Trials
                    </h1>
                    <p className="text-slate-400 mt-2 text-lg">
                        Control central de negocios interesados y pruebas gratuitas.
                    </p>
                </div>
                <div className="flex gap-3 w-full lg:w-auto">
                    <button
                        onClick={fetchLeads}
                        className="btn btn-secondary flex-1 lg:flex-none py-3"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                    <button className="btn btn-primary flex-1 lg:flex-none py-3">
                        <Filter className="w-4 h-4" />
                        Filtros Avanzados
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-center gap-4 text-red-400 animate-slide-up shadow-lg">
                    <AlertCircle className="w-6 h-6 flex-shrink-0" />
                    <p className="font-semibold">Error de Sincronización: {error}</p>
                </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                {[
                    { label: 'Total Leads', value: leads.length, color: 'text-white' },
                    { label: 'Nuevos hoy', value: leads.filter(l => format(new Date(l.created_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length, color: 'text-violet-400' },
                    { label: 'En Prueba', value: leads.filter(l => l.status === 'prueba_iniciada').length, color: 'text-emerald-400' },
                    { label: 'Tasa Conversión', value: '12%', color: 'text-accent' }
                ].map((stat, i) => (
                    <div key={i} className="glass-card p-5 border border-white/5 bg-white/2 hover:bg-white/5 transition-all">
                        <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">{stat.label}</p>
                        <h4 className={`text-2xl font-black ${stat.color}`}>{stat.value}</h4>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <div className="relative group flex-1">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                        <Search className="w-5 h-5 text-slate-500 group-focus-within:text-accent transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por negocio, responsable o email..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-accent/50 focus:bg-white/10 transition-all font-medium shadow-inner"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Table Container */}
            <div className="glass-panel border border-white/5 overflow-hidden animate-slide-up shadow-2xl" style={{ animationDelay: '0.3s' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-[11px] uppercase tracking-widest">
                                <th className="p-6 font-bold">Información del Negocio</th>
                                <th className="p-6 font-bold">Contacto Principal</th>
                                <th className="p-6 font-bold">Infraestructura</th>
                                <th className="p-6 font-bold">Fecha Registro</th>
                                <th className="p-6 font-bold text-center">Estado del Lead</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading && leads.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-32 text-center text-slate-400">
                                        <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-4 opacity-20" />
                                        <p className="font-bold tracking-widest uppercase text-xs">Obteniendo datos de la nube...</p>
                                    </td>
                                </tr>
                            ) : filteredLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-32 text-center">
                                        <div className="max-w-xs mx-auto space-y-4 opacity-50">
                                            <Search size={48} className="mx-auto text-slate-600" />
                                            <h3 className="text-white font-black text-xl">Sin Resultados</h3>
                                            <p className="text-slate-400 text-sm">No encontramos ningún prospecto que coincida con "{searchTerm}".</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLeads.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-white/[0.03] transition-colors group">
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/20 to-violet-500/20 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    <Building2 className="w-6 h-6 text-accent" />
                                                </div>
                                                <div>
                                                    <div className="font-black text-white text-lg tracking-tight uppercase">{lead.business_name}</div>
                                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                                        {lead.business_type === 'barbershop' ? 'Barbería' :
                                                            lead.business_type === 'salon' ? 'Salón de Belleza' :
                                                                lead.business_type === 'spa' ? 'Spa' :
                                                                    lead.business_type === 'clinic' ? 'Clínica' : 'SaaS / Tech'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="font-bold text-white mb-1.5 uppercase tracking-wide text-xs">{lead.contact_name}</div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 text-[11px] text-slate-400 hover:text-white transition-colors">
                                                    <Mail className="w-3 h-3 opacity-50" /> {lead.email}
                                                </div>
                                                {lead.phone && (
                                                    <a
                                                        href={`https://wa.me/${lead.phone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(lead.contact_name)},%20te%20escribo%20de%20CitaLink%20por%20tu%20solicitud%20de%20acceso...`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 text-[11px] text-emerald-400 font-bold hover:translate-x-1 transition-all"
                                                    >
                                                        <Phone className="w-3 h-3" /> {lead.phone}
                                                        <span className="bg-emerald-500/10 text-[8px] px-1.5 py-0.5 rounded border border-emerald-500/20 ml-1">WHATSAPP</span>
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2 text-slate-300 font-bold bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg w-fit">
                                                <Users className="w-4 h-4 text-slate-500" />
                                                <span className="text-xs">{lead.employee_count} {parseInt(lead.employee_count) === 1 ? 'Staff' : 'Staff'}</span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Calendar className="w-4 h-4 opacity-40" />
                                                <span className="text-xs font-medium">{format(new Date(lead.created_at), "dd/MM/yyyy", { locale: es })}</span>
                                            </div>
                                        </td>
                                        <td className="p-6 text-center">
                                            <button
                                                onClick={() => updateLeadStatus(lead.id, lead.status)}
                                                className={`group/btn relative px-6 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${getStatusStyle(lead.status)}`}
                                            >
                                                <span className="flex items-center justify-center gap-2">
                                                    {getStatusText(lead.status)}
                                                    <ArrowRight size={12} className="opacity-0 group-hover/btn:opacity-100 group-hover/btn:translate-x-1 transition-all" />
                                                </span>
                                            </button>
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
