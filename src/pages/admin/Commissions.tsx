import { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuthStore } from '../../lib/store/authStore';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useAppointments } from '../../lib/store/queries/useAppointments';
import { useStylists } from '../../lib/store/queries/useStylists';
import { useServices } from '../../lib/store/queries/useServices';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calculator, Download, Calendar as CalendarIcon, DollarSign, Users, TrendingUp, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Scissors, Clock, User } from 'lucide-react';
import type { CommissionEntry } from '../../lib/types/store.types';

export default function Commissions() {
    const { userRole } = useAuthStore();
    const { data: tenantConfig } = useTenantData();
    const businessConfig = tenantConfig || {} as any;
    
    const [periodType, setPeriodType] = useState<'day' | 'week' | 'month' | 'custom'>('week');
    const [referenceDate, setReferenceDate] = useState<Date>(new Date());
    const [customStart, setCustomStart] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [expandedStylistId, setExpandedStylistId] = useState<number | null>(null);

    const { start: startDate, end: endDate } = useMemo(() => {
        const weekStartsOn = (businessConfig?.weekStartsOn ?? 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6;

        switch (periodType) {
            case 'day': {
                const s = new Date(referenceDate);
                s.setHours(0, 0, 0, 0);
                const e = new Date(referenceDate);
                e.setHours(23, 59, 59, 999);
                return { start: s, end: e };
            }
            case 'week': {
                return { 
                    start: startOfWeek(referenceDate, { weekStartsOn }), 
                    end: endOfWeek(referenceDate, { weekStartsOn }) 
                };
            }
            case 'month': {
                return { 
                    start: startOfMonth(referenceDate), 
                    end: endOfMonth(referenceDate) 
                };
            }
            case 'custom': {
                const s = new Date(customStart + 'T00:00:00');
                const e = new Date(customEnd + 'T23:59:59');
                return { start: s, end: e };
            }
            default:
                return { start: new Date('2020-01-01'), end: new Date('2100-01-01') };
        }
    }, [periodType, referenceDate, customStart, customEnd, businessConfig?.weekStartsOn]);

    const { data: appointments = [] } = useAppointments({
        startDate: format(startDate, 'yyyy-MM-dd')
    });
    const { data: stylists = [] } = useStylists();
    const { data: services = [] } = useServices();

    const handlePrevPeriod = () => {
        setExpandedStylistId(null);
        switch (periodType) {
            case 'day':
                setReferenceDate(prev => subDays(prev, 1));
                break;
            case 'week':
                setReferenceDate(prev => subWeeks(prev, 1));
                break;
            case 'month':
                setReferenceDate(prev => subMonths(prev, 1));
                break;
            default:
                break;
        }
    };

    const handleNextPeriod = () => {
        setExpandedStylistId(null);
        switch (periodType) {
            case 'day':
                setReferenceDate(prev => addDays(prev, 1));
                break;
            case 'week':
                setReferenceDate(prev => addWeeks(prev, 1));
                break;
            case 'month':
                setReferenceDate(prev => addMonths(prev, 1));
                break;
            default:
                break;
        }
    };

    const periodLabel = useMemo(() => {
        switch (periodType) {
            case 'day':
                return format(referenceDate, "EEEE, dd 'de' MMMM yyyy", { locale: es });
            case 'week': {
                const startStr = format(startDate, "dd 'de' MMM", { locale: es });
                const endStr = format(endDate, "dd 'de' MMM, yyyy", { locale: es });
                return `Semana: ${startStr} al ${endStr}`;
            }
            case 'month':
                return format(referenceDate, "MMMM yyyy", { locale: es }).toUpperCase();
            case 'custom':
                return `Rango: ${format(startDate, 'dd/MM/yyyy')} al ${format(endDate, 'dd/MM/yyyy')}`;
            default:
                return '';
        }
    }, [periodType, referenceDate, startDate, endDate]);

    if (userRole !== 'owner' || !businessConfig?.commissionsEnabled) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <Calculator className="text-red-500 w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Acceso Denegado</h2>
                <p className="text-muted">No tienes permisos para ver el módulo de Nómina y Comisiones.</p>
            </div>
        );
    }

    const { commissionEntries, totalGenerated, totalToPay, apptsByStylist } = useMemo(() => {
        const now = new Date();

        // Filter valid completed appointments within date range
        const validAppointments = appointments.filter(apt => {
            if (!apt.stylistId || apt.status === 'cancelada') return false;

            let isCompleted = apt.status === 'completada';

            // Autocompletado virtual para la nómina
            if (!isCompleted && apt.status === 'confirmada') {
                const svc = services.find(s => s.id === apt.serviceId);
                const end = new Date(`${apt.date}T${apt.time}`);
                end.setMinutes(end.getMinutes() + (svc?.duration || 0));

                if (now >= end) {
                    isCompleted = true;
                }
            }

            if (!isCompleted) return false;

            const aptDate = parseISO(apt.date);
            return isWithinInterval(aptDate, { start: startDate, end: endDate });
        });

        const totalsByStylist: Record<number, { revenue: number, count: number }> = {};
        const apptsByStylist: Record<number, typeof appointments> = {};
        let grandTotalGen = 0;

        validAppointments.forEach(apt => {
            const svc = services.find(s => s.id === apt.serviceId);
            const price = svc?.price || 0;
            const sId = apt.stylistId!;

            if (!totalsByStylist[sId]) totalsByStylist[sId] = { revenue: 0, count: 0 };
            totalsByStylist[sId].revenue += price;
            totalsByStylist[sId].count += 1;
            grandTotalGen += price;

            if (!apptsByStylist[sId]) apptsByStylist[sId] = [];
            apptsByStylist[sId].push(apt);
        });

        let grandTotalCommissions = 0;

        const entries: CommissionEntry[] = stylists.map(stylist => {
            const stat = totalsByStylist[stylist.id] || { revenue: 0, count: 0 };
            const rate = stylist.commissionRate || 0;
            const earned = stat.revenue * (rate / 100);

            grandTotalCommissions += earned;

            return {
                stylistId: stylist.id,
                stylistName: stylist.name,
                totalRevenue: stat.revenue,
                appointmentsCount: stat.count,
                commissionRate: rate,
                commissionEarned: earned
            };
        }).sort((a, b) => b.totalRevenue - a.totalRevenue);

        return { 
            commissionEntries: entries, 
            totalGenerated: grandTotalGen, 
            totalToPay: grandTotalCommissions,
            apptsByStylist
        };
    }, [appointments, stylists, services, startDate, endDate]);

    const handleExportCSV = () => {
        const headers = ['Estilista', 'Citas Completadas', 'Total Generado', '% Comisión', 'Total a Pagar (Comisión)'];
        const rows = commissionEntries.map(e => [
            e.stylistName,
            e.appointmentsCount.toString(),
            `$${e.totalRevenue.toFixed(2)}`,
            `${e.commissionRate}%`,
            `$${e.commissionEarned.toFixed(2)}`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `nomina_citalink_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const businessName = businessConfig?.name || 'CitaLink Business';

        // Header
        doc.setFontSize(22);
        doc.setTextColor(40, 42, 54);
        doc.text(businessName.toUpperCase(), 14, 22);

        doc.setFontSize(14);
        doc.setTextColor(100, 100, 100);
        doc.text('REPORTE DE NÓMINA Y COMISIONES', 14, 32);

        doc.setFontSize(10);
        doc.text(`Período: ${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`, 14, 40);
        doc.text(`Fecha de Emisión: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 46);

        // Summary Stats
        doc.setDrawColor(230, 230, 230);
        doc.line(14, 52, 196, 52);

        doc.setFontSize(11);
        doc.setTextColor(40, 42, 54);
        doc.text(`Total Generado (Bruto): $${totalGenerated.toFixed(2)}`, 14, 62);
        doc.text(`Total a Liquidar (Comisiones): $${totalToPay.toFixed(2)}`, 14, 68);
        doc.text(`Total Citas: ${commissionEntries.reduce((sum, e) => sum + e.appointmentsCount, 0)}`, 14, 74);

        // Table
        autoTable(doc, {
            startY: 85,
            head: [['Profesional', 'Citas', 'Generado ($)', '% Com.', 'Pago ($)']],
            body: commissionEntries.map(e => [
                e.stylistName,
                e.appointmentsCount,
                e.totalRevenue.toFixed(2),
                `${e.commissionRate}%`,
                e.commissionEarned.toFixed(2)
            ]),
            styles: { fontSize: 9, cellPadding: 4 },
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            columnStyles: {
                2: { halign: 'right' },
                3: { halign: 'center' },
                4: { halign: 'right', fontStyle: 'bold' }
            }
        });

        // Footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                'Generado automáticamente por CitaLink - La plataforma #1 para la gestión de servicios.',
                14,
                doc.internal.pageSize.height - 10
            );
            doc.text(
                `Página ${i} de ${pageCount}`,
                doc.internal.pageSize.width - 30,
                doc.internal.pageSize.height - 10
            );
        }

        doc.save(`nomina_${businessName.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    return (
        <div className="animate-fade-in space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white mb-1 flex items-center gap-2">
                        <DollarSign className="text-accent" size={28} />
                        Nómina y Comisiones
                    </h1>
                    <p className="text-slate-400 text-sm">Registro financiero de tu equipo para liquidación de servicios.</p>
                </div>

                {/* Period Selector Tabs */}
                <div className="flex bg-slate-900/40 p-1 rounded-2xl border border-white/5 w-full md:w-auto overflow-x-auto">
                    {[
                        { id: 'day', label: 'Diario' },
                        { id: 'week', label: 'Semanal' },
                        { id: 'month', label: 'Mensual' },
                        { id: 'custom', label: 'Personalizado' }
                    ].map(period => (
                        <button
                            key={period.id}
                            onClick={() => {
                                setPeriodType(period.id as any);
                                setReferenceDate(new Date()); // Reset to today on change
                                setExpandedStylistId(null);
                            }}
                            className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-black transition-all whitespace-nowrap ${
                                periodType === period.id
                                    ? 'bg-accent text-[#0a0f1a] shadow-lg shadow-accent/15'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {period.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Navigation Panel */}
            <div className="glass-panel p-5 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                {periodType !== 'custom' ? (
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
                        <div className="flex gap-2">
                            <button
                                onClick={handlePrevPeriod}
                                className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                                title="Anterior"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={handleNextPeriod}
                                className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                                title="Siguiente"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <CalendarIcon size={16} className="text-accent" />
                            <span className="text-sm font-black text-white tracking-tight uppercase">
                                {periodLabel}
                            </span>
                            
                            {/* Hidden date picker trigger via icon */}
                            <label className="relative cursor-pointer p-1.5 hover:bg-white/5 rounded-lg transition-colors flex items-center justify-center">
                                <CalendarIcon size={14} className="text-slate-500 hover:text-white" />
                                <input
                                    type="date"
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                    value={format(referenceDate, 'yyyy-MM-dd')}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setReferenceDate(new Date(e.target.value + 'T12:00:00'));
                                            setExpandedStylistId(null);
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Desde:</span>
                            <input
                                type="date"
                                className="bg-slate-900/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent w-full sm:w-auto"
                                value={customStart}
                                onChange={(e) => { setCustomStart(e.target.value); setExpandedStylistId(null); }}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hasta:</span>
                            <input
                                type="date"
                                className="bg-slate-900/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent w-full sm:w-auto"
                                value={customEnd}
                                onChange={(e) => { setCustomEnd(e.target.value); setExpandedStylistId(null); }}
                            />
                        </div>
                    </div>
                )}

                <div className="text-xs font-bold text-slate-500 bg-white/5 border border-white/5 px-4 py-2 rounded-2xl">
                    Corte: {format(startDate, 'dd MMM yyyy', { locale: es }).toUpperCase()} - {format(endDate, 'dd MMM yyyy', { locale: es }).toUpperCase()}
                </div>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-[2rem] relative overflow-hidden group border border-white/5 bg-slate-900/40">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3.5 rounded-2xl bg-accent/10 text-accent">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Generado (Bruto)</p>
                            <h3 className="text-2xl font-black tracking-tight text-white mt-1">
                                ${totalGenerated.toFixed(2)}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-[2rem] relative overflow-hidden group border border-white/5 bg-slate-900/40">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl group-hover:bg-yellow-500/10 transition-colors"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3.5 rounded-2xl bg-yellow-500/10 text-yellow-500">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total a Pagar (Comisiones)</p>
                            <h3 className="text-2xl font-black tracking-tight text-white mt-1">
                                ${totalToPay.toFixed(2)}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-[2rem] relative overflow-hidden group border border-white/5 bg-slate-900/40">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3.5 rounded-2xl bg-blue-500/10 text-blue-500">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Citas Completadas</p>
                            <h3 className="text-2xl font-black tracking-tight text-white mt-1">
                                {commissionEntries.reduce((sum, e) => sum + e.appointmentsCount, 0)}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Table Desglose */}
            <div className="glass-panel rounded-3xl overflow-hidden border border-white/5 bg-slate-900/20">
                <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            Desglose por Profesional
                        </h2>
                        <p className="text-xs text-slate-500">Haz clic en la fila de un profesional para ver el detalle de sus servicios.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportCSV}
                            className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 flex items-center justify-center cursor-pointer active:scale-95"
                            title="Exportar CSV"
                        >
                            <Download size={20} />
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="btn btn-primary px-4 py-2.5 shadow-lg shadow-accent/20 flex items-center gap-2 font-bold text-xs uppercase tracking-wider"
                        >
                            <Calculator size={18} /> Generar Nómina PDF
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/30 text-xs uppercase tracking-wider text-slate-400 border-b border-white/5">
                                <th className="p-4 font-semibold w-12"></th>
                                <th className="p-4 font-semibold">Profesional</th>
                                <th className="p-4 font-semibold text-center">Citas</th>
                                <th className="p-4 font-semibold text-right">Generado</th>
                                <th className="p-4 font-semibold text-center">% Comisión</th>
                                <th className="p-4 font-semibold text-right text-accent">Pago (Comisión)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {commissionEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        No hay datos de citas completadas para el período seleccionado.
                                    </td>
                                </tr>
                            ) : (
                                commissionEntries.map((entry) => {
                                    const isExpanded = expandedStylistId === entry.stylistId;
                                    const stylistAppts = apptsByStylist[entry.stylistId] || [];

                                    return (
                                        <>
                                            <tr
                                                key={entry.stylistId}
                                                onClick={() => setExpandedStylistId(isExpanded ? null : entry.stylistId)}
                                                className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                                            >
                                                <td className="p-4 text-center text-slate-400">
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </td>
                                                <td className="p-4 text-white font-medium flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold shrink-0">
                                                        {entry.stylistName.charAt(0).toUpperCase()}
                                                    </div>
                                                    {entry.stylistName}
                                                </td>
                                                <td className="p-4 text-center text-slate-300">
                                                    {entry.appointmentsCount}
                                                </td>
                                                <td className="p-4 text-right text-emerald-400 font-medium tracking-tight">
                                                    ${entry.totalRevenue.toFixed(2)}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="bg-white/10 text-slate-300 px-2.5 py-1 rounded-md text-xs font-semibold">
                                                        {entry.commissionRate}%
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right text-accent font-bold tracking-tight text-base">
                                                    ${entry.commissionEarned.toFixed(2)}
                                                </td>
                                            </tr>

                                            {/* Sub-Table Accordion */}
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={6} className="bg-black/45 p-6 border-t border-b border-white/5">
                                                        <div className="rounded-2xl border border-white/5 overflow-hidden shadow-inner">
                                                            <div className="p-4 bg-slate-900/60 border-b border-white/5 flex items-center gap-2">
                                                                <Calculator size={14} className="text-accent" />
                                                                <span className="text-xs font-black text-white uppercase tracking-wider">Detalle de Servicios Realizados ({entry.stylistName})</span>
                                                            </div>
                                                            <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                                                <table className="w-full text-left text-xs border-collapse">
                                                                    <thead>
                                                                        <tr className="bg-slate-900/30 text-slate-400 border-b border-white/5 uppercase font-bold tracking-wide">
                                                                            <th className="p-3">Fecha y Hora</th>
                                                                            <th className="p-3">Cliente</th>
                                                                            <th className="p-3">Servicio</th>
                                                                            <th className="p-3 text-right">Precio</th>
                                                                            <th className="p-3 text-right text-accent">Comisión ({entry.commissionRate}%)</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-white/5">
                                                                        {stylistAppts.length === 0 ? (
                                                                            <tr>
                                                                                <td colSpan={5} className="p-4 text-center text-slate-500">Ningún servicio encontrado en este período.</td>
                                                                            </tr>
                                                                        ) : (
                                                                            stylistAppts.map((apt) => {
                                                                                const svc = services.find(s => s.id === apt.serviceId);
                                                                                const price = svc?.price || 0;
                                                                                const comm = price * (entry.commissionRate / 100);

                                                                                return (
                                                                                    <tr key={apt.id} className="hover:bg-white/[0.01] transition-colors">
                                                                                        <td className="p-3 text-slate-400 font-mono">
                                                                                            <span className="flex items-center gap-1">
                                                                                                <Clock size={12} className="opacity-40" />
                                                                                                {format(parseISO(apt.date), 'dd/MM/yyyy')} — {apt.time}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="p-3 text-white uppercase font-bold tracking-tight">
                                                                                            <span className="flex items-center gap-1">
                                                                                                <User size={12} className="opacity-40" />
                                                                                                {apt.clientName}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="p-3 text-slate-300">
                                                                                            <span className="flex items-center gap-1.5 font-medium">
                                                                                                <Scissors size={12} className="opacity-40" />
                                                                                                {svc?.name || 'Servicio'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="p-3 text-right text-emerald-400 font-bold">
                                                                                            ${price.toFixed(2)}
                                                                                        </td>
                                                                                        <td className="p-3 text-right text-accent font-black">
                                                                                            ${comm.toFixed(2)}
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
