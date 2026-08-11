import { useState } from 'react';
import {
    ShoppingBag, Search, Calendar, DollarSign, Sparkles, Download,
    CheckCircle2, Clock, Filter, Printer, X, FileText, Building2, AlertCircle
} from 'lucide-react';
import {
    useMarketplaceAnalytics,
    useToggleCommissionBilled,
    downloadCommissionReportCSV,
    type MarketplaceAppointment
} from '../../lib/store/queries/useMarketplaceAnalytics';
import { useUIStore } from '../../lib/store/uiStore';

export default function SuperAdminMarketplace() {
    const { data: mktData, isLoading, refetch } = useMarketplaceAnalytics();
    const toggleCommissionBilled = useToggleCommissionBilled();
    const showToast = useUIStore((s) => s.showToast);

    const [selectedBusiness, setSelectedBusiness] = useState<string>('all');
    const [searchClient, setSearchClient] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'billed' | 'pending' | 'future'>('all');

    // Estado para el modal de Estado de Cuenta por Negocio
    const [showStatementModal, setShowStatementModal] = useState<boolean>(false);
    const [statementBusiness, setStatementBusiness] = useState<string>('');

    // Filter appointments
    const appointments = mktData?.marketplaceAppointments || [];
    const businessNames = Array.from(new Set(appointments.map((a) => a.tenantName))).sort();

    const filteredAppointments = appointments.filter((appt) => {
        const matchesBusiness = selectedBusiness === 'all' || appt.tenantName === selectedBusiness;
        
        let matchesStatus = true;
        if (statusFilter === 'billed') {
            matchesStatus = appt.commissionBilled;
        } else if (statusFilter === 'pending') {
            matchesStatus = !appt.commissionBilled && (appt.isCompleted || !appt.isFuture);
        } else if (statusFilter === 'future') {
            matchesStatus = !appt.commissionBilled && appt.isFuture;
        }

        const matchesQuery =
            !searchClient.trim() ||
            appt.clientName.toLowerCase().includes(searchClient.toLowerCase()) ||
            appt.clientPhone.includes(searchClient) ||
            appt.tenantName.toLowerCase().includes(searchClient.toLowerCase()) ||
            appt.serviceName.toLowerCase().includes(searchClient.toLowerCase());

        return matchesBusiness && matchesStatus && matchesQuery;
    });

    // Summary calculations
    const totalBilled = filteredAppointments
        .filter(a => a.commissionBilled)
        .reduce((acc, a) => acc + a.commissionAmount, 0);

    // Solo citas completadas/pasadas no cobradas aún
    const totalPending = filteredAppointments
        .filter(a => !a.commissionBilled && (a.isCompleted || !a.isFuture))
        .reduce((acc, a) => acc + a.commissionAmount, 0);

    // Citas futuras agendadas aún sin atender
    const totalFuturePending = filteredAppointments
        .filter(a => !a.commissionBilled && a.isFuture)
        .reduce((acc, a) => acc + a.commissionAmount, 0);

    // Abrir modal de Estado de Cuenta
    const handleOpenStatementModal = (bizName?: string) => {
        const target = bizName || (selectedBusiness !== 'all' ? selectedBusiness : (businessNames[0] || ''));
        if (!target) {
            showToast('No hay negocios registrados para generar Estado de Cuenta', 'error');
            return;
        }
        setStatementBusiness(target);
        setShowStatementModal(true);
    };

    // Datos del negocio seleccionado en el modal
    const modalBizAppts = appointments.filter(a => a.tenantName === statementBusiness);
    const modalBizCanceledAppts = (mktData?.canceledMarketplaceAppointments || []).filter(a => a.tenantName === statementBusiness);
    
    const modalBizCompletedAppts = modalBizAppts.filter(a => a.isCompleted || !a.isFuture);
    const modalBizSales = modalBizCompletedAppts.reduce((acc, a) => acc + a.servicePrice, 0);
    const modalBizTotalComm = modalBizCompletedAppts.reduce((acc, a) => acc + a.commissionAmount, 0);
    const modalBizBilledComm = modalBizCompletedAppts.filter(a => a.commissionBilled).reduce((acc, a) => acc + a.commissionAmount, 0);
    const modalBizPendingComm = modalBizTotalComm - modalBizBilledComm;

    const handlePrintStatement = () => {
        window.print();
    };

    return (
        <div className="flex flex-col gap-8 pb-10 animate-fade-in">
            {/* Header Módulo */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-cyan-950/40 border border-emerald-500/20 p-6 sm:p-8 rounded-3xl backdrop-blur-2xl shadow-2xl">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 shadow-lg shadow-emerald-500/10">
                        <ShoppingBag size={36} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter uppercase">
                                Marketplace & <span className="text-emerald-400 italic">Comisiones</span>
                            </h1>
                            <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                                Módulo HQ
                            </span>
                        </div>
                        <p className="text-slate-400 text-xs sm:text-sm font-medium tracking-wide mt-1">
                            Gestión de Citas agendadas en el buscador público y Cobranza de Comisiones (10% / 15%)
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={() => handleOpenStatementModal()}
                        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-125 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all flex items-center gap-2"
                    >
                        <FileText size={16} />
                        <span>📄 Estado de Cuenta por Negocio</span>
                    </button>
                    <button
                        onClick={() => downloadCommissionReportCSV(appointments, selectedBusiness)}
                        className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center gap-2"
                        title="Exportar archivo CSV filtrado"
                    >
                        <Download size={16} className="text-emerald-400" />
                        <span>CSV ({selectedBusiness === 'all' ? 'Todos' : selectedBusiness})</span>
                    </button>
                    <button
                        onClick={() => refetch && refetch()}
                        className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center gap-2"
                    >
                        <Sparkles size={16} className="text-emerald-400" />
                        <span>Actualizar</span>
                    </button>
                </div>
            </header>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl flex items-center justify-between shadow-xl">
                    <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Total Búsquedas</p>
                        <p className="text-3xl font-black text-emerald-400 mt-1">{mktData?.totalSearches ?? 0}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Búsquedas en el Marketplace</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Search size={24} />
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl flex items-center justify-between shadow-xl">
                    <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Citas Agendadas</p>
                        <p className="text-3xl font-black text-cyan-400 mt-1">{filteredAppointments.length}</p>
                        <p className="text-[10px] text-slate-500 mt-1">Vía buscador público</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        <Calendar size={24} />
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl flex items-center justify-between shadow-xl">
                    <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Comisiones Por Cobrar</p>
                        <p className="text-3xl font-black text-amber-400 mt-1">
                            ${totalPending.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-amber-500/80 mt-1">
                            Citas ya atendidas / transcurridas
                            {totalFuturePending > 0 && ` (+ $${totalFuturePending.toFixed(2)} a futuro)`}
                        </p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock size={24} />
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-white/10 p-5 rounded-2xl flex items-center justify-between shadow-xl">
                    <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Comisiones Cobradas</p>
                        <p className="text-3xl font-black text-emerald-400 mt-1">
                            ${totalBilled.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-emerald-400/80 mt-1">Liquidadas exitosamente</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 size={24} />
                    </div>
                </div>
            </div>

            {/* Main Content Grid: Top Searches vs Appointments Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel: Top 10 Searches */}
                <div className="bg-slate-900/60 border border-white/10 p-6 rounded-3xl flex flex-col space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Search size={18} className="text-emerald-400" />
                            🔥 Lo Más Buscado
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                            Top 10 Términos
                        </span>
                    </div>

                    <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
                        {(!mktData?.topSearches || mktData.topSearches.length === 0) ? (
                            <div className="text-center py-12 text-slate-500 text-xs italic">
                                No hay búsquedas registradas aún en el Marketplace.
                            </div>
                        ) : (
                            mktData.topSearches.map((item, idx) => (
                                <div key={idx} className="space-y-1.5 bg-white/[0.02] border border-white/5 p-3.5 rounded-2xl hover:bg-white/[0.04] transition-all">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-slate-200 capitalize flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-[10px] flex items-center justify-center">
                                                #{idx + 1}
                                            </span>
                                            "{item.term}"
                                        </span>
                                        <span className="font-mono text-emerald-400 font-black text-xs">
                                            {item.count} {item.count === 1 ? 'búsqueda' : 'búsquedas'}
                                        </span>
                                    </div>
                                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${Math.max(item.percentage, 8)}%` }}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Panel (2 cols): Dedicated Commission Billing Table */}
                <div className="lg:col-span-2 bg-slate-900/60 border border-white/10 p-6 rounded-3xl flex flex-col space-y-5 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <DollarSign size={20} className="text-emerald-400" />
                                Desglose de Citas y Cobro de Comisiones
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Solo las citas ya atendidas/pasadas se habilitan para cobro de comisión.
                            </p>
                        </div>

                        {selectedBusiness !== 'all' && (
                            <button
                                onClick={() => handleOpenStatementModal(selectedBusiness)}
                                className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black hover:bg-emerald-500/20 transition-all flex items-center gap-2 self-start sm:self-auto"
                            >
                                <Building2 size={14} />
                                <span>Ver Estado de Cuenta ({selectedBusiness})</span>
                            </button>
                        )}
                    </div>

                    {/* Filters Toolbar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar por cliente, teléfono o negocio..."
                                value={searchClient}
                                onChange={(e) => setSearchClient(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 text-white rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-emerald-500/40"
                            />
                        </div>

                        {/* Business Dropdown Filter */}
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <Filter size={14} className="text-slate-400" />
                            <select
                                value={selectedBusiness}
                                onChange={(e) => setSelectedBusiness(e.target.value)}
                                className="bg-slate-950 border border-white/10 text-white rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-emerald-500/40"
                            >
                                <option value="all">Todos los Negocios ({businessNames.length})</option>
                                {businessNames.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>

                            {/* Status Filter Buttons */}
                            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10 text-xs font-bold">
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('all')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === 'all' ? 'bg-emerald-500 text-black font-black' : 'text-slate-400 hover:text-white'}`}
                                >
                                    Todas
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('pending')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === 'pending' ? 'bg-amber-500 text-black font-black' : 'text-slate-400 hover:text-white'}`}
                                    title="Por cobrar (Citas transcurridas)"
                                >
                                    Por Cobrar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('future')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === 'future' ? 'bg-cyan-500 text-black font-black' : 'text-slate-400 hover:text-white'}`}
                                    title="Citas programadas a futuro"
                                >
                                    Próximas
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('billed')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${statusFilter === 'billed' ? 'bg-emerald-500 text-black font-black' : 'text-slate-400 hover:text-white'}`}
                                >
                                    Cobradas
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table List */}
                    <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
                        {isLoading ? (
                            <div className="text-center py-16 text-slate-500 text-xs font-semibold animate-pulse">
                                Cargando información de comisiones...
                            </div>
                        ) : filteredAppointments.length === 0 ? (
                            <div className="text-center py-16 text-slate-500 text-xs italic">
                                No se encontraron citas agendadas vía Marketplace con los filtros aplicados.
                            </div>
                        ) : (
                            filteredAppointments.map((appt) => (
                                <div
                                    key={appt.id}
                                    className="bg-slate-950/80 border border-white/10 p-4 rounded-2xl hover:border-emerald-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-black text-white uppercase tracking-tight">
                                                {appt.tenantName}
                                            </span>
                                            <span className="text-[10px] font-extrabold text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                                                {appt.serviceName} (${appt.servicePrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })})
                                            </span>
                                            {appt.isFuture && !appt.commissionBilled && (
                                                <span className="text-[10px] font-extrabold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                    <Clock size={10} />
                                                    ⏳ Cita Próxima
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-300 flex items-center gap-2">
                                            <span className="font-semibold text-slate-200">{appt.clientName}</span>
                                            <span className="text-slate-500">•</span>
                                            <span className="font-mono text-slate-400">{appt.clientPhone || 'Sin tel.'}</span>
                                            <span className="text-slate-500">•</span>
                                            <span className="text-slate-400">{appt.date} ({appt.time})</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-white/5 shrink-0">
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase font-bold text-slate-500">Comisión</p>
                                            <p className="text-base font-black text-amber-400">
                                                ${appt.commissionAmount.toFixed(2)} MXN
                                            </p>
                                        </div>

                                        {appt.commissionBilled ? (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        await toggleCommissionBilled(appt.id, appt.commissionBilled);
                                                        refetch();
                                                        showToast('Comisión marcada como pendiente', 'success');
                                                    } catch (err) {
                                                        showToast('Error al actualizar estado de comisión', 'error');
                                                    }
                                                }}
                                                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 shadow-md bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30"
                                            >
                                                <CheckCircle2 size={14} />
                                                <span>✓ Cobrada</span>
                                            </button>
                                        ) : appt.isFuture ? (
                                            <button
                                                type="button"
                                                disabled={true}
                                                title="Esta cita aún no ha transcurrido. Solo se pueden cobrar comisiones una vez completada o efectuada la cita."
                                                className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-800/80 text-slate-500 border border-white/5 cursor-not-allowed flex items-center gap-1.5 opacity-75"
                                            >
                                                <Clock size={14} className="text-slate-500" />
                                                <span>⏳ Por atender</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        await toggleCommissionBilled(appt.id, appt.commissionBilled);
                                                        refetch();
                                                        showToast('Comisión marcada como cobrada ✅', 'success');
                                                    } catch (err) {
                                                        showToast('Error al actualizar estado de comisión', 'error');
                                                    }
                                                }}
                                                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 shadow-md bg-white/5 text-slate-300 border-white/10 hover:bg-emerald-500 hover:text-black hover:border-emerald-400"
                                            >
                                                <Clock size={14} className="text-amber-400" />
                                                <span>Marcar Cobrada</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Dedicated Panel: Citas Canceladas o No Asistidas en Marketplace */}
            <div className="bg-slate-900/60 border border-red-500/20 p-6 rounded-3xl flex flex-col space-y-4 shadow-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400">
                            <Filter size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-wider">
                                🚫 Registro de Citas Canceladas / No Asistidas (Marketplace)
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Citas del Marketplace que fueron canceladas o marcadas como no asistidas (No generan comisión).
                            </p>
                        </div>
                    </div>

                    <span className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider self-start sm:self-auto">
                        Total: {(mktData?.canceledMarketplaceAppointments || []).length} citas perdidas
                    </span>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-72 pr-1 custom-scrollbar">
                    {(!mktData?.canceledMarketplaceAppointments || mktData.canceledMarketplaceAppointments.length === 0) ? (
                        <div className="text-center py-10 text-slate-500 text-xs italic">
                            ¡Excelente! No hay registros de citas canceladas o no asistidas en el Marketplace.
                        </div>
                    ) : (
                        (selectedBusiness === 'all'
                            ? mktData.canceledMarketplaceAppointments
                            : mktData.canceledMarketplaceAppointments.filter(a => a.tenantName === selectedBusiness)
                        ).map((cAppt) => (
                            <div
                                key={cAppt.id}
                                className="bg-slate-950/80 border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-red-400 uppercase tracking-tight">
                                            {cAppt.tenantName}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                                            {cAppt.serviceName} (${cAppt.servicePrice.toFixed(2)})
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-300 flex items-center gap-2">
                                        <span className="font-semibold text-slate-200">{cAppt.clientName}</span>
                                        <span className="text-slate-500">•</span>
                                        <span className="font-mono text-slate-400">{cAppt.clientPhone || 'Sin tel.'}</span>
                                        <span className="text-slate-500">•</span>
                                        <span className="text-slate-400">{cAppt.date} ({cAppt.time})</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                    <span className="text-xs font-black text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-1 rounded-xl uppercase tracking-wider">
                                        {cAppt.status === 'no_asistio' || cAppt.status === 'no-show' ? 'No Asistió' : 'Cancelada'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ════ MODAL DE ESTADO DE CUENTA POR NEGOCIO ════ */}
            {showStatementModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
                    <style>{`
                        @media print {
                            body * { visibility: hidden; }
                            .printable-statement, .printable-statement * { visibility: visible; }
                            .printable-statement { position: absolute; left: 0; top: 0; width: 100%; color: black !important; background: white !important; padding: 20px !important; }
                            .no-print { display: none !important; }
                        }
                    `}</style>
                    <div className="relative w-full max-w-4xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8 max-h-[90vh]">
                        {/* Header Modal */}
                        <div className="flex items-center justify-between p-6 bg-slate-950 border-b border-white/10 no-print">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-wide">
                                        Estado de Cuenta de Comisiones
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Generador de reporte oficial para enviar a cada negocio
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <select
                                    value={statementBusiness}
                                    onChange={(e) => setStatementBusiness(e.target.value)}
                                    className="bg-slate-900 border border-emerald-500/30 text-emerald-400 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none"
                                >
                                    {businessNames.map((bName) => (
                                        <option key={bName} value={bName}>{bName}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => setShowStatementModal(false)}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Printable Statement Container */}
                        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 custom-scrollbar printable-statement bg-slate-900 text-white">
                            {/* Header del Estado de Cuenta */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl font-black text-emerald-400 tracking-tight uppercase">CitaLink</span>
                                        <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded uppercase">Estado de Cuenta</span>
                                    </div>
                                    <h2 className="text-xl font-bold text-white mt-1 uppercase tracking-wider">{statementBusiness}</h2>
                                    <p className="text-xs text-slate-400">Resumen de Comisiones por Citas agendadas vía Marketplace</p>
                                </div>
                                <div className="text-left sm:text-right">
                                    <p className="text-xs text-slate-400 font-medium">Fecha de Emisión:</p>
                                    <p className="text-sm font-bold text-white capitalize">
                                        {new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </p>
                                </div>
                            </div>

                            {/* Resumen Financiero del Negocio */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl">
                                    <p className="text-[10px] font-bold uppercase text-slate-400">Citas Totales</p>
                                    <p className="text-xl font-black text-white mt-0.5">{modalBizAppts.length}</p>
                                    <p className="text-[10px] text-slate-500">Marketplace</p>
                                </div>
                                <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl">
                                    <p className="text-[10px] font-bold uppercase text-slate-400">Ventas Generadas</p>
                                    <p className="text-xl font-black text-cyan-400 mt-0.5">
                                        ${modalBizSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-[10px] text-slate-500">Monto total de servicios</p>
                                </div>
                                <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl">
                                    <p className="text-[10px] font-bold uppercase text-slate-400">Comisiones Cobradas</p>
                                    <p className="text-xl font-black text-emerald-400 mt-0.5">
                                        ${modalBizBilledComm.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-[10px] text-emerald-500/80">Liquidadas</p>
                                </div>
                                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                                    <p className="text-[10px] font-bold uppercase text-amber-400">Saldo Pendiente</p>
                                    <p className="text-xl font-black text-amber-400 mt-0.5">
                                        ${modalBizPendingComm.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-[10px] text-amber-300">A liquidar a CitaLink</p>
                                </div>
                            </div>

                            {/* Desglose de Citas */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center justify-between">
                                    <span>Desglose de Citas Registradas</span>
                                    <span className="text-xs text-slate-400 font-normal">({modalBizAppts.length} registros)</span>
                                </h4>

                                {modalBizAppts.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500 text-xs italic">
                                        No hay citas registradas para este negocio en el Marketplace.
                                    </div>
                                ) : (
                                    <div className="border border-white/10 rounded-2xl overflow-hidden">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black border-b border-white/10">
                                                <tr>
                                                    <th className="p-3">Fecha & Hora</th>
                                                    <th className="p-3">Cliente</th>
                                                    <th className="p-3">Servicio</th>
                                                    <th className="p-3 text-right">Monto</th>
                                                    <th className="p-3 text-right">Comisión</th>
                                                    <th className="p-3 text-center">Estado Cobro</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {modalBizAppts.map((a) => (
                                                    <tr key={a.id} className="hover:bg-white/[0.02]">
                                                        <td className="p-3 font-semibold text-slate-200">{a.date} ({a.time})</td>
                                                        <td className="p-3 text-slate-300">
                                                            <div className="font-bold text-white">{a.clientName}</div>
                                                            <div className="text-[10px] text-slate-500">{a.clientPhone || 'Sin tel.'}</div>
                                                        </td>
                                                        <td className="p-3 text-slate-300">{a.serviceName}</td>
                                                        <td className="p-3 text-right font-mono text-slate-300">${a.servicePrice.toFixed(2)}</td>
                                                        <td className="p-3 text-right font-mono font-bold text-amber-400">${a.commissionAmount.toFixed(2)}</td>
                                                        <td className="p-3 text-center">
                                                            {a.commissionBilled ? (
                                                                <span className="bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px]">COBRADA</span>
                                                            ) : a.isFuture ? (
                                                                <span className="bg-cyan-500/20 text-cyan-400 font-bold px-2 py-0.5 rounded text-[10px]">POR ATENDER</span>
                                                            ) : (
                                                                <span className="bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded text-[10px]">PENDIENTE</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Citas Canceladas o Perdidas */}
                            {modalBizCanceledAppts.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-white/10">
                                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">
                                        🚫 Citas Canceladas o No Asistidas ({modalBizCanceledAppts.length})
                                    </h4>
                                    <div className="text-[11px] text-slate-400">
                                        {modalBizCanceledAppts.map(c => `${c.date} (${c.time}) - ${c.clientName} [${c.serviceName}]`).join(' • ')}
                                    </div>
                                </div>
                            )}

                            {/* Pie de página oficial para el negocio */}
                            <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 gap-2">
                                <p>CitaLink SaaS HQ • Estado de Cuenta automatizado para {statementBusiness}</p>
                                <p>Soporte CitaLink: contacto@citalink.app</p>
                            </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3 p-6 bg-slate-950 border-t border-white/10 no-print">
                            <button
                                onClick={() => downloadCommissionReportCSV(appointments, statementBusiness)}
                                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center gap-2"
                            >
                                <Download size={16} className="text-emerald-400" />
                                <span>Descargar Excel (CSV)</span>
                            </button>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowStatementModal(false)}
                                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all"
                                >
                                    Cerrar
                                </button>
                                <button
                                    onClick={handlePrintStatement}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-black text-xs uppercase tracking-wider hover:brightness-125 shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                                >
                                    <Printer size={16} />
                                    <span>Imprimir / Guardar PDF</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
