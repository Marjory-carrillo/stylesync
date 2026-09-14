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
import { Calculator, Calendar as CalendarIcon, DollarSign, Users, TrendingUp, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Sparkles, Clock, User, ShoppingBag } from 'lucide-react';
import type { CommissionEntry } from '../../lib/types/store.types';
import DatePickerInput from '../../components/DatePickerInput';

export default function Commissions() {
    const { userRole, loadingAuth, loadingTenant } = useAuthStore();
    const { data: tenantConfig, isLoading: isTenantConfigLoading } = useTenantData();
    const businessConfig = tenantConfig || {} as any;
    
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

    const { commissionEntries, totalGenerated, totalMarketplaceDeductions, totalNetRevenue, totalToPay, apptsByStylist } = useMemo(() => {
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

        let grandTotalCommissions = 0;

        const entries: CommissionEntry[] = stylists.map(stylist => {
            const stat = totalsByStylist[stylist.id] || { revenue: 0, netRevenue: 0, mktDeduction: 0, count: 0 };
            const rate = stylist.commissionRate || 0;
            const earned = stat.netRevenue * (rate / 100);

            grandTotalCommissions += earned;

            return {
                stylistId: stylist.id,
                stylistName: stylist.name,
                totalRevenue: stat.revenue,
                marketplaceDeductionTotal: stat.mktDeduction,
                netRevenueForCommission: stat.netRevenue,
                appointmentsCount: stat.count,
                commissionRate: rate,
                commissionEarned: earned
            };
        }).sort((a, b) => b.totalRevenue - a.totalRevenue);

        return { 
            commissionEntries: entries, 
            totalGenerated: grandTotalGen,
            totalMarketplaceDeductions: grandTotalMktDeductions,
            totalNetRevenue: grandTotalNetRevenue,
            totalToPay: grandTotalCommissions,
            apptsByStylist
        };
    }, [appointments, stylists, services, startDate, endDate, businessConfig?.marketplaceCommissionRate]);

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
            // 4 cajitas métricas
            const boxWidth = 43;
            // Tarjeta 1: Total Generado (Bruto)
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(14, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            doc.text('TOTAL BRUTO', 17, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(15, 23, 42);
            doc.text(formatMoney(totalGenerated), 17, boxY + 15);

            // Tarjeta 2: Deducción Marketplace
            doc.setFillColor(254, 243, 199); // amber-100
            doc.setDrawColor(251, 191, 36); // amber-400
            doc.roundedRect(60, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(180, 83, 9); // amber-700
            doc.text('DEDUC. MARKETPLACE', 63, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(180, 83, 9);
            doc.text(`-${formatMoney(totalMarketplaceDeductions)}`, 63, boxY + 15);

            // Tarjeta 3: Base Comisionable Neta
            doc.setFillColor(240, 249, 255); // sky-50
            doc.setDrawColor(186, 230, 253); // sky-200
            doc.roundedRect(106, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(3, 105, 161); // sky-700
            doc.text('BASE COMISIONABLE', 109, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(3, 105, 161);
            doc.text(formatMoney(totalNetRevenue), 109, boxY + 15);

            // Tarjeta 4: Total a Liquidar (Comisiones)
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(152, boxY, 44, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(100, 116, 139);
            doc.text('A LIQUIDAR (EQUIPO)', 155, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(16, 149, 119); // emerald-600
            doc.text(formatMoney(totalToPay), 155, boxY + 15);
        } else {
            // 3 cajitas estándar
            const boxWidth = 57;
            // Tarjeta 1: Total Generado (Bruto)
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(14, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text('TOTAL GENERADO (BRUTO)', 18, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11.5);
            doc.setTextColor(15, 23, 42);
            doc.text(formatMoney(totalGenerated), 18, boxY + 15);

            // Tarjeta 2: Total Comisiones (A Pagar)
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(77, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text('TOTAL A LIQUIDAR (COMISIONES)', 81, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11.5);
            doc.setTextColor(16, 149, 119); // emerald-600
            doc.text(formatMoney(totalToPay), 81, boxY + 15);

            // Tarjeta 3: Total Citas Completadas
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(139, boxY, boxWidth, boxHeight, 2.5, 2.5, 'FD');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text('CITAS REALIZADAS', 143, boxY + 6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11.5);
            doc.setTextColor(15, 23, 42);
            doc.text(`${totalAppointments} servicios`, 143, boxY + 15);
        }

        // Tabla de Desglose con fila de Totales
        if (hasMarketplaceActivity) {
            autoTable(doc, {
                startY: 74,
                head: [['Profesional / Estilista', 'Citas', `Bruto (${currencyCode})`, `Deduc. Mkt`, `Base Neta`, '% Com.', `Pago Final (${currencyCode})`]],
                body: commissionEntries.map(e => [
                    e.stylistName,
                    e.appointmentsCount.toString(),
                    formatMoney(e.totalRevenue, true),
                    (e.marketplaceDeductionTotal || 0) > 0 ? `-${formatMoney(e.marketplaceDeductionTotal || 0, true)}` : '$0.00',
                    formatMoney(e.netRevenueForCommission || 0, true),
                    `${e.commissionRate}%`,
                    formatMoney(e.commissionEarned, true)
                ]),
                foot: [[
                    'TOTAL GENERAL',
                    totalAppointments.toString(),
                    formatMoney(totalGenerated, true),
                    `-${formatMoney(totalMarketplaceDeductions, true)}`,
                    formatMoney(totalNetRevenue, true),
                    '-',
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
                    3: { halign: 'right', cellWidth: 26, textColor: [180, 83, 9] },
                    4: { halign: 'right', cellWidth: 28 },
                    5: { halign: 'center', cellWidth: 18 },
                    6: { halign: 'right', cellWidth: 34, fontStyle: 'bold', textColor: [15, 23, 42] }
                },
                footStyles: {
                    fillColor: [241, 245, 249],
                    textColor: [15, 23, 42],
                    fontStyle: 'bold',
                    fontSize: 8.5
                }
            });
        } else {
            autoTable(doc, {
                startY: 74,
                head: [['Profesional / Estilista', 'Citas', `Generado (${currencyCode})`, '% Com.', `Pago Final (${currencyCode})`]],
                body: commissionEntries.map(e => [
                    e.stylistName,
                    e.appointmentsCount.toString(),
                    formatMoney(e.totalRevenue, true),
                    `${e.commissionRate}%`,
                    formatMoney(e.commissionEarned, true)
                ]),
                foot: [[
                    'TOTAL GENERAL',
                    totalAppointments.toString(),
                    formatMoney(totalGenerated, true),
                    '-',
                    formatMoney(totalToPay, true)
                ]],
                theme: 'grid',
                styles: {
                    fontSize: 9,
                    cellPadding: 4.5,
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
                    1: { halign: 'center', cellWidth: 22 },
                    2: { halign: 'right', cellWidth: 40 },
                    3: { halign: 'center', cellWidth: 25 },
                    4: { halign: 'right', cellWidth: 42, fontStyle: 'bold', textColor: [15, 23, 42] }
                },
                footStyles: {
                    fillColor: [241, 245, 249],
                    textColor: [15, 23, 42],
                    fontStyle: 'bold',
                    fontSize: 9.5
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

    if (userRole !== 'owner' || !businessConfig?.commissionsEnabled || businessConfig?.plan === 'lite') {
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
            <div className="relative z-30 glass-panel p-5 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
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
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Desde:</span>
                            <DatePickerInput
                                value={customStart}
                                onChange={(val) => { setCustomStart(val); setExpandedStylistId(null); }}
                                compact
                                className="w-36 sm:w-40"
                                align="left"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hasta:</span>
                            <DatePickerInput
                                value={customEnd}
                                onChange={(val) => { setCustomEnd(val); setExpandedStylistId(null); }}
                                compact
                                className="w-36 sm:w-40"
                                align="right"
                            />
                        </div>
                    </div>
                )}

                <div className="text-xs font-bold text-slate-500 bg-white/5 border border-white/5 px-4 py-2 rounded-2xl">
                    Corte: {format(startDate, 'dd MMM yyyy', { locale: es }).toUpperCase()} - {format(endDate, 'dd MMM yyyy', { locale: es }).toUpperCase()}
                </div>
            </div>

            {/* Metrics cards */}
            {/* Metrics cards */}
            <div className={`grid grid-cols-1 md:grid-cols-2 ${hasMarketplaceActivity ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
                <div className="glass-panel p-6 rounded-[2rem] relative overflow-hidden group border border-white/5 bg-slate-900/40">
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

                <div className="glass-panel p-6 rounded-[2rem] relative overflow-hidden group border border-white/5 bg-slate-900/40">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl group-hover:bg-yellow-500/10 transition-colors"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3.5 rounded-2xl bg-yellow-500/10 text-yellow-500">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total a Pagar (Comisiones)</p>
                            <h3 className="text-2xl font-black tracking-tight text-white mt-1">
                                {formatMoney(totalToPay)}
                            </h3>
                            {hasMarketplaceActivity && (
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Sobre base neta: {formatMoney(totalNetRevenue)}</p>
                            )}
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
                    <button
                        onClick={handleExportPDF}
                        className="btn btn-primary px-4 py-2.5 shadow-lg shadow-accent/20 flex items-center gap-2 font-bold text-xs uppercase tracking-wider"
                    >
                        <Calculator size={18} /> Generar Nómina
                    </button>
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
                                <th className="p-4 font-semibold text-right text-accent">Pago (Comisión)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {commissionEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={hasMarketplaceActivity ? 8 : 6} className="p-8 text-center text-slate-500">
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
                                                    <div>
                                                        <div>{entry.stylistName}</div>
                                                        {(entry.marketplaceDeductionTotal || 0) > 0 && (
                                                            <span className="text-[10px] font-semibold text-amber-400/90 flex items-center gap-1 mt-0.5">
                                                                <ShoppingBag size={10} /> Con reservas Marketplace
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center text-slate-300">
                                                    {entry.appointmentsCount}
                                                </td>
                                                <td className="p-4 text-right text-emerald-400 font-medium tracking-tight">
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
                                                <td className="p-4 text-right text-accent font-bold tracking-tight text-base">
                                                    <div>{formatMoney(entry.commissionEarned)}</div>
                                                    {(entry.marketplaceDeductionTotal || 0) > 0 && (
                                                        <span className="text-[10px] text-slate-400 font-normal block font-mono">
                                                            {entry.commissionRate}% de {formatMoney(entry.netRevenueForCommission || 0)}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Sub-Table Accordion */}
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={hasMarketplaceActivity ? 8 : 6} className="bg-black/45 p-6 border-t border-b border-white/5">
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
