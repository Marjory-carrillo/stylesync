import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Appointment, Service, Stylist, WaitingClient } from '../lib/types/store.types';
import { format, addDays, subDays, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    ChevronLeft, ChevronRight, Sparkles, Image as ImageIcon, RefreshCw, Save, UserX, X
} from 'lucide-react';
import DatePickerInput from './DatePickerInput';
import PhotoZoomViewer from './PhotoZoomViewer';
import { supabase } from '../lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { useTenantData } from '../lib/store/queries/useTenantData';
import { calculateAppointmentDuration, getRealAdditionalServices, formatAddOnItemDisplay } from '../lib/smartSlots';
import { useUIStore } from '../lib/store/uiStore';

interface StylistColumnCalendarProps {
    appointments: Appointment[];
    services: Service[];
    stylists: Stylist[];
    waitingList?: WaitingClient[];
    selectedStylistId?: number | 'all';
    onSelectStylist?: (stylistId: number | 'all') => void;
    onWhatsApp?: (apt: Appointment) => void;
    onReschedule?: (apt: Appointment) => void;
    onNoShow?: (apt: Appointment) => void;
    onCancel: (apt: Appointment) => void;
    onOpenReceipt?: (url: string) => void;
}

const CALENDAR_VIEW_DAYS_KEY = 'citalink_calendar_view_days';

const getSavedCalendarDays = (): number | null => {
    try {
        const saved = localStorage.getItem(CALENDAR_VIEW_DAYS_KEY);
        if (saved === '1' || saved === '3') {
            return Number(saved);
        }
        return null;
    } catch {
        return null;
    }
};

export default function StylistColumnCalendar({
    appointments,
    services,
    stylists,
    waitingList = [],
    selectedStylistId = 'all',
    onSelectStylist,
    onReschedule,
    onNoShow,
    onCancel,
    onOpenReceipt
}: StylistColumnCalendarProps) {
    const queryClient = useQueryClient();
    const [currentDate, setCurrentDate] = useState(new Date());
    const { data: tenantConfig } = useTenantData();
    const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
    const [noteInput, setNoteInput] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);

    useEffect(() => {
        if (selectedApt) {
            setNoteInput((selectedApt as any).staff_notes || (selectedApt as any).notes || '');
        }
    }, [selectedApt]);

    const handleSaveStaffNote = async () => {
        if (!selectedApt) return;
        setIsSavingNote(true);
        try {
            await supabase
                .from('appointments')
                .update({ staff_notes: noteInput.trim() || null })
                .eq('id', selectedApt.id);
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            // Update local selected apt reference
            (selectedApt as any).staff_notes = noteInput.trim() || null;
        } catch (_) {
        } finally {
            setIsSavingNote(false);
        }
    };

    // Live clock for red line indicator
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 5000);
        return () => clearInterval(timer);
    }, []);

    const dateStr = format(currentDate, 'yyyy-MM-dd');

    // Filter active appointments for the selected date
    const dayAppointments = useMemo(() => {
        return appointments.filter(a => a.date === dateStr && a.status !== 'cancelada');
    }, [appointments, dateStr]);

    // Active stylists list + "Sin Asignar" column if needed
    const activeStylists = useMemo(() => {
        let list = [...stylists];

        if (selectedStylistId && selectedStylistId !== 'all') {
            list = list.filter(s => Number(s.id) === Number(selectedStylistId));
        }

        const unassignedAppts = dayAppointments.some(a => !a.stylistId);
        if (unassignedAppts && (selectedStylistId === 'all' || selectedStylistId === 0)) {
            list.push({ id: 0, name: 'Sin Asignar', role: 'General', image: '', phone: '' } as Stylist);
        }
        return list;
    }, [stylists, dayAppointments, selectedStylistId]);

    // Responsive screen width tracking for smart column layout
    const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isSingleStylistSelected = Boolean((selectedStylistId && selectedStylistId !== 'all') || stylists.length === 1);
    const singleStylist = useMemo(() => {
        if (isSingleStylistSelected) {
            if (selectedStylistId && selectedStylistId !== 'all') {
                return stylists.find(s => Number(s.id) === Number(selectedStylistId)) || null;
            }
            if (stylists.length === 1) {
                return stylists[0];
            }
        }
        return null;
    }, [isSingleStylistSelected, selectedStylistId, stylists]);

    // Optional user override for number of days (1, 3). Persistido en localStorage; si null, por defecto 3 días
    const [userSelectedDays, setUserSelectedDays] = useState<number | null>(() => getSavedCalendarDays());

    // Active days count: por defecto 'ver 3 días' (3D) cuando es un solo profesional o se selecciona un estilista individual
    const daysCount = useMemo(() => {
        if (!isSingleStylistSelected) return 1;
        if (userSelectedDays !== null) {
            return userSelectedDays;
        }
        return 3; // Por defecto 'ver 3 días'
    }, [isSingleStylistSelected, userSelectedDays]);

    // Multi-day mode only when an individual stylist is selected AND daysCount > 1
    const isMultiDayActive = isSingleStylistSelected && daysCount > 1;

    // Handle day pills click: recuerda la preferencia en localStorage (1D o 3D)
    const handleSelectDays = (num: number) => {
        setUserSelectedDays(num);
        try {
            localStorage.setItem(CALENDAR_VIEW_DAYS_KEY, String(num));
        } catch (_) {}
        if (num > 1 && (!selectedStylistId || selectedStylistId === 'all') && stylists.length > 0) {
            onSelectStylist?.(stylists[0].id);
        }
    };

    // Array of consecutive dates to display when multi-day is active
    const displayDays = useMemo(() => {
        if (!isMultiDayActive || daysCount <= 1) {
            return [currentDate];
        }
        const list: Date[] = [];
        for (let i = 0; i < daysCount; i++) {
            list.push(addDays(currentDate, i));
        }
        return list;
    }, [isMultiDayActive, daysCount, currentDate]);

    // Check if Today is in the current view
    const isViewingToday = useMemo(() => {
        if (isMultiDayActive && daysCount > 1) {
            return displayDays.some(d => isToday(d));
        }
        return isToday(currentDate);
    }, [isMultiDayActive, daysCount, displayDays, currentDate]);

    // Visible appointments (across all displayed days) for bounds and red line
    const visibleAppointments = useMemo(() => {
        if (!isMultiDayActive || daysCount <= 1) {
            return appointments.filter(a => a.date === dateStr && a.status !== 'cancelada');
        }
        const datesSet = new Set(displayDays.map(d => format(d, 'yyyy-MM-dd')));
        return appointments.filter(a => datesSet.has(a.date) && a.status !== 'cancelada');
    }, [appointments, isMultiDayActive, daysCount, dateStr, displayDays]);

    const appointmentCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        (appointments || []).forEach(apt => {
            if (apt.status === 'cancelada') return;
            if (selectedStylistId && selectedStylistId !== 'all' && Number(apt.stylistId) !== Number(selectedStylistId)) return;
            const d = apt.date.split('T')[0];
            counts[d] = (counts[d] || 0) + 1;
        });
        return counts;
    }, [appointments, selectedStylistId]);

    const waitingListCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        (waitingList || []).forEach(w => {
            if (!w.date) return;
            const d = w.date.split('T')[0];
            counts[d] = (counts[d] || 0) + 1;
        });
        return counts;
    }, [waitingList]);

    const getServiceById = (id: number) => services.find(s => Number(s.id) === Number(id));

    // Helper to calculate total price taking into account confirmed quotes, extra options, and catalog add-ons
    const getAppointmentTotalPrice = (apt: Appointment) => {
        const service = services.find(s => Number(s.id) === Number(apt.serviceId));
        const addServices = apt.additionalServices || [];

        // 1. Check for custom quote (Cotización Confirmada / Cotización Estimada / Cotización)
        const customPriceItem = addServices.find((s: string) =>
            s.startsWith('Cotización')
        );

        if (customPriceItem) {
            const match = customPriceItem.match(/\$(\d+(\.\d+)?)/);
            if (match) {
                return parseFloat(match[1]);
            }
        }

        // 2. Base service price or Catalog design price + extra options (+$X MXN) + catalog add-on services
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

            const matchingService = services.find(s =>
                s.name.toLowerCase() === cleanName.toLowerCase() ||
                s.name.toLowerCase() === extra.toLowerCase()
            );
            if (matchingService && matchingService.price) {
                total += matchingService.price;
            }
        });

        return total;
    };

    // Helper to calculate total duration of base service + extra services / quoter options
    const getAppointmentTotalDuration = (apt: Appointment) => {
        return calculateAppointmentDuration(apt, services);
    };

    // Dynamic operating hours bounds calculation (Adapts automatically if business has early/late appointments or for current time)
    const { START_HOUR, END_HOUR } = useMemo(() => {
        let baseStart = 7; // Default 7:00 AM
        let baseEnd = 21;  // Default 9:00 PM (21:00)

        // Ensure the current hour is visible if viewing today
        if (isViewingToday) {
            const currentHour = now.getHours();
            if (currentHour < baseStart) baseStart = Math.max(0, currentHour);
            if (currentHour > baseEnd) baseEnd = Math.min(23, currentHour);
        }

        (visibleAppointments || []).forEach(apt => {
            try {
                const startDt = parseApptDateTime(apt.date, apt.time);
                const duration = getAppointmentTotalDuration(apt);
                const endDt = new Date(startDt.getTime() + duration * 60 * 1000);

                const aptStartHour = startDt.getHours();
                const aptEndHour = Math.min(23, endDt.getHours() + (endDt.getMinutes() > 0 ? 1 : 0));

                if (aptStartHour < baseStart) baseStart = Math.max(0, aptStartHour);
                if (aptEndHour > baseEnd) baseEnd = Math.min(23, aptEndHour);
            } catch {}
        });

        return { START_HOUR: baseStart, END_HOUR: baseEnd };
    }, [visibleAppointments, isViewingToday, now]);

    const HOUR_HEIGHT = 100; // 100px per hour for better readability
    const HOURS = useMemo(() => Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i), [START_HOUR, END_HOUR]);

    // Helper to format full service string (base service + real catalog extra services ONLY)
    const getAppointmentFullServiceDisplay = (apt: Appointment, baseServiceName?: string) => {
        const base = baseServiceName || 'Servicio';
        const catalogAddons = getRealAdditionalServices(apt.additionalServices, services);
        if (catalogAddons.length > 0) {
            return `${base} + ${catalogAddons.join(', ')}`;
        }
        return base;
    };

    // Helper for timezone-safe local date parsing
    const parseApptDateTime = (dateStr?: string, timeStr?: string) => {
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
    };

    // Helper for robust status state determination (Completed vs Atendiendo vs Confirmed vs Agendada)
    const getAppointmentStatusState = (apt: Appointment) => {
        const svc = getServiceById(apt.serviceId);
        const duration = getAppointmentTotalDuration(apt);
        const startDt = parseApptDateTime(apt.date, apt.time);
        const endDt = new Date(startDt.getTime() + duration * 60 * 1000);
        const nowTime = now; // Reacts to live 5s clock update

        const isCompleted = apt.status === 'completada' || nowTime >= endDt;
        const isLiveAtendiendo = !isCompleted && (nowTime >= startDt && nowTime < endDt);

        // No-show option is eligible when appointment start time has arrived (started or past start time)
        const canMarkNoShow = apt.status !== 'completada' && apt.status !== 'cancelada' && apt.status !== 'no_show' && nowTime >= startDt;

        const isConfirmed = Boolean(apt.confirmedByClient || (apt as any).confirmed_by_client || apt.depositStatus === 'approved');
        const isPending = !isConfirmed && Boolean(apt.reminderSent || (apt as any).reminder_sent);
        const isFullPayment = svc && apt.depositAmount && apt.depositAmount >= svc.price;

        return {
            isCompleted,
            isLiveAtendiendo,
            canMarkNoShow,
            isConfirmed,
            isPending,
            isFullPayment,
            startDt,
            endDt
        };
    };

    // Calculate position top (px)
    const calculateTop = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        const minsFromStart = (h - START_HOUR) * 60 + m;
        return (minsFromStart / 60) * HOUR_HEIGHT;
    };

    // Calculate block height (px)
    const calculateHeight = (serviceDurationMins: number = 60) => {
        const mins = Math.max(30, serviceDurationMins);
        return (mins / 60) * HOUR_HEIGHT;
    };

    // Live Red Line position (px)
    const currentRedLineTop = useMemo(() => {
        if (!isViewingToday) return null;
        const h = now.getHours();
        const m = now.getMinutes();
        if (h < START_HOUR || h > END_HOUR) return null;
        const minsFromStart = (h - START_HOUR) * 60 + m;
        return (minsFromStart / 60) * HOUR_HEIGHT;
    }, [now, isViewingToday, START_HOUR, END_HOUR, HOUR_HEIGHT]);

    // Timeline Scroll Container Ref & Centering Logic
    const timelineScrollRef = useRef<HTMLDivElement>(null);
    const hasInitialScrolledRef = useRef(false);
    const isCalendarFullscreen = useUIStore((state) => state.isCalendarFullscreen);

    const scrollToCurrentTime = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (!timelineScrollRef.current || currentRedLineTop === null) return;
        const container = timelineScrollRef.current;
        const containerHeight = container.clientHeight;
        if (containerHeight <= 0) return;

        const stickyHeader = container.querySelector('.sticky') as HTMLElement | null;
        const headerHeight = stickyHeader ? stickyHeader.offsetHeight : 54;
        const visibleHeight = Math.max(100, containerHeight - headerHeight);
        const targetScrollTop = Math.max(0, currentRedLineTop - (visibleHeight / 2));

        container.scrollTo({
            top: targetScrollTop,
            behavior
        });
    }, [currentRedLineTop]);

    // Auto-center current time line on mount and when date changes to today
    useEffect(() => {
        if (!isViewingToday || currentRedLineTop === null) {
            hasInitialScrolledRef.current = false;
            return;
        }

        const timer = setTimeout(() => {
            scrollToCurrentTime(hasInitialScrolledRef.current ? 'smooth' : 'auto');
            hasInitialScrolledRef.current = true;
        }, 120);

        return () => clearTimeout(timer);
    }, [isViewingToday, currentDate, scrollToCurrentTime, currentRedLineTop !== null]);

    // Re-center when fullscreen mode toggles (synchronized with 500ms layout transition)
    useEffect(() => {
        if (!isViewingToday || currentRedLineTop === null) return;
        const t1 = setTimeout(() => {
            scrollToCurrentTime('smooth');
        }, 200);
        const t2 = setTimeout(() => {
            scrollToCurrentTime('smooth');
        }, 520);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [isCalendarFullscreen, isViewingToday, scrollToCurrentTime]);

    // Re-center when window resizes
    useEffect(() => {
        const handleResize = () => {
            if (isViewingToday && currentRedLineTop !== null) {
                scrollToCurrentTime('auto');
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isViewingToday, currentRedLineTop, scrollToCurrentTime]);

    // Reference Photo Lightbox & Selected Appointment State
    const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);

    // Lock body scroll whenever appointment details modal is active
    useEffect(() => {
        if (selectedApt) {
            const originalOverflow = document.body.style.overflow;
            const originalTouchAction = document.body.style.touchAction;
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
            return () => {
                document.body.style.overflow = originalOverflow;
                document.body.style.touchAction = originalTouchAction;
            };
        }
    }, [selectedApt]);

    // ESC shortcut to close appointment details
    useEffect(() => {
        if (!selectedApt) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedApt(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedApt]);

    // Helper to render individual appointment cards (shared between single-day and multi-day views)
    const renderAppointmentCard = (apt: Appointment) => {
        const service = getServiceById(apt.serviceId);
        const duration = getAppointmentTotalDuration(apt);
        const topPx = calculateTop(apt.time);
        const heightPx = calculateHeight(duration);
        const isShort = duration <= 35 || heightPx < 70;
        const totalPrice = getAppointmentTotalPrice(apt);
        const statusState = getAppointmentStatusState(apt);

        return (
            <div
                key={apt.id}
                onClick={() => setSelectedApt(apt)}
                style={{
                    top: `${topPx}px`,
                    height: `${Math.max(48, heightPx - 4)}px`,
                }}
                className={`absolute left-1 right-1 border text-left transition-all duration-300 cursor-pointer shadow-xl overflow-hidden group hover:z-20 hover:scale-[1.01] ${
                    isShort ? 'rounded-xl p-2' : 'rounded-2xl p-2.5'
                } ${
                    statusState.isCompleted
                        ? 'bg-gradient-to-br from-emerald-950/80 to-slate-900/90 border-emerald-500/40 text-emerald-100 shadow-emerald-950/40'
                        : statusState.isLiveAtendiendo
                        ? 'bg-gradient-to-br from-purple-950/90 via-slate-900/90 to-amber-950/80 border-accent/60 text-accent shadow-accent/20 ring-1 ring-accent/40'
                        : statusState.isFullPayment
                        ? 'bg-gradient-to-br from-emerald-950/90 to-teal-900/80 border-emerald-500/50 hover:border-emerald-400 text-emerald-100 shadow-emerald-950/50'
                        : statusState.isConfirmed
                        ? 'bg-gradient-to-br from-teal-950/90 to-cyan-900/80 border-teal-500/40 hover:border-teal-300 text-teal-100'
                        : 'bg-gradient-to-br from-slate-900/90 to-indigo-950/80 border-indigo-500/30 hover:border-indigo-400 text-slate-100'
                }`}
            >
                {isShort ? (
                    /* ── Modo Compacto para citas de 30-35 min (Cero texto cortado) ── */
                    <div className="flex flex-col justify-between h-full">
                        <div className="flex items-center justify-between gap-1 leading-none">
                            <div className="flex items-center gap-1.5 min-w-0">
                                {/* Mini status indicator dot */}
                                {apt.status === 'no_show' ? (
                                    <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" title="No asistió" />
                                ) : statusState.isCompleted ? (
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Completada" />
                                ) : statusState.isLiveAtendiendo ? (
                                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" title="Atendiendo" />
                                ) : statusState.isConfirmed ? (
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Confirmada" />
                                ) : statusState.isPending ? (
                                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Pendiente" />
                                ) : (
                                    <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" title="Agendada" />
                                )}
                                <span className="text-xs font-black truncate">{apt.clientName}</span>
                            </div>
                            <span className="text-[10px] font-bold opacity-80 shrink-0 font-mono">
                                {apt.time.slice(0, 5)}
                            </span>
                        </div>

                        <div className="flex items-center justify-between gap-1 leading-none">
                            <p className="text-[10px] font-semibold opacity-90 truncate flex items-center gap-1 min-w-0" title={getAppointmentFullServiceDisplay(apt, service?.name)}>
                                <Sparkles size={10} className="shrink-0 text-accent" />
                                <span className="truncate">{getAppointmentFullServiceDisplay(apt, service?.name)}</span>
                            </p>
                            <div className="flex items-center gap-1 shrink-0">
                                {(apt.bookingSource === 'marketplace' || (apt as any).booking_source === 'marketplace') && (
                                    <span className="px-1 py-0.5 rounded bg-purple-500/30 text-[8px] font-black text-purple-300 border border-purple-500/40 leading-none">
                                        MKT
                                    </span>
                                )}
                                {totalPrice > 0 && (
                                    <span className="px-1 py-0.5 rounded bg-emerald-500/25 text-[9px] font-black text-emerald-300 border border-emerald-500/40 leading-none">
                                        ${totalPrice}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── Modo Completo para citas de 45+ min ── */
                    <>
                        <div className="flex items-start justify-between gap-1 mb-1">
                            <span className="text-xs font-black truncate">{apt.clientName}</span>
                            <span className="text-[10px] font-bold opacity-80 shrink-0">
                                {apt.time.slice(0, 5)}
                            </span>
                        </div>

                        <p className="text-[11px] font-bold opacity-90 truncate leading-tight flex items-center gap-1" title={getAppointmentFullServiceDisplay(apt, service?.name)}>
                            <Sparkles size={11} className="shrink-0 text-accent" />
                            {getAppointmentFullServiceDisplay(apt, service?.name)}
                        </p>

                        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                            {/* Dynamic Status Badge */}
                            {apt.status === 'no_show' ? (
                                <span className="px-1.5 py-0.5 rounded bg-orange-500/30 text-[9px] font-black text-orange-300 uppercase tracking-wider border border-orange-500/40">
                                    ⚠️ NO ASISTIÓ
                                </span>
                            ) : statusState.isCompleted ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/30 text-[9px] font-black text-emerald-300 uppercase tracking-wider border border-emerald-500/40">
                                    ✓ COMPLETADA
                                </span>
                            ) : statusState.isLiveAtendiendo ? (
                                <span className="px-1.5 py-0.5 rounded bg-accent/30 text-[9px] font-black text-accent uppercase tracking-wider border border-accent/50 animate-pulse">
                                    🔴 ATENDIENDO
                                </span>
                            ) : statusState.isConfirmed ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/30 text-[9px] font-black text-emerald-300 uppercase tracking-wider border border-emerald-500/40">
                                    ✓ CONFIRMADA
                                </span>
                            ) : statusState.isPending ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/30 text-[9px] font-black text-amber-300 uppercase tracking-wider border border-amber-500/40">
                                    ⌛ PENDIENTE
                                </span>
                            ) : (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/30 text-[9px] font-black text-indigo-300 uppercase tracking-wider border border-indigo-500/40">
                                    📅 AGENDADA
                                </span>
                            )}

                            {/* Marketplace Origin Badge */}
                            {(apt.bookingSource === 'marketplace' || (apt as any).booking_source === 'marketplace') && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-500/30 text-[9px] font-black text-purple-300 border border-purple-500/40 uppercase tracking-wider">
                                    🛒 MARKETPLACE
                                </span>
                            )}

                            {/* Total Confirmed Price Badge */}
                            {totalPrice > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 text-[9px] font-black text-emerald-300 border border-emerald-500/40">
                                    💲 ${totalPrice} MXN
                                </span>
                            )}

                            {/* Staff Note Badge */}
                            {((apt as any).staff_notes || (apt as any).notes) && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-[9px] font-bold text-amber-300 border border-amber-400/30 truncate max-w-[150px]">
                                    📝 {(apt as any).staff_notes || (apt as any).notes}
                                </span>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-950/80 rounded-2xl sm:rounded-3xl border border-white/10 overflow-hidden shadow-2xl backdrop-blur-xl">
            {/* ── Top Navigation Bar ── */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 p-3 sm:p-4 border-b border-white/10 bg-[#0c101d]">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <div className="flex items-center gap-0.5 sm:gap-1 bg-black/40 p-1 rounded-xl sm:rounded-2xl border border-white/10">
                        <button
                            onClick={() => setCurrentDate(prev => subDays(prev, 1))}
                            className="p-1.5 sm:p-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg sm:rounded-xl transition-colors cursor-pointer"
                            title="Día anterior"
                        >
                            <ChevronLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
                        </button>
                        <button
                            onClick={() => {
                                setCurrentDate(new Date());
                                setTimeout(() => scrollToCurrentTime('smooth'), 50);
                            }}
                            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                isViewingToday ? 'bg-accent text-slate-950 font-black shadow-lg shadow-accent/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                            title="Ir a hoy y centrar hora actual"
                        >
                            HOY
                        </button>
                        <button
                            onClick={() => setCurrentDate(prev => addDays(prev, 1))}
                            className="p-1.5 sm:p-2 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg sm:rounded-xl transition-colors cursor-pointer"
                            title="Día siguiente"
                        >
                            <ChevronRight size={16} className="sm:w-[18px] sm:h-[18px]" />
                        </button>
                    </div>

                    {/* Transición elegante subiendo el perfil del profesional SOLO en modo multi-día (3 o 4 días) */}
                    {isMultiDayActive && singleStylist && (
                        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-accent/15 via-slate-900/90 to-accent/5 border border-accent/30 shadow-md shadow-accent/5 transition-all duration-300 transform translate-y-0 opacity-100 animate-in fade-in slide-in-from-bottom-2">
                            {singleStylist.image ? (
                                <img
                                    decoding="async"
                                    loading="lazy"
                                    src={singleStylist.image}
                                    alt={singleStylist.name}
                                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-accent/50 shadow-sm shrink-0"
                                />
                            ) : (
                                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center text-[9px] sm:text-[10px] font-black text-accent shrink-0">
                                    {singleStylist.name.charAt(0)}
                                </div>
                            )}
                            <div className="flex flex-col leading-none min-w-0">
                                <span className="text-xs sm:text-sm font-black text-white tracking-tight truncate max-w-[120px] sm:max-w-[180px]">
                                    {singleStylist.name}
                                </span>
                                {singleStylist.role && (
                                    <span className="text-[8px] sm:text-[9px] font-bold text-accent/80 uppercase tracking-widest mt-0.5 truncate max-w-[120px]">
                                        {singleStylist.role}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* View days selector: permite alternar 1D o 3D */}
                    <div className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/10 shadow-inner">
                        {[1, 3].map(num => {
                            const isCurrentActive = (isMultiDayActive && daysCount === num) || (!isMultiDayActive && num === 1);
                            return (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => handleSelectDays(num)}
                                    className={`px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-black rounded-lg transition-all cursor-pointer ${
                                        isCurrentActive
                                            ? 'bg-accent text-slate-950 shadow-md shadow-accent/20 font-black'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                    title={`Ver ${num} ${num === 1 ? 'día' : 'días'}`}
                                >
                                    {num === 1 ? '1D' : `${num}D`}
                                </button>
                            );
                        })}
                    </div>

                    <DatePickerInput
                        value={dateStr}
                        onChange={(val) => {
                            if (val) setCurrentDate(parseISO(val));
                        }}
                        placeholder="Ir a fecha"
                        align="right"
                        className="text-xs"
                        appointmentCounts={appointmentCounts}
                        waitingListCounts={waitingListCounts}
                    />
                </div>
            </div>

            {/* ── Google Calendar Multi-Column Timeline Grid ── */}
            <div ref={timelineScrollRef} className="flex-1 overflow-auto custom-scrollbar relative min-h-0">
                <div
                    className="relative flex flex-col w-full"
                    style={{
                        minWidth: (!isMultiDayActive && activeStylists.length <= 1) || (isMultiDayActive && daysCount <= 1)
                            ? '100%'
                            : `${Math.max(320, (isMultiDayActive ? daysCount : activeStylists.length) * (windowWidth < 640 ? 105 : 180) + (windowWidth < 640 ? 56 : 80))}px`
                    }}
                >

                    {/* Column Headers */}
                    <div className="sticky top-0 z-30 flex border-b border-white/10 bg-[#0f1526]/95 backdrop-blur-xl shadow-md">
                        {/* Time axis header cell */}
                        <div className="w-14 sm:w-20 shrink-0 p-2 sm:p-3 text-center border-r border-white/10 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center justify-center">
                            Hora
                        </div>

                        {/* Columns Header: either Multi-Stylist (1 day) OR Single Stylist (Multi-Day) */}
                        <div className="flex-1 grid grid-flow-col auto-cols-fr divide-x divide-white/10">
                            {isMultiDayActive ? (
                                displayDays.map(dayDate => {
                                    const isDayToday = isToday(dayDate);
                                    const dStr = format(dayDate, 'yyyy-MM-dd');
                                    const apptCount = appointmentCounts[dStr] || 0;

                                    return (
                                        <div
                                            key={dStr}
                                            className={`p-2 sm:p-3 flex flex-col items-center justify-center text-center transition-colors ${
                                                isDayToday ? 'bg-accent/10 border-b-2 border-accent' : ''
                                            }`}
                                        >
                                            <div className="flex items-center gap-1 sm:gap-1.5 leading-tight">
                                                <span className={`text-[11px] sm:text-sm font-black capitalize ${isDayToday ? 'text-accent' : 'text-white'}`}>
                                                    <span className="sm:hidden">{format(dayDate, 'EEE', { locale: es })}</span>
                                                    <span className="hidden sm:inline">{format(dayDate, 'EEEE', { locale: es })}</span>
                                                </span>
                                                {isDayToday && (
                                                    <span className="px-1 sm:px-1.5 py-0.2 rounded bg-accent text-slate-950 text-[7px] sm:text-[8px] font-black uppercase tracking-wider shadow-sm">
                                                        HOY
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 sm:gap-2 mt-0.5">
                                                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 capitalize">
                                                    {format(dayDate, "d 'de' MMM", { locale: es })}
                                                </span>
                                                {apptCount > 0 ? (
                                                    <span className="text-[8px] sm:text-[9px] font-bold text-accent bg-accent/15 px-1 sm:px-1.5 py-0.2 rounded-full border border-accent/30">
                                                        {apptCount} {apptCount === 1 ? 'cita' : 'citas'}
                                                    </span>
                                                ) : (
                                                    <span className="text-[8px] sm:text-[9px] font-medium text-slate-500 hidden xs:inline">
                                                        Libre
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                activeStylists.map(stylist => (
                                    <div key={stylist.id} className="p-3 flex items-center gap-2.5 justify-center text-center">
                                        {stylist.image ? (
                                            <img decoding="async" loading="lazy" src={stylist.image} alt={stylist.name} className="w-7 h-7 rounded-full object-cover border border-accent/40 shrink-0" />
                                        ) : (
                                            <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shrink-0 text-xs font-black">
                                                {stylist.name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="min-w-0 text-left">
                                            <h4 className="text-xs font-black text-white truncate leading-tight">{stylist.name}</h4>
                                            <p className="text-[9px] text-slate-400 truncate uppercase tracking-wider font-bold">{stylist.role || 'Estilista'}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Timeline Body */}
                    <div className="relative flex flex-1" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>

                        {/* Time Labels Y-Axis */}
                        <div className="w-14 sm:w-20 shrink-0 border-r border-white/10 bg-black/20 select-none">
                            {HOURS.map((h) => {
                                const ampm = h >= 12 ? 'PM' : 'AM';
                                const displayH = h % 12 === 0 ? 12 : h % 12;
                                return (
                                    <div
                                        key={h}
                                        style={{ height: `${HOUR_HEIGHT}px` }}
                                        className="border-b border-white/5 pr-2 sm:pr-3 pt-2 text-right text-[10px] sm:text-[11px] font-bold text-slate-500 box-border"
                                    >
                                        {displayH}:00 <span className="text-[8px] sm:text-[9px] text-slate-600 font-normal">{ampm}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Red Line for Live Current Time Indicator */}
                        {currentRedLineTop !== null && (
                            <div
                                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center -translate-y-1/2"
                                style={{ top: `${currentRedLineTop}px` }}
                            >
                                <div className="w-14 sm:w-20 text-right pr-1">
                                    <span
                                        onClick={() => scrollToCurrentTime('smooth')}
                                        title="Hora actual (clic para centrar)"
                                        className="bg-red-500 text-white text-[8px] sm:text-[9px] font-black px-1 sm:px-1.5 py-0.5 rounded-full shadow-lg pointer-events-auto cursor-pointer hover:scale-110 active:scale-95 transition-transform inline-block"
                                    >
                                        {format(now, 'h:mm a')}
                                    </span>
                                </div>
                                {(!isMultiDayActive || daysCount <= 1) && (
                                    <div className="flex-1 h-[2px] bg-gradient-to-r from-red-500 via-red-500 to-transparent shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                )}
                            </div>
                        )}

                        {/* Columns Content Grid */}
                        <div className="flex-1 grid grid-flow-col auto-cols-fr divide-x divide-white/10 relative">

                            {/* Background Hour Lines */}
                            <div className="absolute inset-0 pointer-events-none">
                                {HOURS.map(h => (
                                    <div key={h} style={{ height: `${HOUR_HEIGHT}px` }} className="border-b border-white/5 w-full box-border" />
                                ))}
                            </div>

                            {/* Columns Content: either Single Stylist Multi-Day OR Multi-Stylist Single-Day */}
                            {isMultiDayActive ? (
                                displayDays.map(dayDate => {
                                    const dStr = format(dayDate, 'yyyy-MM-dd');
                                    const isDayToday = isToday(dayDate);
                                    const dayStylistAppts = appointments.filter(a => {
                                        if (a.date !== dStr || a.status === 'cancelada') return false;
                                        if (!singleStylist || singleStylist.id === 0) return !a.stylistId;
                                        return Number(a.stylistId) === Number(singleStylist.id);
                                    });

                                    return (
                                        <div key={dStr} className={`relative h-full ${isDayToday ? 'bg-accent/[0.02]' : ''}`}>
                                            {/* Live red line on today's column */}
                                            {isDayToday && currentRedLineTop !== null && (
                                                <div
                                                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center -translate-y-1/2"
                                                    style={{ top: `${currentRedLineTop}px` }}
                                                >
                                                    <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)] -ml-1 shrink-0" />
                                                    <div className="flex-1 h-[2px] bg-gradient-to-r from-red-500 to-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                                                </div>
                                            )}
                                            {dayStylistAppts.map(apt => renderAppointmentCard(apt))}
                                        </div>
                                    );
                                })
                            ) : (
                                activeStylists.map(stylist => {
                                    const stylistAppts = dayAppointments.filter(a => {
                                        if (stylist.id === 0) return !a.stylistId;
                                        return Number(a.stylistId) === Number(stylist.id);
                                    });

                                    return (
                                        <div key={stylist.id} className="relative h-full">
                                            {stylistAppts.map(apt => renderAppointmentCard(apt))}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Appointment Details Modal (Rendered directly in Body via Portal for exact centering) ── */}
            {selectedApt && createPortal(
                <div
                    className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto overscroll-contain animate-fade-in"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSelectedApt(null);
                    }}
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                >
                    <div
                        className="bg-slate-900 border border-white/15 rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto overscroll-contain space-y-4 shadow-2xl relative text-left custom-scrollbar"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-black text-white">{selectedApt.clientName}</h3>
                                    {(selectedApt.bookingSource === 'marketplace' || (selectedApt as any).booking_source === 'marketplace') && (
                                        <span className="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[9px] font-black uppercase tracking-wider">
                                            🛒 MARKETPLACE
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400 font-medium">Tel: {selectedApt.clientPhone}</p>
                            </div>
                            <button
                                onClick={() => setSelectedApt(null)}
                                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 transition-colors cursor-pointer"
                                aria-label="Cerrar detalles"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 text-xs">
                            <div className="flex justify-between items-center text-slate-300">
                                <span>Fecha & Hora:</span>
                                <strong className="text-white font-bold">{selectedApt.date} • {selectedApt.time.slice(0, 5)} hrs</strong>
                            </div>

                            <div className="flex justify-between items-center text-slate-300">
                                <span>Servicio & Duración:</span>
                                <strong className="text-accent font-bold">
                                    {(() => {
                                        const baseSvc = getServiceById(selectedApt.serviceId);
                                        const totalDur = getAppointmentTotalDuration(selectedApt);
                                        return `${baseSvc?.name || 'Servicio'} (${totalDur} min)`;
                                    })()}
                                </strong>
                            </div>

                            <div className="flex justify-between items-center text-slate-300">
                                <span>Profesional:</span>
                                <strong className="text-white font-bold">
                                    {stylists.find(s => Number(s.id) === Number(selectedApt.stylistId))?.name || 'Sin Asignar'}
                                </strong>
                            </div>

                            {/* Additional Services / Options Breakdown */}
                            {((selectedApt.additionalServices || []).some((s: string) => !s.startsWith('Referencia:')) || selectedApt.additionalServices?.some((s: string) => s.startsWith('Referencia:'))) && (
                                <div className="pt-2 border-t border-white/10 space-y-1.5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        Opciones & Servicios Adicionales:
                                    </span>
                                    <div className="space-y-1 text-slate-200">
                                        {(selectedApt.additionalServices || [])
                                            .filter((s: string) => !s.startsWith('Referencia:'))
                                            .map((extra: string, idx: number) => (
                                                <div key={idx} className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-accent font-bold">•</span>
                                                    <span>{formatAddOnItemDisplay(extra, services, (tenantConfig as any)?.nail_calculator_config)}</span>
                                                </div>
                                            ))}
                                        {selectedApt.additionalServices?.find((s: string) => s.startsWith('Referencia:')) && (
                                            <button
                                                onClick={() => {
                                                    const refUrl = selectedApt.additionalServices
                                                        ?.find((s: string) => s.startsWith('Referencia:'))
                                                        ?.replace('Referencia:', '')
                                                        .trim();
                                                    if (refUrl) setActivePhotoUrl(refUrl);
                                                }}
                                                className="mt-1 flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-xl border border-amber-500/20 transition-all font-bold cursor-pointer"
                                            >
                                                <ImageIcon size={14} /> Ver Foto de Referencia
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Financial Breakdown */}
                            {getAppointmentTotalPrice(selectedApt) > 0 && (
                                <div className="pt-2 border-t border-white/10 space-y-1.5">
                                    <div className="flex justify-between items-center text-slate-300">
                                        <span>Precio Total (Confirmado/Estimado):</span>
                                        <span className="font-bold text-white">${getAppointmentTotalPrice(selectedApt)} MXN</span>
                                    </div>
                                    {(selectedApt.depositAmount || 0) > 0 && (
                                        <div className="flex justify-between items-center text-emerald-400 font-bold">
                                            <span>Monto Anticipo/Pagado:</span>
                                            <span>${selectedApt.depositAmount} MXN</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-amber-400 font-black pt-1 border-t border-white/5">
                                        <span>Restante a Cobrar en Salón:</span>
                                        <span className="bg-amber-500/20 px-2.5 py-1 rounded-xl text-amber-300 border border-amber-500/30 text-sm font-black">
                                            ${Math.max(0, getAppointmentTotalPrice(selectedApt) - (selectedApt.depositAmount || 0))} MXN
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Interactive Staff Note Section */}
                            <div className="pt-2.5 border-t border-white/10 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                        📝 Nota Interna del Salón
                                    </span>
                                    {noteInput !== ((selectedApt as any).staff_notes || (selectedApt as any).notes || '') && (
                                        <button
                                            onClick={handleSaveStaffNote}
                                            disabled={isSavingNote}
                                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 hover:bg-amber-500/30 transition-all cursor-pointer"
                                        >
                                            <Save size={12} /> {isSavingNote ? 'Guardando...' : 'Guardar Nota'}
                                        </button>
                                    )}
                                </div>
                                <textarea
                                    value={noteInput}
                                    onChange={(e) => setNoteInput(e.target.value)}
                                    placeholder="Agregar una nota o recordatorio interno para esta cita..."
                                    rows={2}
                                    className="w-full bg-black/40 border border-amber-500/30 focus:border-amber-500/60 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 outline-none resize-none transition-colors"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                            {(selectedApt.depositReceiptUrl || (selectedApt as any).deposit_receipt_url || (selectedApt as any).receipt_url) && (
                                <button
                                    onClick={() => {
                                        const url = selectedApt.depositReceiptUrl || (selectedApt as any).deposit_receipt_url || (selectedApt as any).receipt_url;
                                        if (onOpenReceipt) {
                                            onOpenReceipt(url);
                                        } else {
                                            setActivePhotoUrl(url);
                                        }
                                    }}
                                    className="w-full py-2.5 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md uppercase tracking-wider"
                                >
                                    <ImageIcon size={14} /> Ver Comprobante de Transferencia
                                </button>
                            )}

                            <div className="space-y-2">
                                {getAppointmentStatusState(selectedApt).isCompleted ? (
                                    <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
                                        ✓ CITA COMPLETADA
                                    </div>
                                ) : getAppointmentStatusState(selectedApt).isLiveAtendiendo ? (
                                    <div className="w-full py-2.5 px-3 rounded-xl bg-accent/20 text-accent border border-accent/40 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm animate-pulse">
                                        🔴 ATENDIENDO CITA
                                    </div>
                                ) : getAppointmentStatusState(selectedApt).isConfirmed ? (
                                    <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
                                        ✓ CONFIRMADA
                                    </div>
                                ) : getAppointmentStatusState(selectedApt).isPending ? (
                                    <div className="w-full py-2.5 px-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
                                        ⌛ PENDIENTE
                                    </div>
                                ) : (
                                    <div className="w-full py-2.5 px-3 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
                                        📅 AGENDADA
                                    </div>
                                )}

                                {/* Reagendar & Cancelar: Solo si la cita NO ha iniciado aún */}
                                {now < getAppointmentStatusState(selectedApt).startDt && selectedApt.status !== 'completada' && selectedApt.status !== 'cancelada' && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {onReschedule && (
                                            <button
                                                onClick={() => {
                                                    onReschedule(selectedApt);
                                                    setSelectedApt(null);
                                                }}
                                                className="py-2.5 px-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                            >
                                                <RefreshCw size={14} /> Reagendar
                                            </button>
                                        )}

                                        <button
                                            onClick={() => {
                                                onCancel(selectedApt);
                                                setSelectedApt(null);
                                            }}
                                            className={`py-2.5 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${!onReschedule ? 'col-span-2' : ''}`}
                                        >
                                            Cancelar Cita
                                        </button>
                                    </div>
                                )}

                                {/* No-Show: Solo si la cita YA inició y hasta 1 hora después de finalizar */}
                                {selectedApt.status !== 'completada' && selectedApt.status !== 'cancelada' && selectedApt.status !== 'no_show' && now >= getAppointmentStatusState(selectedApt).startDt && now <= new Date(getAppointmentStatusState(selectedApt).endDt.getTime() + 60 * 60 * 1000) && onNoShow && (
                                    <button
                                        onClick={() => {
                                            onNoShow(selectedApt);
                                            setSelectedApt(null);
                                        }}
                                        className="w-full py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer uppercase tracking-wider shadow-md"
                                    >
                                        <UserX size={14} /> Marcar No Asistió
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ── High-Res Interactive Image Zoom Viewer ── */}
            <PhotoZoomViewer
                photoUrl={activePhotoUrl}
                onClose={() => setActivePhotoUrl(null)}
                title="Foto de Referencia"
            />
        </div>
    );
}
