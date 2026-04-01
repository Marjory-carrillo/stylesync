import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useCancellationLog } from '../../lib/store/queries/useCancellationLog';
import { useBlockedPhones } from '../../lib/store/queries/useBlockedPhones';
import { useAuthStore } from '../../lib/store/authStore';
import { useUIStore } from '../../lib/store/uiStore';
import { useAppointments } from '../../lib/store/queries/useAppointments';
import { useServices } from '../../lib/store/queries/useServices';
import { useStylists } from '../../lib/store/queries/useStylists';
import { useWaitingList } from '../../lib/store/queries/useWaitingList';
import { Skeleton } from '../../components/ui/Skeleton';
import { Trash2, User, Phone, Scissors, ChevronDown, MessageCircle, Users, CalendarDays, Clock, Search, X, LayoutList, Grid3X3, Plus, Download } from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import Pagination from '../../components/Pagination';
import WeekCalendar from '../../components/WeekCalendar';
import AdminBookingModal from '../../components/AdminBookingModal';
import DatePickerInput from '../../components/DatePickerInput';


export default function Appointments() {
    const { t } = useTranslation();
    const { userRole, userStylistId } = useAuthStore();
    const { showToast } = useUIStore();

    // Optimize: only load last 6 months for the agenda/list
    const startDate = useMemo(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 6);
        return d.toISOString().split('T')[0];
    }, []);

    const { appointments: allAppointments, cancelAppointment, isPending: apptsPending } = useAppointments({ startDate });
    const { services, isPending: servicesPending } = useServices();
    const { stylists, isPending: stylistsPending } = useStylists();
    const { waitingList, removeFromWaitingList } = useWaitingList();

    const isLoading = apptsPending || servicesPending || stylistsPending;
    const { data: tenantConfig } = useTenantData();
    const { cancellationLog } = useCancellationLog();
    const { isPhoneBlocked } = useBlockedPhones();

    // Helpers locales (ya tenemos services y stylists cargados arriba)
    const getServiceById = useCallback((id: number) =>
        services.find(s => s.id === id), [services]);
    const getStylistById = useCallback((id: number) =>
        stylists.find(s => s.id === id), [stylists]);

    const generateWhatsAppUrl = useCallback((apt: any) => {
        const svc = services.find(s => s.id === apt.serviceId);
        const biz = tenantConfig as any;
        let msg = '';
        if (biz?.confirmationTemplate) {
            msg = biz.confirmationTemplate
                .replace(/\[NOMBRE\]/g, apt.clientName || '')
                .replace(/\[SERVICIO\]/g, svc?.name || 'el servicio')
                .replace(/\[FECHA\]/g, apt.date || '')
                .replace(/\[HORA\]/g, apt.time || '')
                .replace(/\[NEGOCIO\]/g, biz?.name || '')
                .replace(/\[DIRECCION\]/g, biz?.address || '');
        } else {
            msg = `Hola *${apt.clientName}*, tu cita en *${biz?.name ?? 'el negocio'}* ha sido confirmada para el ${apt.date} a las ${apt.time}. Servicio: ${svc?.name ?? 'N/A'}. Direccion: ${biz?.address ?? ''}. ${biz?.googleMapsUrl ?? ''}`;
        }
        return `https://wa.me/${(apt.clientPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    }, [services, tenantConfig]);



    const appointments = useMemo(() => {
        if (userRole === 'employee' && userStylistId) {
            return allAppointments.filter(a => a.stylistId === userStylistId);
        }
        return allAppointments;
    }, [allAppointments, userRole, userStylistId]);

    const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'espera'>('list');
    const [filter, setFilter] = useState<'confirmada' | 'completada' | 'cancelada'>('confirmada');
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showWaiting, setShowWaiting] = useState(false);
    const [showLog, setShowLog] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{ open: boolean; appt: any | null }>({ open: false, appt: null });
    const [showBookingModal, setShowBookingModal] = useState(false);

    const PAGE_SIZE = 20;

    // ── CSV Export ──
    const exportCSV = () => {
        const headers = ['Fecha', 'Hora', 'Cliente', 'Teléfono', 'Servicio', 'Precio', 'Profesional', 'Estado'];
        const rows = filteredAppointments.map(apt => {
            const service = getServiceById(apt.serviceId);
            const stylist = apt.stylistId != null ? getStylistById(apt.stylistId) : undefined;
            let status = apt.status;
            if (status !== 'cancelada' && status !== 'completada') {
                const end = new Date(`${apt.date}T${apt.time}`);
                end.setMinutes(end.getMinutes() + (service?.duration || 0));
                if (new Date() >= end) status = 'completada';
            }
            return [
                apt.date,
                apt.time,
                apt.clientName,
                apt.clientPhone,
                service?.name || '',
                `$${service?.price || 0}`,
                stylist?.name || 'Cualquiera',
                status
            ];
        });

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const dateLabel = dateFilter || new Date().toLocaleDateString('en-CA');
        link.href = url;
        link.download = `citas-${filter}-${dateLabel}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('CSV descargado', 'success');
    };




    // Use local system date in YYYY-MM-DD format (timezone-safe)
    const todayStr = new Date().toLocaleDateString('en-CA');

    const filteredAppointments = appointments.filter(apt => {
        const service = getServiceById(apt.serviceId);
        let isFinished = apt.status === 'completada';

        if (!isFinished && apt.status !== 'cancelada') {
            const end = new Date(`${apt.date}T${apt.time}`);
            end.setMinutes(end.getMinutes() + (service?.duration || 0));
            if (new Date() >= end) isFinished = true;
        }


        if (filter === 'confirmada') {
            return apt.status === 'confirmada' && !isFinished;
        }
        if (filter === 'completada') {
            return isFinished;
        }
        return apt.status === filter;
    }).filter(apt => {
        // Text search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!apt.clientName.toLowerCase().includes(q) && !apt.clientPhone.includes(q)) {
                return false;
            }
        }
        // Date filter
        if (dateFilter) {
            return apt.date === dateFilter;
        }
        return true;
    }).sort((a, b) => {
        // Sort by date then time
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
    });

    const handleAdminCancel = (apt: typeof appointments[0]) => {
        setConfirmModal({ open: true, appt: apt });
    };

    const confirmCancel = async () => {
        const apt = confirmModal.appt;
        if (!apt) return;

        await cancelAppointment({ id: apt.id });
        setConfirmModal({ open: false, appt: null });

        // Check waiting list for this date
        const waitingForDate = waitingList.filter(w => w.date === apt.date);
        if (waitingForDate.length > 0) {
            showToast(`Hay ${waitingForDate.length} cliente(s) en espera para esta fecha`, 'info');
            setShowWaiting(true);
        }
    };

    return (
        <div className="animate-fade-in h-[calc(100vh-100px)] flex flex-col gap-6">

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-none px-1 w-full max-w-full">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">{t('appointments.title')}</h2>
                    <p className="text-sm text-muted-foreground">{t('appointments.subtitle')}</p>
                </div>

                {/* Nueva Cita button */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={exportCSV}
                        disabled={filteredAppointments.length === 0}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/5 text-slate-300 hover:text-white font-bold rounded-2xl hover:bg-white/10 transition-all border border-white/10 text-sm shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Exportar CSV"
                    >
                        <Download size={16} />
                        <span className="hidden sm:inline">CSV</span>
                    </button>
                    <button
                        onClick={() => setShowBookingModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accent to-cyan-500 text-white font-bold rounded-2xl hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-accent/20 text-sm shrink-0"
                    >
                        <Plus size={16} />
                        Nueva Cita
                    </button>
                </div>

                {/* Controls Container */}
                <div className="flex items-center gap-3 bg-black/40 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md overflow-x-auto hide-scrollbar w-full max-w-full">
                    {/* View Mode Toggles */}
                    <div className="flex gap-1 border-r border-white/10 pr-3 mr-1">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'}`}
                            title={t('appointments.view_list')}
                        >
                            <LayoutList size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'calendar' ? 'bg-white/10 text-white' : 'text-muted hover:text-white'}`}
                            title={t('appointments.view_calendar')}
                        >
                            <Grid3X3 size={18} />
                        </button>
                        {/* Lista de Espera tab with live badge */}
                        <button
                            onClick={() => setViewMode('espera')}
                            className={`relative p-1.5 rounded-lg transition-colors ${viewMode === 'espera' ? 'bg-amber-500/20 text-amber-400' : 'text-muted hover:text-amber-400'}`}
                            title="Lista de Espera"
                        >
                            <Users size={18} />
                            {waitingList.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none">
                                    {waitingList.length > 9 ? '9+' : waitingList.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Filters (Compact) */}
                    <div className="flex gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 overflow-x-auto hide-scrollbar">
                        {[
                            { id: 'confirmada', label: t('appointments.filters.confirmada'), color: 'bg-emerald-500', text: 'text-emerald-400' },
                            { id: 'completada', label: t('appointments.filters.completada'), color: 'bg-slate-500', text: 'text-slate-400' },
                            { id: 'cancelada', label: t('appointments.filters.cancelada'), color: 'bg-red-500', text: 'text-red-400' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setFilter(tab.id as any);
                                    setCurrentPage(1);
                                }}
                                className={`px-4 py-2 rounded-lg text-[11px] font-black transition-all whitespace-nowrap flex items-center gap-2 ${filter === tab.id
                                    ? `bg-white/10 text-white shadow-lg border border-white/10`
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                aria-current={filter === tab.id ? 'page' : undefined}
                            >
                                <span className={`h-1.5 w-1.5 rounded-full ${filter === tab.id ? tab.color : 'bg-slate-600 opacity-40'}`} />
                                {tab.label.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Secondary Controls: Search & Date Filter */}
            <div className="flex flex-col sm:flex-row gap-4 flex-none px-1 w-full max-w-full">
                <div className="flex-1 w-full bg-[#1a1f2e]/80 hover:bg-[#1f2536] p-3 rounded-2xl border border-white/5 hover:border-white/10 flex items-center gap-3 transition-all focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent/30 shadow-inner">
                    <Search className="text-muted shrink-0 ml-1" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o teléfono..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="bg-transparent border-none outline-none text-[15px] text-white placeholder:text-slate-500 w-full focus:ring-0 font-medium"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="p-1.5 text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                            <X size={14} />
                        </button>
                    )}
                </div>
                {/* Date Filter with custom picker */}
                <div className="relative">
                    <DatePickerInput
                        value={dateFilter}
                        onChange={(val) => { setDateFilter(val); setCurrentPage(1); }}
                        placeholder="Filtrar Fecha"
                        align="right"
                        className="h-full"
                    />
                    {dateFilter && (
                        <button
                            onClick={() => setDateFilter('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors z-10"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-2 flex-none">
                {/* Waiting List Alert (Compact) */}
                {waitingList.length > 0 && !showWaiting && (
                    <button
                        onClick={() => setShowWaiting(true)}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 hover:border-amber-500/40 transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-sm font-medium text-amber-200">
                                <span className="font-bold text-amber-400">{waitingList.length}</span> personas en lista de espera
                            </span>
                        </div>
                        <ChevronDown size={16} className="text-amber-500/50 group-hover:text-amber-400" />
                    </button>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-start w-full max-w-full">
                <div className="w-full max-w-5xl bg-black/20 rounded-3xl border border-white/5 backdrop-blur-sm overflow-hidden flex flex-col shadow-2xl h-full">
                    {/* ── Lista de Espera View ── */}
                    {viewMode === 'espera' ? (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                            <div className="max-w-2xl mx-auto space-y-4">
                                {/* Header */}
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                                        <Users size={20} className="text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-black text-lg">Lista de Espera</h3>
                                        <p className="text-xs text-slate-500">Clientes esperando un espacio disponible</p>
                                    </div>
                                    {waitingList.length > 0 && (
                                        <span className="ml-auto px-3 py-1 bg-amber-500 text-white text-xs font-black rounded-full">
                                            {waitingList.length} pendiente{waitingList.length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>

                                {waitingList.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                                        <Users size={48} className="text-white/10 mb-4" />
                                        <h4 className="text-white font-bold mb-1">Sin clientes en espera</h4>
                                        <p className="text-sm text-muted">Los clientes que soliciten un lugar aparecerán aquí.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {waitingList.map(client => {
                                            const svc = getServiceById(client.serviceId);
                                            const waPhone = client.phone.replace(/\D/g, '');
                                            const waMsg = encodeURIComponent(`Hola ${client.name}, te contactamos porque se ha liberado un espacio para ${svc?.name ?? 'tu servicio'} el ${new Date(client.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}. ¿Te gustaría reservar? 📅`);
                                            return (
                                                <div key={client.id} className="p-4 rounded-2xl bg-black/30 border border-amber-500/10 hover:border-amber-500/30 transition-all">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-white font-black text-base">{client.name}</span>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                {svc && (
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-lg">
                                                                        <Scissors size={9} /> {svc.name}
                                                                    </span>
                                                                )}
                                                                <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20 shadow-[0_0_10px_rgba(251,191,36,0.1)]">
                                                                    <CalendarDays size={10} />
                                                                    Desea cita para: {new Date(client.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                                                                    <Phone size={10} /> {client.phone}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => removeFromWaitingList(client.id)}
                                                            className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                    {/* Contact actions */}
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <a
                                                            href={`tel:${waPhone}`}
                                                            className="flex items-center justify-center gap-2 py-2.5 bg-sky-500/10 text-sky-400 border border-sky-500/15 hover:bg-sky-500 hover:text-white rounded-xl transition-all text-sm font-black"
                                                        >
                                                            <Phone size={15} /> Llamar
                                                        </a>
                                                        <a
                                                            href={`https://wa.me/${waPhone}?text=${waMsg}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 hover:bg-emerald-500 hover:text-white rounded-xl transition-all text-sm font-black"
                                                        >
                                                            <MessageCircle size={15} /> WhatsApp
                                                        </a>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : viewMode === 'calendar' ? (
                        <div className="flex-1 min-h-0 p-2 overflow-hidden">
                            <WeekCalendar
                                appointments={filteredAppointments}
                                services={services}
                                stylists={stylists}
                                onWhatsApp={(apt) => {
                                    const url = generateWhatsAppUrl(apt);
                                    window.open(url, '_blank');
                                }}
                                onCancel={(apt) => handleAdminCancel(apt)}
                            />
                        </div>
                    ) : (
                        <div className="overflow-y-auto custom-scrollbar p-3 space-y-2 flex-1">
                            {/* Empty State / Loading State */}
                            {isLoading ? (
                                <div className="space-y-4">
                                    {Array(5).fill(0).map((_, i) => (
                                        <div key={i} className="flex flex-col sm:flex-row bg-[#111116] border border-white/5 rounded-2xl p-4 gap-4">
                                            <div className="flex flex-col gap-2 flex-1">
                                                <Skeleton className="h-6 w-1/3" />
                                                <Skeleton className="h-4 w-1/2" />
                                            </div>
                                            <div className="w-full sm:w-48 flex flex-col gap-2">
                                                <Skeleton className="h-4 w-full" />
                                                <Skeleton className="h-4 w-2/3" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : filteredAppointments.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-60">
                                    <Scissors size={48} className="text-white/10 mb-4" />
                                    <h3 className="text-lg font-medium text-white mb-1">Sin citas aquí</h3>
                                    <p className="text-sm text-muted">No hay citas registradas en esta categoría.</p>
                                </div>
                            ) : (
                                /* Grouped List Items */
                                (() => {
                                    const paginatedAppts = filteredAppointments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
                                    const grouped = paginatedAppts.reduce((acc, apt) => {
                                        if (!acc[apt.date]) acc[apt.date] = [];
                                        acc[apt.date].push(apt);
                                        return acc;
                                    }, {} as Record<string, typeof appointments>);

                                    return Object.keys(grouped).sort().map(date => (
                                        <div key={date} className="space-y-2 mb-6 last:mb-2">
                                            {/* Date Header */}
                                            <div className="flex items-center gap-3 px-4 py-2.5 sticky top-2 mb-3 bg-[#10131c]/95 backdrop-blur-2xl z-20 rounded-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                                                <div className="p-1.5 rounded-xl bg-accent/10 border border-accent/20">
                                                    <CalendarDays size={13} className="text-accent" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-black uppercase tracking-[0.1em] text-white/90">
                                                        {new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                    </span>
                                                    {date === todayStr && (
                                                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-0.5">HOY</span>
                                                    )}
                                                </div>
                                            </div>

                                            {grouped[date].map((apt: any) => {
                                                const service = getServiceById(apt.serviceId);
                                                const stylist = getStylistById(apt.stylistId);

                                                let isCompleted = apt.status === 'completada';
                                                if (!isCompleted && apt.status !== 'cancelada') {
                                                    const end = new Date(`${apt.date}T${apt.time}`);
                                                    end.setMinutes(end.getMinutes() + (service?.duration || 0));
                                                    if (new Date() >= end) isCompleted = true;
                                                }

                                                const isCancelled = apt.status === 'cancelada';
                                                const blocked = isPhoneBlocked(apt.clientPhone);

                                                // Formatter for 12h time
                                                const displayTime = (() => {
                                                    const [h, m] = apt.time.split(':');
                                                    let hh = parseInt(h);
                                                    const ampm = hh >= 12 ? 'pm' : 'am';
                                                    hh = hh % 12;
                                                    hh = hh ? hh : 12;
                                                    return `${hh}:${m}${ampm}`;
                                                })();

                                                return (
                                                    <div
                                                        key={apt.id}
                                                        className={`group flex items-stretch gap-0 rounded-2xl border transition-all duration-500 overflow-hidden ${isCompleted ? 'bg-white/[0.01] border-white/5 opacity-50 grayscale' :
                                                            isCancelled ? 'bg-red-500/[0.02] border-red-500/10 opacity-70' :
                                                                'bg-slate-900/40 backdrop-blur-md border-white/5 hover:border-accent/40 shadow-xl hover:shadow-accent/10'
                                                            }`}
                                                    >
                                                        {/* Status Indicator Bar */}
                                                        <div className={`w-1.5 shrink-0 ${isCompleted ? 'bg-emerald-500/30' : isCancelled ? 'bg-red-500/30' : 'bg-gradient-to-b from-accent/80 to-accent/20'}`} />

                                                        {/* Time Column */}
                                                        <div className="flex flex-col items-center justify-center w-[72px] sm:w-20 shrink-0 bg-white/[0.02] border-r border-white/5 py-4">
                                                            <span className={`text-base sm:text-lg font-black tracking-tighter ${isCancelled ? 'text-red-400 line-through' : 'text-white'}`}>
                                                                {displayTime.replace(/(am|pm)/, '')}
                                                            </span>
                                                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-accent/80 -mt-1 sm:-mt-1.5">
                                                                {displayTime.match(/(am|pm)/)?.[0]}
                                                            </span>
                                                        </div>

                                                        {/* Main Info */}
                                                        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center p-3 gap-0 md:gap-4 overflow-hidden">
                                                            {/* Client info */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className={`text-lg font-bold ${isCancelled ? 'text-muted line-through' : 'text-white'}`}>
                                                                        {apt.clientName}
                                                                    </span>
                                                                    {blocked && <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-[10px] font-bold text-red-500 border border-red-500/20">BLOQUEADO</span>}
                                                                </div>
                                                                <a href={`tel:${apt.clientPhone}`} className="text-xs font-medium text-muted hover:text-accent transition-colors flex items-center gap-2 w-fit">
                                                                    <div className="p-1 rounded-md bg-white/5"><Phone size={10} /></div> {apt.clientPhone}
                                                                </a>
                                                            </div>

                                                            {/* Service & Stylist */}
                                                            <div className="flex flex-col gap-1.5 md:min-w-[180px] mt-2 md:mt-0">
                                                                <div className="flex items-center gap-2 text-[11px] font-black text-white px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 w-fit">
                                                                    <Scissors size={12} className="text-accent" />
                                                                    <span className="tracking-tight truncate max-w-[150px]">{service?.name}</span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 px-2 uppercase tracking-widest leading-none">
                                                                        <User size={10} className="opacity-40" />
                                                                        <span className="truncate max-w-[150px]">{stylist?.name || 'Cualquier profesional'}</span>
                                                                    </div>
                                                                    {apt.reminderSent && !isCancelled && (
                                                                        <div className="flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                                                                            <MessageCircle size={10} /> Recordatorio
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Actions */}
                                                            <div className="flex items-center justify-end gap-2 pr-1 mt-3 md:mt-0 pt-3 md:pt-0 border-t border-white/5 md:border-0 border-dashed">
                                                                {apt.status === 'confirmada' && (
                                                                    <div className="flex items-center gap-1">
                                                                        <a href={generateWhatsAppUrl(apt)} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl text-muted hover:bg-emerald-500/10 hover:text-emerald-400 transition-all border border-transparent hover:border-emerald-500/20" title="WhatsApp">
                                                                            <MessageCircle size={20} />
                                                                        </a>
                                                                        <button onClick={() => handleAdminCancel(apt)} className="p-2.5 rounded-xl text-muted hover:bg-red-500/10 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20" title="Cancelar">
                                                                            <Trash2 size={20} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ));
                                })()
                            )}

                            {!isLoading && filteredAppointments.length > 0 && (
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={Math.ceil(filteredAppointments.length / PAGE_SIZE)}
                                    onPageChange={setCurrentPage}
                                />
                            )}
                        </div>
                    )}

                    {/* Waiting List & Logs (Persistent — hidden when in espera tab) */}
                    {viewMode !== 'espera' && (waitingList.length > 0 || cancellationLog.length > 0) && (
                        <div className="p-4 border-t border-white/5 flex flex-col sm:flex-row gap-4 flex-none bg-black/20">
                            {waitingList.length > 0 && (
                                <div className="flex-1 rounded-2xl bg-[#161b2a]/95 backdrop-blur-md border border-amber-500/20 shadow-lg shadow-amber-500/5 overflow-hidden transition-all duration-300">
                                    <button
                                        onClick={() => setShowWaiting(!showWaiting)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-amber-500/5 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 group-hover:scale-110 transition-transform">
                                                <Users size={16} />
                                            </div>
                                            <span className="text-sm font-bold text-white tracking-wide">
                                                Lista de Espera <span className="ml-2 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-black">{waitingList.length}</span>
                                            </span>
                                        </div>
                                        <div className={`p-1.5 rounded-lg bg-white/5 text-muted transition-transform duration-300 ${showWaiting ? 'rotate-180 bg-white/10' : ''}`}>
                                            <ChevronDown size={14} />
                                        </div>
                                    </button>
                                    
                                    {/* Expandable Content for Waiting List */}
                                    <div className={`grid transition-all duration-300 ease-in-out ${showWaiting ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                        <div className="overflow-hidden">
                                            <div className="p-3 pt-0 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                                {waitingList.map(client => {
                                                    const svc = getServiceById(client.serviceId);
                                                    const waPhone = client.phone.replace(/\D/g, '');
                                                    const waMsg = encodeURIComponent(`Hola ${client.name}, te contactamos porque se ha liberado un espacio para ${svc?.name ?? 'tu servicio'} el ${new Date(client.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}. ¿Te gustaría reservar? 📅`);
                                                    return (
                                                        <div key={client.id} className="flex flex-col gap-2 p-3 rounded-xl bg-black/40 border border-white/5 hover:border-amber-500/30 hover:bg-[#1a1f2e] transition-all">
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="text-white font-bold text-sm tracking-tight">{client.name}</span>
                                                                    {svc && <span className="text-[10px] text-accent font-bold uppercase tracking-widest">{svc.name}</span>}
                                                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                                                        <span className="text-[10px] font-black text-amber-400 flex items-center gap-1">
                                                                            <CalendarDays size={10} /> Solicita para: {new Date(client.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}
                                                                        </span>
                                                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                                            <Phone size={10} /> {client.phone}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => removeFromWaitingList(client.id)}
                                                                    className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                                    title="Eliminar de lista"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                            {/* Action buttons — always visible */}
                                                            <div className="flex gap-2">
                                                                <a
                                                                    href={`tel:${waPhone}`}
                                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500 hover:text-white rounded-xl transition-all text-xs font-black"
                                                                    title="Llamar"
                                                                >
                                                                    <Phone size={13} /> Llamar
                                                                </a>
                                                                <a
                                                                    href={`https://wa.me/${waPhone}?text=${waMsg}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white rounded-xl transition-all text-xs font-black"
                                                                    title="WhatsApp"
                                                                >
                                                                    <MessageCircle size={13} /> WhatsApp
                                                                </a>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {cancellationLog.length > 0 && (
                                <div className="flex-1 rounded-2xl bg-[#161b2a]/95 backdrop-blur-md border border-white/5 hover:border-white/10 shadow-xl overflow-hidden transition-all duration-300">
                                    <button
                                        onClick={() => setShowLog(!showLog)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 group-hover:scale-110 transition-transform">
                                                <Clock size={16} />
                                            </div>
                                            <span className="text-sm font-bold text-white tracking-wide">
                                                Historial de Cancelaciones <span className="ml-2 text-muted font-normal text-xs">({cancellationLog.length})</span>
                                            </span>
                                        </div>
                                        <div className={`p-1.5 rounded-lg bg-white/5 text-muted transition-transform duration-300 ${showLog ? 'rotate-180 bg-white/10' : ''}`}>
                                            <ChevronDown size={14} />
                                        </div>
                                    </button>
                                    
                                    {/* Expandable Content for Logs */}
                                    <div className={`grid transition-all duration-300 ease-in-out ${showLog ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                        <div className="overflow-hidden">
                                            <div className="p-3 pt-0 space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                                {cancellationLog.slice(0, 10).map(log => (
                                                    <div key={log.id} className="flex justify-between items-center p-3 rounded-xl bg-black/20 border border-white/[0.02] hover:bg-white/5 hover:border-white/10 transition-colors">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-white/90 font-bold text-[13px]">{log.clientName}</span>
                                                            <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                                                                <span className="capitalize">{log.serviceName}</span>
                                                                <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                                                <span className="uppercase tracking-wider">{log.date}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="text-[10px] font-bold text-red-400/80 uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded">Cancelada</span>
                                                            <span className="opacity-50 text-[9px] font-medium text-slate-400">{new Date(log.cancelledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.open}
                title="Cancelar Cita"
                message={`¿Estás seguro de que deseas cancelar la cita de ${confirmModal.appt?.clientName}? Esta acción no se puede deshacer y el cliente será notificado por la lista de espera si hay alguien interesado.`}
                confirmLabel="Sí, Cancelar"
                onConfirm={confirmCancel}
                onCancel={() => setConfirmModal({ open: false, appt: null })}
                danger
            />

            <AdminBookingModal
                isOpen={showBookingModal}
                onClose={() => setShowBookingModal(false)}
            />
        </div>
    );
}
