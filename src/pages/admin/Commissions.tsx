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
import { Calculator, Calendar as CalendarIcon, DollarSign, TrendingUp, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Sparkles, Clock, User, ShoppingBag, Power, Settings, X, Plus, Trash2 } from 'lucide-react';
import type { CommissionEntry } from '../../lib/types/store.types';
import DatePickerInput from '../../components/DatePickerInput';
import CustomSelect from '../../components/CustomSelect';
import { useUIStore } from '../../lib/store/uiStore';
import { usePayrollDeductions } from '../../lib/store/queries/usePayrollDeductions';

export default function Commissions() {
    const { userRole, loadingAuth, loadingTenant } = useAuthStore();
    const { data: tenantConfig, isLoading: isTenantConfigLoading, updateTenantData } = useTenantData();
    const { showToast } = useUIStore();
    const businessConfig = tenantConfig || {} as any;
    
    const { deductions, addDeduction, deleteDeduction, isAdding: isAddingDeduction } = usePayrollDeductions();
    const [isDeductionModalOpen, setIsDeductionModalOpen] = useState(false);
    const [deductionForm, setDeductionForm] = useState({
        stylistId: '',
        amount: '',
        concept: 'Adelanto de sueldo',
        date: format(new Date(), 'yyyy-MM-dd'),
        notes: ''
    });

    const [periodType, setPeriodType] = useState<'day' | 'week' | 'month' | 'custom'>('week');
    const [referenceDate, setReferenceDate] = useState<Date>(new Date());
    const [customStart, setCustomStart] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [expandedStylistId, setExpandedStylistId] = useState<number | null>(null);

    const currencySymbol = businessConfig?.currencySymbol || '$';
    const currencyCode = businessConfig?.currency || 'MXN';

    const formatMoney = (amount: number, includeSymbol = true) => {
        const formatted = Number(amount || 0).toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return includeSymbol ? `${currencySymbol}${formatted}` : formatted;
    };

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
    const { stylists = [], updateStylist } = useStylists();
    const { data: services = [] } = useServices();

    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

    const handleUpdateCommissionRate = async (stylistId: number, rate: number) => {
        try {
            await updateStylist({ id: stylistId, data: { commissionRate: rate } });
            showToast('Porcentaje de comisión actualizado', 'success');
        } catch (err: any) {
            showToast('Error al actualizar comisión: ' + (err?.message || 'Error desconocido'), 'error');
        }
    };

    const handleUpdateWeekStartsOn = async (val: string) => {
        const numericVal = parseInt(val) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
        try {
            await updateTenantData({ weekStartsOn: numericVal });
            showToast('Día de corte semanal actualizado', 'success');
        } catch (err: any) {
            showToast('Error al actualizar día de corte', 'error');
        }
    };

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

    const getAppointmentPrice = (apt: any) => {
        const service = services.find(s => s.id === apt.serviceId);
        
        // 1. Verificar si hay cotización confirmada o estimada
        const customPriceItem = (apt.additionalServices || []).find((s: string) => s.startsWith('Cotización Confirmada:'));
        if (customPriceItem) {
            const priceMatch = customPriceItem.match(/\$(\d+)/);
            if (priceMatch) return Number(priceMatch[1]);
        }
        const quoteItem = (apt.additionalServices || []).find((s: string) => s.startsWith('Cotización Estimada:'));
        if (quoteItem) {
            const priceMatch = quoteItem.match(/\$(\d+)/);
            if (priceMatch) return Number(priceMatch[1]);
        }
        
        // 2. Si no hay cotización, calculamos base (o diseño de catálogo) + adicionales
        let basePrice = service?.price || 0;
        
        const catalogItem = (apt.additionalServices || []).find((s: string) => s.startsWith('Diseño Catálogo:'));
        if (catalogItem) {
            const priceMatch = catalogItem.match(/\$(\d+)/);
            if (priceMatch) {
                basePrice = Number(priceMatch[1]);
            }
        }
        
        let total = basePrice;
        
        // Sumar adicionales normales
        const addOnNames = apt.additionalServices || [];
        addOnNames.forEach((name: string) => {
            if (
                name.startsWith('Cotización Confirmada:') || 
                name.startsWith('Cotización Estimada:') || 
                name.startsWith('Diseño Catálogo:') ||
                name.startsWith('Referencia:')
            ) {
                return;
            }
            
            const extraMatch = name.match(/\(\+\$(\d+(\.\d+)?)/i) || name.match(/\+\$(\d+(\.\d+)?)/i);
            if (extraMatch) {
                total += parseFloat(extraMatch[1]);
                return;
            }
            
            const cleanName = name
                .split('(+')[0]
                .replace(/^Extra:\s*/i, '')
                .replace(/^Diseño:\s*/i, '')
                .replace(/^Largo:\s*/i, '')
                .replace(/^Adicional:\s*/i, '')
                .replace(/^Estilo:\s*/i, '')
                .trim();
            const matchingService = services.find(s => s.name.toLowerCase() === cleanName.toLowerCase() || s.name.toLowerCase() === name.toLowerCase());
            if (matchingService) {
                total += matchingService.price;
            }
        });
        
        return total;
    };

    const { 
        commissionEntries, 
        totalGenerated, 
        totalMarketplaceDeductions, 
        totalNetRevenue, 
        totalCommissions,
        totalDeductions,
        totalToPay, 
        apptsByStylist,
        deductionsByStylist,
        periodDeductions 
    } = useMemo(() => {
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

        const mktRate = Number(businessConfig?.marketplaceCommissionRate ?? 15);
        const totalsByStylist: Record<number, { revenue: number, netRevenue: number, mktDeduction: number, count: number }> = {};
        const apptsByStylist: Record<number, typeof appointments> = {};
        let grandTotalGen = 0;
        let grandTotalMktDeductions = 0;
        let grandTotalNetRevenue = 0;

        validAppointments.forEach(apt => {
            const price = getAppointmentPrice(apt);
            const isMarketplace = apt.bookingSource === 'marketplace';
            const mktDeduction = isMarketplace ? price * (mktRate / 100) : 0;
            const netPrice = price - mktDeduction;
            const sId = apt.stylistId!;

            if (!totalsByStylist[sId]) {
                totalsByStylist[sId] = { revenue: 0, netRevenue: 0, mktDeduction: 0, count: 0 };
            }
            totalsByStylist[sId].revenue += price;
            totalsByStylist[sId].mktDeduction += mktDeduction;
            totalsByStylist[sId].netRevenue += netPrice;
            totalsByStylist[sId].count += 1;
            grandTotalGen += price;
            grandTotalMktDeductions += mktDeduction;
            grandTotalNetRevenue += netPrice;

            if (!apptsByStylist[sId]) apptsByStylist[sId] = [];
            apptsByStylist[sId].push(apt);
        });

        // Filtrar adelantos/deducciones del período
        const periodDeductions = deductions.filter(d => {
            if (!d.date) return false;
            try {
                const dDate = parseISO(d.date);
                return isWithinInterval(dDate, { start: startDate, end: endDate });
            } catch {
                return false;
            }
        });

        const deductionsByStylist: Record<number, typeof deductions> = {};
        const deductionTotalsByStylist: Record<number, number> = {};
        let grandTotalDeductions = 0;

        periodDeductions.forEach(d => {
            const sId = d.stylistId;
            if (!deductionsByStylist[sId]) deductionsByStylist[sId] = [];
            deductionsByStylist[sId].push(d);
            deductionTotalsByStylist[sId] = (deductionTotalsByStylist[sId] || 0) + Number(d.amount);
            grandTotalDeductions += Number(d.amount);
        });

        let grandTotalCommissions = 0;
        let grandTotalNetToPay = 0;

        const entries: CommissionEntry[] = stylists.map(stylist => {
            const stat = totalsByStylist[stylist.id] || { revenue: 0, netRevenue: 0, mktDeduction: 0, count: 0 };
            const rate = stylist.commissionRate || 0;
            const earned = stat.netRevenue * (rate / 100);
            const stylistDeductions = deductionTotalsByStylist[stylist.id] || 0;
            const netToPay = Math.max(0, earned - stylistDeductions);

            grandTotalCommissions += earned;
            grandTotalNetToPay += netToPay;

            return {
                stylistId: stylist.id,
                stylistName: stylist.name,
                totalRevenue: stat.revenue,
                marketplaceDeductionTotal: stat.mktDeduction,
                netRevenueForCommission: stat.netRevenue,
                appointmentsCount: stat.count,
                commissionRate: rate,
                commissionEarned: earned,
                deductionsTotal: stylistDeductions,
                netToPay
            };
        }).sort((a, b) => b.totalRevenue - a.totalRevenue);

        return { 
            commissionEntries: entries, 
            totalGenerated: grandTotalGen,
            totalMarketplaceDeductions: grandTotalMktDeductions,
            totalNetRevenue: grandTotalNetRevenue,
            totalCommissions: grandTotalCommissions,
            totalDeductions: grandTotalDeductions,
            totalToPay: grandTotalNetToPay,
            apptsByStylist,
            deductionsByStylist,
            periodDeductions
        };
    }, [appointments, stylists, services, deductions, startDate, endDate, businessConfig?.marketplaceCommissionRate]);

    const hasMarketplaceActivity = (totalMarketplaceDeductions || 0) > 0;

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const businessName = businessConfig?.name || 'CitaLink Business';
        const totalAppointments = commissionEntries.reduce((sum, e) => sum + e.appointmentsCount, 0);

        // Barra decorativa superior
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, 210, 5, 'F');

        // Encabezado Principal
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(15, 23, 42);
        doc.text(businessName.toUpperCase(), 14, 20);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(37, 99, 235); // blue-600
        doc.text('REPORTE OFICIAL DE NÓMINA Y COMISIONES', 14, 27);

        // Metadatos en dos columnas
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(`Período de Liquidación: ${format(startDate, 'dd/MM/yyyy')} al ${format(endDate, 'dd/MM/yyyy')}`, 14, 35);
        doc.text(`Moneda Oficial: ${currencyCode} (${currencySymbol})`, 14, 41);

        doc.text(`Fecha de Emisión: ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm")} hrs`, 196, 35, { align: 'right' });
        doc.text(`Estado: Liquidado / Para Firma`, 196, 41, { align: 'right' });

        // Tarjetas Métricas Resumen
        const boxY = 47;
        const boxHeight = 20;

        if (hasMarketplaceActivity) {
            // 5 cajitas métricas (182mm total disponible)
            const boxWidth = 33.2;
            const gap = 4;
            let currentX = 14;

            // Tarjeta 1: Total Bruto
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(currentX, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            doc.text('TOTAL BRUTO', currentX + 3, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(formatMoney(totalGenerated), currentX + 3, boxY + 15);

            // Tarjeta 2: Deducción Marketplace
            currentX += boxWidth + gap;
            doc.setFillColor(254, 243, 199); // amber-100
            doc.setDrawColor(251, 191, 36); // amber-400
            doc.roundedRect(currentX, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(180, 83, 9); // amber-700
            doc.text('DEDUC. MKT', currentX + 3, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(180, 83, 9);
            doc.text(`-${formatMoney(totalMarketplaceDeductions)}`, currentX + 3, boxY + 15);

            // Tarjeta 3: Total Comisiones Brutas
            currentX += boxWidth + gap;
            doc.setFillColor(240, 249, 255); // sky-50
            doc.setDrawColor(186, 230, 253); // sky-200
            doc.roundedRect(currentX, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(3, 105, 161); // sky-700
            doc.text('COMISIONES', currentX + 3, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(3, 105, 161);
            doc.text(formatMoney(totalCommissions), currentX + 3, boxY + 15);

            // Tarjeta 4: Adelantos / Préstamos
            currentX += boxWidth + gap;
            doc.setFillColor(255, 241, 242); // rose-50
            doc.setDrawColor(254, 205, 211); // rose-200
            doc.roundedRect(currentX, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(225, 29, 72); // rose-600
            doc.text('ADELANTOS', currentX + 3, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(225, 29, 72);
            doc.text(`-${formatMoney(totalDeductions)}`, currentX + 3, boxY + 15);

            // Tarjeta 5: Neto a Liquidar
            currentX += boxWidth + gap;
            doc.setFillColor(240, 253, 244); // emerald-50
            doc.setDrawColor(187, 247, 208); // emerald-200
            doc.roundedRect(currentX, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(16, 149, 119); // emerald-600
            doc.text('A LIQUIDAR', currentX + 3, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(16, 149, 119);
            doc.text(formatMoney(totalToPay), currentX + 3, boxY + 15);
        } else {
            // 4 cajitas estándar (182mm total)
            const boxWidth = 42.5;
            const gap = 4;
            let currentX = 14;

            // Tarjeta 1: Total Generado (Bruto)
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(currentX, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text('TOTAL GENERADO (BRUTO)', currentX + 3, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(15, 23, 42);
            doc.text(formatMoney(totalGenerated), currentX + 3, boxY + 15);

            // Tarjeta 2: Total Comisiones
            currentX += boxWidth + gap;
            doc.setFillColor(240, 249, 255);
            doc.setDrawColor(186, 230, 253);
            doc.roundedRect(currentX, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(3, 105, 161);
            doc.text('TOTAL COMISIONES', currentX + 3, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(3, 105, 161);
            doc.text(formatMoney(totalCommissions), currentX + 3, boxY + 15);

            // Tarjeta 3: Adelantos / Préstamos
            currentX += boxWidth + gap;
            doc.setFillColor(255, 241, 242);
            doc.setDrawColor(254, 205, 211);
            doc.roundedRect(currentX, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(225, 29, 72);
            doc.text('ADELANTOS / PRÉSTAMOS', currentX + 3, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(225, 29, 72);
            doc.text(`-${formatMoney(totalDeductions)}`, currentX + 3, boxY + 15);

            // Tarjeta 4: Total Neto a Liquidar
            currentX += boxWidth + gap;
            doc.setFillColor(240, 253, 244);
            doc.setDrawColor(187, 247, 208);
            doc.roundedRect(currentX, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(16, 149, 119);
            doc.text('TOTAL NETO A LIQUIDAR', currentX + 3, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(16, 149, 119);
            doc.text(formatMoney(totalToPay), currentX + 3, boxY + 15);
        }

        // Tabla de Desglose con fila de Totales
        if (hasMarketplaceActivity) {
            autoTable(doc, {
                startY: 74,
                head: [['Profesional / Estilista', 'Citas', `Bruto (${currencyCode})`, 'Deduc. Mkt', '% Com.', `Comisión`, `Adelantos (-)`, `Pago Neto (${currencyCode})`]],
                body: commissionEntries.map(e => [
                    e.stylistName,
                    e.appointmentsCount.toString(),
                    formatMoney(e.totalRevenue, true),
                    (e.marketplaceDeductionTotal || 0) > 0 ? `-${formatMoney(e.marketplaceDeductionTotal || 0, true)}` : '$0.00',
                    `${e.commissionRate}%`,
                    formatMoney(e.commissionEarned, true),
                    (e.deductionsTotal || 0) > 0 ? `-${formatMoney(e.deductionsTotal || 0, true)}` : '$0.00',
                    formatMoney(e.netToPay ?? e.commissionEarned, true)
                ]),
                foot: [[
                    'TOTAL GENERAL',
                    totalAppointments.toString(),
                    formatMoney(totalGenerated, true),
                    `-${formatMoney(totalMarketplaceDeductions, true)}`,
                    '-',
                    formatMoney(totalCommissions, true),
                    `-${formatMoney(totalDeductions, true)}`,
                    formatMoney(totalToPay, true)
                ]],
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: 3.5,
                    lineColor: [230, 235, 240],
                    lineWidth: 0.2
                },
                headStyles: {
                    fillColor: [15, 23, 42],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'left'
                },
                alternateRowStyles: {
                    fillColor: [249, 250, 251]
                },
                columnStyles: {
                    0: { cellWidth: 'auto', fontStyle: 'bold' },
                    1: { halign: 'center', cellWidth: 14 },
                    2: { halign: 'right', cellWidth: 23 },
                    3: { halign: 'right', cellWidth: 21, textColor: [180, 83, 9] },
                    4: { halign: 'center', cellWidth: 15 },
                    5: { halign: 'right', cellWidth: 23 },
                    6: { halign: 'right', cellWidth: 23, textColor: [225, 29, 72] },
                    7: { halign: 'right', cellWidth: 27, fontStyle: 'bold', textColor: [16, 149, 119] }
                },
                footStyles: {
                    fillColor: [241, 245, 249],
                    textColor: [15, 23, 42],
                    fontStyle: 'bold',
                    fontSize: 8
                }
            });
        } else {
            autoTable(doc, {
                startY: 74,
                head: [['Profesional / Estilista', 'Citas', `Generado (${currencyCode})`, '% Com.', `Comisión Bruta`, `Adelantos (-)`, `Pago Neto (${currencyCode})`]],
                body: commissionEntries.map(e => [
                    e.stylistName,
                    e.appointmentsCount.toString(),
                    formatMoney(e.totalRevenue, true),
                    `${e.commissionRate}%`,
                    formatMoney(e.commissionEarned, true),
                    (e.deductionsTotal || 0) > 0 ? `-${formatMoney(e.deductionsTotal || 0, true)}` : '$0.00',
                    formatMoney(e.netToPay ?? e.commissionEarned, true)
                ]),
                foot: [[
                    'TOTAL GENERAL',
                    totalAppointments.toString(),
                    formatMoney(totalGenerated, true),
                    '-',
                    formatMoney(totalCommissions, true),
                    `-${formatMoney(totalDeductions, true)}`,
                    formatMoney(totalToPay, true)
                ]],
                theme: 'grid',
                styles: {
                    fontSize: 8.5,
                    cellPadding: 4,
                    lineColor: [230, 235, 240],
                    lineWidth: 0.2
                },
                headStyles: {
                    fillColor: [15, 23, 42],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'left'
                },
                alternateRowStyles: {
                    fillColor: [249, 250, 251]
                },
                columnStyles: {
                    0: { cellWidth: 'auto', fontStyle: 'bold' },
                    1: { halign: 'center', cellWidth: 16 },
                    2: { halign: 'right', cellWidth: 28 },
                    3: { halign: 'center', cellWidth: 18 },
                    4: { halign: 'right', cellWidth: 28 },
                    5: { halign: 'right', cellWidth: 28, textColor: [225, 29, 72] },
                    6: { halign: 'right', cellWidth: 32, fontStyle: 'bold', textColor: [16, 149, 119] }
                },
                footStyles: {
                    fillColor: [241, 245, 249],
                    textColor: [15, 23, 42],
                    fontStyle: 'bold',
                    fontSize: 8.5
                }
            });
        }

        // Tabla Anexo si hay adelantos/deducciones en el período
        if (periodDeductions && periodDeductions.length > 0) {
            const currentTableY = (doc as any).lastAutoTable?.finalY || 130;
            const pageHeight = doc.internal.pageSize.height;
            let deductionsStartY = currentTableY + 10;

            if (deductionsStartY + 35 > pageHeight - 30) {
                doc.addPage();
                deductionsStartY = 20;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
            doc.text('ANEXO: DETALLE DE ADELANTOS Y PRÉSTAMOS DEDUCIDOS', 14, deductionsStartY);

            const stylistMap = new Map(stylists.map(s => [s.id, s.name]));

            autoTable(doc, {
                startY: deductionsStartY + 4,
                head: [['Fecha', 'Colaborador', 'Concepto', 'Notas', `Monto (${currencyCode})`]],
                body: periodDeductions.map(d => [
                    d.date ? format(parseISO(d.date), 'dd/MM/yyyy') : '-',
                    stylistMap.get(d.stylistId) || `Estilista #${d.stylistId}`,
                    d.concept || 'Adelanto de sueldo',
                    d.notes || '-',
                    `-${formatMoney(d.amount, true)}`
                ]),
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: 3,
                    lineColor: [241, 245, 249],
                    lineWidth: 0.2
                },
                headStyles: {
                    fillColor: [225, 29, 72], // rose-600
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'left'
                },
                alternateRowStyles: {
                    fillColor: [255, 241, 242] // rose-50
                },
                columnStyles: {
                    0: { cellWidth: 24, halign: 'center' },
                    1: { cellWidth: 38, fontStyle: 'bold' },
                    2: { cellWidth: 42 },
                    3: { cellWidth: 'auto', textColor: [100, 116, 139] },
                    4: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] }
                }
            });
        }

        // Sección de Firmas de Conformidad
        const lastY = (doc as any).lastAutoTable?.finalY || 180;
        const pageHeight = doc.internal.pageSize.height;
        let sigY = lastY + 32;

        // Si no cabe en la misma página, pasar a la siguiente hoja
        if (sigY + 25 > pageHeight - 20) {
            doc.addPage();
            sigY = 40;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);

        // Línea 1: Administrador / Empresa
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(25, sigY, 85, sigY);
        doc.text('Firma y Sello de la Empresa', 55, sigY + 5, { align: 'center' });

        // Línea 2: Conformidad del Equipo
        doc.line(125, sigY, 185, sigY);
        doc.text('Firma de Conformidad del Equipo', 155, sigY + 5, { align: 'center' });

        // Pie de Página en todas las hojas
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7.5);
            doc.setTextColor(148, 163, 184);
            doc.text(
                'Comprobante emitido por CitaLink - Gestión de Citas y Liquidación de Servicios.',
                14,
                pageHeight - 8
            );
            doc.text(
                `Página ${i} de ${pageCount}`,
                doc.internal.pageSize.width - 14,
                pageHeight - 8,
                { align: 'right' }
            );
        }

        doc.save(`nomina_${businessName.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const isLoading = loadingAuth || loadingTenant || isTenantConfigLoading;
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
                <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin mb-4" />
                <p className="text-slate-400 font-medium text-sm">Cargando nómina y comisiones...</p>
            </div>
        );
    }

    if (userRole !== 'owner' || businessConfig?.plan === 'lite') {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <Calculator className="text-red-500 w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Acceso Denegado</h2>
                <p className="text-muted">
                    {businessConfig?.plan === 'lite'
                        ? 'El módulo de Nómina y Comisiones no está disponible en el plan Esencial (1 solo profesional).'
                        : 'No tienes permisos para ver el módulo de Nómina y Comisiones.'}
                </p>
            </div>
        );
    }

    if (!businessConfig?.commissionsEnabled) {
        return (
            <div className="animate-fade-in flex flex-col items-center justify-center p-6 md:p-12 text-center min-h-[70vh]">
                <div className="relative mb-6">
                    <div className="w-20 h-20 bg-accent/10 border border-accent/20 rounded-3xl flex items-center justify-center shadow-xl shadow-accent/5">
                        <DollarSign className="text-accent w-10 h-10" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center">
                        <Power size={12} className="text-slate-400" />
                    </div>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-bold border border-white/10 mb-3">
                    <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                    <span>Módulo Desactivado</span>
                </div>

                <h2 className="text-2xl md:text-3xl font-black text-white mb-3 tracking-tight">
                    Nómina y Comisiones
                </h2>
                
                <p className="text-slate-400 text-sm max-w-lg mb-8 leading-relaxed">
                    Calcula automáticamente los pagos de tu equipo por citas atendidas, desglosa propinas, servicios y genera recibos de liquidación en PDF en segundos.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl w-full mb-8 text-left">
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
                        <div className="text-accent font-black text-sm">📊 Cortes de Pago</div>
                        <p className="text-[11px] text-slate-400">Por día, semana, mes o fechas personalizadas.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
                        <div className="text-accent font-black text-sm">👥 Por Especialista</div>
                        <p className="text-[11px] text-slate-400">Comisiones individuales según su tarifa asignada.</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
                        <div className="text-accent font-black text-sm">📄 Exportar PDF</div>
                        <p className="text-[11px] text-slate-400">Genera recibos profesionales listos para enviar.</p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={async () => {
                        await updateTenantData({ commissionsEnabled: true });
                        showToast('¡Módulo de Nómina y Comisiones activado! 🚀', 'success');
                    }}
                    className="btn bg-accent hover:bg-accent/90 text-slate-950 font-black text-sm px-8 py-3.5 rounded-2xl shadow-xl shadow-accent/20 active:scale-95 transition-all flex items-center gap-2.5 cursor-pointer"
                >
                    <Power size={18} />
                    <span>Activar Módulo de Nómina</span>
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-1 flex items-center gap-2">
                        <DollarSign className="text-accent" size={28} />
                        Nómina y Comisiones
                    </h1>
                    <p className="text-slate-400 text-xs md:text-sm">Registro financiero de tu equipo para liquidación de servicios.</p>
                </div>

                {/* Botón de configuración */}
                <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(true)}
                    className="btn bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/10 hover:border-accent/40 font-bold text-xs px-4 py-2.5 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                    title="Configurar día de corte y comisiones por especialista"
                >
                    <Settings size={16} className="text-accent shrink-0" />
                    <span className="whitespace-nowrap">Configurar Nómina</span>
                </button>
            </div>

            {/* Barra de Control Unificada: Período y Fechas */}
            <div className="glass-panel p-2 sm:p-2.5 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-3">
                {/* Pestañas de Período */}
                <div className="flex bg-slate-900/70 p-1 rounded-xl border border-white/5 w-full md:w-auto overflow-x-auto custom-scrollbar">
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
                                setReferenceDate(new Date());
                                setExpandedStylistId(null);
                            }}
                            className={`flex-1 md:flex-initial px-4 py-2 rounded-lg text-xs uppercase tracking-wider font-black transition-all text-center whitespace-nowrap cursor-pointer ${
                                periodType === period.id
                                    ? 'bg-accent text-[#0a0f1a] shadow-md shadow-accent/15'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {period.label}
                        </button>
                    ))}
                </div>

                {/* Navegación de Fechas & Rango de Corte */}
                <div className="flex flex-wrap items-center justify-center md:justify-end gap-2.5 w-full md:w-auto">
                    {periodType !== 'custom' ? (
                        <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5">
                            <button
                                onClick={handlePrevPeriod}
                                className="p-1.5 hover:bg-white/10 text-white rounded-lg transition-colors active:scale-95 cursor-pointer"
                                title="Anterior"
                            >
                                <ChevronLeft size={18} />
                            </button>

                            <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-black text-white uppercase tracking-tight">
                                <CalendarIcon size={14} className="text-accent shrink-0" />
                                <span>{periodLabel}</span>

                                <label className="relative cursor-pointer p-0.5 hover:bg-white/10 rounded transition-colors flex items-center justify-center" title="Elegir fecha">
                                    <CalendarIcon size={12} className="text-slate-500 hover:text-white" />
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

                            <button
                                onClick={handleNextPeriod}
                                className="p-1.5 hover:bg-white/10 text-white rounded-lg transition-colors active:scale-95 cursor-pointer"
                                title="Siguiente"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <DatePickerInput
                                value={customStart}
                                onChange={(val) => { setCustomStart(val); setExpandedStylistId(null); }}
                                compact
                                className="w-32"
                                align="left"
                            />
                            <span className="text-slate-500 text-xs font-bold">-</span>
                            <DatePickerInput
                                value={customEnd}
                                onChange={(val) => { setCustomEnd(val); setExpandedStylistId(null); }}
                                compact
                                className="w-32"
                                align="right"
                            />
                        </div>
                    )}

                    {/* Badge de Corte */}
                    <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl whitespace-nowrap">
                        Corte: {format(startDate, 'dd MMM', { locale: es }).toUpperCase()} - {format(endDate, 'dd MMM yyyy', { locale: es }).toUpperCase()}
                    </div>
                </div>
            </div>

            {/* Metrics cards */}
            <div className={`grid grid-cols-1 md:grid-cols-2 ${hasMarketplaceActivity ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 sm:gap-6`}>
                <div className="glass-panel p-5 sm:p-6 rounded-[2rem] relative overflow-hidden group border border-white/5 bg-slate-900/40">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3.5 rounded-2xl bg-accent/10 text-accent">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Generado (Bruto)</p>
                            <h3 className="text-2xl font-black tracking-tight text-white mt-1">
                                {formatMoney(totalGenerated)}
                            </h3>
                        </div>
                    </div>
                </div>

                {hasMarketplaceActivity && (
                    <div className="glass-panel p-6 rounded-[2rem] relative overflow-hidden group border border-amber-500/20 bg-amber-500/[0.03]">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/15 transition-colors"></div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="p-3.5 rounded-2xl bg-amber-500/15 text-amber-400">
                                <ShoppingBag size={24} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-amber-400/80 uppercase tracking-widest flex items-center gap-1.5">
                                    Deducción Marketplace
                                    <span className="bg-amber-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold">-{businessConfig?.marketplaceCommissionRate || 10}%</span>
                                </p>
                                <h3 className="text-2xl font-black tracking-tight text-amber-400 mt-1">
                                    -{formatMoney(totalMarketplaceDeductions)}
                                </h3>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Base neta: {formatMoney(totalNetRevenue)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tarjeta: Comisiones del Equipo */}
                <div className="glass-panel p-5 sm:p-6 rounded-[2rem] relative overflow-hidden group border border-white/5 bg-slate-900/40">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl group-hover:bg-yellow-500/10 transition-colors"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3.5 rounded-2xl bg-yellow-500/10 text-yellow-500">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Comisiones del Equipo</p>
                            <h3 className="text-2xl font-black tracking-tight text-white mt-1">
                                {formatMoney(totalCommissions)}
                            </h3>
                            {hasMarketplaceActivity && (
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Base neta: {formatMoney(totalNetRevenue)}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tarjeta: Adelantos y Préstamos */}
                <div className="glass-panel p-5 sm:p-6 rounded-[2rem] relative overflow-hidden group border border-rose-500/20 bg-rose-500/[0.02]">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl group-hover:bg-rose-500/10 transition-colors"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-400">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-rose-400/90 uppercase tracking-widest">Adelantos / Préstamos</p>
                            <h3 className="text-2xl font-black tracking-tight text-rose-400 mt-1">
                                {totalDeductions > 0 ? `-${formatMoney(totalDeductions)}` : '$0.00'}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">Descontados automáticamente</p>
                        </div>
                    </div>
                </div>

                {/* Tarjeta: Total Neto a Liquidar */}
                <div className="glass-panel p-5 sm:p-6 rounded-[2rem] relative overflow-hidden group border border-emerald-500/20 bg-emerald-500/[0.03]">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/15 transition-colors"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3.5 rounded-2xl bg-emerald-500/15 text-emerald-400">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-400/90 uppercase tracking-widest">Total Neto a Liquidar</p>
                            <h3 className="text-2xl font-black tracking-tight text-emerald-400 mt-1">
                                {formatMoney(totalToPay)}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">Pago final al equipo</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Table Desglose */}
            <div className="glass-panel rounded-3xl overflow-hidden border border-white/5 bg-slate-900/20">
                <div className="p-5 sm:p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            Desglose por Profesional
                        </h2>
                        <p className="text-xs text-slate-500">Haz clic en la fila de un profesional para ver el detalle de sus servicios y préstamos.</p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => {
                                setDeductionForm({
                                    stylistId: stylists[0]?.id ? String(stylists[0].id) : '',
                                    amount: '',
                                    concept: 'Adelanto de sueldo',
                                    date: format(new Date(), 'yyyy-MM-dd'),
                                    notes: ''
                                });
                                setIsDeductionModalOpen(true);
                            }}
                            className="flex-1 sm:flex-initial btn bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 hover:border-accent/40 font-bold text-xs uppercase tracking-wider px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
                        >
                            <Plus size={16} className="text-accent" />
                            <span>Registrar Adelanto</span>
                        </button>

                        <button
                            onClick={handleExportPDF}
                            className="flex-1 sm:flex-initial btn btn-primary px-4 py-2.5 shadow-lg shadow-accent/20 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-95"
                        >
                            <Calculator size={18} /> Generar Nómina
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
                                <th className="p-4 font-semibold text-right">Generado (Bruto)</th>
                                {hasMarketplaceActivity && (
                                    <>
                                        <th className="p-4 font-semibold text-right text-amber-400">Deduc. Marketplace</th>
                                        <th className="p-4 font-semibold text-right text-sky-400">Base Comisionable</th>
                                    </>
                                )}
                                <th className="p-4 font-semibold text-center">% Comisión</th>
                                <th className="p-4 font-semibold text-right text-yellow-400">Comisión</th>
                                <th className="p-4 font-semibold text-right text-rose-400">Adelantos (-)</th>
                                <th className="p-4 font-semibold text-right text-emerald-400">Pago Neto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {commissionEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={hasMarketplaceActivity ? 9 : 7} className="p-8 text-center text-slate-500">
                                        No hay datos de citas completadas para el período seleccionado.
                                    </td>
                                </tr>
                            ) : (
                                commissionEntries.map((entry) => {
                                    const isExpanded = expandedStylistId === entry.stylistId;
                                    const stylistAppts = apptsByStylist[entry.stylistId] || [];
                                    const stylistDeductions = deductionsByStylist[entry.stylistId] || [];

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
                                                    <div>
                                                        <div className="font-bold">{entry.stylistName}</div>
                                                        {(entry.marketplaceDeductionTotal || 0) > 0 && (
                                                            <span className="text-[10px] font-semibold text-amber-400/90 flex items-center gap-1 mt-0.5">
                                                                <ShoppingBag size={10} /> Con reservas Marketplace
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center text-slate-300 font-bold">
                                                    {entry.appointmentsCount}
                                                </td>
                                                <td className="p-4 text-right text-slate-200 font-bold tracking-tight">
                                                    {formatMoney(entry.totalRevenue)}
                                                </td>
                                                {hasMarketplaceActivity && (
                                                    <>
                                                        <td className="p-4 text-right text-amber-400 font-medium tracking-tight">
                                                            {(entry.marketplaceDeductionTotal || 0) > 0 ? (
                                                                <span className="font-mono">-{formatMoney(entry.marketplaceDeductionTotal || 0)}</span>
                                                            ) : (
                                                                <span className="text-slate-600">-</span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-right text-sky-300 font-medium tracking-tight font-mono">
                                                            {formatMoney(entry.netRevenueForCommission || 0)}
                                                        </td>
                                                    </>
                                                )}
                                                <td className="p-4 text-center">
                                                    <span className="bg-white/10 text-slate-300 px-2.5 py-1 rounded-md text-xs font-semibold">
                                                        {entry.commissionRate}%
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right text-yellow-400 font-bold tracking-tight text-sm font-mono">
                                                    <div>{formatMoney(entry.commissionEarned)}</div>
                                                    {(entry.marketplaceDeductionTotal || 0) > 0 && (
                                                        <span className="text-[10px] text-slate-400 font-normal block font-mono">
                                                            {entry.commissionRate}% de {formatMoney(entry.netRevenueForCommission || 0)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {(entry.deductionsTotal || 0) > 0 ? (
                                                        <span className="font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20 text-xs">
                                                            -{formatMoney(entry.deductionsTotal || 0)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-600 text-xs">-</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right text-emerald-400 font-black tracking-tight text-base font-mono">
                                                    <div>{formatMoney(entry.netToPay ?? entry.commissionEarned)}</div>
                                                </td>
                                            </tr>

                                            {/* Sub-Table Accordion */}
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={hasMarketplaceActivity ? 9 : 7} className="bg-black/45 p-6 border-t border-b border-white/5">
                                                        <div className="space-y-4">
                                                            {/* Citas Realizadas */}
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
                                                                                    const price = getAppointmentPrice(apt);
                                                                                    const isMarketplace = apt.bookingSource === 'marketplace';
                                                                                    const mktRate = Number(businessConfig?.marketplaceCommissionRate ?? 15);
                                                                                    const mktDeduction = isMarketplace ? price * (mktRate / 100) : 0;
                                                                                    const netPrice = price - mktDeduction;
                                                                                    const comm = netPrice * (entry.commissionRate / 100);
                                                                                    const displayAddons = (apt.additionalServices || []).filter((s: string) => !s.startsWith('Referencia:'));

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
                                                                                                <div className="flex flex-col">
                                                                                                    <span className="flex items-center gap-1.5 font-medium">
                                                                                                        <Sparkles size={12} className="opacity-40" />
                                                                                                        {svc?.name || 'Servicio'}
                                                                                                        {isMarketplace && (
                                                                                                            <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">
                                                                                                                🛒 Marketplace (-{mktRate}%)
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </span>
                                                                                                    {displayAddons.length > 0 && (
                                                                                                        <span className="text-[10px] text-slate-500 pl-5">
                                                                                                            + {displayAddons.join(', ')}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="p-3 text-right text-emerald-400 font-bold">
                                                                                                {formatMoney(price)}
                                                                                                {isMarketplace && (
                                                                                                    <div className="text-[10px] font-semibold text-amber-400/90">
                                                                                                        -{formatMoney(mktDeduction)} CitaLink
                                                                                                    </div>
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="p-3 text-right text-accent font-black">
                                                                                                {formatMoney(comm)}
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                                {entry.marketplaceDeductionTotal && entry.marketplaceDeductionTotal > 0 ? (
                                                                    <div className="p-3 bg-amber-500/10 border-t border-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-between">
                                                                        <span>[-] Deducción Total por Comisión Marketplace CitaLink ({businessConfig?.marketplaceCommissionRate || 15}%):</span>
                                                                        <span className="font-mono font-black text-sm">-{formatMoney(entry.marketplaceDeductionTotal)} {currencyCode}</span>
                                                                    </div>
                                                                ) : null}
                                                            </div>

                                                            {/* Adelantos y Préstamos del Período */}
                                                            <div className="rounded-2xl border border-white/5 overflow-hidden bg-slate-900/40">
                                                                <div className="p-3.5 bg-slate-900/80 border-b border-white/5 flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <DollarSign size={14} className="text-rose-400" />
                                                                        <span className="text-xs font-black text-white uppercase tracking-wider">
                                                                            Adelantos y Préstamos Registrados ({stylistDeductions.length})
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setDeductionForm({
                                                                                stylistId: String(entry.stylistId),
                                                                                amount: '',
                                                                                concept: 'Adelanto de sueldo',
                                                                                date: format(new Date(), 'yyyy-MM-dd'),
                                                                                notes: ''
                                                                            });
                                                                            setIsDeductionModalOpen(true);
                                                                        }}
                                                                        className="btn bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                                                    >
                                                                        <Plus size={12} className="text-accent" />
                                                                        <span>Registrar Adelanto a {entry.stylistName}</span>
                                                                    </button>
                                                                </div>

                                                                {stylistDeductions.length === 0 ? (
                                                                    <div className="p-4 text-center text-xs text-slate-500">
                                                                        No hay préstamos ni adelantos registrados en este período.
                                                                    </div>
                                                                ) : (
                                                                    <div className="divide-y divide-white/5">
                                                                        {stylistDeductions.map((ded) => (
                                                                            <div key={ded.id} className="p-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors text-xs">
                                                                                <div className="flex items-center gap-3">
                                                                                    <span className="text-slate-400 font-mono text-[11px]">
                                                                                        {format(parseISO(ded.date), 'dd/MM/yyyy')}
                                                                                    </span>
                                                                                    <span className="text-white font-bold">{ded.concept}</span>
                                                                                    {ded.notes && <span className="text-slate-400 text-[11px]">({ded.notes})</span>}
                                                                                </div>
                                                                                <div className="flex items-center gap-3">
                                                                                    <span className="font-black text-rose-400 font-mono text-sm">
                                                                                        -{formatMoney(ded.amount)}
                                                                                    </span>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={async () => {
                                                                                            if (confirm(`¿Eliminar este adelanto de ${formatMoney(ded.amount)}?`)) {
                                                                                                await deleteDeduction(ded.id);
                                                                                            }
                                                                                        }}
                                                                                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                                                                        title="Eliminar adelanto"
                                                                                    >
                                                                                        <Trash2 size={13} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                        <div className="p-3 bg-rose-500/5 border-t border-rose-500/10 flex items-center justify-between text-xs font-bold text-rose-400">
                                                                            <span>Total Descontado en este Período:</span>
                                                                            <span className="font-mono font-black text-sm">-{formatMoney(entry.deductionsTotal || 0)}</span>
                                                                        </div>
                                                                    </div>
                                                                )}
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

            {/* Modal de Configuración de Nómina */}
            {isConfigModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="glass-panel bg-[#0b1329] border border-white/10 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-accent/10 border border-accent/20 text-accent">
                                    <Settings size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white">Configuración de Nómina</h3>
                                    <p className="text-xs text-slate-400">Día de corte semanal y comisiones por especialista</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsConfigModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                                title="Cerrar"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                            {/* Switch de activación */}
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div>
                                    <h4 className="text-white font-bold text-sm">Estado del Módulo</h4>
                                    <p className="text-xs text-slate-400">Habilita o deshabilita el cálculo de nómina y reportes.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={businessConfig?.commissionsEnabled || false}
                                        onChange={async (e) => {
                                            const val = e.target.checked;
                                            await updateTenantData({ commissionsEnabled: val });
                                            showToast(val ? 'Módulo activado' : 'Módulo desactivado', 'info');
                                        }}
                                    />
                                    <div className="w-11 h-6 bg-slate-700/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                                </label>
                            </div>

                            {/* Día de Corte Semanal */}
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <h4 className="text-white font-bold text-sm">Día de Inicio de Semana / Corte</h4>
                                        <p className="text-xs text-slate-400">Determina el primer día del período en la vista "Semanal".</p>
                                    </div>
                                    <div className="relative w-44 shrink-0">
                                        <CustomSelect
                                            value={String(businessConfig?.weekStartsOn ?? 1)}
                                            onChange={handleUpdateWeekStartsOn}
                                            options={[
                                                { value: '1', label: 'Lunes' },
                                                { value: '0', label: 'Domingo' },
                                                { value: '2', label: 'Martes' },
                                                { value: '3', label: 'Miércoles' },
                                                { value: '4', label: 'Jueves' },
                                                { value: '5', label: 'Viernes' },
                                                { value: '6', label: 'Sábado' },
                                            ]}
                                            buttonClassName="w-full glass-card bg-[#0f172a] border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-accent text-xs font-bold transition-all cursor-pointer flex items-center justify-between"
                                            dropdownClassName="absolute right-0 z-50 w-full mt-1 bg-[#1e293b] border border-slate-700/50 rounded-xl shadow-2xl py-1 animate-fade-in overflow-hidden"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Porcentajes por especialista */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-white font-bold text-sm">Porcentajes de Comisión por Profesional</h4>
                                        <p className="text-xs text-slate-400">Porcentaje que recibe el especialista sobre el valor de sus citas completadas.</p>
                                    </div>
                                    <span className="text-xs font-bold text-accent px-2.5 py-1 bg-accent/10 rounded-full border border-accent/20">
                                        {stylists.length} {stylists.length === 1 ? 'profesional' : 'profesionales'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {stylists.map(stylist => (
                                        <div key={stylist.id} className="p-3.5 bg-slate-900/70 border border-white/5 rounded-2xl flex items-center justify-between gap-3 hover:border-white/10 transition-colors">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center text-accent font-black text-xs shrink-0 uppercase">
                                                    {stylist.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs text-white font-bold truncate">{stylist.name}</p>
                                                    <p className="text-[11px] text-slate-400 truncate">{stylist.role || 'Especialista'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-white/5">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    className="w-12 bg-transparent text-white font-black text-sm text-center focus:outline-none"
                                                    defaultValue={stylist.commissionRate ?? 0}
                                                    onBlur={(e) => {
                                                        const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                                        if (val !== (stylist.commissionRate ?? 0)) {
                                                            handleUpdateCommissionRate(stylist.id, val);
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            (e.target as HTMLInputElement).blur();
                                                        }
                                                    }}
                                                />
                                                <span className="text-slate-400 font-bold text-xs">%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[11px] text-slate-500 italic">
                                    💡 Escribe el porcentaje y presiona Enter o haz clic fuera del recuadro para guardar.
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-white/5 bg-slate-900/50 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsConfigModalOpen(false)}
                                className="btn bg-accent hover:bg-accent/90 text-slate-950 font-black text-xs px-6 py-2.5 rounded-xl shadow-lg shadow-accent/15 transition-all cursor-pointer active:scale-95"
                            >
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para Registrar Adelanto / Préstamo */}
            {isDeductionModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="glass-panel bg-[#0b1329] border border-white/10 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-scale-in">
                        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-white">Registrar Adelanto / Préstamo</h3>
                                    <p className="text-xs text-slate-400">Se descontará automáticamente de la nómina</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsDeductionModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                if (!deductionForm.stylistId) {
                                    showToast('Selecciona un colaborador', 'error');
                                    return;
                                }
                                const numAmount = parseFloat(deductionForm.amount);
                                if (isNaN(numAmount) || numAmount <= 0) {
                                    showToast('Ingresa un monto válido mayor a 0', 'error');
                                    return;
                                }
                                await addDeduction({
                                    stylistId: Number(deductionForm.stylistId),
                                    amount: numAmount,
                                    concept: deductionForm.concept || 'Adelanto de sueldo',
                                    date: deductionForm.date,
                                    notes: deductionForm.notes || undefined,
                                });
                                setIsDeductionModalOpen(false);
                                setDeductionForm({
                                    stylistId: '',
                                    amount: '',
                                    concept: 'Adelanto de sueldo',
                                    date: format(new Date(), 'yyyy-MM-dd'),
                                    notes: ''
                                });
                            }}
                            className="p-6 space-y-4"
                        >
                            {/* Selector de Colaborador */}
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Colaborador
                                </label>
                                <select
                                    value={deductionForm.stylistId}
                                    onChange={(e) => setDeductionForm({ ...deductionForm, stylistId: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-xs font-bold focus:border-accent focus:outline-none cursor-pointer"
                                    required
                                >
                                    <option value="" disabled>Selecciona a quién se le entrega...</option>
                                    {stylists.map(s => (
                                        <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                                            {s.name} ({s.role || 'Especialista'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Monto */}
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Monto del Adelanto ({currencyCode})
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
                                        {currencySymbol}
                                    </span>
                                    <input
                                        type="number"
                                        step="any"
                                        min="1"
                                        required
                                        placeholder="300.00"
                                        value={deductionForm.amount}
                                        onChange={(e) => setDeductionForm({ ...deductionForm, amount: e.target.value })}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 pl-8 pr-3 text-white text-base font-black focus:border-accent focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Concepto y botones rápidos */}
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Motivo / Concepto
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Adelanto a mitad de semana, Préstamo..."
                                    value={deductionForm.concept}
                                    onChange={(e) => setDeductionForm({ ...deductionForm, concept: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-xs focus:border-accent focus:outline-none mb-2"
                                />
                                <div className="flex flex-wrap gap-1.5">
                                    {['Adelanto de sueldo', 'Préstamo personal', 'Uniforme / Equipo', 'Materiales'].map(pill => (
                                        <button
                                            key={pill}
                                            type="button"
                                            onClick={() => setDeductionForm({ ...deductionForm, concept: pill })}
                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                                                deductionForm.concept === pill
                                                    ? 'bg-accent/20 border-accent text-accent'
                                                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            {pill}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Fecha */}
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Fecha del Adelanto
                                </label>
                                <DatePickerInput
                                    value={deductionForm.date}
                                    onChange={(val) => setDeductionForm({ ...deductionForm, date: val })}
                                    className="w-full"
                                />
                            </div>

                            {/* Notas adicionales */}
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Notas adicionales (opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Detalles del acuerdo..."
                                    value={deductionForm.notes}
                                    onChange={(e) => setDeductionForm({ ...deductionForm, notes: e.target.value })}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-white text-xs focus:border-accent focus:outline-none"
                                />
                            </div>

                            {/* Botones */}
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsDeductionModalOpen(false)}
                                    className="flex-1 btn bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-3 rounded-xl cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAddingDeduction}
                                    className="flex-1 btn bg-accent hover:bg-accent/90 text-slate-950 text-xs font-black py-3 rounded-xl cursor-pointer shadow-lg shadow-accent/20 active:scale-95 transition-all"
                                >
                                    {isAddingDeduction ? 'Guardando...' : 'Registrar Adelanto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
