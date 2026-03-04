import { useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calculator, Download, Calendar as CalendarIcon, DollarSign, Users, TrendingUp } from 'lucide-react';
import type { CommissionEntry } from '../../lib/types/store.types';

export default function Commissions() {
    const { appointments, stylists, services, userRole, businessConfig } = useStore();
    const [dateRange, setDateRange] = useState<'thisWeek' | 'thisMonth' | 'all'>('thisMonth');

    // Only owners can view this module, but we double-check just in case.
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

    const { start: startDate, end: endDate } = useMemo(() => {
        const now = new Date();
        switch (dateRange) {
            case 'thisWeek':
                return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
            case 'thisMonth':
                return { start: startOfMonth(now), end: endOfMonth(now) };
            default:
                return { start: new Date('2000-01-01'), end: new Date('2100-01-01') };
        }
    }, [dateRange]);

    const { commissionEntries, totalGenerated, totalToPay } = useMemo(() => {
        // Filter valid completed appointments within date range
        const validAppointments = appointments.filter(apt => {
            if (apt.status !== 'completada' || !apt.stylistId) return false;

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
                    <button
                        onClick={handleExportCSV}
                        className="btn bg-[#0f172a] hover:bg-white/5 text-white border border-white/10 shadow-sm flex items-center gap-2 py-2"
                    >
                        <Download size={16} /> Exportar CSV
                    </button>
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
