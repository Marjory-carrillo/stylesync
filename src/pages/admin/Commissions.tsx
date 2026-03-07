import { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuthStore } from '../../lib/store/authStore';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useAppointments } from '../../lib/store/queries/useAppointments';
import { useStylists } from '../../lib/store/queries/useStylists';
import { useServices } from '../../lib/store/queries/useServices';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calculator, Download, Calendar as CalendarIcon, DollarSign, Users, TrendingUp } from 'lucide-react';
import type { CommissionEntry } from '../../lib/types/store.types';

export default function Commissions() {
    const { userRole } = useAuthStore();
    const { data: tenantConfig } = useTenantData();
    const businessConfig = tenantConfig || {} as any;
    const [dateRange, setDateRange] = useState<'thisWeek' | 'thisMonth' | 'all'>('thisMonth');

    const { start: startDate, end: endDate } = useMemo(() => {
        const now = new Date();
        const weekStartsOn = (businessConfig?.weekStartsOn ?? 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6;

        switch (dateRange) {
            case 'thisWeek':
                return { start: startOfWeek(now, { weekStartsOn }), end: endOfWeek(now, { weekStartsOn }) };
            case 'thisMonth':
                return { start: startOfMonth(now), end: endOfMonth(now) };
            default:
                return { start: new Date('2020-01-01'), end: new Date('2100-01-01') };
        }
    }, [dateRange, businessConfig?.weekStartsOn]);

    const { data: appointments = [] } = useAppointments({
        startDate: format(startDate, 'yyyy-MM-dd')
    });
    const { data: stylists = [] } = useStylists();
    const { data: services = [] } = useServices();

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

    const { commissionEntries, totalGenerated, totalToPay } = useMemo(() => {
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
                    isCompleted = true; // La cita ya terminó, se marca como completada para nómina
                }
            }

            if (!isCompleted) return false;

            const aptDate = parseISO(apt.date);
            return isWithinInterval(aptDate, { start: startDate, end: endDate });
        });

        const totalsByStylist: Record<number, { revenue: number, count: number }> = {};
        let grandTotalGen = 0;

        validAppointments.forEach(apt => {
            const svc = services.find(s => s.id === apt.serviceId);
            const price = svc?.price || 0;
            const sId = apt.stylistId!;

            if (!totalsByStylist[sId]) totalsByStylist[sId] = { revenue: 0, count: 0 };
            totalsByStylist[sId].revenue += price;
            totalsByStylist[sId].count += 1;
            grandTotalGen += price;
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

        return { commissionEntries: entries, totalGenerated: grandTotalGen, totalToPay: grandTotalCommissions };
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white mb-1 flex items-center gap-2">
                        <DollarSign className="text-accent" size={28} />
                        Nómina y Comisiones
                    </h1>
                    <p className="text-slate-400 text-sm">Registro financiero de tu equipo para liquidación de servicios.</p>
                </div>

                <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 w-full md:w-auto overflow-x-auto">
                    {[
                        { id: 'thisWeek', label: 'Esta Semana' },
                        { id: 'thisMonth', label: 'Mes Actual' },
                        { id: 'all', label: 'Histórico' }
                    ].map(period => (
                        <button
                            key={period.id}
                            onClick={() => setDateRange(period.id as any)}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${dateRange === period.id
                                ? 'bg-accent/20 text-accent shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {period.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                            <TrendingUp className="text-accent" size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-400">Total Generado (Bruto)</p>
                            <h3 className="text-2xl font-black tracking-tight text-white mt-1">
                                ${totalGenerated.toFixed(2)}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl group-hover:bg-yellow-500/10 transition-colors"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                            <DollarSign className="text-yellow-500" size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-400">Total a Pagar (Comisiones)</p>
                            <h3 className="text-2xl font-black tracking-tight text-white mt-1">
                                ${totalToPay.toFixed(2)}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Users className="text-blue-500" size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-400">Citas Completadas</p>
                            <h3 className="text-2xl font-black tracking-tight text-white mt-1">
                                {commissionEntries.reduce((sum, e) => sum + e.appointmentsCount, 0)}
                            </h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
                <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        Desglose por Profesional
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportCSV}
                            className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5"
                            title="Exportar CSV"
                        >
                            <Download size={20} />
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="btn btn-primary px-4 py-2.5 shadow-lg shadow-accent/20 flex items-center gap-2"
                        >
                            <Calculator size={18} /> Generar Nómina PDF
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 text-xs uppercase tracking-wider text-slate-400 border-b border-white/10">
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
                                    <td colSpan={5} className="p-8 text-center text-muted">No hay datos de citas completadas para el período seleccionado.</td>
                                </tr>
                            ) : (
                                commissionEntries.map((entry) => (
                                    <tr key={entry.stylistId} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-white font-medium flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold shrink-0">
                                                {entry.stylistName.charAt(0)}
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {dateRange !== 'all' && (
                    <div className="p-4 bg-black/20 border-t border-white/5 text-center text-xs text-muted flex items-center justify-center gap-2">
                        <CalendarIcon size={14} />
                        Mostrando datos desde {format(startDate, 'dd MMMM yyyy', { locale: es })} hasta {format(endDate, 'dd MMMM yyyy', { locale: es })}
                    </div>
                )}
            </div>
        </div>
    );
}
