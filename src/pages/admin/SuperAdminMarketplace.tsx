import { useState } from 'react';
import {
    ShoppingBag, Search, Calendar, DollarSign, Sparkles, Download,
    CheckCircle2, Clock, Filter
} from 'lucide-react';
import {
    useMarketplaceAnalytics,
    useToggleCommissionBilled,
    downloadCommissionReportCSV
} from '../../lib/store/queries/useMarketplaceAnalytics';
import { useUIStore } from '../../lib/store/uiStore';

export default function SuperAdminMarketplace() {
    const { data: mktData, isLoading, refetch } = useMarketplaceAnalytics();
    const toggleCommissionBilled = useToggleCommissionBilled();
    const showToast = useUIStore((s) => s.showToast);

    const [selectedBusiness, setSelectedBusiness] = useState<string>('all');
    const [searchClient, setSearchClient] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'billed' | 'pending'>('all');

    // Filter appointments
    const appointments = mktData?.marketplaceAppointments || [];
    
    const businessNames = Array.from(new Set(appointments.map((a) => a.tenantName))).sort();

    const filteredAppointments = appointments.filter((appt) => {
        const matchesBusiness = selectedBusiness === 'all' || appt.tenantName === selectedBusiness;
        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'billed' && appt.commissionBilled) ||
            (statusFilter === 'pending' && !appt.commissionBilled);
        const matchesQuery =
            !searchClient.trim() ||
            appt.clientName.toLowerCase().includes(searchClient.toLowerCase()) ||
            appt.clientPhone.includes(searchClient) ||
            appt.tenantName.toLowerCase().includes(searchClient.toLowerCase()) ||
            appt.serviceName.toLowerCase().includes(searchClient.toLowerCase());

        return matchesBusiness && matchesStatus && matchesQuery;
    });

    // Summary calculations
    const totalBilled = filteredAppointments.filter(a => a.commissionBilled).reduce((acc, a) => acc + a.commissionAmount, 0);
    const totalPending = filteredAppointments.filter(a => !a.commissionBilled).reduce((acc, a) => acc + a.commissionAmount, 0);

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
                            Gestión de Citas agendadas por clientes en el buscador público y Cobranza de Comisiones (10% / 15%)
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={() => downloadCommissionReportCSV(appointments, selectedBusiness)}
                        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-125 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all flex items-center gap-2"
                    >
                        <Download size={16} />
                        <span>📄 Exportar Estado de Cuenta (CSV)</span>
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
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Comisiones Pendientes</p>
                        <p className="text-3xl font-black text-amber-400 mt-1">
                            ${totalPending.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-amber-500/80 mt-1">Por cobrar a negocios</p>
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
                                Revisa el estado de cada cita registrada desde el Marketplace y marca como cobrada.
                            </p>
                        </div>
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
                        <div className="flex items-center gap-2">
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
                                >
                                    Pendientes
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

                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await toggleCommissionBilled(appt.id, appt.commissionBilled);
                                                    refetch();
                                                    showToast(
                                                        appt.commissionBilled
                                                            ? 'Comisión marcada como pendiente'
                                                            : 'Comisión marcada como cobrada ✅',
                                                        'success'
                                                    );
                                                } catch (err) {
                                                    showToast('Error al actualizar estado de comisión', 'error');
                                                }
                                            }}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 shadow-md ${
                                                appt.commissionBilled
                                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                                                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-emerald-500 hover:text-black hover:border-emerald-400'
                                            }`}
                                        >
                                            {appt.commissionBilled ? (
                                                <>
                                                    <CheckCircle2 size={14} />
                                                    <span>✓ Cobrada</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Clock size={14} className="text-amber-400" />
                                                    <span>Marcar Cobrada</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
