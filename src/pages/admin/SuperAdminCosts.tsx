import { useState, useEffect, useMemo } from 'react';
import { useSuperAdmin } from '../../lib/store/queries/useSuperAdmin';
import { supabase } from '../../lib/supabaseClient';
import { useUIStore } from '../../lib/store/uiStore';
import {
    DollarSign, TrendingUp, TrendingDown, Settings,
    Building2, MessageCircle, Phone, Server, Search, Download,
    RefreshCw, Zap, Sparkles, Calendar, Plus, Trash2, Edit3,
    Scissors, Flower2, Briefcase, MoreHorizontal, BarChart3, PieChart as PieChartIcon,
    CheckCircle2, X, ToggleLeft, ToggleRight, Bot
} from 'lucide-react';
import DatePickerInput from '../../components/DatePickerInput';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend
} from 'recharts';

export interface FixedExpense {
    id: string;
    name: string;
    amount: number;
    currency: 'USD' | 'MXN';
    category: 'hosting' | 'database' | 'domain' | 'software' | 'marketing' | 'salaries' | 'other';
    frequency: 'monthly' | 'yearly';
    notes?: string;
    active: boolean;
}

export interface VariableRates {
    fxRate: number; // Tipo de cambio USD a MXN
    whatsappRate: number; // USD por mensaje
    twilioRate: number; // USD por SMS +1
}

const DEFAULT_RATES: VariableRates = {
    fxRate: 18.50,
    whatsappRate: 0.0085,
    twilioRate: 0.0085
};

const CATEGORIES = [
    { id: 'all', label: 'Todas las Categorías', icon: null },
    { id: 'barbershop', label: 'Barberías', icon: Scissors },
    { id: 'beauty_salon', label: 'Salones', icon: Sparkles },
    { id: 'nail_bar', label: "Nail's", icon: Sparkles },
    { id: 'lashes', label: 'Lashes', icon: Sparkles },
    { id: 'spa', label: 'Spas', icon: Flower2 },
    { id: 'consulting', label: 'Clínicas', icon: Briefcase },
    { id: 'other', label: 'Otros', icon: MoreHorizontal }
];

const EXPENSE_CATEGORIES: Record<string, { label: string; color: string }> = {
    hosting: { label: 'Hosting & Servidor', color: '#8b5cf6' },
    database: { label: 'Base de Datos', color: '#3b82f6' },
    domain: { label: 'Dominios & SSL', color: '#f59e0b' },
    software: { label: 'Software / SaaS', color: '#ec4899' },
    marketing: { label: 'Marketing & Ads', color: '#10b981' },
    salaries: { label: 'Nómina / Soporte', color: '#6366f1' },
    other: { label: 'Otros Gastos', color: '#64748b' }
};

export default function SuperAdminCosts() {
    const { allTenants, fetchAllTenants } = useSuperAdmin();
    const showToast = useUIStore(s => s.showToast);

    // 1. Tarifas Variables Reales (Tipo de cambio, WA, Twilio)
    const [rates, setRates] = useState<VariableRates>(() => {
        const savedWa = localStorage.getItem('citalink_wa_cost');
        const savedSms = localStorage.getItem('citalink_twilio_sms_cost');
        const savedFx = localStorage.getItem('citalink_fx_rate') || localStorage.getItem('citalink_exchange_rate');
        let savedObj: any = null;
        try {
            const s = localStorage.getItem('citalink_variable_rates');
            if (s) savedObj = JSON.parse(s);
        } catch (e) {
            console.warn("Error loading rates:", e);
        }

        return {
            fxRate: savedFx ? parseFloat(savedFx) : (savedObj?.fxRate || DEFAULT_RATES.fxRate),
            whatsappRate: savedWa ? parseFloat(savedWa) : (savedObj?.whatsappRate || DEFAULT_RATES.whatsappRate),
            twilioRate: savedSms ? parseFloat(savedSms) : (savedObj?.twilioRate || DEFAULT_RATES.twilioRate)
        };
    });

    // Re-sincronizar tarifas en tiempo real si se cambiaron en otra ventana o pestaña
    useEffect(() => {
        const syncRates = () => {
            const savedWa = localStorage.getItem('citalink_wa_cost');
            const savedSms = localStorage.getItem('citalink_twilio_sms_cost');
            const savedFx = localStorage.getItem('citalink_fx_rate') || localStorage.getItem('citalink_exchange_rate');
            let savedObj: any = null;
            try {
                const s = localStorage.getItem('citalink_variable_rates');
                if (s) savedObj = JSON.parse(s);
            } catch (e) {}

            setRates({
                fxRate: savedFx ? parseFloat(savedFx) : (savedObj?.fxRate || DEFAULT_RATES.fxRate),
                whatsappRate: savedWa ? parseFloat(savedWa) : (savedObj?.whatsappRate || DEFAULT_RATES.whatsappRate),
                twilioRate: savedSms ? parseFloat(savedSms) : (savedObj?.twilioRate || DEFAULT_RATES.twilioRate)
            });
        };

        window.addEventListener('storage', syncRates);
        return () => window.removeEventListener('storage', syncRates);
    }, []);

    // 2. Lista de Gastos Fijos Reales ingresados por el Super Admin
    const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>(() => {
        try {
            const saved = localStorage.getItem('citalink_custom_fixed_expenses');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.warn("Error loading custom expenses:", e);
        }
        return [];
    });

    // Pestañas principales del módulo
    const [activeTab, setActiveTab] = useState<'dashboard' | 'expenses' | 'rates'>('dashboard');

    // Modales y control de edición de gastos
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);

    // Filtros de búsqueda y vista
    const [showCharts] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterPlan, setFilterPlan] = useState<string>('all');
    const [filterPayment, setFilterPayment] = useState<'all' | 'paying' | 'trial' | 'unpaid' | 'free'>('all');
    const [filterMargin, setFilterMargin] = useState<'all' | 'profitable' | 'medium' | 'low' | 'loss'>('all');
    const [sortBy, setSortBy] = useState<'profit_desc' | 'cost_desc' | 'revenue_desc' | 'margin_desc' | 'wa_desc'>('cost_desc');

    // Filtros de fecha visuales (por defecto Histórico Total para ver todos los mensajes acumulados)
    const [dateRangePreset, setDateRangePreset] = useState<'all_time' | '30d' | 'this_month' | 'last_month' | '90d' | 'custom'>('all_time');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Métricas dinámicas desde Supabase
    const [smsLogs, setSmsLogs] = useState<any[]>([]);
    const [appointmentsData, setAppointmentsData] = useState<any[]>([]);
    const [waMetricsView, setWaMetricsView] = useState<Record<string, any>>({});
    const [smsByMonth, setSmsByMonth] = useState<{ month_label: string; count: number }[]>([]);
    const [loading, setLoading] = useState(true);

    const handlePresetChange = (preset: 'all_time' | '30d' | 'this_month' | 'last_month' | '90d' | 'custom') => {
        setDateRangePreset(preset);
        const now = new Date();
        if (preset === 'all_time') {
            setStartDate('');
            setEndDate('');
        } else if (preset === '30d') {
            const start = new Date();
            start.setDate(now.getDate() - 30);
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(now.toISOString().split('T')[0]);
        } else if (preset === 'this_month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(now.toISOString().split('T')[0]);
        } else if (preset === 'last_month') {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(end.toISOString().split('T')[0]);
        } else if (preset === '90d') {
            const start = new Date();
            start.setDate(now.getDate() - 90);
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(now.toISOString().split('T')[0]);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            await fetchAllTenants();

            // 1. Obtener logs de mensajes (manuales y automáticos) sin límites restrictivos
            let querySms = supabase.from('sms_logs').select('*').limit(10000);
            if (startDate) {
                querySms = querySms.gte('created_at', `${startDate}T00:00:00`);
            }
            if (endDate) {
                querySms = querySms.lte('created_at', `${endDate}T23:59:59`);
            }
            const { data: smsData, error: smsErr } = await querySms;
            if (!smsErr && smsData) {
                setSmsLogs(smsData);
            }

            // 2. Obtener vista acumulada de WhatsApp por tenant
            const { data: waViewData } = await supabase.from('whatsapp_metrics_by_tenant').select('*');
            if (waViewData) {
                const map: Record<string, any> = {};
                waViewData.forEach((row: any) => {
                    if (row.tenant_id) map[row.tenant_id] = row;
                });
                setWaMetricsView(map);
            }

            // 3. Obtener historial mensual exacto desde la vista oficial de Supabase
            const { data: monthData } = await supabase.from('whatsapp_metrics_by_month').select('*');
            if (monthData) {
                setSmsByMonth(monthData.map((d: any) => ({ month_label: d.month_label, count: d.count || 0 })));
            }

            // 4. Obtener citas con recordatorios automáticos filtradas por fecha
            let queryAppt = supabase.from('appointments').select('id, tenant_id, date, reminder_sent, created_at').limit(10000);
            if (startDate) {
                queryAppt = queryAppt.gte('date', startDate);
            }
            if (endDate) {
                queryAppt = queryAppt.lte('date', endDate);
            }
            const { data: apptData, error: apptErr } = await queryAppt;
            if (!apptErr && apptData) {
                setAppointmentsData(apptData);
            }
        } catch (err) {
            console.error("Error loading cost data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [startDate, endDate]);

    // Guardar tarifas variables
    const handleSaveRates = (newRates: VariableRates) => {
        setRates(newRates);
        localStorage.setItem('citalink_variable_rates', JSON.stringify(newRates));
        localStorage.setItem('citalink_twilio_sms_cost', String(newRates.twilioRate));
        localStorage.setItem('citalink_wa_cost', String(newRates.whatsappRate));
        localStorage.setItem('citalink_fx_rate', String(newRates.fxRate));
        localStorage.setItem('citalink_exchange_rate', String(newRates.fxRate));
        showToast('Tarifas de mensajería y tipo de cambio actualizados', 'success');
    };

    // Guardar / Actualizar gasto fijo
    const handleSaveExpense = (expense: Omit<FixedExpense, 'id'> & { id?: string }) => {
        let updated: FixedExpense[];
        if (expense.id) {
            updated = fixedExpenses.map(e => e.id === expense.id ? { ...expense, id: expense.id } as FixedExpense : e);
            showToast('Gasto actualizado correctamente', 'success');
        } else {
            const newExp: FixedExpense = {
                ...expense,
                id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
            };
            updated = [...fixedExpenses, newExp];
            showToast('Gasto fijo agregado exitosamente', 'success');
        }
        setFixedExpenses(updated);
        localStorage.setItem('citalink_custom_fixed_expenses', JSON.stringify(updated));
        setIsExpenseModalOpen(false);
        setEditingExpense(null);
    };

    // Eliminar gasto fijo
    const handleDeleteExpense = (id: string) => {
        const updated = fixedExpenses.filter(e => e.id !== id);
        setFixedExpenses(updated);
        localStorage.setItem('citalink_custom_fixed_expenses', JSON.stringify(updated));
        showToast('Gasto eliminado', 'info');
    };

    // Toggle activo/inactivo de un gasto
    const handleToggleExpenseActive = (id: string) => {
        const updated = fixedExpenses.map(e => e.id === id ? { ...e, active: !e.active } : e);
        setFixedExpenses(updated);
        localStorage.setItem('citalink_custom_fixed_expenses', JSON.stringify(updated));
    };

    // Verificación 100% REAL de si un negocio está PAGANDO en Stripe o Manual
    const evaluateTenantPaymentStatus = (tenant: any) => {
        const now = new Date();
        const plan = tenant.plan || 'free';
        const isTrial = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) > now : false;
        const isSuspended = tenant.payment_status === 'suspended' ||
            (tenant.payment_status === 'grace_period' && tenant.grace_period_ends_at && new Date(tenant.grace_period_ends_at) < now);

        const hasStripePayment = Boolean(tenant.stripe_subscription_id && tenant.stripe_subscription_id.trim() !== '');
        const isManualPaid = tenant.subscription_type === 'manual' && tenant.payment_status === 'paid';

        // Solo está pagando realmente si NO está en prueba, NO está suspendido y TIENE Stripe activo o pago manual verificado
        const isRealPaying = !isTrial && !isSuspended && (hasStripePayment || isManualPaid) && plan !== 'free';

        let basePrice = 0;
        if (tenant.monthly_price && !isNaN(parseFloat(tenant.monthly_price))) {
            basePrice = parseFloat(tenant.monthly_price);
        } else {
            switch (plan) {
                case 'lite': basePrice = 299; break;
                case 'pro': basePrice = 649; break;
                case 'business': basePrice = 1249; break;
                default: basePrice = 0;
            }
        }

        // Si NO está pagando realmente en Stripe, su ingreso cobrado es estrictamente $0.00 MXN
        const revenueMXN = isRealPaying ? basePrice : 0;

        let statusLabel = 'Plan Gratuito';
        let statusBadgeClass = 'bg-slate-800 text-slate-400 border-slate-700';

        if (isTrial) {
            statusLabel = 'En Prueba ($0)';
            statusBadgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
        } else if (hasStripePayment && !isSuspended) {
            statusLabel = 'Stripe Activo (Cobrado)';
            statusBadgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
        } else if (isManualPaid && !isSuspended) {
            statusLabel = 'Pago Manual (Cobrado)';
            statusBadgeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
        } else if (isSuspended) {
            statusLabel = 'Suspendido ($0)';
            statusBadgeClass = 'bg-red-500/20 text-red-300 border-red-500/30';
        } else if (plan !== 'free') {
            statusLabel = 'Sin Pago Stripe ($0)';
            statusBadgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
        }

        return {
            isTrial,
            isSuspended,
            hasStripePayment,
            isManualPaid,
            isRealPaying,
            revenueMXN,
            basePrice,
            statusLabel,
            statusBadgeClass
        };
    };

    // Unit economics por negocio con conteo de mensajes manuales y automáticos
    const businessMetrics = useMemo(() => {
        const waCounts: Record<string, number> = {};
        const smsUsCounts: Record<string, number> = {};
        const autoRemindersCounts: Record<string, number> = {};

        // 1. Conteo desde sms_logs
        smsLogs.forEach(row => {
            if (!row.tenant_id) return;
            const phoneStr = (row.phone || row.phone_to || '');
            const isUsSms = row.provider === 'twilio' || row.provider === 'sms' || phoneStr.startsWith('+1');
            const isAuto = row.message_type === 'reminder' || row.message_type === 'confirmation' || row.message_type === 'automatic';

            if (isAuto) {
                autoRemindersCounts[row.tenant_id] = (autoRemindersCounts[row.tenant_id] || 0) + 1;
            }

            if (isUsSms) {
                smsUsCounts[row.tenant_id] = (smsUsCounts[row.tenant_id] || 0) + 1;
            } else {
                waCounts[row.tenant_id] = (waCounts[row.tenant_id] || 0) + 1;
            }
        });

        // 2. Conteo de citas y recordatorios automáticos marcados en appointments
        const apptCounts: Record<string, number> = {};
        const apptRemindersCount: Record<string, number> = {};

        appointmentsData.forEach(row => {
            if (row.tenant_id) {
                apptCounts[row.tenant_id] = (apptCounts[row.tenant_id] || 0) + 1;
                if (row.reminder_sent) {
                    apptRemindersCount[row.tenant_id] = (apptRemindersCount[row.tenant_id] || 0) + 1;
                }
            }
        });

        return allTenants.map(t => {
            const paymentInfo = evaluateTenantPaymentStatus(t);
            const revenueMXN = paymentInfo.revenueMXN;

            // Mensajes de WhatsApp y automáticos: usamos el conteo de logs + citas con recordatorio
            let waCount = waCounts[t.id] || 0;
            let autoCount = autoRemindersCounts[t.id] || 0;
            const apptReminder = apptRemindersCount[t.id] || 0;

            // Si los recordatorios automáticos registrados en citas superan los logs, sumamos la diferencia
            if (apptReminder > autoCount) {
                const diff = apptReminder - autoCount;
                autoCount += diff;
                waCount += diff;
            }

            const waTotalHistorical = waMetricsView[t.id]?.total || waCount;
            const waThisMonth = waMetricsView[t.id]?.this_month || waMetricsView[t.id]?.month || 0;
            const waLastMonth = waMetricsView[t.id]?.last_month || 0;

            // Determinar los mensajes de WhatsApp según el filtro o preset seleccionado
            if (dateRangePreset === 'all_time') {
                waCount = Math.max(waCount, waTotalHistorical);
            } else if (dateRangePreset === 'this_month') {
                waCount = waThisMonth > 0 ? waThisMonth : waCount;
            } else if (dateRangePreset === 'last_month') {
                waCount = waLastMonth > 0 ? waLastMonth : waCount;
            } else if (dateRangePreset === '30d') {
                waCount = (waMetricsView[t.id]?.month !== undefined) ? waMetricsView[t.id].month : waCount;
            }

            const smsUsCount = smsUsCounts[t.id] || 0;
            const apptCount = apptCounts[t.id] || 0;

            const waCostUSD = waCount * rates.whatsappRate;
            const smsUsCostUSD = smsUsCount * rates.twilioRate;
            const totalVarCostUSD = waCostUSD + smsUsCostUSD;
            const totalVarCostMXN = totalVarCostUSD * rates.fxRate;

            const netProfitMXN = revenueMXN - totalVarCostMXN;
            const marginPct = revenueMXN > 0 ? ((netProfitMXN / revenueMXN) * 100) : (totalVarCostMXN > 0 ? -100 : 0);

            let marginStatus: 'profitable' | 'medium' | 'low' | 'loss' = 'profitable';
            if (marginPct >= 80) marginStatus = 'profitable';
            else if (marginPct >= 50) marginStatus = 'medium';
            else if (marginPct > 0) marginStatus = 'low';
            else marginStatus = 'loss';

            return {
                tenant: t,
                paymentInfo,
                revenueMXN,
                waCount,
                waTotalHistorical,
                autoCount,
                smsUsCount,
                apptCount,
                waCostUSD,
                smsUsCostUSD,
                totalVarCostUSD,
                totalVarCostMXN,
                netProfitMXN,
                marginPct,
                marginStatus
            };
        });
    }, [allTenants, smsLogs, appointmentsData, waMetricsView, rates, dateRangePreset]);

    // Resumen Global del SaaS
    const globalSummary = useMemo(() => {
        const totalMRR_MXN = businessMetrics.reduce((acc, b) => acc + b.revenueMXN, 0);
        const totalMRR_USD = totalMRR_MXN / (rates.fxRate || 1);

        const totalWaCount = businessMetrics.reduce((acc, b) => acc + b.waCount, 0);
        const totalAutoCount = businessMetrics.reduce((acc, b) => acc + b.autoCount, 0);
        const totalSmsUsCount = businessMetrics.reduce((acc, b) => acc + b.smsUsCount, 0);

        const totalWaCostUSD = totalWaCount * rates.whatsappRate;
        const totalWaCostMXN = totalWaCostUSD * rates.fxRate;

        const totalSmsUsCostUSD = totalSmsUsCount * rates.twilioRate;
        const totalSmsUsCostMXN = totalSmsUsCostUSD * rates.fxRate;

        const totalVariableCostUSD = totalWaCostUSD + totalSmsUsCostUSD;
        const totalVariableCostMXN = totalWaCostMXN + totalSmsUsCostMXN;

        let totalFixedCostUSD = 0;
        let totalFixedCostMXN = 0;

        fixedExpenses.filter(e => e.active).forEach(e => {
            const monthlyAmount = e.frequency === 'yearly' ? (e.amount / 12) : e.amount;
            if (e.currency === 'USD') {
                totalFixedCostUSD += monthlyAmount;
                totalFixedCostMXN += monthlyAmount * rates.fxRate;
            } else {
                totalFixedCostMXN += monthlyAmount;
                totalFixedCostUSD += monthlyAmount / (rates.fxRate || 1);
            }
        });

        const totalOperatingCostUSD = totalVariableCostUSD + totalFixedCostUSD;
        const totalOperatingCostMXN = totalVariableCostMXN + totalFixedCostMXN;

        const netProfitMXN = totalMRR_MXN - totalOperatingCostMXN;
        const netProfitUSD = totalMRR_USD - totalOperatingCostUSD;
        const overallMarginPct = totalMRR_MXN > 0 ? ((netProfitMXN / totalMRR_MXN) * 100) : 0;

        const payingBusinessesCount = businessMetrics.filter(b => b.paymentInfo.isRealPaying).length;
        const trialBusinessesCount = businessMetrics.filter(b => b.paymentInfo.isTrial).length;
        const unpaidBusinessesCount = businessMetrics.filter(b => !b.paymentInfo.isRealPaying && !b.paymentInfo.isTrial && b.tenant.plan !== 'free').length;
        const atRiskBusinesses = businessMetrics.filter(b => b.marginStatus === 'loss' && (b.waCount > 0 || b.smsUsCount > 0));

        return {
            totalMRR_MXN,
            totalMRR_USD,
            totalWaCount,
            totalAutoCount,
            totalSmsUsCount,
            totalWaCostUSD,
            totalWaCostMXN,
            totalSmsUsCostUSD,
            totalSmsUsCostMXN,
            totalVariableCostUSD,
            totalVariableCostMXN,
            totalFixedCostUSD,
            totalFixedCostMXN,
            totalOperatingCostUSD,
            totalOperatingCostMXN,
            netProfitMXN,
            netProfitUSD,
            overallMarginPct,
            payingBusinessesCount,
            trialBusinessesCount,
            unpaidBusinessesCount,
            atRiskBusinesses
        };
    }, [businessMetrics, fixedExpenses, rates]);

    // Filtrado y Ordenamiento
    const filteredBusinesses = useMemo(() => {
        return businessMetrics
            .filter(b => {
                const matchSearch = b.tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (b.tenant.slug && b.tenant.slug.toLowerCase().includes(searchTerm.toLowerCase()));
                const matchCategory = filterCategory === 'all' || b.tenant.category === filterCategory;
                const matchPlan = filterPlan === 'all' || b.tenant.plan === filterPlan;
                
                let matchPayment = true;
                if (filterPayment === 'paying') matchPayment = b.paymentInfo.isRealPaying;
                else if (filterPayment === 'trial') matchPayment = b.paymentInfo.isTrial;
                else if (filterPayment === 'unpaid') matchPayment = !b.paymentInfo.isRealPaying && !b.paymentInfo.isTrial && b.tenant.plan !== 'free';
                else if (filterPayment === 'free') matchPayment = b.tenant.plan === 'free';

                const matchMargin = filterMargin === 'all' || b.marginStatus === filterMargin;
                return matchSearch && matchCategory && matchPlan && matchPayment && matchMargin;
            })
            .sort((a, b) => {
                if (sortBy === 'cost_desc') return b.totalVarCostMXN - a.totalVarCostMXN;
                if (sortBy === 'profit_desc') return b.netProfitMXN - a.netProfitMXN;
                if (sortBy === 'revenue_desc') return b.revenueMXN - a.revenueMXN;
                if (sortBy === 'margin_desc') return b.marginPct - a.marginPct;
                if (sortBy === 'wa_desc') return b.waCount - a.waCount;
                return 0;
            });
    }, [businessMetrics, searchTerm, filterCategory, filterPlan, filterPayment, filterMargin, sortBy]);

    // Datos para Gráfica de Barras Agrupada por CATEGORÍA (en general, no negocio por negocio)
    const categoryChartData = useMemo(() => {
        return CATEGORIES.filter(c => c.id !== 'all').map(cat => {
            const bizInCat = businessMetrics.filter(b => (b.tenant.category || 'other') === cat.id);
            const totalRevenue = bizInCat.reduce((acc, b) => acc + b.revenueMXN, 0);
            const totalCost = bizInCat.reduce((acc, b) => acc + b.totalVarCostMXN, 0);
            const totalProfit = Math.max(0, totalRevenue - totalCost);
            const totalMsgs = bizInCat.reduce((acc, b) => acc + b.waCount + b.smsUsCount, 0);
            const totalAppts = bizInCat.reduce((acc, b) => acc + b.apptCount, 0);

            return {
                name: cat.label,
                Ingreso: totalRevenue,
                Costo: parseFloat(totalCost.toFixed(2)),
                Ganancia: parseFloat(totalProfit.toFixed(2)),
                Negocios: bizInCat.length,
                Mensajes: totalMsgs,
                Citas: totalAppts
            };
        }).filter(item => item.Negocios > 0 || item.Ingreso > 0 || item.Costo > 0 || item.Mensajes > 0);
    }, [businessMetrics]);

    // Datos para Gráfica de Pastel (Distribución 100% Real de tus Gastos)
    const pieChartData = useMemo(() => {
        const data: { name: string; value: number; color: string }[] = [];

        if (globalSummary.totalWaCostMXN > 0) {
            data.push({ name: 'WhatsApp & Auto API', value: parseFloat(globalSummary.totalWaCostMXN.toFixed(2)), color: '#10b981' });
        }
        if (globalSummary.totalSmsUsCostMXN > 0) {
            data.push({ name: 'Twilio SMS (+1)', value: parseFloat(globalSummary.totalSmsUsCostMXN.toFixed(2)), color: '#06b6d4' });
        }

        fixedExpenses.filter(e => e.active).forEach(e => {
            const monthlyAmountMXN = e.currency === 'USD'
                ? (e.frequency === 'yearly' ? (e.amount / 12) : e.amount) * rates.fxRate
                : (e.frequency === 'yearly' ? (e.amount / 12) : e.amount);

            const catInfo = EXPENSE_CATEGORIES[e.category] || EXPENSE_CATEGORIES.other;
            data.push({
                name: e.name,
                value: parseFloat(monthlyAmountMXN.toFixed(2)),
                color: catInfo.color
            });
        });

        return data;
    }, [globalSummary, fixedExpenses, rates]);

    // Exportar CSV
    const exportCSV = () => {
        const headers = ["Negocio", "Categoría", "Plan", "Estado de Pago", "Ingreso Cobrado (MXN)", "WhatsApp (Rango)", "Recordatorios Automáticos", "SMS USA (Rango)", "Costo Variable Total (MXN)", "Ganancia Neta (MXN)", "Margen %"];
        const rows = filteredBusinesses.map(b => [
            `"${b.tenant.name}"`,
            b.tenant.category || 'general',
            b.tenant.plan || 'free',
            `"${b.paymentInfo.statusLabel}"`,
            b.revenueMXN.toFixed(2),
            b.waCount,
            b.autoCount,
            b.smsUsCount,
            b.totalVarCostMXN.toFixed(2),
            b.netProfitMXN.toFixed(2),
            `${b.marginPct.toFixed(1)}%`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `citalink_unit_economics_${startDate}_a_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Reporte CSV descargado', 'success');
    };

    return (
        <div className="space-y-6 animate-fade-in text-white pb-24">
            {/* Header del Módulo */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-white/10 rounded-2xl glass-card text-emerald-400 shadow-md shrink-0">
                        <DollarSign size={26} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Costos & <span className="text-emerald-400 font-light italic">Rentabilidad</span></h1>
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">Unit Economics Reales</span>
                        </div>
                        <p className="text-slate-400 text-xs font-medium tracking-wide">Control de Pagos Reales en Stripe, Mensajería Automática y Facturas de Infraestructura</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="btn border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-2 px-3.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 text-xs"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin text-accent' : ''} />
                        <span>Actualizar</span>
                    </button>

                    <button
                        onClick={exportCSV}
                        className="btn border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold py-2 px-3.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 text-xs"
                    >
                        <Download size={13} className="text-emerald-400" />
                        <span>Exportar CSV</span>
                    </button>

                    <button
                        onClick={() => {
                            setEditingExpense(null);
                            setIsExpenseModalOpen(true);
                        }}
                        className="btn bg-accent hover:brightness-110 text-slate-950 font-black py-2 px-4 rounded-xl shadow-md shadow-accent/20 flex items-center gap-1.5 transition-all text-xs"
                    >
                        <Plus size={15} />
                        <span>+ Agregar Gasto Fijo</span>
                    </button>
                </div>
            </header>

            {/* BARRA DE NAVEGACIÓN POR PESTAÑAS (TABS) */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
                <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                        activeTab === 'dashboard'
                            ? 'bg-accent text-slate-950 shadow-md shadow-accent/20'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <BarChart3 size={14} />
                    <span>Resumen Financiero & Negocios</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('expenses')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                        activeTab === 'expenses'
                            ? 'bg-accent text-slate-950 shadow-md shadow-accent/20'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <Server size={14} />
                    <span>Gestor de Gastos Fijos ({fixedExpenses.length})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('rates')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                        activeTab === 'rates'
                            ? 'bg-accent text-slate-950 shadow-md shadow-accent/20'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <Settings size={14} />
                    <span>Tarifas Variables & Tipo de Cambio</span>
                </button>
            </div>

            {/* PESTAÑA 1: DASHBOARD FINANCIERO & UNIT ECONOMICS */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6 animate-fade-in">
                    {/* BARRA DE FILTRO DE FECHAS VISUAL & PRESETS */}
                    <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 shadow-lg space-y-3">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-emerald-400 shrink-0" />
                                <span className="text-xs font-black uppercase tracking-wider text-white">Rango de Análisis:</span>
                                <span className="text-[11px] font-mono text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                    {dateRangePreset === 'all_time' ? '🌐 Histórico Completo (Todos los Tiempos)' : `${startDate} ➔ ${endDate}`}
                                </span>
                            </div>

                            {/* Presets Rápidos */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => handlePresetChange('all_time')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        dateRangePreset === 'all_time'
                                            ? 'bg-accent text-slate-950 font-black shadow-sm'
                                            : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
                                    }`}
                                >
                                    🌐 Histórico Total
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePresetChange('30d')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        dateRangePreset === '30d'
                                            ? 'bg-accent text-slate-950 font-black shadow-sm'
                                            : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
                                    }`}
                                >
                                    Últimos 30d
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePresetChange('this_month')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        dateRangePreset === 'this_month'
                                            ? 'bg-accent text-slate-950 font-black shadow-sm'
                                            : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
                                    }`}
                                >
                                    Este Mes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePresetChange('last_month')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        dateRangePreset === 'last_month'
                                            ? 'bg-accent text-slate-950 font-black shadow-sm'
                                            : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
                                    }`}
                                >
                                    Mes Anterior
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePresetChange('90d')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        dateRangePreset === '90d'
                                            ? 'bg-accent text-slate-950 font-black shadow-sm'
                                            : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
                                    }`}
                                >
                                    Últimos 90d
                                </button>
                            </div>
                        </div>

                        {/* Selectores de Fecha Personalizados */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Desde (Fecha Inicio)</label>
                                <DatePickerInput
                                    value={startDate}
                                    onChange={(val) => {
                                        setStartDate(val);
                                        setDateRangePreset('custom');
                                    }}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hasta (Fecha Fin)</label>
                                <DatePickerInput
                                    value={endDate}
                                    onChange={(val) => {
                                        setEndDate(val);
                                        setDateRangePreset('custom');
                                    }}
                                />
                            </div>
                        </div>

                        {/* Historial Mensual Oficial de WhatsApp */}
                        {smsByMonth.length > 0 && (
                            <div className="flex items-center gap-2 pt-2 border-t border-white/5 overflow-x-auto pb-0.5 custom-scrollbar">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
                                    <Zap size={11} className="text-emerald-400" /> Meses Oficiales:
                                </span>
                                {smsByMonth.map(m => {
                                    const isSelectedMonth = startDate.startsWith(m.month_label);
                                    return (
                                        <button
                                            key={m.month_label}
                                            type="button"
                                            onClick={() => {
                                                const [y, mon] = m.month_label.split('-');
                                                const year = parseInt(y);
                                                const month = parseInt(mon);
                                                const start = new Date(year, month - 1, 1);
                                                const end = new Date(year, month, 0);
                                                setStartDate(start.toISOString().split('T')[0]);
                                                setEndDate(end.toISOString().split('T')[0]);
                                                setDateRangePreset('custom');
                                            }}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 shrink-0 border transition-all ${
                                                isSelectedMonth
                                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-black shadow-sm'
                                                    : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                                            }`}
                                        >
                                            <span className="font-mono">{m.month_label}</span>
                                            <span className="font-black text-emerald-400 font-mono bg-black/40 px-1 py-0.2 rounded">{m.count} msgs</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* FILTRO VISUAL POR CATEGORÍAS */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Building2 size={13} className="text-accent" /> Filtrar por Categoría de Negocio:
                            </span>
                            {filterCategory !== 'all' && (
                                <button
                                    onClick={() => setFilterCategory('all')}
                                    className="text-[10px] text-accent hover:underline font-bold"
                                >
                                    Ver Todas
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                            {CATEGORIES.map(cat => {
                                const Icon = cat.icon;
                                const isSelected = filterCategory === cat.id;
                                const count = cat.id === 'all'
                                    ? allTenants.length
                                    : allTenants.filter(t => t.category === cat.id).length;

                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setFilterCategory(cat.id)}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                                            isSelected
                                                ? 'bg-accent text-slate-950 border-accent font-black shadow-md shadow-accent/20'
                                                : 'bg-slate-950/60 hover:bg-white/5 border-white/10 text-slate-300'
                                        }`}
                                    >
                                        {Icon && <Icon size={14} className={isSelected ? 'text-slate-950' : 'text-accent'} />}
                                        <span>{cat.label}</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                                            isSelected ? 'bg-slate-900 text-white font-bold' : 'bg-white/5 text-slate-400'
                                        }`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* KPIs Financieros Globales */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                        {/* MRR Real Cobrado */}
                        <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-slate-950/60 shadow-md">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ingresos Reales Cobrados (MRR)</span>
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                    <TrendingUp size={16} />
                                </div>
                            </div>
                            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                                ${globalSummary.totalMRR_MXN.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-xs text-slate-400 font-bold">MXN</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono mt-1">
                                {globalSummary.payingBusinessesCount} pagando · {globalSummary.trialBusinessesCount} en prueba · {globalSummary.unpaidBusinessesCount} sin cobro
                            </p>
                        </div>

                        {/* Costo Operativo Total */}
                        <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-slate-950/60 shadow-md">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Costo Operativo Real</span>
                                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                                    <TrendingDown size={16} />
                                </div>
                            </div>
                            <div className="text-2xl sm:text-3xl font-black text-rose-400 tracking-tight mt-1">
                                ${globalSummary.totalOperatingCostMXN.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-slate-400 font-bold">MXN</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono mt-1">
                                Var: ${globalSummary.totalVariableCostMXN.toFixed(1)} MXN + Fijos: ${globalSummary.totalFixedCostMXN.toFixed(1)} MXN
                            </p>
                        </div>

                        {/* Ganancia Neta Limpia */}
                        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 shadow-md">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Ganancia Neta (EBITDA)</span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${globalSummary.overallMarginPct >= 70 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                                    {globalSummary.overallMarginPct.toFixed(1)}% Margen
                                </span>
                            </div>
                            <div className={`text-2xl sm:text-3xl font-black tracking-tight mt-1 ${globalSummary.netProfitMXN >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                ${globalSummary.netProfitMXN.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-slate-400 font-bold">MXN</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono mt-1">
                                ≈ ${globalSummary.netProfitUSD.toFixed(2)} USD beneficio limpio
                            </p>
                        </div>

                        {/* Mensajería Automática y Manual */}
                        <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-slate-950/60 shadow-md">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mensajería en Rango</span>
                                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                                    <Bot size={16} />
                                </div>
                            </div>
                            <div className="text-2xl sm:text-3xl font-black text-cyan-400 tracking-tight mt-1">
                                {(globalSummary.totalWaCount + globalSummary.totalSmsUsCount).toLocaleString()} <span className="text-xs text-slate-400 font-bold">msgs</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono mt-1">
                                💬 {globalSummary.totalWaCount} WA ({globalSummary.totalAutoCount} automáticos) · 📱 {globalSummary.totalSmsUsCount} SMS
                            </p>
                        </div>
                    </div>

                    {/* SECCIÓN DE GRÁFICAS INTERACTIVAS (RECHARTS) */}
                    {showCharts && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-in">
                            {/* Gráfica 1: Comparativa General por Categoría */}
                            <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-white/10 shadow-lg space-y-3">
                                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 size={16} className="text-emerald-400" />
                                        <h3 className="text-xs font-black uppercase tracking-wider text-white">Rentabilidad & Consumo por Categoría (MXN)</h3>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-bold">Métricas Consolidadas por Rubro</span>
                                </div>

                                {categoryChartData.length === 0 ? (
                                    <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
                                        No hay datos de categorías para graficar.
                                    </div>
                                ) : (
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" />
                                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                                                <RechartsTooltip
                                                    contentStyle={{
                                                        backgroundColor: '#0f172a',
                                                        borderColor: 'rgba(255,255,255,0.15)',
                                                        borderRadius: '12px',
                                                        fontSize: '11px',
                                                        color: '#fff'
                                                    }}
                                                    formatter={(val: any, name: any) => [`$${val} MXN`, name]}
                                                />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                                                <Bar dataKey="Ingreso" fill="#10b981" radius={[4, 4, 0, 0]} name="Ingresos Cobrados ($ MXN)" />
                                                <Bar dataKey="Costo" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Costo Mensajes ($ MXN)" />
                                                <Bar dataKey="Ganancia" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Margen Limpio ($ MXN)" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>

                            {/* Gráfica 2: Distribución 100% Real de tus Gastos */}
                            <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-white/10 shadow-lg space-y-3 flex flex-col justify-between">
                                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                                    <div className="flex items-center gap-2">
                                        <PieChartIcon size={16} className="text-cyan-400" />
                                        <h3 className="text-xs font-black uppercase tracking-wider text-white">Distribución Real de Gastos</h3>
                                    </div>
                                    <span className="text-[10px] text-cyan-400 font-mono font-bold">${globalSummary.totalOperatingCostMXN.toFixed(0)} MXN</span>
                                </div>

                                {pieChartData.length === 0 ? (
                                    <div className="h-48 flex items-center justify-center text-slate-500 text-xs text-center px-4">
                                        No hay gastos registrados. Agrega tus facturas en la pestaña "Gastos Fijos".
                                    </div>
                                ) : (
                                    <div className="h-48 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={pieChartData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={45}
                                                    outerRadius={75}
                                                    paddingAngle={4}
                                                >
                                                    {pieChartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip
                                                    contentStyle={{
                                                        backgroundColor: '#0f172a',
                                                        borderColor: 'rgba(255,255,255,0.15)',
                                                        borderRadius: '12px',
                                                        fontSize: '11px',
                                                        color: '#fff'
                                                    }}
                                                    formatter={(val: any) => [`$${val} MXN`, 'Gasto']}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/5 text-[10px] max-h-24 overflow-y-auto custom-scrollbar">
                                    {pieChartData.map(item => (
                                        <div key={item.name} className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                            <span className="text-slate-400 truncate">{item.name}:</span>
                                            <span className="font-bold text-white font-mono ml-auto">${item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tabla de Unit Economics Negocio por Negocio */}
                    <div className="space-y-3">
                        {/* Barra de Búsqueda, Filtros y Orden */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                            <div className="relative flex-1 max-w-md">
                                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar negocio por nombre o slug..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                                />
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Filtro por Estado de Pago Stripe */}
                                <select
                                    value={filterPayment}
                                    onChange={(e) => setFilterPayment(e.target.value as any)}
                                    className="bg-slate-950/60 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-accent font-bold"
                                >
                                    <option value="all">💳 Todo Estado de Pago</option>
                                    <option value="paying">🟢 Pagando Real (Stripe / Manual)</option>
                                    <option value="trial">🟠 En Periodo de Prueba</option>
                                    <option value="unpaid">⚠️ Sin Pago Configurado</option>
                                    <option value="free">⚪ Plan Gratuito</option>
                                </select>

                                {/* Filtro por Plan */}
                                <select
                                    value={filterPlan}
                                    onChange={(e) => setFilterPlan(e.target.value)}
                                    className="bg-slate-950/60 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-accent"
                                >
                                    <option value="all">Todos los Planes</option>
                                    <option value="free">Plan Free</option>
                                    <option value="trial">En Prueba</option>
                                    <option value="lite">Plan Esencial (Lite)</option>
                                    <option value="pro">Plan Pro</option>
                                    <option value="business">Plan Business</option>
                                </select>

                                {/* Filtro por Margen */}
                                <select
                                    value={filterMargin}
                                    onChange={(e) => setFilterMargin(e.target.value as any)}
                                    className="bg-slate-950/60 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-accent"
                                >
                                    <option value="all">Todo Margen</option>
                                    <option value="profitable">🟢 Excelente (&gt;80%)</option>
                                    <option value="medium">🟡 Medio (50-80%)</option>
                                    <option value="low">🟠 Bajo (&lt;50%)</option>
                                    <option value="loss">🔴 En Pérdida (Gasto &gt; Ingreso)</option>
                                </select>

                                {/* Ordenamiento */}
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="bg-slate-950/60 border border-white/10 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-accent"
                                >
                                    <option value="cost_desc">Mayor Costo Variable</option>
                                    <option value="profit_desc">Mayor Ganancia Neta</option>
                                    <option value="revenue_desc">Mayor Ingreso (MRR)</option>
                                    <option value="margin_desc">Mayor Margen %</option>
                                    <option value="wa_desc">Más Mensajes WA</option>
                                </select>
                            </div>
                        </div>

                        {/* Tabla de Negocios */}
                        <div className="rounded-2xl bg-slate-950/60 border border-white/10 overflow-hidden shadow-lg">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                                            <th className="py-3 px-4">Negocio</th>
                                            <th className="py-3 px-3">Estado Stripe / Ingreso</th>
                                            <th className="py-3 px-3">WhatsApp & Auto</th>
                                            <th className="py-3 px-3">SMS +1 USA</th>
                                            <th className="py-3 px-3">Costo Variable</th>
                                            <th className="py-3 px-3">Ganancia Neta</th>
                                            <th className="py-3 px-3 text-right">Margen %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredBusinesses.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                                                    No se encontraron negocios con los filtros seleccionados.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredBusinesses.map(b => {
                                                return (
                                                    <tr key={b.tenant.id} className="hover:bg-white/[0.02] transition-colors group">
                                                        {/* Negocio */}
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                                                    {b.tenant.logoUrl ? (
                                                                        <img decoding="async" loading="lazy" src={b.tenant.logoUrl} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <Sparkles size={14} className="text-accent" />
                                                                    )}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-bold text-white truncate text-xs">{b.tenant.name}</p>
                                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                                                        <span className="text-accent/80 font-mono truncate">{b.tenant.slug}</span>
                                                                        <span>·</span>
                                                                        <span className="text-slate-500">{b.apptCount} citas</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Estado de Pago / Ingreso Real */}
                                                        <td className="py-3 px-3">
                                                            <div className="flex flex-col gap-1">
                                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border w-fit ${b.paymentInfo.statusBadgeClass}`}>
                                                                    {b.paymentInfo.statusLabel}
                                                                </span>
                                                                <p className="font-black text-white font-mono text-xs">
                                                                    ${b.revenueMXN.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-[9px] text-slate-500">MXN</span>
                                                                </p>
                                                            </div>
                                                        </td>

                                                        {/* WhatsApp & Mensajes Automáticos */}
                                                        <td className="py-3 px-3">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="font-bold text-emerald-400 font-mono text-xs flex items-center gap-1 flex-wrap">
                                                                    <span>{b.waCount} msgs</span>
                                                                    {b.autoCount > 0 && (
                                                                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-sans font-bold" title={`${b.autoCount} recordatorios automáticos enviados`}>
                                                                            🤖 {b.autoCount} auto
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono flex-wrap">
                                                                    <span>${b.waCostUSD.toFixed(4)} USD</span>
                                                                    {b.waTotalHistorical > b.waCount && (
                                                                        <span className="text-slate-500 font-sans font-bold">({b.waTotalHistorical} histórico)</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* SMS +1 USA */}
                                                        <td className="py-3 px-3">
                                                            {b.smsUsCount > 0 ? (
                                                                <>
                                                                    <span className="font-bold text-cyan-400 font-mono text-xs">
                                                                        {b.smsUsCount} SMS
                                                                    </span>
                                                                    <p className="text-[10px] text-slate-400 font-mono">
                                                                        ${b.smsUsCostUSD.toFixed(4)} USD
                                                                    </p>
                                                                </>
                                                            ) : (
                                                                <span className="text-slate-500 font-mono text-[11px]">0</span>
                                                            )}
                                                        </td>

                                                        {/* Costo Variable Total */}
                                                        <td className="py-3 px-3">
                                                            <p className="font-black text-rose-400 font-mono text-xs">
                                                                ${b.totalVarCostMXN.toFixed(2)} <span className="text-[9px] text-slate-500">MXN</span>
                                                            </p>
                                                            <p className="text-[9px] text-slate-400 font-mono">
                                                                (${b.totalVarCostUSD.toFixed(4)} USD)
                                                            </p>
                                                        </td>

                                                        {/* Ganancia Neta */}
                                                        <td className="py-3 px-3">
                                                            <p className={`font-black font-mono text-xs ${b.netProfitMXN >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                {b.netProfitMXN >= 0 ? '+' : ''}${b.netProfitMXN.toFixed(2)} <span className="text-[9px] text-slate-500">MXN</span>
                                                            </p>
                                                        </td>

                                                        {/* Margen % */}
                                                        <td className="py-3 px-3 text-right">
                                                            <div className="inline-flex flex-col items-end">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border font-mono ${
                                                                    b.marginStatus === 'profitable'
                                                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                                        : b.marginStatus === 'medium'
                                                                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                                                        : b.marginStatus === 'low'
                                                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                                        : 'bg-red-500/20 text-red-300 border-red-500/30'
                                                                }`}>
                                                                    {b.marginPct.toFixed(1)}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA 2: GESTOR DE GASTOS FIJOS 100% PERSONALIZABLE */}
            {activeTab === 'expenses' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950/60 border border-white/10">
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-tight">Tus Gastos Fijos de Infraestructura</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Agrega tus servicios reales (Vercel, Supabase, Dominios, Software, Nómina, etc.) con sus precios exactos.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setEditingExpense(null);
                                setIsExpenseModalOpen(true);
                            }}
                            className="btn bg-accent hover:brightness-110 text-slate-950 font-black py-2 px-4 rounded-xl shadow-md flex items-center gap-1.5 text-xs self-start sm:self-auto"
                        >
                            <Plus size={15} />
                            <span>Agregar Gasto</span>
                        </button>
                    </div>

                    {fixedExpenses.length === 0 ? (
                        <div className="p-12 rounded-3xl bg-slate-950/40 border border-white/10 text-center space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                                <Server size={22} />
                            </div>
                            <h4 className="text-base font-bold text-white">Sin Gastos Fijos Registrados</h4>
                            <p className="text-xs text-slate-400 max-w-md mx-auto">
                                No tienes costos fijos ficticios. Registra tus facturas reales de servidores o licencias para que las gráficas y márgenes de tu SaaS reflejen datos 100% exactos.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingExpense(null);
                                    setIsExpenseModalOpen(true);
                                }}
                                className="btn bg-accent hover:brightness-110 text-slate-950 font-black py-2 px-4 rounded-xl text-xs inline-flex items-center gap-1.5"
                            >
                                <Plus size={14} />
                                <span>Registrar mi Primer Gasto</span>
                            </button>
                        </div>
                    ) : (
                        <div className="rounded-2xl bg-slate-950/60 border border-white/10 overflow-hidden shadow-lg">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                                        <th className="py-3 px-4">Concepto / Nombre</th>
                                        <th className="py-3 px-3">Categoría</th>
                                        <th className="py-3 px-3">Monto & Moneda</th>
                                        <th className="py-3 px-3">Frecuencia</th>
                                        <th className="py-3 px-3">Costo Mensual (MXN)</th>
                                        <th className="py-3 px-3">Estado</th>
                                        <th className="py-3 px-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {fixedExpenses.map(e => {
                                        const cat = EXPENSE_CATEGORIES[e.category] || EXPENSE_CATEGORIES.other;
                                        const monthlyAmountMXN = e.currency === 'USD'
                                            ? (e.frequency === 'yearly' ? (e.amount / 12) : e.amount) * rates.fxRate
                                            : (e.frequency === 'yearly' ? (e.amount / 12) : e.amount);

                                        return (
                                            <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="font-bold text-white text-xs">{e.name}</div>
                                                    {e.notes && <div className="text-[10px] text-slate-500 mt-0.5">{e.notes}</div>}
                                                </td>
                                                <td className="py-3 px-3">
                                                    <span
                                                        className="px-2 py-0.5 rounded-md text-[9px] font-bold"
                                                        style={{ backgroundColor: `${cat.color}20`, color: cat.color, border: `1px solid ${cat.color}40` }}
                                                    >
                                                        {cat.label}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 font-mono font-bold text-white text-xs">
                                                    ${e.amount.toLocaleString()} <span className="text-[10px] text-slate-400">{e.currency}</span>
                                                </td>
                                                <td className="py-3 px-3 text-slate-400 text-xs">
                                                    {e.frequency === 'yearly' ? '📅 Anual (/12)' : '🗓️ Mensual'}
                                                </td>
                                                <td className="py-3 px-3 font-mono font-black text-emerald-400 text-xs">
                                                    ${monthlyAmountMXN.toFixed(2)} MXN
                                                </td>
                                                <td className="py-3 px-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleExpenseActive(e.id)}
                                                        className={`text-xs font-bold flex items-center gap-1.5 ${e.active ? 'text-emerald-400' : 'text-slate-500'}`}
                                                    >
                                                        {e.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                                        <span>{e.active ? 'Activo' : 'Pausado'}</span>
                                                    </button>
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingExpense(e);
                                                                setIsExpenseModalOpen(true);
                                                            }}
                                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                                                            title="Editar Gasto"
                                                        >
                                                            <Edit3 size={13} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteExpense(e.id)}
                                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-500 hover:text-red-400"
                                                            title="Eliminar Gasto"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* PESTAÑA 3: CONFIGURACIÓN DE TARIFAS VARIABLES & TIPO DE CAMBIO */}
            {activeTab === 'rates' && (
                <RatesFormSection
                    initialRates={rates}
                    onSave={handleSaveRates}
                />
            )}

            {/* MODAL PARA AGREGAR / EDITAR GASTO FIJO */}
            {isExpenseModalOpen && (
                <ExpenseFormModal
                    isOpen={isExpenseModalOpen}
                    onClose={() => {
                        setIsExpenseModalOpen(false);
                        setEditingExpense(null);
                    }}
                    initialData={editingExpense}
                    onSave={handleSaveExpense}
                />
            )}
        </div>
    );
}

// Modal Formulario de Gasto Fijo
function ExpenseFormModal({ isOpen, onClose, initialData, onSave }: { isOpen: boolean; onClose: () => void; initialData: FixedExpense | null; onSave: (e: any) => void }) {
    const [name, setName] = useState(initialData?.name || '');
    const [amount, setAmount] = useState(initialData?.amount !== undefined ? String(initialData.amount) : '');
    const [currency, setCurrency] = useState<'USD' | 'MXN'>(initialData?.currency || 'USD');
    const [category, setCategory] = useState<any>(initialData?.category || 'hosting');
    const [frequency, setFrequency] = useState<'monthly' | 'yearly'>(initialData?.frequency || 'monthly');
    const [notes, setNotes] = useState(initialData?.notes || '');
    const [active] = useState(initialData?.active !== undefined ? initialData.active : true);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount < 0) return;

        onSave({
            id: initialData?.id,
            name: name.trim(),
            amount: parsedAmount,
            currency,
            category,
            frequency,
            notes: notes.trim(),
            active
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
            <div className="w-full max-w-md bg-[#0a0f1a] border border-white/10 rounded-3xl p-6 shadow-2xl animate-scale-in space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-accent/10 border border-accent/20 text-accent">
                            <Server size={18} />
                        </div>
                        <div>
                            <h3 className="font-black text-white text-base tracking-tight uppercase">
                                {initialData ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo'}
                            </h3>
                            <p className="text-[10px] text-slate-400">Registra un servicio real de infraestructura o SaaS</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white">
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                    {/* Nombre del Servicio */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre del Concepto / Servicio *</label>
                        <input
                            required
                            type="text"
                            placeholder="Ej: Hosting Vercel Pro, Base de Datos Supabase..."
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-3.5 text-white focus:border-accent focus:outline-none text-xs"
                        />
                    </div>

                    {/* Monto y Moneda */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monto *</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={amount}
                                onWheel={e => (e.target as HTMLElement).blur()}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-3.5 text-white font-mono font-bold focus:border-accent focus:outline-none text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Moneda</label>
                            <select
                                value={currency}
                                onChange={e => setCurrency(e.target.value as any)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-2 text-white font-bold focus:border-accent focus:outline-none text-xs"
                            >
                                <option value="USD">USD ($)</option>
                                <option value="MXN">MXN ($)</option>
                            </select>
                        </div>
                    </div>

                    {/* Categoría y Frecuencia */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoría</label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value as any)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-2.5 text-white text-xs focus:border-accent focus:outline-none"
                            >
                                {Object.entries(EXPENSE_CATEGORIES).map(([key, val]) => (
                                    <option key={key} value={key}>{val.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Frecuencia</label>
                            <select
                                value={frequency}
                                onChange={e => setFrequency(e.target.value as any)}
                                className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-2.5 text-white text-xs focus:border-accent focus:outline-none"
                            >
                                <option value="monthly">Mensual</option>
                                <option value="yearly">Anual</option>
                            </select>
                        </div>
                    </div>

                    {/* Notas Opcionales */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notas / Factura (Opcional)</label>
                        <input
                            type="text"
                            placeholder="Ej: Plan Pro para 5 proyectos, renovación en Noviembre..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl py-2 px-3 text-white focus:border-accent focus:outline-none text-xs"
                        />
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                        <button
                            type="submit"
                            className="flex-1 py-3 rounded-xl bg-accent hover:brightness-110 text-slate-950 font-black uppercase tracking-wider text-xs transition-all shadow-md"
                        >
                            {initialData ? 'Guardar Cambios' : 'Registrar Gasto'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Subcomponente: Formulario de Tarifas Variables con Guardado Explícito y Prevención de Scroll Wheel
function RatesFormSection({ initialRates, onSave }: { initialRates: VariableRates; onSave: (r: VariableRates) => void }) {
    const [formData, setFormData] = useState<VariableRates>(initialRates);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setFormData(initialRates);
        setHasChanges(false);
    }, [initialRates]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        setHasChanges(false);
    };

    return (
        <div className="max-w-2xl bg-slate-950/60 border border-white/10 rounded-3xl p-6 shadow-xl space-y-5 animate-fade-in">
            <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Tarifas Variables de Mensajería & Tipo de Cambio</h3>
                <p className="text-xs text-slate-400 mt-0.5">Ingresa los precios unitarios reales que pagas a Meta y Twilio para calcular el costo por mensaje.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {/* Tipo de Cambio USD/MXN */}
                <div className="space-y-1.5 p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                    <label className="text-[10px] font-black uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                        <DollarSign size={13} className="text-accent" />
                        <span>Tipo de Cambio Real (1 USD = X MXN)</span>
                    </label>
                    <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                        <input
                            type="number"
                            step="0.01"
                            min="1"
                            value={formData.fxRate}
                            onWheel={e => (e.target as HTMLElement).blur()}
                            onChange={e => {
                                setFormData({ ...formData, fxRate: parseFloat(e.target.value) || 0 });
                                setHasChanges(true);
                            }}
                            className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 pl-8 pr-4 text-white font-bold font-mono focus:border-accent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>
                </div>

                {/* WhatsApp Cloud API */}
                <div className="space-y-2 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                            <MessageCircle size={14} />
                            <span>Costo Unitario WhatsApp Cloud API (USD)</span>
                        </label>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">USD / mensaje</span>
                    </div>
                    <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                        <input
                            type="number"
                            step="0.0001"
                            min="0"
                            value={formData.whatsappRate}
                            onWheel={e => (e.target as HTMLElement).blur()}
                            onChange={e => {
                                setFormData({ ...formData, whatsappRate: parseFloat(e.target.value) || 0 });
                                setHasChanges(true);
                            }}
                            className="w-full bg-black/50 border border-emerald-500/30 rounded-xl py-2.5 pl-8 pr-4 text-white font-bold font-mono focus:border-emerald-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>
                </div>

                {/* Twilio SMS (+1 USA) */}
                <div className="space-y-2 p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Phone size={14} />
                            <span>Costo Unitario Twilio SMS (+1 USA/CA) (USD)</span>
                        </label>
                        <span className="text-[10px] font-mono text-cyan-400 font-bold">USD / SMS</span>
                    </div>
                    <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                        <input
                            type="number"
                            step="0.0001"
                            min="0"
                            value={formData.twilioRate}
                            onWheel={e => (e.target as HTMLElement).blur()}
                            onChange={e => {
                                setFormData({ ...formData, twilioRate: parseFloat(e.target.value) || 0 });
                                setHasChanges(true);
                            }}
                            className="w-full bg-black/50 border border-cyan-500/30 rounded-xl py-2.5 pl-8 pr-4 text-white font-bold font-mono focus:border-cyan-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={!hasChanges}
                        className={`w-full py-3 rounded-xl font-black uppercase tracking-wider text-xs transition-all shadow-md flex items-center justify-center gap-2 ${
                            hasChanges
                                ? 'bg-accent hover:brightness-110 text-slate-950 cursor-pointer shadow-accent/20'
                                : 'bg-white/10 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        <CheckCircle2 size={15} />
                        <span>{hasChanges ? 'Guardar Nuevas Tarifas' : 'Tarifas Guardadas'}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}
