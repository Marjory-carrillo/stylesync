import { useState, useRef, useMemo, useEffect } from 'react';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { format, addDays, isToday, isTomorrow, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Instagram,
    Download,
    Copy,
    Check,
    MessageCircle,
    ExternalLink,
    Sparkles,
    Users,
    Clock,
    Building2,
    RotateCcw
} from 'lucide-react';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useSchedule } from '../../lib/store/queries/useSchedule';
import { useAppointments } from '../../lib/store/queries/useAppointments';
import { useStylists } from '../../lib/store/queries/useStylists';
import { useBlockedSlots } from '../../lib/store/queries/useBlockedSlots';
import { useServices } from '../../lib/store/queries/useServices';
import { useAuthStore } from '../../lib/store/authStore';
import { useUIStore } from '../../lib/store/uiStore';
import { DAY_NAMES } from '../../lib/constants';
import { getSmartSlots, calculateAppointmentDuration, type Appointment as SlotAppointment, type BlockedInterval } from '../../lib/smartSlots';

// Helper: Formato 12 horas (ej. "09:00 AM", "03:30 PM")
function formatTime12h(timeStr: string): string {
    if (!timeStr || !timeStr.includes(':')) return timeStr;
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

const DAY_KEYS_MAP = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export default function SocialContent() {
    const { showToast } = useUIStore();
    const { userTenants } = useAuthStore();
    const { data: tenantConfig } = useTenantData();
    const { schedule } = useSchedule();
    const { appointments = [] } = useAppointments();
    const { stylists = [] } = useStylists();
    const { blockedSlots = [] } = useBlockedSlots();
    const { services = [] } = useServices();

    const businessName = tenantConfig?.name || 'Mi Negocio';
    const businessSlug = tenantConfig?.slug || '';
    const brandSlug = tenantConfig?.brandSlug || null;
    const logoUrl = tenantConfig?.logoUrl || '';

    // Direct branch booking link vs multisucursal brand link
    const hasMultiBranch = Boolean(brandSlug && userTenants && userTenants.length >= 2);
    const [linkType, setLinkType] = useState<'branch' | 'brand'>('branch');

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.citalink.app';
    const bookingPath = (linkType === 'brand' && brandSlug)
        ? `sucursales/${brandSlug}`
        : `reserva/${businessSlug || '...'}`;
    const cleanDisplayUrl = `citalink.app/${bookingPath}`;
    const fullBookingUrl = `${baseUrl}/${bookingPath}`;

    // Mode: 'slots' (Horarios Libres) | 'launch' (Cuéntale a tus clientes) | 'whatsapp' (Mensaje de difusión)
    const [activeTab, setActiveTab] = useState<'slots' | 'launch' | 'whatsapp'>('slots');

    // Theme of the story image: 'light' | 'dark' | 'pink'
    const [storyTheme, setStoryTheme] = useState<'light' | 'dark' | 'pink'>('light');

    // Time display format: '12h' | '24h'
    const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');

    // Standard slot interval (45 minutes for availability calculation)
    const slotDuration = 45;

    // Selected date for slots (defaults to tomorrow if after hours, or today)
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedStylistId, setSelectedStylistId] = useState<number | 'all'>('all');
    const [customTitle] = useState('Citas disponibles');

    // Manual selected slots to highlight on the Story card (max 8)
    const [selectedSlotTimes, setSelectedSlotTimes] = useState<string[]>([]);

    // Exporting states
    const [isExporting, setIsExporting] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedMessage, setCopiedMessage] = useState(false);

    const storyCardRef = useRef<HTMLDivElement>(null);

    // Generate next 14 days for the horizontal date selector
    const dateOptions = useMemo(() => {
        const today = new Date();
        return Array.from({ length: 14 }).map((_, i) => addDays(today, i));
    }, []);

    // ── CALCULAR HORARIOS LIBRES REALES (SMARTSLOTS) ──
    const { realAvailableSlots, isDayClosed } = useMemo(() => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const dayKey = DAY_KEYS_MAP[selectedDate.getDay()];

        const daySchedule = schedule ? (schedule as any)[dayKey] : null;
        if (!daySchedule || !daySchedule.open) {
            return { realAvailableSlots: [], isDayClosed: true };
        }

        const todayLocal = format(new Date(), 'yyyy-MM-dd');
        const baseDate = dateStr === todayLocal
            ? new Date()
            : new Date(dateStr.replace(/-/g, '/') + ' 00:00:00');

        const bufferMinutes = (tenantConfig as any)?.breakBetweenAppointments ?? 0;

        // Stylists to check
        const stylistsToCheck = selectedStylistId === 'all'
            ? stylists
            : stylists.filter(s => s.id === selectedStylistId);

        const allSlots = new Set<string>();

        if (stylistsToCheck.length === 0) {
            // No stylists configured — treat as generic resource
            const blocked: BlockedInterval[] = blockedSlots
                .filter(b => b.date === dateStr)
                .map(b => ({
                    start: parse(b.startTime.slice(0, 5), 'HH:mm', baseDate),
                    end: parse(b.endTime.slice(0, 5), 'HH:mm', baseDate),
                }));

            if (daySchedule.breakStart && daySchedule.breakEnd) {
                blocked.push({
                    start: parse(daySchedule.breakStart, 'HH:mm', baseDate),
                    end: parse(daySchedule.breakEnd, 'HH:mm', baseDate),
                });
            }

            const appts: SlotAppointment[] = appointments
                .filter(a => {
                    const aDate = a.date ? a.date.split('T')[0] : '';
                    return aDate === dateStr && a.status !== 'cancelada';
                })
                .map(a => {
                    const dur = calculateAppointmentDuration(a, services);
                    const start = parse(a.time.slice(0, 5), 'HH:mm', baseDate);
                    const end = new Date(start.getTime() + dur * 60000);
                    return { id: a.id, stylistId: '0', start, end };
                });

            const smartSlots = getSmartSlots(
                baseDate,
                slotDuration,
                daySchedule.start || '09:00',
                daySchedule.end || '19:00',
                appts,
                blocked,
                bufferMinutes
            );
            smartSlots.forEach(s => allSlots.add(s));
        } else {
            stylistsToCheck.forEach(stylist => {
                const stylistSchedule = (stylist.schedule && typeof stylist.schedule === 'object' && Object.keys(stylist.schedule).length > 0)
                    ? (stylist.schedule as any)
                    : null;
                const stylistDaySchedule = stylistSchedule && stylistSchedule[dayKey]
                    ? stylistSchedule[dayKey]
                    : daySchedule;

                if (!stylistDaySchedule || !stylistDaySchedule.open) return;

                const blocked: BlockedInterval[] = blockedSlots
                    .filter(b => {
                        if (b.date !== dateStr) return false;
                        if (b.staffId && String(b.staffId) !== String(stylist.id)) return false;
                        return true;
                    })
                    .map(b => ({
                        start: parse(b.startTime.slice(0, 5), 'HH:mm', baseDate),
                        end: parse(b.endTime.slice(0, 5), 'HH:mm', baseDate),
                    }));

                if (stylistDaySchedule.breakStart && stylistDaySchedule.breakEnd) {
                    blocked.push({
                        start: parse(stylistDaySchedule.breakStart, 'HH:mm', baseDate),
                        end: parse(stylistDaySchedule.breakEnd, 'HH:mm', baseDate),
                    });
                }

                const stylistAppts: SlotAppointment[] = appointments
                    .filter(a => {
                        const aDate = a.date ? a.date.split('T')[0] : '';
                        return aDate === dateStr && a.status !== 'cancelada' && String(a.stylistId) === String(stylist.id);
                    })
                    .map(a => {
                        const dur = calculateAppointmentDuration(a, services);
                        const start = parse(a.time.slice(0, 5), 'HH:mm', baseDate);
                        const end = new Date(start.getTime() + dur * 60000);
                        return { id: a.id, stylistId: String(stylist.id), start, end };
                    });

                const smartSlots = getSmartSlots(
                    baseDate,
                    slotDuration,
                    stylistDaySchedule.start || '09:00',
                    stylistDaySchedule.end || '19:00',
                    stylistAppts,
                    blocked,
                    bufferMinutes
                );
                smartSlots.forEach(s => allSlots.add(s));
            });
        }

        const sorted = Array.from(allSlots).sort();
        return { realAvailableSlots: sorted, isDayClosed: false };
    }, [selectedDate, schedule, appointments, selectedStylistId, stylists, blockedSlots, services, slotDuration, tenantConfig]);

    // Pre-select slots when available slots change
    useEffect(() => {
        if (realAvailableSlots.length <= 8) {
            setSelectedSlotTimes(realAvailableSlots);
        } else {
            // Pick 8 slots evenly distributed (morning, midday, afternoon)
            const step = Math.floor(realAvailableSlots.length / 8);
            const picked = realAvailableSlots.filter((_, idx) => idx % step === 0).slice(0, 8);
            setSelectedSlotTimes(picked);
        }
    }, [realAvailableSlots]);

    // Toggle a slot in the selection
    const handleToggleSlot = (time: string) => {
        setSelectedSlotTimes(prev => {
            if (prev.includes(time)) {
                return prev.filter(t => t !== time);
            }
            if (prev.length >= 8) {
                showToast('Máximo 8 horarios en la Historia para visualización óptima', 'info');
                return prev;
            }
            return [...prev, time].sort();
        });
    };

    // Reset to suggested slots
    const handleResetSuggestedSlots = () => {
        if (realAvailableSlots.length <= 8) {
            setSelectedSlotTimes(realAvailableSlots);
        } else {
            const step = Math.floor(realAvailableSlots.length / 8);
            const picked = realAvailableSlots.filter((_, idx) => idx % step === 0).slice(0, 8);
            setSelectedSlotTimes(picked);
        }
    };

    // Copy link helper
    const handleCopyLink = () => {
        navigator.clipboard.writeText(fullBookingUrl);
        setCopiedLink(true);
        showToast('¡Enlace de reservas copiado!', 'success');
        setTimeout(() => setCopiedLink(false), 2000);
    };

    // Copy WhatsApp Broadcast message
    const broadcastMessage = `¡Hola! ✨ Ya puedes agendar tus citas con nosotros 100% en línea y en segundos. 💖

Olvídate de esperar respuesta por chat: ahora puedes elegir tu servicio favorito, seleccionar el día y tu horario ideal directo desde nuestra nueva app web:

👉 ${fullBookingUrl}

¡Te esperamos pronto! 💕`;

    const handleCopyBroadcast = () => {
        navigator.clipboard.writeText(broadcastMessage);
        setCopiedMessage(true);
        showToast('Mensaje de difusión copiado', 'success');
        setTimeout(() => setCopiedMessage(false), 2000);
    };

    // Download Story as HD PNG (1080x1920)
    const handleDownloadStory = async () => {
        if (!storyCardRef.current) return;
        setIsExporting(true);
        const docEl = document.documentElement;
        const previousZoom = (docEl.style as any).zoom;
        try {
            // Temporarily normalize root zoom to 1 to guarantee 100% unscaled character font metrics
            (docEl.style as any).zoom = '1';
            await new Promise((resolve) => setTimeout(resolve, 60));

            let dataUrl: string = '';

            // Attempt 1: html-to-image (native browser SVG foreignObject engine, 100% pixel-perfect text kerning)
            try {
                dataUrl = await toPng(storyCardRef.current, {
                    pixelRatio: 3, // 1080x1920 Ultra HD
                    quality: 1,
                    cacheBust: true,
                    width: 360,
                    height: 640,
                    backgroundColor: storyTheme === 'pink' ? '#fff1f2' : storyTheme === 'light' ? '#ffffff' : '#0a0e1a',
                    style: {
                        transform: 'none',
                        borderRadius: '0px',
                        margin: '0',
                    },
                });
            } catch (svgErr) {
                console.warn('html-to-image failed, falling back to html2canvas:', svgErr);
                // Attempt 2: html2canvas with full zoom & letter-spacing fixes
                const canvas = await html2canvas(storyCardRef.current, {
                    scale: 3,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: storyTheme === 'pink' ? '#fff1f2' : storyTheme === 'light' ? '#ffffff' : '#0a0e1a',
                    logging: false,
                    onclone: (clonedDoc) => {
                        if (clonedDoc.documentElement) {
                            (clonedDoc.documentElement.style as any).zoom = '1';
                        }
                        if (clonedDoc.body) {
                            (clonedDoc.body.style as any).zoom = 'normal';
                            clonedDoc.body.style.minHeight = 'auto';
                        }
                        const card = clonedDoc.querySelector('[data-story-card]') as HTMLElement;
                        if (card) {
                            card.style.borderRadius = '0px';
                            card.style.transform = 'none';
                            const nodes = card.querySelectorAll('*');
                            nodes.forEach((n: any) => {
                                n.style.letterSpacing = 'normal';
                                n.style.wordSpacing = 'normal';
                            });
                        }
                    }
                });
                dataUrl = canvas.toDataURL('image/png', 1.0);
            }

            if (!dataUrl) {
                throw new Error('No se pudo generar la imagen');
            }

            const link = document.createElement('a');
            const fileSuffix = activeTab === 'slots' 
                ? `horarios_${format(selectedDate, 'yyyy-MM-dd')}`
                : 'cuentale_a_tus_clientes';
            link.download = `citalink_${businessSlug || 'historia'}_${fileSuffix}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('¡Historia descargada en Ultra HD (1080x1920)! 📸', 'success');
        } catch (err: any) {
            console.error('Error generating image:', err);
            showToast('Error al generar la imagen: ' + (err.message || 'Inténtalo de nuevo'), 'error');
        } finally {
            // Restore unified app zoom
            if (previousZoom) {
                (docEl.style as any).zoom = previousZoom;
            } else {
                (docEl.style as any).zoom = '0.85';
            }
            setIsExporting(false);
        }
    };

    return (
        <div className="animate-fade-in space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-fuchsia-500/20 via-rose-500/20 to-amber-500/20 border border-fuchsia-500/30 text-fuchsia-400">
                            <Instagram size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                                Contenido para Redes
                            </h1>
                            <p className="text-slate-400 text-xs md:text-sm mt-0.5">
                                Genera historias listas para Instagram y WhatsApp con tus horarios libres reales o anuncia tu enlace.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Theme Selector */}
                <div className="flex items-center bg-slate-900/60 p-1 rounded-2xl border border-white/5 gap-1">
                    <button
                        onClick={() => setStoryTheme('light')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            storyTheme === 'light'
                                ? 'bg-white text-slate-950 shadow-md'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <span>☀️ Claro</span>
                    </button>
                    <button
                        onClick={() => setStoryTheme('pink')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            storyTheme === 'pink'
                                ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <span>🌸 Rosa Chic</span>
                    </button>
                    <button
                        onClick={() => setStoryTheme('dark')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            storyTheme === 'dark'
                                ? 'bg-violet-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <span>🌙 Oscuro</span>
                    </button>
                </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex flex-wrap bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 gap-1.5">
                <button
                    onClick={() => setActiveTab('slots')}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                        activeTab === 'slots'
                            ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Clock size={16} />
                    <span>Horarios Disponibles</span>
                </button>

                <button
                    onClick={() => setActiveTab('launch')}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                        activeTab === 'launch'
                            ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-lg shadow-pink-600/20'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <Sparkles size={16} />
                    <span>¡Cuéntale a tus clientes!</span>
                </button>

                <button
                    onClick={() => setActiveTab('whatsapp')}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                        activeTab === 'whatsapp'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/20'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <MessageCircle size={16} />
                    <span>Mensaje de Difusión</span>
                </button>
            </div>

            {/* Main Content Area: Left Controls & Story Preview, Right Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* ── Left Column: Controls & Live Story Preview ── */}
                <div className="lg:col-span-7 space-y-6">
                    {/* Controls specific to 'slots' mode */}
                    {activeTab === 'slots' && (
                        <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/5 space-y-5">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Elige el día</h3>
                                    <p className="text-sm font-bold text-white mt-0.5 capitalize">
                                        {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                    {/* Stylist filter if multiple stylists */}
                                    {stylists.length > 1 && (
                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <Users size={14} className="text-slate-500 shrink-0" />
                                            <select
                                                value={selectedStylistId}
                                                onChange={(e) => setSelectedStylistId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                                aria-label="Filtrar por especialista"
                                                className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent w-full sm:w-auto"
                                            >
                                                <option value="all">Todos los especialistas</option>
                                                {stylists.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}



                                    {/* Time format selector */}
                                    <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-0.5">
                                        <button
                                            onClick={() => setTimeFormat('12h')}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                                timeFormat === '12h' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            12 Horas
                                        </button>
                                        <button
                                            onClick={() => setTimeFormat('24h')}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                                timeFormat === '24h' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            24 Horas
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Horizontal scrollable date pills */}
                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                {dateOptions.map((date) => {
                                    const isSel = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                                    let label = format(date, 'EEE d', { locale: es });
                                    if (isToday(date)) label = 'Hoy';
                                    else if (isTomorrow(date)) label = 'Mañana';

                                    return (
                                        <button
                                            key={date.toISOString()}
                                            onClick={() => setSelectedDate(date)}
                                            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                                                isSel
                                                    ? 'bg-white text-slate-950 shadow-lg scale-105'
                                                    : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Real slots interactive picker */}
                            <div className="pt-2 border-t border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                                            Horarios reales disponibles ({realAvailableSlots.length})
                                        </span>
                                        <span className="text-[11px] font-medium text-slate-500">
                                            • Seleccionados ({selectedSlotTimes.length}/8)
                                        </span>
                                    </div>
                                    {realAvailableSlots.length > 8 && (
                                        <button
                                            onClick={handleResetSuggestedSlots}
                                            className="text-[11px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 cursor-pointer"
                                        >
                                            <RotateCcw size={12} />
                                            <span>Sugerir 8</span>
                                        </button>
                                    )}
                                </div>

                                {isDayClosed ? (
                                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold flex items-center gap-2">
                                        <span>🔴</span>
                                        <span>El establecimiento se encuentra cerrado los {DAY_NAMES[DAY_KEYS_MAP[selectedDate.getDay()]]}s según tu configuración de horarios.</span>
                                    </div>
                                ) : realAvailableSlots.length === 0 ? (
                                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-2">
                                        <span>✨</span>
                                        <span>No hay horarios libres disponibles para esta fecha (agenda completa o fuera de horario laboral).</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                        {realAvailableSlots.map(time => {
                                            const isSelected = selectedSlotTimes.includes(time);
                                            const displayTime = timeFormat === '12h' ? formatTime12h(time) : time;
                                            return (
                                                <button
                                                    key={time}
                                                    onClick={() => handleToggleSlot(time)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-600/30'
                                                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5'
                                                    }`}
                                                >
                                                    {isSelected && <Check size={12} className="stroke-[3]" />}
                                                    <span>{displayTime}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── LIVE INSTAGRAM STORY CARD PREVIEW (9:16) ── */}
                    {activeTab !== 'whatsapp' ? (
                        <div className="flex flex-col items-center">
                            <div className="relative group p-2">
                                {/* Simulated mobile device frame / glow */}
                                <div className="absolute -inset-2 bg-gradient-to-r from-violet-600/20 via-pink-600/20 to-amber-600/20 rounded-[3rem] blur-xl opacity-75 pointer-events-none" />

                                {/* 9:16 Story Canvas (Exported element: Exactly 360 x 640 = 9:16) */}
                                <div
                                    ref={storyCardRef}
                                    data-story-card
                                    className={`relative w-[360px] h-[640px] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col justify-between p-6 select-none transition-all duration-300 ${
                                        storyTheme === 'pink'
                                            ? 'bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200 text-slate-900 border border-pink-300 shadow-pink-500/15'
                                            : storyTheme === 'light'
                                            ? 'bg-white text-slate-900 border border-slate-200 shadow-slate-200/50'
                                            : 'bg-[#0a0e1a] text-white border border-white/10 shadow-black/60'
                                    }`}
                                >
                                    {/* Top decorative accent gradient bar */}
                                    <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                                        storyTheme === 'pink'
                                            ? 'bg-gradient-to-r from-pink-500 via-rose-400 to-fuchsia-500'
                                            : 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500'
                                    }`} />

                                    {/* Subtle decorative background light */}
                                    <div className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
                                        storyTheme === 'pink' ? 'bg-pink-300/40' : storyTheme === 'light' ? 'bg-violet-200/40' : 'bg-violet-600/10'
                                    }`} />
                                    <div className={`absolute -bottom-12 -left-12 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
                                        storyTheme === 'pink' ? 'bg-rose-300/40' : storyTheme === 'light' ? 'bg-pink-200/30' : 'bg-pink-600/10'
                                    }`} />

                                    {/* Story Header: Brand */}
                                    <div className="relative z-10 flex items-center justify-between pt-1">
                                        <div className="flex items-center gap-3">
                                            {logoUrl ? (
                                                <img
                                                    src={logoUrl}
                                                    alt={businessName}
                                                    className="w-11 h-11 rounded-2xl object-cover border border-black/5 shadow-sm"
                                                    crossOrigin="anonymous"
                                                    loading="lazy"
                                                    decoding="async"
                                                />
                                            ) : (
                                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shadow-sm ${
                                                    storyTheme === 'pink'
                                                        ? 'bg-pink-500 text-white shadow-pink-500/25'
                                                        : storyTheme === 'light'
                                                        ? 'bg-slate-950 text-white'
                                                        : 'bg-white text-slate-950'
                                                }`}>
                                                    {businessName.charAt(0)}
                                                </div>
                                            )}
                                            <div className="text-left">
                                                <h4 className="font-black text-sm tracking-normal leading-tight">
                                                    {businessName}
                                                </h4>
                                                <p className={`text-[10px] font-bold uppercase tracking-wider ${
                                                    storyTheme === 'pink' ? 'text-pink-600' : storyTheme === 'light' ? 'text-slate-500' : 'text-slate-400'
                                                }`}>
                                                    Reserva en Línea
                                                </p>
                                            </div>
                                        </div>

                                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                            storyTheme === 'pink'
                                                ? 'bg-pink-200/70 text-pink-700 border-pink-300'
                                                : storyTheme === 'light'
                                                ? 'bg-violet-50 text-violet-700 border-violet-200'
                                                : 'bg-violet-950/60 text-violet-300 border-violet-500/30'
                                        }`}>
                                            24/7
                                        </div>
                                    </div>

                                    {/* Story Body Content */}
                                    <div className="relative z-10 my-auto text-center space-y-4 py-1">
                                        {activeTab === 'slots' ? (
                                            <>
                                                <div>
                                                    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mb-2 ${
                                                        storyTheme === 'pink'
                                                            ? 'bg-pink-500/15 text-pink-700 border-pink-300/60'
                                                            : 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                    }`}>
                                                        📅 Agenda Abierta
                                                    </span>
                                                    <h2 className="text-2xl font-black tracking-normal leading-tight">
                                                        {customTitle}
                                                    </h2>
                                                    <p className={`text-xs font-bold mt-1 uppercase tracking-wider ${
                                                        storyTheme === 'pink' ? 'text-pink-600' : storyTheme === 'light' ? 'text-slate-500' : 'text-slate-400'
                                                    }`}>
                                                        {isToday(selectedDate)
                                                            ? '¡Últimos turnos para hoy!'
                                                            : format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
                                                    </p>
                                                </div>

                                                {/* Slots Grid */}
                                                {isDayClosed ? (
                                                    <div className="p-4 rounded-2xl text-xs font-bold w-full max-w-[310px] mx-auto bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                                        Establecimiento cerrado este día
                                                        <p className="text-[10px] font-normal mt-1 opacity-80">¡Revisa nuestros horarios en las próximas fechas!</p>
                                                    </div>
                                                ) : selectedSlotTimes.length > 0 ? (
                                                    <div className="grid grid-cols-2 gap-2 w-full max-w-[310px] mx-auto pt-1">
                                                        {selectedSlotTimes.map((time) => {
                                                            const display = timeFormat === '12h' ? formatTime12h(time) : time;
                                                            return (
                                                                <div
                                                                    key={time}
                                                                    className={`py-2.5 px-3 rounded-2xl font-black text-sm tracking-normal transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                                                                        storyTheme === 'pink'
                                                                            ? 'bg-white/95 text-pink-950 border border-pink-300/80 shadow-pink-500/5'
                                                                            : storyTheme === 'light'
                                                                            ? 'bg-slate-50 text-slate-800 border border-slate-200/90'
                                                                            : 'bg-white/5 text-white border border-white/10'
                                                                    }`}
                                                                >
                                                                    <Clock size={13} className={`${storyTheme === 'pink' ? 'text-pink-500' : 'opacity-60'} shrink-0`} />
                                                                    <span>{display}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className={`p-4 rounded-2xl text-xs font-bold w-full max-w-[310px] mx-auto ${
                                                        storyTheme === 'pink'
                                                            ? 'bg-white/90 text-pink-700 border border-pink-200'
                                                            : storyTheme === 'light'
                                                            ? 'bg-slate-50 text-slate-500 border border-slate-200'
                                                            : 'bg-white/5 text-slate-400 border border-white/10'
                                                    }`}>
                                                        Agenda completa para este día. ¡Toca el link para ver más fechas disponibles!
                                                    </div>
                                                )}

                                                <p className={`text-[11px] font-bold text-center w-full block ${
                                                    storyTheme === 'pink' ? 'text-pink-700' : storyTheme === 'light' ? 'text-slate-500' : 'text-slate-400'
                                                }`}>
                                                    {selectedSlotTimes.length} {selectedSlotTimes.length === 1 ? 'horario disponible' : 'horarios disponibles'}
                                                </p>
                                            </>
                                        ) : (
                                            /* Launch mode: ¡Cuéntale a tus clientes! */
                                            <>
                                                <div>
                                                    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mb-2 ${
                                                        storyTheme === 'pink'
                                                            ? 'bg-pink-500/15 text-pink-700 border-pink-300/60'
                                                            : 'bg-gradient-to-r from-pink-500/10 to-violet-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20'
                                                    }`}>
                                                        ✨ ¡Nuevo Sistema de Citas!
                                                    </span>
                                                    <h2 className="text-2xl font-black tracking-normal leading-tight">
                                                        ¡Ahora puedes agendar tu cita en línea!
                                                    </h2>
                                                </div>

                                                {/* 3 Real CitaLink Steps */}
                                                <div className="w-full max-w-[310px] mx-auto space-y-2.5 pt-1">
                                                    <p className={`text-[10px] font-black uppercase tracking-widest text-center ${
                                                        storyTheme === 'pink' ? 'text-pink-600' : storyTheme === 'light' ? 'text-slate-400' : 'text-slate-500'
                                                    }`}>
                                                        ¿Cómo reservar?
                                                    </p>

                                                    <div className={`p-3 rounded-2xl flex items-center gap-3 border shadow-sm transition-all ${
                                                        storyTheme === 'pink'
                                                            ? 'bg-white/90 border-pink-200/80 shadow-pink-500/5'
                                                            : storyTheme === 'light'
                                                            ? 'bg-slate-50/80 border-slate-200/90'
                                                            : 'bg-white/[0.04] border-white/10'
                                                    }`}>
                                                        <div className={`w-7 h-7 rounded-xl text-white text-xs font-black flex items-center justify-center shrink-0 shadow-sm ${
                                                            storyTheme === 'pink'
                                                                ? 'bg-gradient-to-tr from-pink-500 to-rose-500'
                                                                : 'bg-gradient-to-tr from-violet-600 to-fuchsia-600'
                                                        }`}>
                                                            1
                                                        </div>
                                                        <div className="text-left flex-1 min-w-0">
                                                            <p className="text-xs font-black tracking-normal leading-tight">
                                                                Ingresa tu WhatsApp
                                                            </p>
                                                            <p className={`text-[10px] font-medium leading-none mt-0.5 ${
                                                                storyTheme === 'pink' ? 'text-pink-600/80' : storyTheme === 'light' ? 'text-slate-500' : 'text-slate-400'
                                                            }`}>
                                                                Rápido y sin contraseñas
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className={`p-3 rounded-2xl flex items-center gap-3 border shadow-sm transition-all ${
                                                        storyTheme === 'pink'
                                                            ? 'bg-white/90 border-pink-200/80 shadow-pink-500/5'
                                                            : storyTheme === 'light'
                                                            ? 'bg-slate-50/80 border-slate-200/90'
                                                            : 'bg-white/[0.04] border-white/10'
                                                    }`}>
                                                        <div className={`w-7 h-7 rounded-xl text-white text-xs font-black flex items-center justify-center shrink-0 shadow-sm ${
                                                            storyTheme === 'pink'
                                                                ? 'bg-gradient-to-tr from-pink-500 to-rose-500'
                                                                : 'bg-gradient-to-tr from-violet-600 to-fuchsia-600'
                                                        }`}>
                                                            2
                                                        </div>
                                                        <div className="text-left flex-1 min-w-0">
                                                            <p className="text-xs font-black tracking-normal leading-tight">
                                                                Elige servicio y especialista
                                                            </p>
                                                            <p className={`text-[10px] font-medium leading-none mt-0.5 ${
                                                                storyTheme === 'pink' ? 'text-pink-600/80' : storyTheme === 'light' ? 'text-slate-500' : 'text-slate-400'
                                                            }`}>
                                                                Precios y fotos transparentes
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className={`p-3 rounded-2xl flex items-center gap-3 border shadow-sm transition-all ${
                                                        storyTheme === 'pink'
                                                            ? 'bg-white/90 border-pink-200/80 shadow-pink-500/5'
                                                            : storyTheme === 'light'
                                                            ? 'bg-slate-50/80 border-slate-200/90'
                                                            : 'bg-white/[0.04] border-white/10'
                                                    }`}>
                                                        <div className={`w-7 h-7 rounded-xl text-white text-xs font-black flex items-center justify-center shrink-0 shadow-sm ${
                                                            storyTheme === 'pink'
                                                                ? 'bg-gradient-to-tr from-pink-500 to-rose-500'
                                                                : 'bg-gradient-to-tr from-violet-600 to-fuchsia-600'
                                                        }`}>
                                                            3
                                                        </div>
                                                        <div className="text-left flex-1 min-w-0">
                                                            <p className="text-xs font-black tracking-normal leading-tight">
                                                                Selecciona día y horario ¡y listo!
                                                            </p>
                                                            <p className={`text-[10px] font-medium leading-none mt-0.5 ${
                                                                storyTheme === 'pink' ? 'text-pink-600/80' : storyTheme === 'light' ? 'text-slate-500' : 'text-slate-400'
                                                            }`}>
                                                                Confirmación instantánea
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Simulated Instagram Link Sticker Box */}
                                        <div className="w-full max-w-[310px] mx-auto pt-1">
                                            <div className={`p-3 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all ${
                                                storyTheme === 'pink'
                                                    ? 'bg-pink-100/70 border-pink-400 text-pink-700'
                                                    : storyTheme === 'light'
                                                    ? 'bg-violet-50/70 border-violet-400 text-violet-700'
                                                    : 'bg-violet-950/40 border-violet-400/80 text-violet-300'
                                            }`}>
                                                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
                                                    <span>🔗</span>
                                                    <span>STICKER DE ENLACE AQUÍ</span>
                                                </div>
                                                <span className="text-[10px] opacity-80 font-medium">
                                                    (Pega tu link de reserva en tu historia)
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Story Footer */}
                                    <div className={`relative z-10 pt-3 border-t flex items-center justify-between text-[11px] font-bold ${
                                        storyTheme === 'pink' ? 'border-pink-300/80 text-pink-700' : storyTheme === 'light' ? 'border-slate-200/90 text-slate-500' : 'border-white/10 text-slate-400'
                                    }`}>
                                        <span className="font-mono truncate tracking-normal">
                                            {cleanDisplayUrl}
                                        </span>
                                        <span className="text-[9px] uppercase tracking-widest font-black opacity-70 flex items-center gap-1">
                                            <span>CitaLink</span>
                                            <Sparkles size={10} className={storyTheme === 'pink' ? 'text-pink-500' : 'text-fuchsia-500'} />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* WhatsApp Broadcast Mode */
                        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    <MessageCircle size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-white">Mensaje de Difusión para WhatsApp</h3>
                                    <p className="text-xs text-slate-400">
                                        Envía este mensaje a tus listas de difusión o publícalo en tus estados de WhatsApp.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-black/50 p-5 rounded-2xl border border-white/10 relative">
                                <pre className="font-sans text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                                    {broadcastMessage}
                                </pre>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={handleCopyBroadcast}
                                    className="btn btn-primary flex-1 py-3.5 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider"
                                >
                                    {copiedMessage ? <Check size={16} /> : <Copy size={16} />}
                                    <span>{copiedMessage ? '¡Copiado!' : 'Copiar Mensaje'}</span>
                                </button>
                                <a
                                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(broadcastMessage)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                                >
                                    <ExternalLink size={16} />
                                    <span>Abrir en WhatsApp</span>
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Right Column: Instructions & Actions ── */}
                <div className="lg:col-span-5 space-y-6">
                    {/* How to use card */}
                    <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-white/5 space-y-5">
                        <div className="flex items-center gap-3 pb-3 border-b border-white/5">
                            <div className="p-2.5 rounded-2xl bg-white/5 text-white border border-white/10">
                                <Instagram size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-white">¿Cómo publicarlo en Instagram?</h3>
                                <p className="text-[11px] text-slate-500 font-medium">3 pasos para empezar a recibir reservas</p>
                            </div>
                        </div>

                        <ol className="space-y-3.5 text-xs text-slate-300">
                            <li className="flex items-start gap-3">
                                <span className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-400 border border-violet-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                    1
                                </span>
                                <span><strong>Descarga la imagen</strong> haciendo clic en el botón de abajo.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-400 border border-violet-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                    2
                                </span>
                                <span><strong>Súbela como Historia</strong> a tu cuenta de Instagram o estados de WhatsApp.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="w-5 h-5 rounded-full bg-violet-600/30 text-violet-400 border border-violet-500/30 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                    3
                                </span>
                                <span>
                                    Toca el icono de <strong>Stickers</strong> de Instagram, elige <strong>"Enlace"</strong>, pega tu link y colócalo encima del recuadro violeta.
                                </span>
                            </li>
                        </ol>

                        {/* Copyable Link Field */}
                        <div className="pt-2">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                                    Tu link de reservas oficial
                                </label>
                                {hasMultiBranch && (
                                    <span className="text-[10px] font-bold text-violet-400">Multisucursal activa</span>
                                )}
                            </div>

                            {/* Multi-Branch toggle if active */}
                            {hasMultiBranch && (
                                <div className="flex bg-black/50 p-1 rounded-2xl border border-white/10 gap-1 mb-3">
                                    <button
                                        onClick={() => setLinkType('branch')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                            linkType === 'branch'
                                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/30'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <span>📍 Esta sucursal</span>
                                    </button>
                                    <button
                                        onClick={() => setLinkType('brand')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                                            linkType === 'brand'
                                                ? 'bg-gradient-to-r from-violet-500/25 to-fuchsia-600/20 text-violet-300 border border-violet-500/30'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <Building2 size={13} />
                                        <span>Multisucursal</span>
                                    </button>
                                </div>
                            )}

                            <div className="flex items-center bg-black/50 border border-white/10 rounded-2xl p-1.5 focus-within:border-accent">
                                <span className="text-xs font-mono text-slate-300 px-3 truncate flex-1 select-all">
                                    {cleanDisplayUrl}
                                </span>
                                <button
                                    onClick={handleCopyLink}
                                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer active:scale-95 shrink-0"
                                >
                                    {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                    <span className="hidden sm:inline">{copiedLink ? 'Copiado' : 'Copiar'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        {activeTab !== 'whatsapp' && (
                            <button
                                onClick={handleDownloadStory}
                                disabled={isExporting}
                                className="w-full py-4 rounded-2xl bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-white/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                <Download size={18} />
                                <span>{isExporting ? 'Generando Historia...' : 'Descargar imagen'}</span>
                            </button>
                        )}
                    </div>

                    {/* Pro Tip Card */}
                    <div className="p-5 rounded-3xl bg-gradient-to-br from-violet-600/10 via-fuchsia-600/5 to-purple-600/10 border border-violet-500/20 space-y-2">
                        <div className="flex items-center gap-2 text-violet-400 font-bold text-xs">
                            <Sparkles size={14} />
                            <span>Consejo de Conversión</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Los negocios que publican sus horarios libres en Historias de Instagram al menos <strong>3 veces por semana</strong> aumentan sus citas confirmadas en más de un <strong>40%</strong>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
