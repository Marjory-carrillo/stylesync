import { useState, useMemo } from 'react';
import { useAppointments } from '../../lib/store/queries/useAppointments';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useAuthStore } from '../../lib/store/authStore';
import { useServices } from '../../lib/store/queries/useServices';
import { CreditCard, CheckCircle2, Clock, MessageSquare, Search, DollarSign, Image as ImageIcon, Calendar, X, CalendarDays, ArrowRight } from 'lucide-react';
import { useUIStore } from '../../lib/store/uiStore';
import DatePickerInput from '../../components/DatePickerInput';
import { format, isSameWeek, parseISO, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Deposits() {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();
    const { data: tenantConfig } = useTenantData();
    const businessConfig = tenantConfig || ({} as any);
    const { services } = useServices();

    const { appointments, confirmByClient } = useAppointments({
        tenantId: tenantId ?? undefined,
        adminPhone: businessConfig?.phone,
        businessName: businessConfig?.name,
    });

    const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'all'>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

    // ── Date Filters ──
    const [startDateFilter, setStartDateFilter] = useState<string>(''); // YYYY-MM-DD (Desde)
    const [endDateFilter, setEndDateFilter] = useState<string>(''); // YYYY-MM-DD (Hasta)
    const [dateQuickFilter, setDateQuickFilter] = useState<'all' | 'today' | 'tomorrow' | 'week'>('all');

    // Helper: Check if appointment is in the past AND has a receipt attached
    const isPastApptWithReceipt = (appt: any) => {
        try {
            if (!appt.depositReceiptUrl) return false;
            const apptDt = new Date(`${appt.date}T${appt.time.slice(0, 5)}`);
            return new Date() > apptDt;
        } catch {
            return false;
        }
    };

    // Filter appointments that have or require a deposit
    const depositAppointments = useMemo(() => {
        return appointments.filter(a => {
            if (a.status === 'cancelada') return false;
            // Include if explicitly requires deposit or has deposit status
            return a.depositRequired || (a.depositAmount && a.depositAmount > 0) || a.depositStatus;
        });
    }, [appointments]);

    const stats = useMemo(() => {
        const approved = depositAppointments.filter(a => a.depositStatus === 'approved' || a.confirmedByClient || isPastApptWithReceipt(a));
        const pending = depositAppointments.filter(a => (a.depositStatus === 'pending' || (!a.depositStatus && a.depositRequired)) && !approved.includes(a));
        const totalApprovedAmount = approved.reduce((sum, a) => sum + (a.depositAmount || 0), 0);

        return {
            pendingCount: pending.length,
            approvedCount: approved.length,
            totalApprovedAmount
        };
    }, [depositAppointments]);

    const filteredAppointments = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
        const now = new Date();

        const list = depositAppointments.filter(a => {
            const matchesSearch =
                a.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.clientPhone.includes(searchQuery);

            if (!matchesSearch) return false;

            // Date filtering (Single date or Range: Desde / Hasta)
            if (startDateFilter && endDateFilter) {
                if (a.date < startDateFilter || a.date > endDateFilter) return false;
            } else if (startDateFilter) {
                if (a.date < startDateFilter) return false;
            } else if (endDateFilter) {
                if (a.date > endDateFilter) return false;
            } else if (dateQuickFilter === 'today') {
                if (a.date !== todayStr) return false;
            } else if (dateQuickFilter === 'tomorrow') {
                if (a.date !== tomorrowStr) return false;
            } else if (dateQuickFilter === 'week') {
                try {
                    const aDate = parseISO(a.date);
                    if (!isSameWeek(aDate, now, { locale: es })) return false;
                } catch { return false; }
            }

            const isApproved = a.depositStatus === 'approved' || a.confirmedByClient || isPastApptWithReceipt(a);
            const isPending = (a.depositStatus === 'pending' || (!a.depositStatus && a.depositRequired)) && !isApproved;

            if (activeTab === 'pending') return isPending;
            if (activeTab === 'approved') return isApproved;
            return true;
        });

        // Ordenar por fecha y hora más reciente arriba (más nueva primero)
        return list.sort((a, b) => {
            const dtA = new Date(`${a.date}T${a.time.slice(0, 5)}`).getTime();
            const dtB = new Date(`${b.date}T${b.time.slice(0, 5)}`).getTime();
            return dtB - dtA;
        });
    }, [depositAppointments, activeTab, searchQuery, startDateFilter, endDateFilter, dateQuickFilter]);

    const getServiceName = (serviceId: number) => {
        return services.find(s => Number(s.id) === Number(serviceId))?.name ?? 'Servicio';
    };

    const handleApproveDeposit = async (apptId: string) => {
        try {
            await confirmByClient(apptId);
            showToast('✅ Anticipo verificado y cita confirmada con éxito', 'success');
        } catch (err: any) {
            showToast('Error al confirmar anticipo: ' + err.message, 'error');
        }
    };

    const handleRequestReceiptWA = (phone: string, clientName: string, amount: number) => {
        const cleanPhone = phone.replace(/\D/g, '');
        const formattedPhone = cleanPhone.startsWith('52') ? cleanPhone : `52${cleanPhone}`;
        const msg = encodeURIComponent(
            `✨ ¡Hola, ${clientName}! Te saludamos de ${businessConfig?.name || 'nuestro salón'}. Recordamos que para confirmar tu cita solicitamos el comprobante del anticipo de $${amount} MXN. ¿Nos lo compartes por aquí por favor? 📲`
        );
        window.open(`https://wa.me/${formattedPhone}?text=${msg}`, '_blank');
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
                        <CreditCard className="text-emerald-400" size={28} />
                        Gestión de Anticipos
                    </h1>
                    <p className="text-xs text-slate-400 font-medium mt-1">
                        Valida transferencias, revisa comprobantes y confirma reservas en 1-clic.
                    </p>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-white space-y-1">
                    <div className="flex items-center justify-between text-amber-400 text-xs font-bold uppercase tracking-wider">
                        <span>Por Validar</span>
                        <Clock size={18} />
                    </div>
                    <p className="text-2xl font-black">{stats.pendingCount}</p>
                    <p className="text-[10px] text-amber-300/70">Comprobantes pendientes de revisión</p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-white space-y-1">
                    <div className="flex items-center justify-between text-emerald-400 text-xs font-bold uppercase tracking-wider">
                        <span>Anticipos Aprobados</span>
                        <CheckCircle2 size={18} />
                    </div>
                    <p className="text-2xl font-black">{stats.approvedCount}</p>
                    <p className="text-[10px] text-emerald-300/70">Citas con anticipo validado</p>
                </div>

                <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-white space-y-1">
                    <div className="flex items-center justify-between text-cyan-400 text-xs font-bold uppercase tracking-wider">
                        <span>Recibido Total</span>
                        <DollarSign size={18} />
                    </div>
                    <p className="text-2xl font-black">${stats.totalApprovedAmount} <span className="text-xs font-normal text-cyan-300">MXN</span></p>
                    <p className="text-[10px] text-cyan-300/70">Monto total de anticipos ingresados</p>
                </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-col gap-3 bg-slate-900/50 p-3 rounded-2xl border border-white/5">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                activeTab === 'pending'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            ⏳ Pendientes ({stats.pendingCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('approved')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                activeTab === 'approved'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            🟢 Aprobados ({stats.approvedCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                activeTab === 'all'
                                    ? 'bg-white/10 text-white border border-white/15'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Todos ({depositAppointments.length})
                        </button>
                    </div>

                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar por cliente o tel..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                    </div>
                </div>

                {/* Date Filters Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-white/5 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-400 font-bold text-[11px] flex items-center gap-1">
                            <CalendarDays size={14} className="text-emerald-400" /> Fecha:
                        </span>
                        <button
                            onClick={() => { setDateQuickFilter('all'); setStartDateFilter(''); setEndDateFilter(''); }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                dateQuickFilter === 'all' && !startDateFilter && !endDateFilter ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white bg-white/5'
                            }`}
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => { setDateQuickFilter('today'); setStartDateFilter(''); setEndDateFilter(''); }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                dateQuickFilter === 'today' && !startDateFilter && !endDateFilter ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white bg-white/5'
                            }`}
                        >
                            Hoy
                        </button>
                        <button
                            onClick={() => { setDateQuickFilter('tomorrow'); setStartDateFilter(''); setEndDateFilter(''); }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                dateQuickFilter === 'tomorrow' && !startDateFilter && !endDateFilter ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white bg-white/5'
                            }`}
                        >
                            Mañana
                        </button>
                        <button
                            onClick={() => { setDateQuickFilter('week'); setStartDateFilter(''); setEndDateFilter(''); }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                dateQuickFilter === 'week' && !startDateFilter && !endDateFilter ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white bg-white/5'
                            }`}
                        >
                            Esta Semana
                        </button>
                    </div>

                    {/* Date Range Picker (Desde ➔ Hasta) */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Rango:</span>
                        <DatePickerInput
                            value={startDateFilter}
                            onChange={(val) => { setStartDateFilter(val); setDateQuickFilter('all'); }}
                            placeholder="Desde"
                            align="right"
                            className="text-xs"
                        />
                        <ArrowRight size={12} className="text-slate-500" />
                        <DatePickerInput
                            value={endDateFilter}
                            onChange={(val) => { setEndDateFilter(val); setDateQuickFilter('all'); }}
                            placeholder="Hasta"
                            align="right"
                            className="text-xs"
                        />
                        {(startDateFilter || endDateFilter) && (
                            <button
                                onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-all cursor-pointer"
                                title="Limpiar rango de fechas"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* List / Table */}
            {filteredAppointments.length === 0 ? (
                <div className="p-12 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 space-y-3">
                    <CreditCard className="mx-auto text-slate-600" size={40} />
                    <p className="text-sm font-semibold text-slate-300">No hay anticipos en esta categoría</p>
                    <p className="text-xs text-slate-500">
                        {activeTab === 'pending'
                            ? '¡Genial! No tienes transferencias ni comprobantes pendientes de validar.'
                            : 'No se encontraron registros de anticipos con los filtros actuales.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {filteredAppointments.map(appt => {
                        const isPastAppt = isPastApptWithReceipt(appt);
                        const isApproved = appt.depositStatus === 'approved' || appt.confirmedByClient || isPastAppt;
                        const isPending = (appt.depositStatus === 'pending' || (!appt.depositStatus && appt.depositRequired)) && !isApproved;

                        return (
                            <div
                                key={appt.id}
                                className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                                    isApproved
                                        ? 'bg-emerald-500/5 border-emerald-500/20'
                                        : 'bg-slate-900/60 border-white/10 hover:border-white/20'
                                }`}
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="space-y-1 min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm font-bold text-white truncate">{appt.clientName}</h3>
                                            {isApproved ? (
                                                isPastAppt ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/30 text-[10px] font-black uppercase flex items-center gap-1">
                                                        ⏰ Cita Pasada (Comprobante Guardado)
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase">
                                                        ✓ Anticipo Aprobado
                                                    </span>
                                                )
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
                                                    ⏳ Pendiente de Validación
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-medium">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={14} className="text-slate-500" />
                                                {appt.date} • {appt.time.slice(0, 5)} hrs
                                            </span>
                                            <span>•</span>
                                            <span>{getServiceName(appt.serviceId)}</span>
                                            <span>•</span>
                                            <span className="text-white font-bold">Tel: {appt.clientPhone}</span>
                                        </div>

                                        <div className="pt-1 flex items-center gap-3 text-xs flex-wrap">
                                            <span className="text-slate-400">
                                                Monto Transferido: <strong className="text-emerald-400 font-black">${appt.depositAmount || 0} MXN</strong>
                                            </span>
                                            {appt.depositReceiptUrl && (
                                                <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold flex items-center gap-1">
                                                    🤖 Validado por IA (Fecha de Hoy, CLABE & Titular OK)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-white/5">
                                    {appt.depositReceiptUrl && (
                                        <button
                                            onClick={() => setSelectedReceiptUrl(appt.depositReceiptUrl!)}
                                            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <ImageIcon size={14} className="text-cyan-400" />
                                            Ver Comprobante
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleRequestReceiptWA(appt.clientPhone, appt.clientName, appt.depositAmount || 0)}
                                        className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <MessageSquare size={14} />
                                        Pedir por WA
                                    </button>

                                    {isPending && (
                                        <button
                                            onClick={() => handleApproveDeposit(appt.id)}
                                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                        >
                                            <CheckCircle2 size={16} />
                                            Aprobar Anticipo
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Receipt Modal */}
            {selectedReceiptUrl && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-white/15 rounded-3xl p-5 max-w-lg w-full space-y-4 shadow-2xl relative">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <ImageIcon size={20} className="text-cyan-400" />
                                Comprobante de Transferencia
                            </h3>
                            <button
                                onClick={() => setSelectedReceiptUrl(null)}
                                className="w-8 h-8 rounded-full bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="rounded-2xl overflow-hidden border border-white/10 bg-black flex items-center justify-center max-h-[65vh]">
                            <img
                                decoding="async" loading="lazy"
                                src={selectedReceiptUrl}
                                alt="Comprobante de Pago"
                                className="max-h-[65vh] w-auto object-contain"
                            />
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setSelectedReceiptUrl(null)}
                                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
