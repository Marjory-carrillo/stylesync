import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users, Mail, Phone, Building2, Calendar, Search } from 'lucide-react';

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

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLeads(data || []);
        } catch (error) {
            console.error("Error fetching leads:", error);
        } finally {
            setLoading(false);
        }
    };

    const updateLeadStatus = async (id: string, currentStatus: string) => {
        const statuses = ['nuevo', 'contactado', 'prueba_iniciada', 'rechazado'];
        const currentIndex = statuses.indexOf(currentStatus);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];

        try {
            const { error } = await supabase
                .from('leads')
                .update({ status: nextStatus })
                .eq('id', id);

            if (error) throw error;

            // Update local state
            setLeads(leads.map(lead =>
                lead.id === id ? { ...lead, status: nextStatus } : lead
            ));
        } catch (error) {
            console.error("Error updating lead status:", error);
            alert("No se pudo actualizar el estado.");
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'nuevo':
                return 'bg-violet-100 text-violet-800 border-violet-200';
            case 'contactado':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'prueba_iniciada':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'rechazado':
                return 'bg-gray-100 text-gray-800 border-gray-200';
            default:
                return 'bg-slate-100 text-slate-800 border-slate-200';
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
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Prospectos y Trials</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Gestiona los negocios que han solicitado su prueba de 14 días.
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por negocio, nombre o correo..."
                    className="flex-1 bg-transparent border-none outline-none text-slate-700"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Leads Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                                <th className="p-4 font-semibold">Negocio</th>
                                <th className="p-4 font-semibold">Contacto</th>
                                <th className="p-4 font-semibold">Tamaño</th>
                                <th className="p-4 font-semibold">Fecha</th>
                                <th className="p-4 font-semibold">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                        Cargando prospectos...
                                    </td>
                                </tr>
                            ) : filteredLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                        No se encontraron prospectos.
                                    </td>
                                </tr>
                            ) : (
                                filteredLeads.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-medium text-slate-900 flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-slate-400" />
                                                {lead.business_name}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1 capitalize">
                                                {lead.business_type === 'barbershop' ? 'Barbería' :
                                                    lead.business_type === 'salon' ? 'Salón de Belleza' :
                                                        lead.business_type === 'spa' ? 'Spa' :
                                                            lead.business_type === 'clinic' ? 'Clínica' : 'Otro'}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-900">{lead.contact_name}</div>
                                            <div className="flex flex-col gap-1 mt-1 text-xs text-slate-500">
                                                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {lead.email}</span>
                                                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.phone}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1 text-slate-600">
                                                <Users className="w-4 h-4 text-slate-400" />
                                                {lead.employee_count} {lead.employee_count === '1' ? 'persona' : 'personas'}
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-500 whitespace-nowrap">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                {format(new Date(lead.created_at), "d MMM, yyyy", { locale: es })}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => updateLeadStatus(lead.id, lead.status)}
                                                className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusStyle(lead.status)} hover:opacity-80 transition-opacity`}
                                                title="Haz clic para cambiar el estado"
                                            >
                                                {getStatusText(lead.status)}
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
