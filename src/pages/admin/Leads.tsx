import { useState, useMemo } from 'react';
import { useLeads } from '../../lib/store/queries/useLeads';
import { useSuperAdmin } from '../../lib/store/queries/useSuperAdmin';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Users, Mail, Phone, Building2, Calendar, Search, MessageCircle,
    RefreshCw, Filter, ArrowRight, X, Trash2, Archive, CheckCircle2,
    Download, Save, ShieldAlert
} from 'lucide-react';
import type { Lead } from '../../lib/types/store.types';

export default function Leads() {
    const {
        leads,
        isLoading,
        updateLeadStatus,
        updateLeadNotes,
        archiveLead,
        deleteLead,
        markLeadAsConverted
    } = useLeads();

    const { createTenant } = useSuperAdmin();

    // ── Search & Filter State ──
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [employeeFilter, setEmployeeFilter] = useState<string>('all');
    const [currentTab, setCurrentTab] = useState<'active' | 'archived'>('active');

    // ── Pagination State ──
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // ── Selection & Modals State ──
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [tempNotes, setTempNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [showConvertModal, setShowConvertModal] = useState(false);

    // ── Convert Lead Form State ──
    const [convertForm, setConvertForm] = useState({
        businessName: '',
        slug: '',
        address: '',
        category: 'barbershop',
        ownerEmail: '',
        ownerPassword: '',
        noTrial: false
    });
    const [isCreatingTenant, setIsCreatingTenant] = useState(false);
    const [convertError, setConvertError] = useState<string | null>(null);

    // ── WhatsApp Message Generator ──
    const getWhatsAppUrl = (lead: Lead) => {
        const cleanPhone = lead.phone.replace(/\D/g, '');
        const message = `Hola ${lead.contact_name}, te escribo de CitaLink por tu solicitud para ${lead.business_name}. ¿Cómo estás?`;
        return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    };

    // ── Open Lead Detail Modal ──
    const openLeadDetails = (lead: Lead) => {
        setSelectedLead(lead);
        setTempNotes(lead.notes || '');
    };

    // ── Save Notes ──
    const handleSaveNotes = async () => {
        if (!selectedLead) return;
        setIsSavingNotes(true);
        try {
            await updateLeadNotes({ id: selectedLead.id, notes: tempNotes });
            setSelectedLead({ ...selectedLead, notes: tempNotes });
        } finally {
            setIsSavingNotes(false);
        }
    };

    // ── Open Convert Modal ──
    const openConvertModal = (lead: Lead) => {
        // Generar slug limpio
        const cleanSlug = lead.business_name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
            .replace(/[^a-z0-9\s-]/g, '') // Quitar caracteres raros
            .trim()
            .replace(/\s+/g, '-'); // Reemplazar espacios por guiones

        // Generar contraseña segura simple
        const generatedPassword = Math.random().toString(36).slice(-8) + 'CL!';

        setConvertForm({
            businessName: lead.business_name,
            slug: cleanSlug,
            address: '',
            category: lead.business_type || 'barbershop',
            ownerEmail: lead.email,
            ownerPassword: generatedPassword,
            noTrial: false
        });
        setConvertError(null);
        setShowConvertModal(true);
    };

    // ── Handle Lead-to-Tenant Conversion ──
    const handleConvertLead = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLead) return;
        setIsCreatingTenant(true);
        setConvertError(null);

        try {
            const res = await createTenant(
                convertForm.businessName.trim(),
                convertForm.slug.trim(),
                convertForm.address.trim(),
                convertForm.category,
                convertForm.ownerEmail.trim(),
                convertForm.ownerPassword.trim(),
                'America/Mexico_City',
                undefined, // owner ID created automatically
                undefined, // brand slug
                convertForm.noTrial
            );

            if (!res.success) {
                throw new Error(res.error || 'Error desconocido al crear el tenant');
            }

            // Marcar el lead como convertido
            await markLeadAsConverted({
                id: selectedLead.id,
                tenantId: res.data.id
            });

            // Cerrar modals y limpiar
            setShowConvertModal(false);
            setSelectedLead(null);
        } catch (err: any) {
            setConvertError(err.message || 'Error al crear negocio');
        } finally {
            setIsCreatingTenant(false);
        }
    };

    // ── Lead Archiving ──
    const handleToggleArchive = async (lead: Lead) => {
        const shouldArchive = !lead.archived_at;
        await archiveLead({ id: lead.id, archive: shouldArchive });
        if (selectedLead && selectedLead.id === lead.id) {
            setSelectedLead({
                ...selectedLead,
                archived_at: shouldArchive ? new Date().toISOString() : null
            });
        }
    };

    // ── Lead Deletion ──
    const handleDeleteLead = async (lead: Lead) => {
        if (confirm(`¿Estás completamente seguro de eliminar permanentemente a "${lead.business_name}"? Esta acción no se puede deshacer.`)) {
            await deleteLead(lead.id);
            setSelectedLead(null);
        }
    };

    // ── Export to CSV ──
    const handleExportCSV = () => {
        if (processedLeads.length === 0) return;

        const headers = ['Negocio', 'Tipo', 'Personal', 'Contacto', 'Email', 'Telefono', 'Estado', 'Notas', 'Fecha de Registro'];
        const rows = processedLeads.map(l => [
            l.business_name,
            l.business_type,
            l.employee_count,
            l.contact_name,
            l.email,
            `'${l.phone}`, // para evitar truncamiento científico en Excel
            l.status,
            l.notes || '',
            format(new Date(l.created_at), 'yyyy-MM-dd HH:mm:ss')
        ]);

        const csvContent = [headers, ...rows]
            .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `leads_citalink_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ── Process Filters & Search ──
    const processedLeads = useMemo(() => {
        return leads.filter(lead => {
            // Tab filter
            const isArchived = !!lead.archived_at;
            if (currentTab === 'active' && isArchived) return false;
            if (currentTab === 'archived' && !isArchived) return false;

            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchesSearch =
                    lead.business_name.toLowerCase().includes(term) ||
                    lead.contact_name.toLowerCase().includes(term) ||
                    lead.email.toLowerCase().includes(term) ||
                    lead.phone.includes(term);
                if (!matchesSearch) return false;
            }

            // Advanced Filters
            if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
            if (typeFilter !== 'all' && lead.business_type !== typeFilter) return false;
            if (employeeFilter !== 'all' && lead.employee_count !== employeeFilter) return false;

            return true;
        });
    }, [leads, searchTerm, statusFilter, typeFilter, employeeFilter, currentTab]);

    // ── Dynamic Statistics Calculations ──
    const stats = useMemo(() => {
        const activeLeads = leads.filter(l => !l.archived_at);
        const converted = activeLeads.filter(l => l.status === 'prueba_iniciada' || l.converted_tenant_id).length;
        const total = Math.max(1, activeLeads.length);
        const conversionRate = Math.round((converted / total) * 100);

        return {
            total: activeLeads.length,
            today: activeLeads.filter(l => format(new Date(l.created_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length,
            trial: activeLeads.filter(l => l.status === 'prueba_iniciada').length,
            conversion: `${conversionRate}%`
        };
    }, [leads]);

    // ── Paginated Leads ──
    const paginatedLeads = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return processedLeads.slice(startIndex, startIndex + itemsPerPage);
    }, [processedLeads, currentPage]);

    const totalPages = Math.max(1, Math.ceil(processedLeads.length / itemsPerPage));

    // ── Badge Helpers ──
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

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
                        <Users className="text-cyan-400" size={36} />
                        Prospectos y Trials
                    </h1>
                    <p className="text-slate-400 mt-2 text-lg">
                        Control central de negocios interesados y pruebas gratuitas.
                    </p>
                </div>
                <div className="flex gap-3 w-full lg:w-auto">
                    <button
                        onClick={handleExportCSV}
                        disabled={processedLeads.length === 0}
                        className="btn btn-secondary py-3 flex items-center justify-center gap-2 flex-1 lg:flex-none disabled:opacity-50"
                    >
                        <Download size={16} />
                        Exportar CSV
                    </button>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`btn py-3 flex items-center justify-center gap-2 flex-1 lg:flex-none ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        <Filter className="w-4 h-4" />
                        Filtros {showFilters ? 'Activos' : 'Avanzados'}
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                {[
                    { label: 'Total Prospectos', value: stats.total, color: 'text-white' },
                    { label: 'Nuevos Hoy', value: stats.today, color: 'text-violet-400' },
                    { label: 'En Prueba (Trial)', value: stats.trial, color: 'text-emerald-400' },
                    { label: 'Tasa Conversión', value: stats.conversion, color: 'text-cyan-400' }
                ].map((stat, i) => (
                    <div key={i} className="glass-card p-5 border border-white/5 bg-white/2 hover:bg-white/5 transition-all">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{stat.label}</p>
                        <h4 className={`text-2xl font-black ${stat.color}`}>{stat.value}</h4>
                    </div>
                ))}
            </div>

            {/* Search and Collapsible Filters */}
            <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                        <Search className="w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar por negocio, contacto o email..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 focus:bg-white/10 transition-all font-medium shadow-inner"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </div>

                {/* Advanced Filters Panel */}
                {showFilters && (
                    <div className="glass-panel p-6 border border-white/5 bg-slate-900/60 rounded-3xl grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Estado</label>
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-400/40"
                                value={statusFilter}
                                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="all" className="bg-slate-900 text-white">Todos los estados</option>
                                <option value="nuevo" className="bg-slate-900 text-white">Nuevo</option>
                                <option value="contactado" className="bg-slate-900 text-white">Contactado</option>
                                <option value="prueba_iniciada" className="bg-slate-900 text-white">Trial Activo</option>
                                <option value="rechazado" className="bg-slate-900 text-white">Rechazado</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tipo de Negocio</label>
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-400/40"
                                value={typeFilter}
                                onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="all" className="bg-slate-900 text-white">Todos los tipos</option>
                                <option value="barbershop" className="bg-slate-900 text-white">Barbería</option>
                                <option value="salon" className="bg-slate-900 text-white">Salón de Belleza</option>
                                <option value="spa" className="bg-slate-900 text-white">Spa</option>
                                <option value="clinic" className="bg-slate-900 text-white">Clínica</option>
                                <option value="other" className="bg-slate-900 text-white">Otros</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tamaño del Personal</label>
                            <select
                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-400/40"
                                value={employeeFilter}
                                onChange={(e) => { setEmployeeFilter(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="all" className="bg-slate-900 text-white">Cualquier tamaño</option>
                                <option value="1" className="bg-slate-900 text-white">Solo yo (1)</option>
                                <option value="2-4" className="bg-slate-900 text-white">2 a 4 personas</option>
                                <option value="5-10" className="bg-slate-900 text-white">5 a 10 personas</option>
                                <option value="10+" className="bg-slate-900 text-white">Más de 10 personas</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-white/5">
                <button
                    onClick={() => { setCurrentTab('active'); setCurrentPage(1); }}
                    className={`px-6 py-3 font-bold text-xs uppercase tracking-widest border-b-2 transition-all ${currentTab === 'active' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    Prospectos Activos ({leads.filter(l => !l.archived_at).length})
                </button>
                <button
                    onClick={() => { setCurrentTab('archived'); setCurrentPage(1); }}
                    className={`px-6 py-3 font-bold text-xs uppercase tracking-widest border-b-2 transition-all ${currentTab === 'archived' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    Archivados ({leads.filter(l => !!l.archived_at).length})
                </button>
            </div>

            {/* Table Container */}
            <div className="glass-panel border border-white/5 overflow-hidden animate-slide-up shadow-2xl" style={{ animationDelay: '0.3s' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-[10px] uppercase tracking-widest">
                                <th className="p-6 font-bold">Información del Negocio</th>
                                <th className="p-6 font-bold">Contacto Principal</th>
                                <th className="p-6 font-bold">Infraestructura</th>
                                <th className="p-6 font-bold">Fecha Registro</th>
                                <th className="p-6 font-bold text-center">Estado</th>
                                <th className="p-6 font-bold text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-24 text-center text-slate-400">
                                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 opacity-20" />
                                        <p className="font-bold tracking-widest uppercase text-xs">Cargando prospectos...</p>
                                    </td>
                                </tr>
                            ) : paginatedLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-24 text-center">
                                        <div className="max-w-xs mx-auto space-y-3 opacity-40">
                                            <Search size={40} className="mx-auto text-slate-500" />
                                            <h3 className="text-white font-black text-base">Sin Resultados</h3>
                                            <p className="text-slate-400 text-xs">No hay prospectos que coincidan con los filtros seleccionados.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedLeads.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                                                    <Building2 className="w-5 h-5 text-cyan-400" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white text-base tracking-tight uppercase">{lead.business_name}</div>
                                                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                                        {lead.business_type === 'barbershop' ? 'Barbería' :
                                                            lead.business_type === 'salon' ? 'Salón de Belleza' :
                                                                lead.business_type === 'spa' ? 'Spa' :
                                                                    lead.business_type === 'clinic' ? 'Clínica' : 'Otros'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="font-bold text-white text-xs mb-1 uppercase tracking-wide">{lead.contact_name}</div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                                    <Mail className="w-3 h-3 opacity-40" /> {lead.email}
                                                </div>
                                                {lead.phone && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Phone className="w-3 h-3 text-slate-400 opacity-40" /> 
                                                        <span className="text-[10px] text-slate-400">{lead.phone}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2 text-slate-300 font-bold bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg w-fit text-[10px]">
                                                <Users className="w-3.5 h-3.5 text-slate-500" />
                                                <span>{lead.employee_count === '1' ? '1 Empleado' : `${lead.employee_count} Colaboradores`}</span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                                                <Calendar className="w-3.5 h-3.5 opacity-30" />
                                                <span>{format(new Date(lead.created_at), "dd/MM/yyyy", { locale: es })}</span>
                                            </div>
                                        </td>
                                        <td className="p-6 text-center">
                                            <span className={`px-3 py-1 rounded-full border font-black text-[9px] uppercase tracking-widest ${getStatusStyle(lead.status)}`}>
                                                {getStatusText(lead.status)}
                                            </span>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => openLeadDetails(lead)}
                                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10 transition-colors text-xs font-bold"
                                                    title="Ver detalles"
                                                >
                                                    Ver Detalle
                                                </button>
                                                {lead.phone && (
                                                    <a
                                                        href={getWhatsAppUrl(lead)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                                                        title="Contactar por WhatsApp"
                                                    >
                                                        <MessageCircle className="w-4 h-4" />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between text-slate-500 text-xs">
                        <div>
                            Mostrando {Math.min(processedLeads.length, (currentPage - 1) * itemsPerPage + 1)} a {Math.min(processedLeads.length, currentPage * itemsPerPage)} de {processedLeads.length} prospectos
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white border border-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            >
                                Anterior
                            </button>
                            <span className="flex items-center px-2 text-slate-400 font-bold">Página {currentPage} de {totalPages}</span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white border border-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── DETAIL MODAL ── */}
            {selectedLead && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setSelectedLead(null)} />
                    <div className="relative w-full max-w-lg bg-[#0e131f] border border-white/10 rounded-[2.5rem] overflow-hidden animate-scale-up shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Header banner */}
                        <div className="p-6 bg-gradient-to-br from-cyan-900/40 via-[#0e131f] to-[#0e131f] border-b border-white/5 shrink-0 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">{selectedLead.business_name}</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1 flex items-center gap-1.5">
                                    <Building2 size={12} /> Prospecto desde hace {format(new Date(selectedLead.created_at), 'd', { locale: es })} días
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedLead(null)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content Scrollable */}
                        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-300">
                            {/* General Details Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Contacto</span>
                                    <p className="font-bold text-white text-sm">{selectedLead.contact_name}</p>
                                </div>
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Tipo de Negocio</span>
                                    <p className="font-bold text-white text-sm uppercase">
                                        {selectedLead.business_type === 'barbershop' ? 'Barbería' :
                                            selectedLead.business_type === 'salon' ? 'Salón de Belleza' :
                                                selectedLead.business_type === 'spa' ? 'Spa' :
                                                    selectedLead.business_type === 'clinic' ? 'Clínica' : selectedLead.business_type || 'Otros'}
                                    </p>
                                </div>
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Email</span>
                                    <p className="font-bold text-white text-xs truncate">{selectedLead.email}</p>
                                </div>
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Teléfono</span>
                                    <p className="font-bold text-white text-xs">{selectedLead.phone}</p>
                                </div>
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Infraestructura</span>
                                    <p className="font-bold text-white text-xs">{selectedLead.employee_count === '1' ? '1 Colaborador' : `${selectedLead.employee_count} Colaboradores`}</p>
                                </div>
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Fecha Registro</span>
                                    <p className="font-bold text-white text-xs">{format(new Date(selectedLead.created_at), 'dd MMMM yyyy, HH:mm', { locale: es })}</p>
                                </div>
                            </div>

                            {/* Status controls */}
                            <div className="space-y-3">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Actualizar Estado de Gestión</span>
                                <div className="grid grid-cols-4 gap-2">
                                    {['nuevo', 'contactado', 'prueba_iniciada', 'rechazado'].map((statusOption) => (
                                        <button
                                            key={statusOption}
                                            type="button"
                                            onClick={() => updateLeadStatus({ id: selectedLead.id, status: statusOption }).then(() => {
                                                setSelectedLead({ ...selectedLead, status: statusOption });
                                            })}
                                            className={`py-2 px-1 text-[9px] font-black uppercase tracking-wider border rounded-xl transition-all ${
                                                selectedLead.status === statusOption
                                                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                                                    : 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            {getStatusText(statusOption)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Notes input */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Notas de Seguimiento Internas</span>
                                    {tempNotes !== (selectedLead.notes || '') && (
                                        <button
                                            onClick={handleSaveNotes}
                                            disabled={isSavingNotes}
                                            className="text-[10px] font-black text-cyan-400 flex items-center gap-1.5 uppercase hover:text-cyan-300 disabled:opacity-50"
                                        >
                                            <Save size={12} /> Guardar Nota
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-cyan-400/40 h-24 placeholder-slate-600 resize-none font-medium leading-relaxed"
                                    placeholder="Escribe comentarios de llamadas, seguimiento o acuerdos con el salón..."
                                    value={tempNotes}
                                    onChange={(e) => setTempNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="p-4 border-t border-white/5 bg-[#080c14] shrink-0 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleToggleArchive(selectedLead)}
                                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-400 hover:text-white transition-colors"
                                    title={selectedLead.archived_at ? 'Desarchivar' : 'Archivar'}
                                >
                                    <Archive size={16} />
                                </button>
                                <button
                                    onClick={() => handleDeleteLead(selectedLead)}
                                    className="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors"
                                    title="Eliminar permanentemente"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            {selectedLead.converted_tenant_id ? (
                                <div className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl uppercase tracking-wider flex items-center gap-1.5">
                                    <CheckCircle2 size={14} /> Cliente Convertido Activo
                                </div>
                            ) : (
                                <button
                                    onClick={() => openConvertModal(selectedLead)}
                                    className="btn btn-primary py-2.5 px-5 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-glow"
                                >
                                    Activar como Cliente <ArrowRight size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── CONVERT LEAD TO TENANT DIALOG MODAL ── */}
            {showConvertModal && selectedLead && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowConvertModal(false)} />
                    <form
                        onSubmit={handleConvertLead}
                        className="relative w-full max-w-md bg-[#161b22] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-scale-up flex flex-col max-h-[90vh] overflow-hidden"
                    >
                        <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                <Building2 className="text-cyan-400" size={20} />
                                ACTIVACIÓN DE NEGOCIO
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowConvertModal(false)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {convertError && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-semibold flex items-start gap-2.5 mb-6">
                                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                                <span>{convertError}</span>
                            </div>
                        )}

                        <div className="space-y-4 overflow-y-auto pr-1 flex-1 pb-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nombre Comercial</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold focus:outline-none focus:border-cyan-400/40"
                                    value={convertForm.businessName}
                                    onChange={(e) => setConvertForm({ ...convertForm, businessName: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Link de Reservas (Slug)</label>
                                <div className="relative flex items-center">
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-16 py-3 text-white text-xs font-mono focus:outline-none focus:border-cyan-400/40"
                                        value={convertForm.slug}
                                        onChange={(e) => setConvertForm({ ...convertForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                    />
                                    <span className="absolute right-4 text-[9px] font-black text-cyan-500 uppercase tracking-widest">SLUG</span>
                                </div>
                                <p className="text-[9px] text-slate-500 ml-1">Ej: citalink.app/<strong>{convertForm.slug || 'slug'}</strong></p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Categoría del Negocio</label>
                                <select
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold focus:outline-none focus:border-cyan-400/40"
                                    value={convertForm.category}
                                    onChange={(e) => setConvertForm({ ...convertForm, category: e.target.value })}
                                >
                                    <option value="barbershop" className="bg-slate-900 text-white">Barbería</option>
                                    <option value="salon" className="bg-slate-900 text-white">Salón de Belleza / Uñas</option>
                                    <option value="spa" className="bg-slate-900 text-white">Spa</option>
                                    <option value="clinic" className="bg-slate-900 text-white">Clínica / Consultorio</option>
                                    <option value="other" className="bg-slate-900 text-white">Otro</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Dirección del Salón</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Av. Principal 123, Col. Centro"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-medium focus:outline-none focus:border-cyan-400/40"
                                    value={convertForm.address}
                                    onChange={(e) => setConvertForm({ ...convertForm, address: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2 border-t border-white/5 pt-4">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email del Propietario (Acceso)</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-bold focus:outline-none focus:border-cyan-400/40"
                                    value={convertForm.ownerEmail}
                                    onChange={(e) => setConvertForm({ ...convertForm, ownerEmail: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contraseña Propietario</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-mono focus:outline-none focus:border-cyan-400/40"
                                    value={convertForm.ownerPassword}
                                    onChange={(e) => setConvertForm({ ...convertForm, ownerPassword: e.target.value })}
                                />
                            </div>

                            <div className="flex items-center gap-2.5 px-1 py-2">
                                <input
                                    type="checkbox"
                                    id="noTrialCheckbox"
                                    className="w-4 h-4 rounded border-white/10 bg-white/5 text-cyan-500 focus:ring-0 focus:ring-offset-0 focus:outline-none"
                                    checked={convertForm.noTrial}
                                    onChange={(e) => setConvertForm({ ...convertForm, noTrial: e.target.checked })}
                                />
                                <label htmlFor="noTrialCheckbox" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer">
                                    Omitir período de prueba (Activar plan directo)
                                </label>
                            </div>
                        </div>

                        {/* Submit button */}
                        <button
                            type="submit"
                            disabled={isCreatingTenant}
                            className="w-full py-4 mt-6 bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-glow hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                        >
                            {isCreatingTenant ? (
                                <span className="flex items-center justify-center gap-2">
                                    <RefreshCw className="w-4 h-4 animate-spin" /> Inyectando configuraciones en BD...
                                </span>
                            ) : 'Crear Negocio e Iniciar Trial'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
