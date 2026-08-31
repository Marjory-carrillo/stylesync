import { useMemo, useState, useCallback, useEffect } from 'react';
import { useCancellationLog } from '../../lib/store/queries/useCancellationLog';
import { useAuthStore } from '../../lib/store/authStore';
import { useUIStore } from '../../lib/store/uiStore';
import { useAppointments } from '../../lib/store/queries/useAppointments';
import { useServices } from '../../lib/store/queries/useServices';
import { useWaitingList } from '../../lib/store/queries/useWaitingList';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useStylists } from '../../lib/store/queries/useStylists';
import { useSchedule } from '../../lib/store/queries/useSchedule';
import { useStripeCheckout } from '../../lib/store/queries/useStripeCheckout';
import { Skeleton } from '../../components/ui/Skeleton';
import { CustomSelect } from '../../components/CustomSelect';
import { OnboardingChecklist } from '../../components/OnboardingChecklist';
import ConfirmModal from '../../components/ConfirmModal';
import AdminBookingModal from '../../components/AdminBookingModal';
import AdminRescheduleModal from '../../components/AdminRescheduleModal';
import { calculateAppointmentDuration, getRealAdditionalServices } from '../../lib/smartSlots';
import { Calendar, DollarSign, Users, User, UserX, TrendingUp, Bell, MessageCircle, Phone, Clock, Sparkles, Activity, ChevronDown, Building2, X, Eye, Save, CheckCircle2, RefreshCw } from 'lucide-react';
import { getPlanLimits, isInTrial } from '../../lib/planLimits';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { formatPhoneDisplay } from '../../lib/schemas';
import StylistColumnCalendar from '../../components/StylistColumnCalendar';
import WaitingListModal from '../../components/WaitingListModal';
import PhotoZoomViewer from '../../components/PhotoZoomViewer';

type ChartRange = '7D' | '30D' | '3M' | 'AÑO';

export default function Dashboard() {
    const navigate = useNavigate();
    const [chartRange, setChartRange] = useState<ChartRange>('7D');
    const [chartViewType, setChartViewType] = useState<'revenue' | 'volume'>('revenue');
    const [tomorrowOpen, setTomorrowOpen] = useState(false);
    const [isWaitingListModalOpen, setIsWaitingListModalOpen] = useState(false);
    const [isNewApptModalOpen, setIsNewApptModalOpen] = useState(false);
    const { userRole, userStylistId, userTenants, tenantId } = useAuthStore();
    const isEmployee = userRole === 'employee';
    const [dashboardStylistId, setDashboardStylistId] = useState<number | 'all'>(
        isEmployee && userStylistId ? userStylistId : 'all'
    );
    const { showToast } = useUIStore();
    const { redirectToCheckout, isCheckoutLoading } = useStripeCheckout();

    // Note editing state for completed & active appointments
    const [editingNoteApptId, setEditingNoteApptId] = useState<string | null>(null);
    const [noteText, setNoteText] = useState('');
    const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

    const saveNote = async (aptId: string) => {
        if (!tenantId) return;
        setSavingNoteId(aptId);
        try {
            const { error } = await supabase
                .from('appointments')
                .update({ staff_notes: noteText.trim() || null })
                .eq('id', aptId)
                .eq('tenant_id', tenantId);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['appointments', tenantId] });
            showToast('Nota guardada', 'success');
            setEditingNoteApptId(null);
        } catch (err: any) {
            showToast(`Error al guardar nota: ${err.message}`, 'error');
        } finally {
            setSavingNoteId(null);
        }
    };

    // Custom confirm dialog state
    const [customConfirm, setCustomConfirm] = useState<{
        open: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        onConfirm: () => void;
        danger?: boolean;
    }>({
        open: false,
        title: '',
        message: '',
        onConfirm: () => {},
        danger: false
    });

    // Handle checkout return from Stripe
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const checkoutStatus = params.get('checkout');
        if (checkoutStatus === 'success') {
            showToast('🎉 ¡Pago exitoso! Tu plan se actualizará en segundos.', 'success');
            window.history.replaceState({}, '', window.location.pathname);
        } else if (checkoutStatus === 'cancel') {
            showToast('Pago cancelado. Puedes intentar de nuevo cuando quieras.', 'error');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    // Optimize: only load last 12 months for dashboard metrics
    const startDate = useMemo(() => format(subMonths(new Date(), 12), 'yyyy-MM-01'), []);
    const { appointments: allAppointments, isPending: apptsPending, markNoShow, cancelAppointment } = useAppointments({ startDate });
    const [rescheduleModal, setRescheduleModal] = useState<{ open: boolean; appt: any }>({ open: false, appt: null });
    const [receiptModalUrl, setReceiptModalUrl] = useState<string | null>(null);
    const { services, isPending: svcsLoading } = useServices();
    const { waitingList, addToWaitingList, removeFromWaitingList } = useWaitingList();
    const { stylists } = useStylists();
    const { data: tenantConfig } = useTenantData();
    const { schedule } = useSchedule();
    const businessConfig = (tenantConfig || { slug: '', brandSlug: '', name: '', paymentStatus: 'active', gracePeriodEndsAt: null }) as any;
    const tenantPlan = (tenantConfig as any)?.plan || 'free';
    const trialEndsAt = (tenantConfig as any)?.trialEndsAt || null;
    const inTrial = isInTrial(trialEndsAt);
    const planLimits = getPlanLimits(tenantPlan);
    const monthlyApptLimit = (!inTrial && planLimits.maxAppointmentsPerMonth > 0) ? planLimits.maxAppointmentsPerMonth : -1;

    // Calculate trial and grace days left
    const trialDaysLeft = useMemo(() => {
        if (!trialEndsAt) return -1;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const ends = new Date(trialEndsAt);
        ends.setHours(0, 0, 0, 0);
        return Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }, [trialEndsAt]);

    const isGracePeriod = businessConfig?.paymentStatus === 'grace_period';
    const graceDaysLeft = useMemo(() => {
        if (!isGracePeriod || !businessConfig?.gracePeriodEndsAt) return -1;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const ends = new Date(businessConfig.gracePeriodEndsAt);
        ends.setHours(0, 0, 0, 0);
        return Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }, [isGracePeriod, businessConfig?.gracePeriodEndsAt]);

    // Count non-cancelled appointments in the current calendar month
    const monthlyApptCount = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        return allAppointments.filter(a => {
            if (a.status === 'cancelada') return false;
            const d = new Date(a.date + 'T00:00:00');
            return d.getFullYear() === year && d.getMonth() === month;
        }).length;
    }, [allAppointments]);

    const [linkType, setLinkType] = useState<'branch' | 'brand'>('branch');
    const [isLinkCardExpanded, setIsLinkCardExpanded] = useState(false);
    const [isRemindersExpanded, setIsRemindersExpanded] = useState(false);
    const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
    const [expandedServiceApptId, setExpandedServiceApptId] = useState<string | null>(null);

    const isLoading = apptsPending || svcsLoading;

    const { cancellationLog } = useCancellationLog();
    const getServiceById = useCallback((id: number) => services.find((s: any) => s.id === id), [services]);

    const getAppointmentTotalDuration = useCallback((apt: any) => {
        return calculateAppointmentDuration(apt, services);
    }, [services]);

    const getAppointmentFullServiceDisplay = useCallback((apt: any, baseServiceName?: string) => {
        const base = baseServiceName || 'Servicio';
        const catalogAddons = getRealAdditionalServices(apt.additionalServices, services);
        if (catalogAddons.length > 0) {
            return `${base} + ${catalogAddons.join(', ')}`;
        }
        return base;
    }, [services]);

    const parseApptDateTime = useCallback((dateStr?: string, timeStr?: string) => {
        if (!dateStr || !timeStr) return new Date();
        try {
            const cleanDate = dateStr.split('T')[0].replace(/\//g, '-');
            const [year, month, day] = cleanDate.split('-').map(Number);

            let [hStr, mStr] = timeStr.trim().split(':');
            let hours = parseInt(hStr, 10);
            let minutes = parseInt(mStr, 10) || 0;

            const isPM = /pm/i.test(timeStr);
            const isAM = /am/i.test(timeStr);
            if (isPM && hours < 12) hours += 12;
            if (isAM && hours === 12) hours = 0;

            return new Date(year, month - 1, day, hours, minutes);
        } catch {
            return new Date();
        }
    }, []);

    const getAppointmentPrice = useCallback((apt: any) => {
        const service = getServiceById(apt.serviceId);
        const addServices = apt.additionalServices || [];

        const customPriceItem = addServices.find((s: string) =>
            s.startsWith('Cotización')
        );

        if (customPriceItem) {
            const match = customPriceItem.match(/\$(\d+(\.\d+)?)/);
            if (match) {
                return parseFloat(match[1]);
            }
        }

        let basePrice = service?.price || 0;
        const catalogItem = addServices.find((s: string) => s.startsWith('Diseño Catálogo:'));
        if (catalogItem) {
            const priceMatch = catalogItem.match(/\$(\d+(\.\d+)?)/);
            if (priceMatch) {
                basePrice = parseFloat(priceMatch[1]);
            }
        }

        let total = basePrice;
        addServices.forEach((extra: string) => {
            if (
                extra.startsWith('Cotización') || 
                extra.startsWith('Referencia:') ||
                extra.startsWith('Diseño Catálogo:')
            ) {
                return;
            }

            const extraMatch = extra.match(/\(\+\$(\d+(\.\d+)?)/i) || extra.match(/\+\$(\d+(\.\d+)?)/i);
            if (extraMatch) {
                total += parseFloat(extraMatch[1]);
                return;
            }

            const cleanName = extra
                .split('(+')[0]
                .replace(/^Extra:\s*/i, '')
                .replace(/^Diseño:\s*/i, '')
                .replace(/^Largo:\s*/i, '')
                .replace(/^Adicional:\s*/i, '')
                .replace(/^Estilo:\s*/i, '')
                .trim();

            const matchingService = services.find((s: any) =>
                s.name.toLowerCase() === cleanName.toLowerCase() ||
                s.name.toLowerCase() === extra.toLowerCase()
            );
            if (matchingService && matchingService.price) {
                total += matchingService.price;
            }
        });

        return total;
    }, [getServiceById, services]);

    const isPriceConfirmed = useCallback((apt: any) => {
        if ((apt.additionalServices || []).some((s: string) => s.startsWith('Cotización Confirmada:'))) {
            return true;
        }
        const hasApproxDesign = (apt.additionalServices || []).some((s: string) => 
            s.startsWith('Diseño:') && (
                s.includes('Sencillo') || 
                s.includes('Elaborado') || 
                s.includes('Complex') || 
                s.includes('complex') || 
                s.includes('simple')
            )
        );
        return !hasApproxDesign;
    }, []);

    const handleNoShow = useCallback((appt: any) => {
        setCustomConfirm({
            open: true,
            title: '¿Marcar como Inasistencia?',
            message: `¿Marcar a ${appt.clientName} como que no asistió? Esto registrará su inasistencia y bloqueará su número para futuras reservas.`,
            confirmLabel: 'Marcar No-Asistió',
            cancelLabel: 'Cancelar',
            danger: true,
            onConfirm: async () => {
                try {
                    await markNoShow(appt.id);
                    showToast('Cliente marcado como No Asistió con éxito', 'success');
                } catch (err: any) {
                    showToast(`Error al registrar inasistencia: ${err.message}`, 'error');
                }
            }
        });
    }, [markNoShow, showToast]);

    const [selectedApptForPrice, setSelectedApptForPrice] = useState<any | null>(null);
    const [newPriceValue, setNewPriceValue] = useState('');
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const queryClient = useQueryClient();

    const handleSaveCustomPrice = async () => {
        if (!selectedApptForPrice || !newPriceValue.trim() || !tenantId) return;
        const price = Number(newPriceValue);
        if (isNaN(price)) {
            showToast('Ingresa un precio numérico válido', 'error');
            return;
        }

        try {
            const apt = selectedApptForPrice;
            const currentAddServices = apt.additionalServices || [];
            // Limpiar cotización vieja
            let cleanAddServices = currentAddServices.filter((s: string) => 
                !s.startsWith('Cotización Estimada:') && 
                !s.startsWith('Cotización Confirmada:')
            );
            // Añadir nueva cotización confirmada
            cleanAddServices.push(`Cotización Confirmada: $${price} MXN`);

            // Actualizar en base de datos
            const updatePayload: any = { additional_services: cleanAddServices };
            if (apt.bookingSource === 'marketplace' || apt.booking_source === 'marketplace') {
                const commRate = (tenantConfig as any)?.marketplaceCommissionRate || 15.0;
                updatePayload.marketplace_commission_amount = Number(price) * (commRate / 100);
            }

            const { error } = await supabase
                .from('appointments')
                .update(updatePayload)
                .eq('id', apt.id)
                .eq('tenant_id', tenantId);

            if (error) throw error;

            // Enviar notificación automática por WhatsApp al cliente mediante la plantilla price_update
            const mainSvc = services.find(s => s.id === apt.serviceId);
            try {
                const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
                const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
                fetch(`${SUPABASE_URL}/functions/v1/notify-admin`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${ANON_KEY}`,
                        'apikey': ANON_KEY,
                    },
                    body: JSON.stringify({
                        tenant_id: tenantId,
                        event_type: 'price_update',
                        appointment: {
                            id: apt.id,
                            client_name: apt.clientName,
                            client_phone: apt.clientPhone,
                            service_name: mainSvc?.name || 'Servicio',
                            date: apt.date,
                            time: apt.time,
                            confirmed_price: price,
                            additional_services: apt.additionalServices || [],
                        },
                        business_name: businessConfig?.name || 'CitaLink',
                    }),
                }).catch(() => {});
            } catch (_) {}

            showToast('Precio de cita actualizado y notificación enviada con éxito', 'success');
            
            // Actualizar queries locales y desmarcar tarjeta desplegada para prevenir bug visual
            queryClient.invalidateQueries({ queryKey: ['appointments', tenantId] });
            setExpandedServiceApptId(null);
            
            setIsPriceModalOpen(false);
            setSelectedApptForPrice(null);
        } catch (err: any) {
            showToast(`Error al guardar precio: ${err.message}`, 'error');
        }
    };


    const appointments = useMemo(() => {
        if (userRole === 'employee' && userStylistId) {
            return allAppointments.filter(a => a.stylistId === userStylistId);
        }
        return allAppointments;
    }, [allAppointments, userRole, userStylistId]);

    const todayAppts = useMemo(() => {
        // Actually, we should use format from date-fns or local formatting
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const tStr = `${yyyy}-${mm}-${dd}`;
        return appointments.filter(a => a.date === tStr && a.status !== 'cancelada');
    }, [appointments]);



    const tomorrowAppts = useMemo(() => {
        const target = new Date();
        target.setDate(target.getDate() + 1);
        const yyyy = target.getFullYear();
        const mm = String(target.getMonth() + 1).padStart(2, '0');
        const dd = String(target.getDate()).padStart(2, '0');
        const tStr = `${yyyy}-${mm}-${dd}`;
        return appointments
            .filter(a => {
                if (a.date !== tStr || a.status === 'cancelada') return false;
                if (dashboardStylistId !== 'all' && Number(a.stylistId) !== Number(dashboardStylistId)) return false;
                return true;
            })
            .sort((a, b) => a.time.localeCompare(b.time));
    }, [appointments, dashboardStylistId]);

    const reminders = useMemo(() => {
        return tomorrowAppts.filter(a => {
            if (!a.bookedAt) return false;
            const diffDays = (Date.now() - new Date(a.bookedAt).getTime()) / (1000 * 3600 * 24);
            return diffDays >= 3;
        });
    }, [tomorrowAppts]);



    // Citas pendientes de confirmar precio (servicios sin precio fijo, rango o calculadora con diseño extra)
    const pendingPriceAppts = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        return appointments.filter(a => {
            if (a.status === 'cancelada') return false;
            if (a.date < todayStr) return false;
            const svc = services.find(s => s.id === a.serviceId);
            if (!svc) return false;
            
            const isConfirmed = (a.additionalServices || []).some((s: string) => 
                s.startsWith('Cotización Confirmada:') || 
                s.startsWith('Cotización:') || 
                s.startsWith('Cotización Personalizada:')
            );
            if (isConfirmed) return false;

            const isVar = svc.priceType === 'no_price' || svc.priceType === 'range';
            const hasQuoterDesign = svc.enableQuoter && (a.additionalServices || []).some((s: string) => 
                s.startsWith('Diseño:') && (s.includes('+$') || s.includes('Sencillo') || s.includes('Elaborado'))
            );

            return isVar || hasQuoterDesign;
        }).sort((a, b) => {
            const dateCmp = b.date.localeCompare(a.date);
            if (dateCmp !== 0) return dateCmp;
            return b.time.localeCompare(a.time);
        });
    }, [appointments, services]);

    // Recordatorios enviados hoy (con reminder_sent = true para citas de hoy)
    const todayRemindersSent = useMemo(() => {
        return todayAppts.filter(a => a.reminderSent === true);
    }, [todayAppts]);

    const remindersSentCount = todayRemindersSent.length;
    const [dashboardViewMode, setDashboardViewMode] = useState<'columns' | 'list'>('columns');

    // ── Reports Logic ──
    const currentMonthStats = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        let currentRevenue = 0;
        let lastRevenue = 0;
        let currentCompleted = 0;
        let lastCompleted = 0;
        let currentCanceled = 0;

        appointments.forEach(a => {
            const d = new Date(a.date + 'T' + a.time);
            const isCurrentMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            const isLastMonth = d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
            const isCanceled = a.status === 'cancelada';
            const isNoShow = a.status === 'no_show';

            const price = getAppointmentPrice(a);

            if (isCurrentMonth) {
                if (isCanceled) {
                    currentCanceled++;
                } else if (!isNoShow) {
                    currentCompleted++;
                    let isFinished = a.status === 'completada';
                    if (!isFinished) {
                        const end = new Date(`${a.date}T${a.time}`);
                        end.setMinutes(end.getMinutes() + getAppointmentTotalDuration(a));
                        if (new Date() >= end) isFinished = true;
                    }
                    if (isFinished) {
                        currentRevenue += price;
                    }
                }
            } else if (isLastMonth) {
                if (!isCanceled && !isNoShow) {
                    lastCompleted++;
                    let isFinished = a.status === 'completada';
                    if (!isFinished) {
                        const end = new Date(`${a.date}T${a.time}`);
                        end.setMinutes(end.getMinutes() + getAppointmentTotalDuration(a));
                        if (new Date() >= end) isFinished = true;
                    }
                    if (isFinished) {
                        lastRevenue += price;
                    }
                }
            }
        });

        // Growth metrics
        const revenueGrowth = lastRevenue === 0 ? (currentRevenue > 0 ? 100 : 0) : ((currentRevenue - lastRevenue) / lastRevenue) * 100;
        const appsGrowth = lastCompleted === 0 ? (currentCompleted > 0 ? 100 : 0) : ((currentCompleted - lastCompleted) / lastCompleted) * 100;

        return {
            revenue: currentRevenue,
            lastRevenue,
            revenueGrowth,
            count: currentCompleted,
            appsGrowth,
            canceled: currentCanceled
        };
    }, [appointments, services, getAppointmentPrice, getAppointmentTotalDuration]);

    // Graph Data & Summary
    const { chartData: revenueChartData, chartSummary } = useMemo(() => {
        const data = [];
        const today = new Date();
        let totalRevenue = 0;
        let totalAppointments = 0;

        if (chartRange === '7D' || chartRange === '30D') {
            const daysCount = chartRange === '7D' ? 7 : 30;
            for (let i = daysCount - 1; i >= 0; i--) {
                const d = subDays(today, i);
                const dateStr = format(d, 'yyyy-MM-dd');
                const label = format(d, 'd MMM', { locale: es });

                const dayAppts = appointments.filter(a => a.date === dateStr && a.status !== 'cancelada');
                const dayRevenue = dayAppts.reduce((sum, appt) => {
                    const svc = services.find(s => s.id === appt.serviceId);
                    if (!svc) return sum;
                    let isFinished = appt.status === 'completada';
                    if (!isFinished) {
                        const end = new Date(`${appt.date}T${appt.time}`);
                        end.setMinutes(end.getMinutes() + getAppointmentTotalDuration(appt));
                        if (new Date() >= end) isFinished = true;
                    }
                    return isFinished ? sum + getAppointmentPrice(appt) : sum;
                }, 0);

                totalRevenue += dayRevenue;
                totalAppointments += dayAppts.length;

                data.push({
                    name: label,
                    date: dateStr,
                    Ingresos: dayRevenue,
                    Citas: dayAppts.length
                });
            }
        } else if (chartRange === '3M') {
            // Last 12 weeks
            for (let i = 11; i >= 0; i--) {
                const startOfTargetWeek = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
                const endOfTargetWeek = endOfWeek(startOfTargetWeek, { weekStartsOn: 1 });
                const label = `${format(startOfTargetWeek, 'd', { locale: es })}-${format(endOfTargetWeek, 'd MMM', { locale: es })}`;

                const weekAppts = appointments.filter(a => {
                    if (a.status === 'cancelada') return false;
                    const d = new Date(a.date + 'T12:00:00');
                    return isWithinInterval(d, { start: startOfTargetWeek, end: endOfTargetWeek });
                });

                const weekRevenue = weekAppts.reduce((sum, appt) => {
                    const svc = services.find(s => s.id === appt.serviceId);
                    if (!svc) return sum;
                    return sum + getAppointmentPrice(appt);
                }, 0);

                totalRevenue += weekRevenue;
                totalAppointments += weekAppts.length;

                data.push({
                    name: label,
                    Ingresos: weekRevenue,
                    Citas: weekAppts.length
                });
            }
        } else if (chartRange === 'AÑO') {
            // Last 12 months
            for (let i = 11; i >= 0; i--) {
                const targetMonth = startOfMonth(subMonths(today, i));
                const endOfTargetMonth = endOfMonth(targetMonth);
                const label = format(targetMonth, 'MMM yy', { locale: es });

                const monthAppts = appointments.filter(a => {
                    if (a.status === 'cancelada') return false;
                    const d = new Date(a.date + 'T12:00:00');
                    return isWithinInterval(d, { start: targetMonth, end: endOfTargetMonth });
                });

                const monthRevenue = monthAppts.reduce((sum, appt) => {
                    const svc = services.find(s => s.id === appt.serviceId);
                    if (!svc) return sum;
                    return sum + getAppointmentPrice(appt);
                }, 0);

                totalRevenue += monthRevenue;
                totalAppointments += monthAppts.length;

                data.push({
                    name: label.charAt(0).toUpperCase() + label.slice(1),
                    Ingresos: monthRevenue,
                    Citas: monthAppts.length
                });
            }
        }

        const avgTicket = totalAppointments > 0 ? Math.round(totalRevenue / totalAppointments) : 0;

        return {
            chartData: data,
            chartSummary: {
                totalRevenue,
                totalAppointments,
                avgTicket
            }
        };
    }, [appointments, services, chartRange, getAppointmentPrice]);

    // Top Services Enriched with % of total revenue and top stylist
    const topServicesData = useMemo(() => {
        const serviceStats: Record<number, { count: number; revenue: number; stylists: Record<number, number> }> = {};
        let totalRevenueSum = 0;

        appointments.forEach(a => {
            if (a.status === 'cancelada') return;
            const svc = services.find(s => s.id === a.serviceId);
            if (!svc) return;
            const price = getAppointmentPrice(a);

            if (!serviceStats[a.serviceId]) {
                serviceStats[a.serviceId] = { count: 0, revenue: 0, stylists: {} };
            }
            serviceStats[a.serviceId].count += 1;
            serviceStats[a.serviceId].revenue += price;
            totalRevenueSum += price;

            if (a.stylistId) {
                serviceStats[a.serviceId].stylists[a.stylistId] = (serviceStats[a.serviceId].stylists[a.stylistId] || 0) + 1;
            }
        });

        const list = Object.entries(serviceStats)
            .map(([id, stats]) => {
                const svc = services.find(s => s.id === Number(id));
                let topStylistName = '';
                let maxStylistCount = 0;
                Object.entries(stats.stylists).forEach(([stId, count]) => {
                    if (count > maxStylistCount) {
                        maxStylistCount = count;
                        const st = stylists.find(s => s.id === Number(stId));
                        if (st) topStylistName = st.name.split(' ')[0];
                    }
                });

                const percentOfTotal = totalRevenueSum > 0 ? Math.round((stats.revenue / totalRevenueSum) * 100) : 0;

                return {
                    id: Number(id),
                    name: svc?.name || 'Servicio',
                    count: stats.count,
                    revenue: stats.revenue,
                    percentOfTotal,
                    topStylistName
                };
            })
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 4);

        return { list, totalRevenueSum };
    }, [appointments, services, stylists, getAppointmentPrice]);



    return (
        <div className="animate-fade-in space-y-6 md:space-y-8">
            {/* Warning Banner (Grace Period or Trial expiring soon) */}
            {(() => {
                const isGrace = businessConfig?.paymentStatus === 'grace_period';
                const showTrialWarning = inTrial && trialDaysLeft <= 8 && trialDaysLeft >= 0;

                if (!isGrace && !showTrialWarning) return null;

                return (
                    <div className="glass-panel p-5 border border-amber-500/25 bg-amber-500/5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-scale-in">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-amber-500/15 text-amber-400 rounded-2xl shrink-0">
                                <Activity size={20} className="animate-pulse-soft" />
                            </div>
                            <div className="text-left">
                                <h4 className="text-sm font-black text-white uppercase tracking-wider">
                                    {isGrace ? 'Problema con tu método de pago' : 'Tu período de prueba está por vencer'}
                                </h4>
                                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                                    {isGrace ? (
                                        <>
                                            Tu suscripción está en período de gracia. Actualiza tu método de pago antes del{' '}
                                            <strong className="text-amber-400">
                                                {businessConfig.gracePeriodEndsAt 
                                                    ? format(new Date(businessConfig.gracePeriodEndsAt), 'dd/MM/yyyy', { locale: es }) 
                                                    : 'próximo ciclo'}
                                            </strong>{' '}
                                            para evitar la suspensión temporal del servicio.
                                        </>
                                    ) : (
                                        <>
                                            Tu período de prueba de 30 días gratis expira en{' '}
                                            <strong className="text-amber-400">
                                                {trialDaysLeft} {trialDaysLeft === 1 ? 'día' : 'días'}
                                            </strong>. Elige un plan para continuar usando CitaLink.
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                        {isGrace ? (
                            <a
                                href={`https://wa.me/528681239154?text=${encodeURIComponent(`Hola, mi negocio "${businessConfig.name || ''}" tiene un aviso de pago pendiente en CitaLink. ¿Me ayudan a verificar?`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 shrink-0"
                            >
                                <MessageCircle size={14} />
                                Contactar Soporte
                            </a>
                        ) : (
                            <button
                                onClick={() => {
                                    const el = document.getElementById('pricing-section');
                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 shrink-0"
                            >
                                Ver Planes
                            </button>
                        )}
                    </div>
                );
            })()}

            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">Dashboard</h2>
                        {!isEmployee && (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                tenantPlan === 'pro'
                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                    : tenantPlan === 'business'
                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                    : inTrial
                                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                                    : 'bg-white/5 border-white/10 text-slate-500'
                            }`}>
                                {tenantPlan === 'pro' && '⭐ '}
                                {tenantPlan === 'business' && '🚀 '}
                                {inTrial ? 'Trial' : tenantPlan.toUpperCase()}
                            </span>
                        )}
                    </div>
                    <p className="text-slate-400 text-xs md:text-sm">Resumen de actividad y métricas clave.</p>
                </div>
                <div className="glass-panel px-4 py-2 rounded-2xl flex items-center gap-2 text-xs md:text-sm text-cyan-400 whitespace-nowrap shadow-inner">
                    <Clock size={14} className="md:size-4" />
                    <span className="capitalize">{new Date().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </div>
            </header>

            {/* ── Onboarding Checklist (solo admin, desaparece cuando todo está completo) ── */}
            {!isEmployee && tenantConfig && (
                <OnboardingChecklist
                    tenantId={useAuthStore.getState().tenantId || ''}
                    stylists={stylists}
                    services={services}
                    tenantConfig={tenantConfig}
                    schedule={schedule}
                />
            )}

            {/* ── Monthly Appointment Counter (Free plan only) ── */}
            {!isEmployee && !inTrial && tenantPlan === 'free' && monthlyApptLimit > 0 && (
                (() => {
                    const used = monthlyApptCount;
                    const limit = monthlyApptLimit;
                    const pct = Math.min(100, Math.round((used / limit) * 100));
                    const remaining = limit - used;
                    const isWarning = remaining <= 5 && remaining > 0;
                    const isExhausted = remaining <= 0;
                    const barColor = isExhausted
                        ? 'from-red-500 to-red-600'
                        : isWarning
                        ? 'from-amber-400 to-orange-500'
                        : 'from-cyan-400 to-blue-500';
                    const bgColor = isExhausted
                        ? 'border-red-500/20 bg-red-500/5'
                        : isWarning
                        ? 'border-amber-500/20 bg-amber-500/5'
                        : 'border-white/8 bg-white/3';
                    return (
                        <div className={`glass-panel rounded-2xl p-5 border mb-6 ${bgColor}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${
                                        isExhausted ? 'bg-red-500/15' : isWarning ? 'bg-amber-500/15' : 'bg-cyan-500/15'
                                    }`}>
                                        <Activity size={16} className={isExhausted ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-cyan-400'} />
                                    </div>
                                    <span className="text-sm font-bold text-white">Citas este mes</span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                                        isExhausted ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                        : isWarning ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                        : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                                    }`}>
                                        {isExhausted ? 'LÍMITE ALCANZADO' : isWarning ? `¡Solo ${remaining} restantes!` : `Plan Free`}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-white">{used}</span>
                                    <span className="text-slate-500 font-bold">/{limit}</span>
                                </div>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                <div
                                    className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            {(isWarning || isExhausted) && (
                                <div className="mt-3 flex items-center justify-between">
                                    <p className={`text-xs ${isExhausted ? 'text-red-400' : 'text-amber-400'}`}>
                                        {isExhausted
                                            ? 'Los clientes no pueden reservar nuevas citas este mes.'
                                            : `Quedan ${remaining} citas disponibles para tus clientes.`
                                        }
                                    </p>
                                    <button
                                        onClick={() => redirectToCheckout('pro')}
                                        disabled={isCheckoutLoading}
                                        className="ml-4 shrink-0 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-violet-500 to-purple-600 text-white border border-violet-500/30 hover:opacity-90 transition-opacity"
                                    >
                                        Actualizar a Pro →
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })()
            )}

            {/* ── Client App Link Banner (Collapsible) ── */}
            <div className={`relative overflow-hidden rounded-[2.5rem] border p-6 md:p-8 shadow-2xl mb-6 group transition-all duration-500 ${
                linkType === 'brand'
                    ? 'bg-gradient-to-br from-violet-600/15 via-fuchsia-600/5 to-purple-600/15 border-violet-500/15'
                    : 'bg-gradient-to-br from-cyan-600/15 via-blue-600/5 to-purple-600/15 border-white/5'
            }`}>
                {/* Header that is always visible and clickable to toggle */}
                <div 
                    className="flex items-center justify-between cursor-pointer select-none relative z-10"
                    onClick={() => setIsLinkCardExpanded(!isLinkCardExpanded)}
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl shrink-0 ${
                            linkType === 'brand' ? 'bg-violet-500/20 text-violet-400' : 'bg-cyan-500/20 text-cyan-400'
                        }`}>
                            <Users size={20} />
                        </div>
                        <div className="text-left">
                            <h3 className="text-base md:text-lg font-black text-white tracking-tight">
                                Enlace de la App de Reservas
                            </h3>
                            <p className="text-xs text-slate-400 font-medium">
                                {linkType === 'brand' 
                                    ? '🏢 Enlace Multi-Sucursal activo' 
                                    : '📍 Enlace directo de esta sucursal'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/5 px-2.5 py-1 rounded-xl border border-white/10 hidden sm:inline">
                            {isLinkCardExpanded ? 'Contraer' : 'Expandir Enlaces'}
                        </span>
                        <ChevronDown 
                            size={18} 
                            className={`text-slate-400 transition-transform duration-300 ${isLinkCardExpanded ? 'rotate-180' : ''}`}
                        />
                    </div>
                </div>

                {/* Collapsible Content */}
                <div className={`transition-all duration-500 ease-in-out overflow-hidden relative z-10 ${
                    isLinkCardExpanded ? 'max-h-[800px] opacity-100 mt-6 pt-6 border-t border-white/5' : 'max-h-0 opacity-0'
                }`}>
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-700">
                        <Users size={160} />
                    </div>
                    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8">
                        <div className="flex-1">
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 transition-all duration-300 ${
                                linkType === 'brand'
                                    ? 'bg-violet-500/10 border border-violet-500/20 text-violet-400'
                                    : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                            }`}>
                                {linkType === 'brand' ? '🏢 Enlace Multi-Sucursal' : 'PWA Discovery'}
                            </div>
                            <p className="text-slate-400 text-sm leading-relaxed font-medium">
                                {linkType === 'brand'
                                    ? 'Comparte este link con tus clientes para que elijan entre todas tus sucursales antes de agendar.'
                                    : 'Tus clientes pueden instalar esta web como una app nativa en su celular para reservar en segundos.'}
                            </p>
                        </div>

                        <div className="flex flex-col gap-4 w-full xl:w-auto">
                            {/* Toggle — solo si tiene brand_slug y cuenta con más de una sucursal activa */}
                            {businessConfig.brandSlug && userTenants && userTenants.length >= 2 && (
                                <div className="flex bg-black/50 p-1.5 rounded-2xl border border-white/[0.08] gap-1 w-full sm:w-auto">
                                    <button
                                        onClick={() => setLinkType('branch')}
                                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                                            linkType === 'branch'
                                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/25 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
                                        }`}
                                    >
                                        <span className="text-base">📍</span>
                                        <span>Esta sucursal</span>
                                    </button>
                                    <button
                                        onClick={() => setLinkType('brand')}
                                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                                            linkType === 'brand'
                                                ? 'bg-gradient-to-r from-violet-500/25 to-fuchsia-600/20 text-violet-300 border border-violet-500/30 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
                                        }`}
                                    >
                                        <Building2 size={14} />
                                        <span>Multisucursal</span>
                                    </button>
                                </div>
                            )}

                            {/* URL + Actions */}
                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                                <div className={`flex items-center backdrop-blur-md rounded-2xl px-5 py-4 border flex-1 sm:min-w-[300px] shadow-inner transition-all duration-300 ${
                                    linkType === 'brand' ? 'bg-violet-950/40 border-violet-500/15' : 'bg-black/40 border-white/5'
                                }`}>
                                    <code className={`font-mono text-xs md:text-sm select-all truncate transition-colors duration-300 ${linkType === 'brand' ? 'text-violet-300' : 'text-blue-400'}`}>
                                        {(() => {
                                            const path = linkType === 'brand' && businessConfig.brandSlug
                                                ? `sucursales/${businessConfig.brandSlug}`
                                                : `reserva/${businessConfig.slug || '...'}`;
                                            return `citalink.app/${path}`;
                                        })()}
                                    </code>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            const path = linkType === 'brand' && businessConfig.brandSlug
                                                ? `/sucursales/${businessConfig.brandSlug}`
                                                : `/reserva/${businessConfig.slug || ''}`;
                                            const url = `${window.location.origin}${path}`;
                                            navigator.clipboard.writeText(url);
                                            showToast('¡Enlace copiado!', 'success');
                                        }}
                                        className={`flex-1 sm:flex-none px-8 py-4 text-white font-black rounded-2xl hover:brightness-110 transition-all active:scale-95 shadow-xl text-sm tracking-wide ${
                                            linkType === 'brand'
                                                ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 shadow-violet-900/40'
                                                : 'bg-gradient-to-r from-cyan-500 to-blue-600 shadow-cyan-900/40'
                                        }`}
                                    >
                                        Copiar
                                    </button>
                                    <a
                                        href={linkType === 'brand' && businessConfig.brandSlug ? `/sucursales/${businessConfig.brandSlug}` : `/reserva/${businessConfig.slug || ''}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-5 py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all border border-white/10 text-sm flex items-center gap-2 backdrop-blur-sm"
                                    >
                                        Abrir
                                    </a>
                                </div>
                            </div>

                            {/* Contextual help text */}
                            <p className={`text-[11px] text-slate-600 transition-all duration-300 ${linkType === 'brand' ? 'text-violet-400/50' : 'text-slate-600'}`}>
                                {linkType === 'brand'
                                    ? '🏢 El cliente verá todas tus sucursales y elegirá antes de reservar'
                                    : '📍 El cliente entra directo a reservar en esta sucursal'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>


            {/* ── Monthly Usage Card (only for Free plan or Trial) ── */}
            {!isEmployee && !isLoading && (tenantPlan === 'free' || inTrial) && (() => {
                const used = currentMonthStats.count;
                const limit = monthlyApptLimit; // -1 = unlimited
                const hasLimit = limit > 0;
                const pct = hasLimit ? Math.min((used / limit) * 100, 100) : -1;
                const isNear = hasLimit && pct >= 70;
                const isFull = hasLimit && pct >= 100;

                // Days remaining — use trial end date if in trial, otherwise month
                const now = new Date();
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const daysLeft = inTrial && trialEndsAt
                    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                    : lastDay - now.getDate();

                // Average daily rate
                const dayOfMonth = now.getDate();
                const avgPerDay = dayOfMonth > 0 ? (used / dayOfMonth) : 0;
                const projected = Math.round(avgPerDay * lastDay);

                // Colors
                const ringColor = isFull ? 'stroke-red-500' : isNear ? 'stroke-amber-500' : 'stroke-violet-500';
                const bgGlow = isFull ? 'from-red-600/10 via-red-600/5' : isNear ? 'from-amber-600/10 via-amber-600/5' : 'from-violet-600/10 via-violet-600/5';
                const borderColor = isFull ? 'border-red-500/20' : isNear ? 'border-amber-500/20' : 'border-white/5';
                const accentText = isFull ? 'text-red-400' : isNear ? 'text-amber-400' : 'text-violet-400';

                // SVG ring calculations
                const radius = 52;
                const circumference = 2 * Math.PI * radius;
                const dashOffset = hasLimit ? circumference - (circumference * (pct / 100)) : 0;

                return (
                    <div className={`relative overflow-hidden rounded-[2rem] border ${borderColor} bg-gradient-to-br ${bgGlow} to-transparent p-6 md:p-8 mb-8 transition-all duration-500`}>
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-white/[0.02] to-transparent rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
                            {/* Progress Ring */}
                            {hasLimit ? (
                                <div className="relative shrink-0">
                                    <svg width="130" height="130" className="-rotate-90" viewBox="0 0 120 120">
                                        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="8" stroke="rgba(255,255,255,0.05)" />
                                        <circle
                                            cx="60" cy="60" r={radius}
                                            fill="none"
                                            strokeWidth="8"
                                            strokeLinecap="round"
                                            className={`${ringColor} transition-all duration-1000 ease-out`}
                                            strokeDasharray={circumference}
                                            strokeDashoffset={dashOffset}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className={`text-3xl font-black tracking-tighter ${accentText}`}>{used}</span>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">/ {limit}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative shrink-0 w-[130px] h-[130px] flex items-center justify-center">
                                    <div className="absolute inset-0 rounded-full border-[8px] border-white/5" />
                                    <div className="absolute inset-0 rounded-full border-[8px] border-transparent border-t-violet-500 border-r-violet-500/50 animate-spin" style={{ animationDuration: '3s' }} />
                                    <div className="flex flex-col items-center justify-center">
                                        <span className="text-3xl font-black tracking-tighter text-violet-400">{used}</span>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">∞</span>
                                    </div>
                                </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0 text-center md:text-left">
                                <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                                    <h3 className="text-lg md:text-xl font-black text-white tracking-tight">Citas este Mes</h3>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                        tenantPlan === 'pro' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                        tenantPlan === 'business' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                    }`}>
                                        {inTrial ? '🎁 Trial' : tenantPlan === 'pro' ? '⭐ Pro' : tenantPlan === 'business' ? '🚀 Biz' : 'Free'}
                                    </span>
                                </div>

                                {hasLimit ? (
                                    <>
                                        {/* Full progress bar */}
                                        <div className="w-full max-w-md h-3 bg-white/5 rounded-full overflow-hidden mb-3">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                                    isFull ? 'bg-gradient-to-r from-red-500 to-red-600 animate-pulse' :
                                                    isNear ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                                                    'bg-gradient-to-r from-violet-500 to-indigo-500'
                                                }`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>

                                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 text-sm">
                                            <span className={`font-bold ${accentText}`}>
                                                {isFull ? '⚠️ Límite alcanzado' : `${limit - used} citas restantes`}
                                            </span>
                                            <span className="text-slate-600 text-xs font-medium">
                                                {daysLeft} días restantes {inTrial ? 'de Trial' : 'en el mes'}
                                            </span>
                                            {!isFull && projected > limit && (
                                                <span className="text-amber-500/80 text-xs font-bold">
                                                    📈 Proyección: ~{projected} citas
                                                </span>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 text-sm">
                                        <span className="text-slate-400 font-medium">
                                            <span className="text-violet-400 font-black">{used}</span> citas completadas
                                        </span>
                                        <span className="text-slate-600 text-xs font-medium">
                                            {daysLeft} días de Trial restantes · Citas ilimitadas ✨
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Full limit overlay warning */}
                        {isFull && (
                            <div className="mt-6 p-4 bg-red-500/5 border border-red-500/15 rounded-2xl">
                                <p className="text-sm text-red-400/90 font-medium text-center">
                                    Has alcanzado el límite de <strong>{limit} citas</strong> para el Plan Free este mes. 
                                    Elige uno de nuestros planes para continuar sin interrupciones.
                                </p>
                            </div>
                        )}

                    </div>
                );
            })()}

            {/* Premium Plans Grid (Shown for Free plan, trial expiring soon, or grace period expiring soon) */}
            {!isEmployee && !isLoading && (tenantPlan === 'free' || (inTrial && trialDaysLeft <= 8) || (isGracePeriod && graceDaysLeft <= 8)) && (
                <div id="pricing-section" className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/5 bg-white/[0.01] mb-8">
                    <h4 className="text-sm font-black text-white uppercase tracking-wider mb-6 text-center md:text-left">
                        Elige el plan ideal para tu negocio
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Plan Esencial */}
                        <div className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-3xl p-6 flex flex-col justify-between transition-all hover:scale-[1.01] relative overflow-hidden">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest bg-teal-500/10 border border-teal-500/20 px-2.5 py-0.5 rounded-full">
                                        Esencial
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-1 mb-4">
                                    <span className="text-3xl font-black text-white">$349</span>
                                    <span className="text-xs text-slate-500 font-bold">MXN / mes</span>
                                </div>
                                <ul className="space-y-2 text-xs text-slate-400 font-medium mb-6">
                                    <li className="flex items-center gap-2">
                                        <span className="text-teal-400 font-bold">✓</span> 1 Profesional (no expandible)
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-teal-400 font-bold">✓</span> 1 Sucursal
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-teal-400 font-bold">✓</span> Citas Ilimitadas
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-teal-400 font-bold">✓</span> App de Reservas Clientes
                                    </li>
                                </ul>
                            </div>
                            <button
                                onClick={() => redirectToCheckout('lite')}
                                disabled={isCheckoutLoading}
                                className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                            >
                                Adquirir Esencial
                            </button>
                        </div>

                        {/* Plan Pro */}
                        <div className="bg-white/[0.03] hover:bg-white/[0.05] border border-amber-500/30 rounded-3xl p-6 flex flex-col justify-between transition-all hover:scale-[1.01] relative shadow-[0_0_30px_rgba(245,158,11,0.05)] overflow-hidden">
                            <div className="absolute -top-1.5 right-6 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-[8px] uppercase tracking-widest px-2.5 py-1 rounded-b-xl border border-t-0 border-amber-400/30">
                                Recomendado
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                                        Pro
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-1 mb-4">
                                    <span className="text-3xl font-black text-white">$649</span>
                                    <span className="text-xs text-slate-500 font-bold">MXN / mes</span>
                                </div>
                                <ul className="space-y-2 text-xs text-slate-400 font-medium mb-6">
                                    <li className="flex items-center gap-2">
                                        <span className="text-amber-400 font-bold">✓</span> 2 Profesionales (incluidos)
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-amber-400 font-bold">✓</span> Profesionales Extra (+$249/mes c/u)
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-amber-400 font-bold">✓</span> 1 Sucursal
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-amber-400 font-bold">✓</span> Citas Ilimitadas
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-amber-400 font-bold">✓</span> Módulo de Nómina y Comisiones
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-amber-400 font-bold">✓</span> WhatsApp / Recordatorios Auto
                                    </li>
                                </ul>
                            </div>
                            <button
                                onClick={() => redirectToCheckout('pro')}
                                disabled={isCheckoutLoading}
                                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50"
                            >
                                Actualizar a Pro
                            </button>
                        </div>

                        {/* Plan Business */}
                        <div className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-3xl p-6 flex flex-col justify-between transition-all hover:scale-[1.01] relative overflow-hidden">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 rounded-full">
                                        Business
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-1 mb-4">
                                    <span className="text-3xl font-black text-white">$1,249</span>
                                    <span className="text-xs text-slate-500 font-bold">MXN / mes</span>
                                </div>
                                <ul className="space-y-2 text-xs text-slate-400 font-medium mb-6">
                                    <li className="flex items-center gap-2">
                                        <span className="text-violet-400 font-bold">✓</span> Multi-Sucursal (2 incluidas)
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-violet-400 font-bold">✓</span> Sucursales Extra (+$599/mes c/u)
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-violet-400 font-bold">✓</span> 2 Profesionales por Sucursal
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-violet-400 font-bold">✓</span> Citas Ilimitadas
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-violet-400 font-bold">✓</span> WhatsApp / Recordatorios Auto
                                    </li>
                                </ul>
                            </div>
                            <button
                                onClick={() => redirectToCheckout('business')}
                                disabled={isCheckoutLoading}
                                className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                            >
                                Adquirir Business
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {
                (cancellationLog.length > 0 && waitingList.length > 0) && (() => {
                    // Agrupar cancelaciones por fecha — un solo card por fecha
                    const byDate: Record<string, typeof cancellationLog[0]> = {};
                    cancellationLog.forEach(c => { if (!byDate[c.date]) byDate[c.date] = c; });
                    const uniqueCancels = Object.values(byDate).slice(0, 5);
                    const hasOpportunities = uniqueCancels.some(c => waitingList.some(w => w.date === c.date));
                    if (!hasOpportunities) return null;

                    return (
                        <div className="glass-panel p-6 rounded-xl border-l-4 border-yellow-500 relative overflow-hidden mb-8">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500 animate-pulse">
                                    <Bell size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-white">Oportunidades de Recuperación</h3>
                            </div>

                            <div className="space-y-4">
                                {uniqueCancels.map(cancel => {
                                    const matches = waitingList.filter(w => w.date === cancel.date);
                                    if (matches.length === 0) return null;
                                    const [h, m] = cancel.time.split(':');
                                    let hh = parseInt(h);
                                    const ampm = hh >= 12 ? 'pm' : 'am';
                                    hh = hh % 12 || 12;
                                    const time12 = `${hh}:${m}${ampm}`;

                                    return (
                                        <div key={cancel.date} className="bg-white/5 border border-white/10 rounded-lg p-4">
                                            <div className="flex items-center gap-2 text-sm text-red-400 mb-2">
                                                <Clock size={14} />
                                                <span>Espacio liberado el <strong>{cancel.date}</strong> a las <strong>{time12}</strong> ({cancel.serviceName})</span>
                                            </div>
                                            <p className="text-xs text-muted mb-3">Hay {matches.length} cliente{matches.length !== 1 ? 's' : ''} esperando para esta fecha:</p>

                                            <div className="space-y-2">
                                                {matches.map(match => (
                                                    <div key={match.id} className="flex justify-between items-center bg-black/30 backdrop-blur-md p-3 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                                                        <div>
                                                            <span className="text-white font-black text-sm block tracking-tight">{match.name.toUpperCase()}</span>
                                                            <span className="text-[10px] text-slate-500 font-mono tracking-tighter">{match.phone}</span>
                                                        </div>

                                                        <a
                                                            href={`https://wa.me/${match.phone.replace(/\D/g, '')}?text=Hola ${match.name}, te contactamos de ${(businessConfig as any)?.name}. ¡Se acaba de liberar un espacio el ${match.date} a las ${time12}! ¿Te interesa tomarlo?`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn btn-sm bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                                                        >
                                                            <MessageCircle size={14} /> Avisar Cliente
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()
            }



            {/* ── SECCIÓN DEDICADA: CITAS PENDIENTES DE COTIZACIÓN (Solo si hay pendientes) ── */}
            {pendingPriceAppts.length > 0 && (
                <div className="mb-8 p-6 md:p-8 rounded-[2.5rem] bg-gradient-to-br from-amber-500/15 via-slate-900/80 to-slate-950/90 border border-amber-500/30 shadow-2xl relative overflow-hidden animate-fade-in">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/10 blur-3xl rounded-full pointer-events-none"></div>
                    
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg md:text-xl font-black text-white tracking-tight">Citas Pendientes de Cotización</h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 shadow-sm">
                                        {pendingPriceAppts.length}
                                    </span>
                                </div>
                                <p className="text-xs text-amber-200/70 font-medium mt-0.5">
                                    Ordenadas de la más reciente a la más lejana. Confirma el precio para notificar al cliente por WhatsApp.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                        {pendingPriceAppts.map((apt) => {
                            const svc = services.find(s => s.id === apt.serviceId);
                            const stylist = stylists.find(s => s.id === apt.stylistId);
                            const dateObj = new Date(apt.date + 'T00:00:00');
                            const dateStr = format(dateObj, 'EEEE d ' + "'de'" + ' MMMM', { locale: es });

                            return (
                                <div key={apt.id} className="p-5 rounded-[1.8rem] bg-slate-950/80 border border-amber-500/30 flex flex-col justify-between gap-4 hover:border-amber-400/60 transition-all duration-300 shadow-lg group relative overflow-hidden">
                                    <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-amber-500/5 blur-xl rounded-full"></div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-black text-white text-base tracking-tight truncate">{apt.clientName}</span>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20 shrink-0">
                                                📅 {dateStr}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                                            <Clock size={14} className="text-amber-400 shrink-0" />
                                            <span>{apt.time} hrs</span>
                                            {stylist && (
                                                <>
                                                    <span className="text-slate-600">•</span>
                                                    <span className="text-pink-400 font-semibold truncate">{stylist.name}</span>
                                                </>
                                            )}
                                        </div>

                                        <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5 pt-1">
                                            <Sparkles size={14} className="text-slate-500 shrink-0" />
                                            <span className="font-bold text-slate-200">{svc?.name || 'Servicio'}</span>
                                        </div>

                                         {/* Detalles de Calculadora / Adicionales (Contraídos por defecto) */}
                                         {apt.additionalServices && apt.additionalServices.length > 0 && (
                                             <div className="mt-2 text-[11px] text-amber-200/90 bg-amber-500/10 rounded-xl border border-amber-500/20 overflow-hidden">
                                                 <button
                                                     type="button"
                                                     onClick={() => setExpandedServiceApptId(expandedServiceApptId === `top-quote-${apt.id}` ? null : `top-quote-${apt.id}`)}
                                                     className="w-full p-2.5 flex items-center justify-between gap-2 hover:bg-amber-500/10 transition-colors text-left"
                                                 >
                                                     <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">Detalles de cotización ({apt.additionalServices.length})</span>
                                                     <ChevronDown size={14} className={`text-amber-400 transition-transform duration-300 ${expandedServiceApptId === `top-quote-${apt.id}` ? 'rotate-180' : ''}`} />
                                                 </button>

                                                 {expandedServiceApptId === `top-quote-${apt.id}` && (
                                                     <div className="px-2.5 pb-2.5 pt-1 border-t border-amber-500/20 space-y-1 animate-fade-in">
                                                         {apt.additionalServices.map((extra: string, idx: number) => {
                                                             if (extra.startsWith('Referencia:')) {
                                                                 const url = extra.replace('Referencia: ', '');
                                                                 return (
                                                                     <div key={idx} className="pt-1.5 pb-0.5 flex items-center justify-between gap-2">
                                                                         <span className="font-bold text-slate-300">• Referencia:</span>
                                                                         <button
                                                                             type="button"
                                                                             onClick={() => setActivePhotoUrl(url)}
                                                                             className="inline-flex items-center gap-1.5 text-[10px] font-black bg-cyan-500 text-slate-900 px-3 py-1 rounded-lg hover:bg-cyan-400 transition-all uppercase tracking-wider cursor-pointer active:scale-95 shadow-md shadow-cyan-500/20"
                                                                         >
                                                                             <Eye size={12} className="text-slate-900" />
                                                                             <span>Ver Diseño</span>
                                                                         </button>
                                                                     </div>
                                                                 );
                                                             }
                                                             return <div key={idx} className="font-medium truncate">• {extra}</div>;
                                                         })}
                                                     </div>
                                                 )}
                                             </div>
                                         )}
                                    </div>

                                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                        {apt.clientPhone && (
                                            <a
                                                href={`https://wa.me/${apt.clientPhone.replace(/\D/g, '')}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 border border-white/10 transition-colors"
                                                title="Contactar al cliente por WhatsApp"
                                            >
                                                <MessageCircle size={16} />
                                            </a>
                                        )}
                                        <button
                                            onClick={() => {
                                                setSelectedApptForPrice(apt);
                                                setNewPriceValue('');
                                                setIsPriceModalOpen(true);
                                            }}
                                            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5"
                                        >
                                            <DollarSign size={14} />
                                            <span>Confirmar Cotización</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Top Metric Banner (Single unified glass card with clean segments) ── */}
            <div className="glass-panel p-4 sm:p-6 rounded-3xl border border-white/10 bg-slate-900/60 shadow-xl mb-6 relative overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-white/10 items-center">
                    {/* 1. Citas Hoy */}
                    <div className="flex items-center gap-2.5 sm:gap-4 px-2 sm:px-4">
                        <div className="p-2 sm:p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0 hidden sm:flex">
                            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs text-slate-400 font-black uppercase tracking-wider truncate">
                                Citas Hoy
                            </p>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                                {isLoading ? (
                                    <Skeleton className="h-7 w-12" />
                                ) : (
                                    <p className="text-xl sm:text-3xl font-black text-white tracking-tight">
                                        {todayAppts.length}
                                    </p>
                                )}
                                <span className="text-[10px] text-slate-500 font-medium hidden md:inline">para hoy</span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Recordatorios WhatsApp enviados hoy */}
                    <div className="flex items-center gap-2.5 sm:gap-4 px-2 sm:px-4">
                        <div className="p-2 sm:p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 hidden sm:flex">
                            <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs text-slate-400 font-black uppercase tracking-wider truncate">
                                Recordatorios
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {isLoading ? (
                                    <Skeleton className="h-7 w-10" />
                                ) : (
                                    <p className="text-xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                                        {remindersSentCount}
                                    </p>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsRemindersExpanded(!isRemindersExpanded)}
                                    className="text-[9px] sm:text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer"
                                >
                                    <span>{isRemindersExpanded ? 'Cerrar' : 'Ver'}</span>
                                    <ChevronDown size={11} className={`transition-transform duration-300 ${isRemindersExpanded ? 'rotate-180' : ''}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 3. Citas del Mes */}
                    <div className="flex items-center gap-2.5 sm:gap-4 px-2 sm:px-4">
                        <div className="p-2 sm:p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 hidden sm:flex">
                            <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs text-slate-400 font-black uppercase tracking-wider truncate">
                                Citas del Mes
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {isLoading ? (
                                    <Skeleton className="h-7 w-12" />
                                ) : (
                                    <p className="text-xl sm:text-3xl font-black text-white tracking-tight">
                                        {currentMonthStats.count}
                                        {monthlyApptLimit > 0 && (
                                            <span className="text-xs sm:text-base font-bold text-slate-500">/{monthlyApptLimit}</span>
                                        )}
                                    </p>
                                )}
                                <span className={`text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-md border ${
                                    currentMonthStats.appsGrowth >= 0 
                                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                                        : 'text-red-400 bg-red-500/10 border-red-500/20'
                                }`}>
                                    {currentMonthStats.appsGrowth >= 0 ? '↗' : '↘'} {Math.abs(Math.round(currentMonthStats.appsGrowth))}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Desplegable de Citas con Recordatorio Enviado Hoy */}
                {isRemindersExpanded && (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-2.5 animate-slide-down">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
                            <div className="flex items-center gap-2">
                                <MessageCircle size={14} className="text-emerald-400" />
                                <h4 className="text-xs font-black text-white">Recordatorios WhatsApp enviados hoy</h4>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {todayRemindersSent.length} {todayRemindersSent.length === 1 ? 'envío' : 'envíos'}
                            </span>
                        </div>
                        {todayRemindersSent.length === 0 ? (
                            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-400 italic">
                                Aún no se han enviado recordatorios para las citas de hoy.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                {todayRemindersSent.map((apt) => {
                                    const svc = services.find(s => s.id === apt.serviceId);
                                    const stylist = stylists.find(s => s.id === apt.stylistId);
                                    const apptTimeStr = apt.time ? apt.time.slice(0, 5) : '';
                                    const sentTimestamp = (apt as any).reminder_sent_at || (apt as any).updated_at;
                                    let sentTimeStr = '';
                                    if (sentTimestamp) {
                                        try {
                                            sentTimeStr = format(new Date(sentTimestamp), 'HH:mm');
                                        } catch {
                                            sentTimeStr = '';
                                        }
                                    }

                                    return (
                                        <div key={apt.id} className="p-3 rounded-2xl bg-slate-950/80 border border-emerald-500/20 text-xs flex flex-col justify-between gap-1.5 hover:border-emerald-500/40 transition-all">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-black text-white truncate text-xs">
                                                    {apt.clientName} - {apt.clientPhone || 'Sin tel'}
                                                </span>
                                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                                                    Enviado 🟢
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                                                <span className="text-slate-300 font-semibold">
                                                    ⏰ Cita: <strong className="text-white">{apptTimeStr} hrs</strong>
                                                </span>
                                                {sentTimeStr && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-emerald-400 font-semibold">
                                                            📤 Envío: <strong>{sentTimeStr} hrs</strong>
                                                        </span>
                                                    </>
                                                )}
                                                <span>•</span>
                                                <span className="truncate text-slate-300">
                                                    {svc?.name || 'Servicio'}
                                                </span>
                                                {stylist && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-pink-400 truncate font-medium">
                                                            {stylist.name}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {!isEmployee && (businessConfig as any).showDashboardMetrics !== false && (
                <div className="space-y-6">
                    {/* ── Grid Principal de Gráfica y Servicios ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* ── Revenue & Volume Chart ── */}
                        <div className="lg:col-span-2 glass-panel p-5 sm:p-7 rounded-3xl border border-white/10 flex flex-col min-h-[400px] bg-slate-900/60 shadow-xl relative overflow-hidden">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <div>
                                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                                        <TrendingUp size={20} className="text-accent" /> Rendimiento y Flujo de Clientes
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Análisis detallado de facturación y volumen por período
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                    {/* Toggle Métrica: Ingresos ($) vs Citas (#) */}
                                    <div className="flex bg-slate-800/80 p-1 rounded-xl border border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => setChartViewType('revenue')}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                                                chartViewType === 'revenue'
                                                    ? 'bg-accent text-white shadow-lg'
                                                    : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            💰 Ingresos ($)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setChartViewType('volume')}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                                                chartViewType === 'volume'
                                                    ? 'bg-cyan-500 text-slate-950 shadow-lg'
                                                    : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            👥 Citas (#)
                                        </button>
                                    </div>

                                    {/* Rango Selector */}
                                    <div className="flex bg-slate-800/80 p-1 rounded-xl border border-white/10">
                                        {(["7D", "30D", "3M", "AÑO"] as ChartRange[]).map(range => (
                                            <button
                                                key={range}
                                                type="button"
                                                onClick={() => setChartRange(range)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                                                    chartRange === range
                                                        ? 'bg-white/20 text-white shadow-sm'
                                                        : 'text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {range}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Resumen Financiero del Período Seleccionado */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/5 mb-6">
                                <div>
                                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Total Período
                                    </p>
                                    <p className="text-base sm:text-2xl font-black text-white tracking-tight mt-0.5">
                                        ${chartSummary.totalRevenue.toLocaleString()}
                                    </p>
                                </div>
                                <div className="border-x border-white/5 px-2 sm:px-4">
                                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Ticket Promedio
                                    </p>
                                    <p className="text-base sm:text-2xl font-black text-accent tracking-tight mt-0.5">
                                        ${chartSummary.avgTicket}
                                        <span className="text-[10px] sm:text-xs text-slate-500 font-normal ml-1 hidden sm:inline">/ cita</span>
                                    </p>
                                </div>
                                <div className="pl-1 sm:pl-2">
                                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Citas Realizadas
                                    </p>
                                    <p className="text-base sm:text-2xl font-black text-cyan-400 tracking-tight mt-0.5">
                                        {chartSummary.totalAppointments}
                                        <span className="text-[10px] sm:text-xs text-slate-500 font-normal ml-1 hidden sm:inline">completadas</span>
                                    </p>
                                </div>
                            </div>

                            {/* Gráfica Recharts */}
                            <div className="flex-1 w-full relative min-h-[220px]">
                                {revenueChartData.length === 0 || (chartViewType === 'revenue' && revenueChartData.every(d => d.Ingresos === 0)) || (chartViewType === 'volume' && revenueChartData.every(d => d.Citas === 0)) ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
                                        <Activity size={44} className="mb-3 text-slate-500 animate-pulse-soft" />
                                        <p className="text-sm text-slate-400 font-medium">No hay suficientes datos registrados para este período.</p>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="hsl(var(--hue-accent), 100%, 50%)" stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor="hsl(var(--hue-accent), 100%, 50%)" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                                            <YAxis
                                                stroke="rgba(255,255,255,0.3)"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => chartViewType === 'revenue' ? `$${value}` : `${value}`}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', backdropFilter: 'blur(12px)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}
                                                labelStyle={{ color: '#94a3b8', fontWeight: 'bold', marginBottom: '6px' }}
                                                formatter={(value: any, name: any) => [
                                                    name === 'Ingresos' ? `$${Number(value).toLocaleString()}` : `${value} citas`,
                                                    name === 'Ingresos' ? 'Facturado' : 'Citas'
                                                ]}
                                            />
                                            {chartViewType === 'revenue' ? (
                                                <Area type="monotone" dataKey="Ingresos" stroke="hsl(var(--hue-accent), 100%, 50%)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                                            ) : (
                                                <Area type="monotone" dataKey="Citas" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
                                            )}
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* ── Servicios Más Rentables ── */}
                        <div className="glass-panel p-5 sm:p-7 rounded-3xl border border-white/10 bg-slate-900/60 shadow-xl flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                                        <Sparkles size={20} className="text-pink-400" /> Servicios Populares
                                    </h3>
                                    <span className="text-[10px] font-black uppercase text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                                        Por Ganancia
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mb-6">
                                    Servicios que mayor facturación aportan al salón
                                </p>

                                <div className="space-y-4">
                                    {topServicesData.list.length > 0 ? topServicesData.list.map((svc, i) => (
                                        <div key={svc.id} className="group p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-all">
                                            <div className="flex justify-between items-start mb-1.5 gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="w-5 h-5 rounded-full bg-pink-500/10 text-pink-400 text-[10px] font-black flex items-center justify-center shrink-0 border border-pink-500/20">
                                                        {i + 1}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="text-xs sm:text-sm font-black text-white truncate group-hover:text-pink-300 transition-colors">
                                                            {svc.name}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400">
                                                            {svc.count} {svc.count === 1 ? 'cita' : 'citas'} {svc.topStylistName && `· ⭐ ${svc.topStylistName}`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-xs sm:text-sm font-black text-pink-400">
                                                        ${svc.revenue.toLocaleString()}
                                                    </p>
                                                    <p className="text-[9px] font-bold text-slate-400">
                                                        {svc.percentOfTotal}% del total
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-700"
                                                    style={{ width: `${Math.max(8, svc.percentOfTotal)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-12 text-slate-500 text-xs italic">
                                            No hay citas completadas suficientes para calcular los servicios más rentables.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {topServicesData.totalRevenueSum > 0 && (
                                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                                    <span>Total facturado en servicios:</span>
                                    <strong className="text-white font-black">${topServicesData.totalRevenueSum.toLocaleString()}</strong>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            )}

            {/* Today's Appointments */}
            <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-white/10 relative overflow-hidden bg-slate-900/40 backdrop-blur-xl shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-accent/10 border border-accent/20 text-accent shrink-0 shadow-lg shadow-accent/5">
                            <Calendar size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-black text-lg text-white tracking-tight">
                                    {dashboardViewMode === 'columns' ? 'Control de Citas' : 'Próximas Citas de Hoy'}
                                </h3>
                            </div>
                            <p className="text-xs text-slate-400">
                                {dashboardViewMode === 'columns'
                                    ? 'Monitoreo en tiempo real por especialista'
                                    : 'Citas programadas pendientes para la jornada de hoy'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 ml-auto">
                        {/* View Mode Toggle */}
                        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-2xl border border-white/10 shrink-0">
                            <button
                                onClick={() => setDashboardViewMode('columns')}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    dashboardViewMode === 'columns'
                                        ? 'bg-accent text-slate-950 font-black shadow-lg shadow-accent/20'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                                title="Vista Multicolumna por Profesional (Estilo Google Calendar)"
                            >
                                <User size={15} />
                            </button>
                            <button
                                onClick={() => setDashboardViewMode('list')}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    dashboardViewMode === 'list'
                                        ? 'bg-accent text-slate-950 font-black shadow-lg shadow-accent/20'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                                title="Vista en Lista de Citas"
                            >
                                <Calendar size={15} />
                            </button>
                        </div>

                        {!isEmployee && (
                            <>
                                <CustomSelect
                                    value={String(dashboardStylistId)}
                                    onChange={(val) => setDashboardStylistId(val === 'all' ? 'all' : Number(val))}
                                    options={[
                                        { value: 'all', label: 'Todos los Profesionales' },
                                        ...stylists.map(s => ({ value: String(s.id), label: s.name.split(' ')[0] }))
                                    ]}
                                    buttonClassName="bg-slate-900/60 border border-white/10 text-white rounded-2xl px-3 py-2 text-xs focus:outline-none focus:border-accent flex items-center justify-between min-w-[140px] sm:min-w-[170px] shadow-sm shrink-0"
                                    dropdownClassName="absolute z-50 w-full mt-1 bg-[#1e293b] border border-slate-700/50 rounded-2xl shadow-2xl py-1 animate-fade-in overflow-hidden"
                                />

                                {/* Button to open Waiting List Modal */}
                                <button
                                    type="button"
                                    onClick={() => setIsWaitingListModalOpen(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-2xl transition-all font-black text-[10px] uppercase tracking-wider shrink-0 cursor-pointer shadow-sm active:scale-95"
                                    title="Abrir Lista de Espera"
                                >
                                    <Users size={14} />
                                    <span className="hidden sm:inline">Lista de Espera</span>
                                    {waitingList.length > 0 && (
                                        <span className="bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-full text-[9px] min-w-[16px] h-4 flex items-center justify-center font-black">
                                            {waitingList.length}
                                        </span>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {dashboardViewMode === 'columns' ? (
                    <div className="mt-2 min-h-[550px]">
                        {tomorrowAppts.length > 0 && (
                            <div className="mb-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold shadow-sm">
                                <span>📌</span>
                                <span>{tomorrowAppts.length} {tomorrowAppts.length === 1 ? 'cita confirmada para mañana' : 'citas confirmadas para mañana'}</span>
                            </div>
                        )}
                        <StylistColumnCalendar
                            appointments={appointments}
                            services={services}
                            stylists={stylists}
                            waitingList={waitingList}
                            selectedStylistId={dashboardStylistId}
                            onWhatsApp={(apt) => {
                                const waPhone = apt.clientPhone.replace(/\D/g, '');
                                window.open(`https://wa.me/${waPhone}`, '_blank');
                            }}
                            onReschedule={(apt) => setRescheduleModal({ open: true, appt: apt })}
                            onNoShow={(apt) => handleNoShow(apt)}
                            onOpenReceipt={(url) => setReceiptModalUrl(url)}
                            onCancel={(apt) => {
                                setCustomConfirm({
                                    open: true,
                                    title: 'Cancelar Cita',
                                    message: `¿Estás seguro de que deseas cancelar la cita de ${apt.clientName}?`,
                                    confirmLabel: 'Sí, Cancelar',
                                    cancelLabel: 'Volver',
                                    danger: true,
                                    onConfirm: () => {
                                        cancelAppointment(apt.id);
                                    }
                                });
                            }}
                        />
                    </div>
                ) : (
                    <div className="space-y-6 pt-4 border-t border-white/10">
                        {/* ── Próximas Citas Mañana (collapsible) ── */}
                        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                            {/* Header / toggle */}
                            <button
                                onClick={() => setTomorrowOpen(o => !o)}
                                className="w-full flex items-center justify-between p-6 hover:bg-white/[0.02] transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="flex h-3 w-3 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
                                    </span>
                                    <h3 className="font-bold text-lg text-white">
                                        Próximas Citas (Mañana)
                                        <span className="ml-2 px-2.5 py-0.5 rounded-full bg-accent/20 text-accent text-sm font-black">
                                            {tomorrowAppts.length}
                                        </span>
                                    </h3>
                                </div>
                                <ChevronDown
                                    size={20}
                                    className={`text-slate-400 transition-transform duration-300 ${tomorrowOpen ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {tomorrowOpen && (
                                <div className="px-6 pb-6">
                                    <p className="text-sm text-muted mb-4">
                                        {reminders.length > 0
                                            ? `${reminders.length} de estas citas llevan 3+ días reservadas. Recuerda enviarles un recordatorio.`
                                            : 'Citas confirmadas para mañana.'}
                                    </p>

                                    {tomorrowAppts.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                            <Calendar size={32} className="mb-2 text-slate-500" />
                                            <p className="text-sm">No hay citas agendadas para mañana.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {tomorrowAppts.map(appt => {
                                                const svc = getServiceById(appt.serviceId);
                                                const needsReminder = reminders.some(r => r.id === appt.id);
                                                const [h, m] = appt.time.split(':');
                                                let hh = parseInt(h);
                                                const ampm = hh >= 12 ? 'pm' : 'am';
                                                hh = hh % 12 || 12;
                                                return (
                                                    <div key={appt.id} className={`bg-slate-900/40 backdrop-blur-md border p-5 rounded-3xl hover:border-accent/40 transition-all duration-300 group ${
                                                        needsReminder ? 'border-amber-500/30' : 'border-white/5'
                                                    }`}>
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div>
                                                                <div className="font-black text-white text-base tracking-tight mb-1 flex items-center gap-2 flex-wrap">
                                                                    <span>{appt.clientName.toUpperCase()}</span>
                                                                    {appt.bookingSource === 'marketplace' && (
                                                                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-[9px] font-black text-emerald-400 border border-emerald-500/30 flex items-center gap-1 tracking-wider uppercase shadow-sm">
                                                                            🛒 Buscador CitaLink
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <button
                                                                         onClick={() => setExpandedServiceApptId(expandedServiceApptId === `quote-${appt.id}` ? null : `quote-${appt.id}`)}
                                                                         className={`flex items-center gap-2 text-[10px] font-black px-2.5 py-1 rounded-lg border transition-all cursor-pointer uppercase tracking-tight ${
                                                                             expandedServiceApptId === `quote-${appt.id}`
                                                                                 ? 'bg-accent/20 border-accent/40 text-accent'
                                                                                 : 'bg-white/5 border-white/10 hover:border-white/20 text-white'
                                                                         }`}
                                                                         title="Ver/ocultar desglose de servicios"
                                                                     >
                                                                         <Sparkles size={12} className="text-accent shrink-0" />
                                                                         <span>{getAppointmentFullServiceDisplay(appt, svc?.name)}</span>
                                                                         <ChevronDown size={10} className={`text-slate-400 transition-transform duration-300 shrink-0 ${expandedServiceApptId === `quote-${appt.id}` ? 'rotate-180 text-accent' : ''}`} />
                                                                     </button>
                                                                    {(() => {
                                                                        const refItem = (appt.additionalServices ?? []).find((s: string) => s.startsWith('Referencia:'));
                                                                        if (refItem) {
                                                                            const url = refItem.replace('Referencia: ', '');
                                                                            return (
                                                                                <button
                                                                                    onClick={() => setActivePhotoUrl(url)}
                                                                                    className="inline-flex items-center gap-1.5 text-[10px] font-black bg-cyan-500 text-slate-900 px-3 py-1.5 rounded-xl hover:bg-cyan-400 transition-all uppercase tracking-wider cursor-pointer active:scale-95 shadow-md shadow-cyan-500/20"
                                                                                >
                                                                                    <Eye size={12} className="text-slate-900" />
                                                                                    <span>Diseño</span>
                                                                                </button>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    })()}
                                                                    {appt.stylistId && stylists.find(s => Number(s.id) === Number(appt.stylistId)) ? (
                                                                        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-300 uppercase bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl">
                                                                            <User size={12} className="text-emerald-400 opacity-80" />
                                                                            <span>{stylists.find(s => Number(s.id) === Number(appt.stylistId))?.name.split(' ')[0]}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase bg-white/5 border border-white/5 px-2.5 py-1 rounded-xl">
                                                                            <User size={12} className="opacity-40" />
                                                                            <span>Cualquiera</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Desplegable de detalles de servicio */}
                                                                {expandedServiceApptId === `quote-${appt.id}` && (
                                                                    <div className="mt-2 p-3 rounded-xl bg-slate-950/90 border border-accent/30 text-xs space-y-1 animate-fade-in relative z-10">
                                                                        <div className="text-[9px] font-black uppercase tracking-wider text-accent border-b border-white/10 pb-1 flex items-center justify-between">
                                                                            <span>Desglose Detallado</span>
                                                                        </div>
                                                                        <div className="space-y-1 text-slate-300 font-medium text-[11px] pt-1">
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="text-slate-400">Servicio Base:</span>
                                                                                <span className="font-bold text-white">{svc?.name || 'Servicio'}</span>
                                                                            </div>
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="text-slate-400">Duración:</span>
                                                                                <span className="font-bold text-accent">
                                                                                    {getAppointmentTotalDuration(appt)} min
                                                                                </span>
                                                                            </div>
                                                                            {appt.additionalServices && appt.additionalServices.length > 0 && (
                                                                                <div className="mt-1 pt-1 border-t border-white/5 space-y-0.5">
                                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Opciones / Adicionales:</span>
                                                                                    {appt.additionalServices
                                                                                        .filter((s: string) => !s.startsWith('Referencia:'))
                                                                                        .map((extra: string, idx: number) => {
                                                                                            const cleanExtra = extra
                                                                                                .replace(/\s*\(\+\d+\s*min\)/gi, '')
                                                                                                .replace(/\s*\(\d+\s*min\)/gi, '');
                                                                                            return (
                                                                                                <div key={idx} className="flex items-start gap-1.5 text-amber-300/90 pl-1">
                                                                                                    <span className="text-slate-500">•</span>
                                                                                                    <span className="break-words">{cleanExtra}</span>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-white font-black bg-white/5 border border-white/10 px-3 py-1 rounded-xl text-xs">{hh}:{m}{ampm}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4 font-medium flex-wrap">
                                                            <Phone size={12} className="opacity-50" />
                                                            <span>{formatPhoneDisplay(appt.clientPhone)}</span>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingNoteApptId(appt.id);
                                                                    setNoteText((appt as any).staff_notes || '');
                                                                }}
                                                                className={`px-2 py-0.5 rounded-md text-[9px] font-bold cursor-pointer transition-colors ${ (appt as any).staff_notes ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
                                                            >
                                                                {(appt as any).staff_notes ? '🗒️ Nota' : '+ Nota'}
                                                            </button>
                                                            {!businessConfig?.hideServicePrices && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedApptForPrice(appt);
                                                                        setNewPriceValue(String(getAppointmentPrice(appt)));
                                                                        setIsPriceModalOpen(true);
                                                                    }}
                                                                    className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-md border cursor-pointer hover:bg-white/5 active:scale-95 transition-all ${
                                                                        isPriceConfirmed(appt)
                                                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse-soft'
                                                                    }`}
                                                                    title="Ajustar precio de la cita"
                                                                >
                                                                    <DollarSign size={9} />
                                                                    <span>{getAppointmentPrice(appt)}</span>
                                                                    <span className="text-[7px] opacity-60 uppercase font-black ml-0.5">
                                                                        {isPriceConfirmed(appt) ? 'Confirmado' : 'Aprox'}
                                                                    </span>
                                                                </button>
                                                            )}
                                                            {needsReminder && (
                                                                <span className="ml-auto text-[9px] font-black uppercase text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">Recordar</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => setRescheduleModal({ open: true, appt })}
                                                                className="flex-1 py-2 text-xs gap-1.5 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 transition-all flex items-center justify-center font-bold cursor-pointer"
                                                                title="Reagendar Cita"
                                                            >
                                                                <RefreshCw size={13} /> Reagendar
                                                            </button>
                                                            <button
                                                                onClick={() => navigate('/admin/appointments')}
                                                                className="flex-1 py-2 text-xs gap-1.5 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white border border-white/5 hover:border-white/10 transition-all flex items-center justify-center font-bold cursor-pointer"
                                                            >
                                                                <Calendar size={13} className="opacity-70" /> Gestionar
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Próximas Citas Hoy */}
                        <div>
                            {(() => {
                                const now = new Date();
                    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                    const upcomingAppts = todayAppts.filter(appt => {
                        const isMatch = dashboardStylistId === 'all' || appt.stylistId === dashboardStylistId;
                        if (!isMatch) return false;

                        // Show if it isn't completed or cancelled
                        return appt.status !== 'completada' && appt.status !== 'cancelada';
                    }).sort((a, b) => a.time.localeCompare(b.time));

                    if (upcomingAppts.length === 0) {
                        return (
                            <div className="bg-gradient-to-b from-white/[0.03] via-accent/[0.02] to-transparent rounded-3xl border border-dashed border-white/15 p-10 sm:p-12 text-center relative overflow-hidden shadow-inner">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-purple-500/10 border border-accent/30 text-accent flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/10 ring-8 ring-accent/5">
                                    <Calendar size={28} />
                                </div>
                                <p className="text-lg font-black text-white tracking-tight">¡Todo al día por hoy!</p>
                                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">No hay citas pendientes para lo que resta de la jornada. Excelente trabajo.</p>
                            </div>
                        );
                    }

                    return (
                        <div className="space-y-3">
                            {upcomingAppts.map(appt => {
                                const svc = services.find(s => s.id === appt.serviceId);
                                const isCurrentlyHappening = currentTimeStr >= appt.time;

                                const canMarkNoShow = (() => {
                                    if (appt.status === 'completada' || appt.status === 'cancelada' || appt.status === 'no_show') return false;
                                    const startDt = parseApptDateTime(appt.date, appt.time);
                                    const totalDur = getAppointmentTotalDuration(appt);
                                    const maxNoShowDt = new Date(startDt.getTime() + (totalDur + 60) * 60 * 1000);
                                    const nowTime = new Date();
                                    return nowTime >= startDt && nowTime <= maxNoShowDt;
                                })();

                                const displayTime = (() => {
                                    const [h, m] = appt.time.split(':');
                                    let hh = parseInt(h);
                                    const ampm = hh >= 12 ? 'pm' : 'am';
                                    hh = hh % 12;
                                    hh = hh ? hh : 12;
                                    return `${hh}:${m}${ampm}`;
                                })();

                                const duration = getAppointmentTotalDuration(appt);
                                const endTimeDisplay = (() => {
                                    const [hours, minutes] = appt.time.split(':').map(Number);
                                    const endMinutes = hours * 60 + minutes + duration;
                                    let endHours = Math.floor(endMinutes / 60);
                                    const endMins = String(endMinutes % 60).padStart(2, '0');
                                    const ampm = endHours >= 12 && endHours < 24 ? 'pm' : 'am';
                                    endHours = endHours % 12;
                                    endHours = endHours ? endHours : 12;
                                    return `${endHours}:${endMins}${ampm}`;
                                })();

                                return (
                                    <div key={appt.id} className={`group flex items-stretch gap-0 rounded-[1.5rem] border transition-all duration-500 overflow-hidden ${isCurrentlyHappening
                                        ? 'bg-accent/10 border-accent/20 ring-1 ring-accent/10 shadow-2xl shadow-accent/10'
                                        : 'bg-slate-900/40 backdrop-blur-md border-white/5 hover:border-accent/40 hover:shadow-2xl hover:shadow-accent/5'
                                        }`}>

                                        {/* Status Indicator Bar */}
                                        <div className={`w-1.5 shrink-0 ${isCurrentlyHappening ? 'bg-accent animate-pulse' : 'bg-gradient-to-b from-white/20 to-transparent'}`} />

                                        {/* Time Column */}
                                        <div className={`flex flex-col items-center justify-center w-20 sm:w-28 shrink-0 border-r py-4 ${isCurrentlyHappening ? 'bg-accent/10 border-accent/10' : 'bg-white/[0.03] border-white/5'}`}>
                                            <span className={`text-sm sm:text-base font-black tracking-tighter ${isCurrentlyHappening ? 'text-accent' : 'text-white'}`}>
                                                {displayTime.replace(/(am|pm)/, '')}
                                            </span>
                                            <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest -mt-1 ${isCurrentlyHappening ? 'text-accent' : 'text-accent/60'}`}>
                                                {displayTime.match(/(am|pm)/)?.[0]}
                                            </span>
                                            <span className={`text-[8px] sm:text-[9px] font-bold mt-2 opacity-60 ${isCurrentlyHappening ? 'text-accent' : 'text-white'}`}>
                                                a {endTimeDisplay.replace(/(am|pm)/, '')}{endTimeDisplay.match(/(am|pm)/)?.[0]}
                                            </span>
                                        </div>
                                        {/* Main Info */}
                                        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
                                            <div className="flex items-center gap-5">
                                                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner relative overflow-hidden ${isCurrentlyHappening ? 'bg-accent text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                    {isCurrentlyHappening && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                                                    <span className="relative z-10">{appt.clientName.charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                                                        <span className="font-black text-white text-lg tracking-tighter uppercase">{appt.clientName}</span>

                                                        {appt.status === 'cancelada' && appt.cancellationReason && (
                                                            <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-[10px] font-bold text-red-400 border border-red-500/30 flex items-center gap-1 tracking-wider uppercase shadow-sm">
                                                                Motivo: {appt.cancellationReason}
                                                            </span>
                                                        )}
                                                        {appt.bookingSource === 'marketplace' && (
                                                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-[9px] font-black text-emerald-400 border border-emerald-500/30 flex items-center gap-1 tracking-wider uppercase shadow-sm">
                                                                🛒 Buscador CitaLink
                                                            </span>
                                                        )}
                                                        {isCurrentlyHappening && (
                                                            <span className="px-2 py-0.5 rounded-full bg-accent/20 text-[9px] font-black uppercase tracking-widest text-accent border border-accent/20 shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)] animate-pulse">EN VIVO</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <button
                                                            onClick={() => setExpandedServiceApptId(expandedServiceApptId === `today-${appt.id}` ? null : `today-${appt.id}`)}
                                                            className={`flex items-center gap-2 text-[10px] font-black px-2.5 py-1 rounded-lg border transition-all cursor-pointer uppercase tracking-tight ${
                                                                expandedServiceApptId === `today-${appt.id}`
                                                                    ? 'bg-accent/20 border-accent/40 text-accent'
                                                                    : 'bg-white/5 border-white/10 hover:border-white/20 text-white'
                                                            }`}
                                                            title="Ver/ocultar desglose de servicios"
                                                        >
                                                            <Sparkles size={12} className="text-accent shrink-0" />
                                                            <span>{svc?.name}</span>
                                                            <ChevronDown size={10} className={`text-slate-400 transition-transform duration-300 shrink-0 ${expandedServiceApptId === `today-${appt.id}` ? 'rotate-180 text-accent' : ''}`} />
                                                        </button>
                                                        {(() => {
                                                            const refItem = (appt.additionalServices ?? []).find((s: string) => s.startsWith('Referencia:'));
                                                            if (refItem) {
                                                                const url = refItem.replace('Referencia: ', '');
                                                                return (
                                                                    <button
                                                                        onClick={() => setActivePhotoUrl(url)}
                                                                        className="inline-flex items-center gap-1.5 text-[10px] font-black bg-cyan-500 text-slate-900 px-3 py-1.5 rounded-xl hover:bg-cyan-400 transition-all uppercase tracking-wider cursor-pointer active:scale-95 shadow-md shadow-cyan-500/20"
                                                                    >
                                                                        <Eye size={12} className="text-slate-900" />
                                                                        <span>Diseño</span>
                                                                    </button>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                        {appt.stylistId && stylists.find(s => s.id === appt.stylistId) && (
                                                            <>
                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                                                                <div className="flex items-center gap-1.5 uppercase text-slate-400"><User size={12} className="opacity-40 text-accent/60" /> {stylists.find(s => s.id === appt.stylistId)?.name.split(' ')[0]}</div>
                                                            </>
                                                        )}
                                                         <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                                                         <a
                                                             href={`https://wa.me/${appt.clientPhone.replace(/\D/g, '')}`}
                                                             target="_blank"
                                                             rel="noopener noreferrer"
                                                             className="flex items-center gap-1.5 text-accent hover:text-white transition-colors"
                                                         >
                                                             <Phone size={12} className="opacity-70" />
                                                             <span className="underline underline-offset-2 decoration-accent/30">{formatPhoneDisplay(appt.clientPhone)}</span>
                                                         </a>
                                                         <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                                                         {editingNoteApptId === appt.id ? (
                                                             <div className="w-full mt-2.5 p-3 rounded-2xl bg-slate-950/90 border border-amber-500/30 space-y-2 animate-fade-in relative z-10 max-w-sm">
                                                                 <div className="flex items-center justify-between text-[10px] font-black uppercase text-amber-400">
                                                                     <span>Nota interna de la cita</span>
                                                                 </div>
                                                                 <textarea
                                                                     value={noteText}
                                                                     onChange={(e) => setNoteText(e.target.value)}
                                                                     placeholder="Escribe una nota interna para esta cita..."
                                                                     rows={2}
                                                                     className="w-full bg-black/40 border border-amber-500/30 focus:border-amber-500/60 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none resize-none transition-colors"
                                                                 />
                                                                 <div className="flex items-center gap-2 justify-end">
                                                                     <button
                                                                         onClick={() => setEditingNoteApptId(null)}
                                                                         className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                                                                     >
                                                                         Cancelar
                                                                     </button>
                                                                     <button
                                                                         onClick={() => saveNote(appt.id)}
                                                                         disabled={savingNoteId === appt.id}
                                                                         className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all disabled:opacity-50 cursor-pointer"
                                                                     >
                                                                         <Save size={12} />
                                                                         {savingNoteId === appt.id ? 'Guardando...' : 'Guardar Nota'}
                                                                     </button>
                                                                 </div>
                                                             </div>
                                                         ) : (
                                                             <button
                                                                 onClick={() => {
                                                                     setEditingNoteApptId(appt.id);
                                                                     setNoteText((appt as any).staff_notes || '');
                                                                 }}
                                                                 className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-amber-400 transition-colors group/note cursor-pointer"
                                                                 title="Agregar o editar nota interna de la cita"
                                                             >
                                                                 <span className="text-xs group-hover/note:scale-110 transition-transform">🗒️</span>
                                                                 <span className="group-hover/note:underline underline-offset-2">
                                                                     {(appt as any).staff_notes ? (
                                                                         <span className="text-amber-400/90 font-bold italic">
                                                                             "{(appt as any).staff_notes.slice(0, 35)}{(appt as any).staff_notes.length > 35 ? '...' : ''}"
                                                                         </span>
                                                                     ) : (
                                                                         <span className="text-slate-500 hover:text-amber-400">+ Nota</span>
                                                                     )}
                                                                 </span>
                                                             </button>
                                                         )}
                                                        {!businessConfig?.hideServicePrices && (
                                                            <>
                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedApptForPrice(appt);
                                                                        setNewPriceValue(String(getAppointmentPrice(appt)));
                                                                        setIsPriceModalOpen(true);
                                                                    }}
                                                                    className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-md border cursor-pointer hover:bg-white/5 active:scale-95 transition-all ${
                                                                        isPriceConfirmed(appt)
                                                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                                            : 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse-soft'
                                                                    }`}
                                                                    title="Ajustar precio de la cita"
                                                                >
                                                                    <DollarSign size={9} />
                                                                    <span>${getAppointmentPrice(appt)}</span>
                                                                    <span className="text-[7px] opacity-60 uppercase font-black ml-0.5">
                                                                        {isPriceConfirmed(appt) ? 'Confirmado' : 'Aprox'}
                                                                    </span>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                    
                                                     {/* Desplegable de detalles de servicio */}
                                                     {expandedServiceApptId === `today-${appt.id}` && (
                                                         <div className="mt-2 p-3 rounded-xl bg-slate-950/90 border border-accent/30 text-xs space-y-1 animate-fade-in relative z-10 max-w-sm">
                                                             <div className="text-[9px] font-black uppercase tracking-wider text-accent border-b border-white/10 pb-1 flex items-center justify-between">
                                                                 <span>Desglose Detallado</span>
                                                             </div>
                                                             <div className="space-y-1 text-slate-300 font-medium text-[11px] pt-1">
                                                                 <div className="flex justify-between items-center">
                                                                     <span className="text-slate-400">Servicio Base:</span>
                                                                     <span className="font-bold text-white">{getServiceById(appt.serviceId)?.name || 'Servicio'}</span>
                                                                 </div>
                                                                 <div className="flex justify-between items-center">
                                                                     <span className="text-slate-400">Duración:</span>
                                                                     <span className="font-bold text-accent">
                                                                         {getAppointmentTotalDuration(appt)} min
                                                                     </span>
                                                                 </div>
                                                                 {appt.additionalServices && appt.additionalServices.length > 0 && (
                                                                     <div className="mt-1 pt-1 border-t border-white/5 space-y-0.5">
                                                                         <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Opciones / Adicionales:</span>
                                                                         {appt.additionalServices
                                                                             .filter((s: string) => !s.startsWith('Referencia:'))
                                                                             .map((extra: string, idx: number) => {
                                                                                 const cleanExtra = extra
                                                                                     .replace(/\s*\(\+\d+\s*min\)/gi, '')
                                                                                     .replace(/\s*\(\d+\s*min\)/gi, '');
                                                                                 return (
                                                                                     <div key={idx} className="flex items-start gap-1.5 text-amber-300/90 pl-1">
                                                                                         <span className="text-slate-500">•</span>
                                                                                         <span className="break-words">{cleanExtra}</span>
                                                                                     </div>
                                                                                 );
                                                                             })}
                                                                     </div>
                                                                 )}
                                                             </div>
                                                         </div>
                                                     )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {canMarkNoShow && (
                                                    <button 
                                                        onClick={() => handleNoShow(appt)} 
                                                        className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 rounded-xl text-amber-300 border border-amber-500/30 text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md uppercase tracking-wider"
                                                        title="Marcar No Asistió"
                                                    >
                                                        <UserX size={14} /> No Asistió
                                                    </button>
                                                )}
                                                {isCurrentlyHappening ? (
                                                    <>
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-2 bg-accent/5 px-3 py-1.5 rounded-full border border-accent/10">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping"></div> Ahora
                                                        </span>
                                                        <div className="px-4 py-2 rounded-xl text-[10px] font-black border uppercase tracking-widest shadow-inner bg-accent text-white border-white/10">
                                                            Atendiendo
                                                        </div>
                                                    </>
                                                ) : appt.confirmedByClient ? (
                                                    <div className="px-4 py-2 rounded-xl text-[10px] font-black border border-emerald-500/30 bg-emerald-500/20 text-emerald-400 uppercase tracking-widest shadow-sm flex items-center gap-1.5">
                                                        ✓ Confirmada
                                                    </div>
                                                ) : appt.reminderSent ? (
                                                    <div className="px-4 py-2 rounded-xl text-[10px] font-black border border-amber-500/30 bg-amber-500/20 text-amber-400 uppercase tracking-widest shadow-sm flex items-center gap-1.5">
                                                        ⌛ Pendiente
                                                    </div>
                                                ) : (
                                                    <div className="px-4 py-2 rounded-xl text-[10px] font-black border border-indigo-500/30 bg-indigo-500/20 text-indigo-400 uppercase tracking-widest shadow-sm flex items-center gap-1.5">
                                                        📅 Agendada
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>

                        {/* Completed Appointments Today */}
                        <div className="pt-6 border-t border-white/10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/5">
                                    <CheckCircle2 size={22} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-emerald-400 tracking-tight">Citas Completadas Hoy</h3>
                                    <p className="text-xs text-slate-400">Historial de atenciones finalizadas el día de hoy</p>
                                </div>
                            </div>

                {(() => {
                    const now = new Date();
                    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                    const completedAppts = todayAppts.filter(appt => {
                        const isMatch = dashboardStylistId === 'all' || appt.stylistId === dashboardStylistId;
                        if (!isMatch) return false;

                        if (appt.status === 'completada') return true;

                        const duration = getAppointmentTotalDuration(appt);

                        // Calculate end time
                        const [hours, minutes] = appt.time.split(':').map(Number);
                        const endMinutes = hours * 60 + minutes + duration;
                        const endHours = Math.floor(endMinutes / 60);
                        const endMins = endMinutes % 60;
                        const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

                        // Show if it is confirmed but time has passed
                        return currentTimeStr >= endTimeStr && appt.status === 'confirmada';
                    }).sort((a, b) => b.time.localeCompare(a.time)); // Sort descending by time

                    if (completedAppts.length === 0) {
                        return (
                            <div className="bg-gradient-to-b from-emerald-500/[0.04] via-emerald-500/[0.02] to-transparent rounded-3xl border border-dashed border-emerald-500/20 p-10 sm:p-12 text-center relative overflow-hidden shadow-inner">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/10 ring-8 ring-emerald-500/5">
                                    <CheckCircle2 size={28} />
                                </div>
                                <p className="text-lg font-black text-white tracking-tight">Aún no hay citas completadas hoy</p>
                                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Las citas que atiendas y finalices a lo largo del día aparecerán registradas aquí.</p>
                            </div>
                        );
                    }

                    return (
                        <div className="space-y-3">
                            {completedAppts.map(appt => {
                                const svc = services.find(s => s.id === appt.serviceId);

                                const displayTime = (() => {
                                    const [h, m] = appt.time.split(':');
                                    let hh = parseInt(h);
                                    const ampm = hh >= 12 ? 'pm' : 'am';
                                    hh = hh % 12;
                                    hh = hh ? hh : 12;
                                    return `${hh}:${m}${ampm}`;
                                })();

                                const duration = getAppointmentTotalDuration(appt);
                                const endTimeDisplay = (() => {
                                    const [hours, minutes] = appt.time.split(':').map(Number);
                                    const endMinutes = hours * 60 + minutes + duration;
                                    let endHours = Math.floor(endMinutes / 60);
                                    const endMins = String(endMinutes % 60).padStart(2, '0');
                                    const ampm = endHours >= 12 && endHours < 24 ? 'pm' : 'am';
                                    endHours = endHours % 12;
                                    endHours = endHours ? endHours : 12;
                                    return `${endHours}:${endMins}${ampm}`;
                                })();

                                return (
                                    <div key={appt.id} className="group flex items-stretch gap-0 rounded-2xl border transition-all overflow-hidden glass-card border-white/5 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/10">

                                        {/* Status Indicator Bar */}
                                        <div className="w-1.5 shrink-0 bg-gradient-to-b from-emerald-500/50 to-transparent" />

                                        {/* Time Column */}
                                        <div className="flex flex-col items-center justify-center w-20 sm:w-28 shrink-0 border-r py-4 bg-white/[0.03] border-white/5">
                                            <span className="text-sm sm:text-base font-black tracking-tighter text-white">
                                                {displayTime.replace(/(am|pm)/, '')}
                                            </span>
                                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest -mt-1 text-emerald-500/60">
                                                {displayTime.match(/(am|pm)/)?.[0]}
                                            </span>
                                            <span className="text-[8px] sm:text-[9px] font-bold mt-2 opacity-60 text-white">
                                                a {endTimeDisplay.replace(/(am|pm)/, '')}{endTimeDisplay.match(/(am|pm)/)?.[0]}
                                            </span>
                                        </div>

                                         {/* Main Info */}
                                        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
                                            <div className="flex items-center gap-5">
                                                <div className="h-12 w-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner relative overflow-hidden bg-slate-800 text-emerald-500/70">
                                                    <span className="relative z-10">{appt.clientName.charAt(0).toUpperCase()}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                                                         <span className="font-black text-white text-lg tracking-tight uppercase">{appt.clientName}</span>
                                                         {appt.bookingSource === 'marketplace' && (
                                                             <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-[9px] font-black text-emerald-400 border border-emerald-500/30 flex items-center gap-1 tracking-wider uppercase shadow-sm">
                                                                 🛒 Buscador CitaLink
                                                             </span>
                                                         )}
                                                     </div>
                                                    <div className="text-[10px] font-bold text-slate-500 flex items-center flex-wrap gap-3 tracking-wide">
                                                        <button
                                                             onClick={() => setExpandedServiceApptId(expandedServiceApptId === `tomorrow-${appt.id}` ? null : `tomorrow-${appt.id}`)}
                                                             className={`flex items-center gap-2 text-[10px] font-black px-2.5 py-1 rounded-lg border transition-all cursor-pointer uppercase tracking-tight ${
                                                                 expandedServiceApptId === `tomorrow-${appt.id}`
                                                                     ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                                                     : 'bg-white/5 border-white/10 hover:border-white/20 text-white'
                                                             }`}
                                                             title="Ver/ocultar desglose de servicios"
                                                         >
                                                             <Sparkles size={12} className="text-emerald-400 shrink-0" />
                                                             <span>{svc?.name}</span>
                                                             <ChevronDown size={10} className={`text-slate-400 transition-transform duration-300 shrink-0 ${expandedServiceApptId === `tomorrow-${appt.id}` ? 'rotate-180 text-emerald-400' : ''}`} />
                                                         </button>
                                                        {(() => {
                                                            const refItem = (appt.additionalServices ?? []).find((s: string) => s.startsWith('Referencia:'));
                                                            if (refItem) {
                                                                const url = refItem.replace('Referencia: ', '');
                                                                return (
                                                                    <button
                                                                        onClick={() => setActivePhotoUrl(url)}
                                                                        className="inline-flex items-center gap-1.5 text-[10px] font-black bg-cyan-500 text-slate-900 px-3 py-1.5 rounded-xl hover:bg-cyan-400 transition-all uppercase tracking-wider cursor-pointer active:scale-95 shadow-md shadow-cyan-500/20"
                                                                    >
                                                                        <Eye size={12} className="text-slate-900" />
                                                                        <span>Diseño</span>
                                                                    </button>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                        {appt.stylistId && stylists.find(s => s.id === appt.stylistId) && (
                                                            <>
                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                                                                <div className="flex items-center gap-1.5 uppercase text-slate-400"><User size={12} className="opacity-40 text-emerald-500/60" /> {stylists.find(s => s.id === appt.stylistId)?.name.split(' ')[0]}</div>
                                                            </>
                                                        )}
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                                                        <a
                                                            href={`https://wa.me/${appt.clientPhone.replace(/\D/g, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1.5 text-emerald-500/70 hover:text-emerald-400 transition-colors"
                                                        >
                                                            <Phone size={12} className="opacity-70" />
                                                            <span className="underline underline-offset-2 decoration-emerald-500/30">{formatPhoneDisplay(appt.clientPhone)}</span>
                                                        </a>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-800"></span>
                                                        {editingNoteApptId === appt.id ? (
                                                            <div className="w-full mt-2.5 p-3 rounded-2xl bg-slate-950/90 border border-amber-500/30 space-y-2 animate-fade-in relative z-10 max-w-sm">
                                                                <div className="flex items-center justify-between text-[10px] font-black uppercase text-amber-400">
                                                                    <span>Nota interna de la cita</span>
                                                                </div>
                                                                <textarea
                                                                    value={noteText}
                                                                    onChange={(e) => setNoteText(e.target.value)}
                                                                    placeholder="Escribe una nota interna para esta cita..."
                                                                    rows={2}
                                                                    className="w-full bg-black/40 border border-amber-500/30 focus:border-amber-500/60 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none resize-none transition-colors"
                                                                />
                                                                <div className="flex items-center gap-2 justify-end">
                                                                    <button
                                                                        onClick={() => setEditingNoteApptId(null)}
                                                                        className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                                                                    >
                                                                        Cancelar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => saveNote(appt.id)}
                                                                        disabled={savingNoteId === appt.id}
                                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all disabled:opacity-50 cursor-pointer"
                                                                    >
                                                                        <Save size={12} />
                                                                        {savingNoteId === appt.id ? 'Guardando...' : 'Guardar Nota'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingNoteApptId(appt.id);
                                                                    setNoteText((appt as any).staff_notes || '');
                                                                }}
                                                                className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-amber-400 transition-colors group/note cursor-pointer"
                                                                title="Agregar o editar nota interna de la cita"
                                                            >
                                                                <span className="text-xs group-hover/note:scale-110 transition-transform">🗒️</span>
                                                                <span className="group-hover/note:underline underline-offset-2">
                                                                    {(appt as any).staff_notes ? (
                                                                        <span className="text-amber-400/90 font-bold italic">
                                                                            "{(appt as any).staff_notes.slice(0, 35)}{(appt as any).staff_notes.length > 35 ? '...' : ''}"
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-500 hover:text-amber-400">+ Nota</span>
                                                                    )}
                                                                </span>
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Desplegable de detalles de servicio */}
                                                    {expandedServiceApptId === `tomorrow-${appt.id}` && (
                                                         <div className="mt-2 p-3 rounded-xl bg-slate-950/90 border border-emerald-500/30 text-xs space-y-1 animate-fade-in relative z-10 max-w-sm">
                                                             <div className="text-[9px] font-black uppercase tracking-wider text-emerald-400 border-b border-white/10 pb-1 flex items-center justify-between">
                                                                 <span>Desglose Detallado</span>
                                                             </div>
                                                             <div className="space-y-1 text-slate-300 font-medium text-[11px] pt-1">
                                                                 <div className="flex justify-between items-center">
                                                                     <span className="text-slate-400">Servicio Base:</span>
                                                                     <span className="font-bold text-white">{svc?.name || 'Servicio'}</span>
                                                                 </div>
                                                                 {svc?.duration && (
                                                                     <div className="flex justify-between items-center">
                                                                         <span className="text-slate-400">Duración:</span>
                                                                         <span className="font-bold text-accent">
                                                                             {getAppointmentTotalDuration(appt)} min
                                                                         </span>
                                                                     </div>
                                                                 )}
                                                                 {appt.additionalServices && appt.additionalServices.length > 0 && (
                                                                     <div className="mt-1 pt-1 border-t border-white/5 space-y-0.5">
                                                                         <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Opciones / Adicionales:</span>
                                                                         {appt.additionalServices
                                                                             .filter((s: string) => !s.startsWith('Referencia:'))
                                                                             .map((extra: string, idx: number) => {
                                                                                 const cleanExtra = extra
                                                                                     .replace(/\s*\(\+\d+\s*min\)/gi, '')
                                                                                     .replace(/\s*\(\d+\s*min\)/gi, '');
                                                                                 return (
                                                                                     <div key={idx} className="flex items-start gap-1.5 text-amber-300/90 pl-1">
                                                                                         <span className="text-slate-500">•</span>
                                                                                         <span className="break-words">{cleanExtra}</span>
                                                                                     </div>
                                                                                 );
                                                                             })}
                                                                     </div>
                                                                 )}
                                                             </div>
                                                         </div>
                                                     )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                {!isEmployee && (
                                                    <div className="text-right mr-2 hidden sm:block">
                                                        <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Ingreso</span>
                                                        <span className="text-sm font-black text-emerald-400">${getAppointmentPrice(appt)}</span>
                                                    </div>
                                                )}
                                                <div className="px-4 py-2 rounded-xl text-[10px] font-black border uppercase tracking-widest shadow-inner bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                                    Completada
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>
        </div>
    )}
</div>

            {/* Full screen design reference photo preview modal */}
            <PhotoZoomViewer
                photoUrl={activePhotoUrl}
                onClose={() => setActivePhotoUrl(null)}
                title="Foto de Referencia"
            />

            {isPriceModalOpen && selectedApptForPrice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setIsPriceModalOpen(false); setSelectedApptForPrice(null); }} />
                    <div className="relative w-full max-w-sm bg-[#0a0f1a] border border-white/10 rounded-2xl p-6 shadow-2xl animate-scale-in flex flex-col z-50">
                        <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">
                            Ajustar Precio de la Cita
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed mb-4">
                            Ingresa el precio final para la cita de <strong className="text-white">{selectedApptForPrice.clientName}</strong>.
                        </p>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Precio Final (MXN)</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</div>
                                    <input
                                        type="number"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-sm text-white focus:outline-none focus:border-accent bg-[#0b101c]"
                                        value={newPriceValue}
                                        onChange={e => setNewPriceValue(e.target.value)}
                                        placeholder="Ej. 450"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsPriceModalOpen(false);
                                        setSelectedApptForPrice(null);
                                    }}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-xs uppercase transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveCustomPrice}
                                    className="flex-1 py-2.5 rounded-xl bg-accent text-[#0a0f1a] font-bold text-xs uppercase tracking-wide hover:brightness-110 transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Save size={14} /> Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={customConfirm.open}
                title={customConfirm.title}
                message={customConfirm.message}
                confirmLabel={customConfirm.confirmLabel}
                cancelLabel={customConfirm.cancelLabel}
                onConfirm={() => {
                    customConfirm.onConfirm();
                    setCustomConfirm(prev => ({ ...prev, open: false }));
                }}
                onCancel={() => setCustomConfirm(prev => ({ ...prev, open: false }))}
                danger={customConfirm.danger}
            />

            {isNewApptModalOpen && (
                <AdminBookingModal isOpen={true} onClose={() => setIsNewApptModalOpen(false)} />
            )}

            <AdminRescheduleModal
                isOpen={rescheduleModal.open}
                onClose={() => setRescheduleModal({ open: false, appt: null })}
                appointment={rescheduleModal.appt}
            />

            <WaitingListModal
                isOpen={isWaitingListModalOpen}
                onClose={() => setIsWaitingListModalOpen(false)}
                waitingList={waitingList}
                services={services}
                businessName={(businessConfig as any)?.name || 'CitaLink'}
                onAdd={addToWaitingList}
                onRemove={removeFromWaitingList}
                showToast={showToast}
            />

            {receiptModalUrl && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#1e293b] border border-cyan-500/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-white/10">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                💳 Comprobante de Pago / Transferencia
                            </h3>
                            <button
                                onClick={() => setReceiptModalUrl(null)}
                                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/50 p-2 flex items-center justify-center">
                            <img
                                decoding="async" loading="lazy"
                                src={receiptModalUrl}
                                alt="Comprobante de Pago"
                                className="max-w-full max-h-[60vh] object-contain rounded-xl"
                            />
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={() => setReceiptModalUrl(null)}
                                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
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