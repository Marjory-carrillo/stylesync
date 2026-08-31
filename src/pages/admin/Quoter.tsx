import { useState, useMemo, useRef, useEffect } from 'react';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useNailCalculator } from '../../lib/store/queries/useNailCalculator';
import { useStylists } from '../../lib/store/queries/useStylists';
import { useServices } from '../../lib/store/queries/useServices';
import { useQuotes } from '../../lib/store/queries/useQuotes';
import { useImageUpload } from '../../lib/store/queries/useImageUpload';
import { useAuthStore } from '../../lib/store/authStore';
import { 
    Calculator, Sparkles, Plus, Minus, Upload, Image as ImageIcon, Trash2, Maximize2, 
    Eye, X, RotateCcw, Download, User, Clock, Link as LinkIcon, MessageCircle, 
    History, CheckCircle, Search, CalendarPlus, AlertCircle, Loader2,
    ChevronDown, ChevronUp, Camera
} from 'lucide-react';
import { useUIStore } from '../../lib/store/uiStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import QuoteDirectBookingModal from '../../components/QuoteDirectBookingModal';
import type { Quote } from '../../lib/types/store.types';

export default function Quoter() {
    const { showToast } = useUIStore();
    const { user, userRole, userStylistId } = useAuthStore();
    const { data: tenantConfig } = useTenantData();
    const businessConfig = tenantConfig || {} as any;
    const { config, isLoading } = useNailCalculator();
    const { stylists } = useStylists();
    const { services } = useServices();
    const { quotes, createQuote, deleteQuote, isDeleting } = useQuotes();
    const { uploadNailDesign } = useImageUpload();
    
    const ticketRef = useRef<HTMLDivElement>(null);

    // Active tab: 'calculator' vs 'history'
    const [activeTab, setActiveTab] = useState<'calculator' | 'history'>('calculator');

    // Main services from the business catalog enabled for quoting
    const baseServices = useMemo(() => {
        const quoterSvcs = services.filter(s => s.enableQuoter && !s.isAddon);
        return quoterSvcs.length > 0 ? quoterSvcs : services.filter(s => !s.isAddon);
    }, [services]);

    const qualifiedStylists = useMemo(() => {
        if (baseServices.length === 0) return stylists;
        return stylists.filter(st => {
            if (!st.serviceIds || st.serviceIds.length === 0) return true; // Can do all
            return baseServices.some(ns => st.serviceIds?.includes(Number(ns.id)));
        });
    }, [stylists, baseServices]);

    // Selection states
    const [selectedStylistId, setSelectedStylistId] = useState<string>('');

    // Auto-select stylist
    useEffect(() => {
        if (qualifiedStylists.length === 0) return;

        if (userRole === 'employee') {
            if (userStylistId) {
                const employeeStylist = qualifiedStylists.find(st => st.id === userStylistId);
                if (employeeStylist) {
                    setSelectedStylistId(String(employeeStylist.id));
                    return;
                }
            }
            const userEmail = user?.email;
            if (userEmail) {
                const employeeStylist = qualifiedStylists.find(st => st.phone?.toLowerCase() === userEmail.toLowerCase() || st.name.toLowerCase().includes(userEmail.split('@')[0].toLowerCase()));
                if (employeeStylist) {
                    setSelectedStylistId(String(employeeStylist.id));
                    return;
                }
            }
        }

        if (qualifiedStylists.length === 1) {
            setSelectedStylistId(String(qualifiedStylists[0].id));
        }
    }, [qualifiedStylists, userRole, userStylistId, user]);

    const [selectedBaseServiceId, setSelectedBaseServiceId] = useState<string>('');
    const [selectedSizeId, setSelectedSizeId] = useState<string>('');
    const [selectedStyles, setSelectedStyles] = useState<Record<string, { checked: boolean; qty: number }>>({});
    const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({});
    const [cardTheme, setCardTheme] = useState<'pink' | 'dark' | 'gold'>('pink');

    // Auto-select first base service
    useEffect(() => {
        if (baseServices.length > 0 && !selectedBaseServiceId) {
            setSelectedBaseServiceId(String(baseServices[0].id));
        }
    }, [baseServices, selectedBaseServiceId]);

    // Reference photo state, Cloud URL & lightbox modal
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState<boolean>(false);
    const [modalImageSrc, setModalImageSrc] = useState<string | null>(null);

    // Direct booking modal state
    const [selectedQuoteForBooking, setSelectedQuoteForBooking] = useState<Quote | null>(null);
    const [isDirectBookingModalOpen, setIsDirectBookingModalOpen] = useState<boolean>(false);
    const [showImageExportOptions, setShowImageExportOptions] = useState<boolean>(false);

    // History filter & search
    const [historyFilter, setHistoryFilter] = useState<'all' | 'pending' | 'booked'>('all');
    const [historySearch, setHistorySearch] = useState<string>('');
    const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);

    // Process file & upload to Supabase Storage
    const processAndUploadFile = async (file: File) => {
        // Immediate local preview
        const reader = new FileReader();
        reader.onload = (event) => {
            setReferenceImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);

        // Upload to Storage
        try {
            setIsUploadingPhoto(true);
            const publicUrl = await uploadNailDesign(file);
            if (publicUrl) {
                setUploadedImageUrl(publicUrl);
                setReferenceImage(publicUrl);
                showToast('📸 Foto de referencia lista para compartir', 'success');
            }
        } catch (err) {
            console.error('Error subiendo foto de referencia:', err);
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    // Listener for Ctrl + V image paste from WhatsApp / Clipboard
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        processAndUploadFile(blob);
                        showToast('📸 Foto de referencia pegada desde el portapapeles', 'success');
                    }
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [uploadNailDesign, showToast]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processAndUploadFile(file);
        }
    };

    // Categorized config items
    const sizeCategory = useMemo(() => config.find(c => c.id === 'sizes'), [config]);
    const styleCategory = useMemo(() => config.find(c => c.id === 'styles'), [config]);
    const extrasCategory = useMemo(() => config.find(c => c.id === 'extras'), [config]);

    const currentStylist = useMemo(() => {
        if (!selectedStylistId) return null;
        return stylists.find(s => String(s.id) === selectedStylistId) || null;
    }, [selectedStylistId, stylists]);

    const selectedBaseService = useMemo(() => {
        return baseServices.find(s => String(s.id) === selectedBaseServiceId) || null;
    }, [baseServices, selectedBaseServiceId]);

    // Helper to format minutes into human-readable hours and mins
    const formatDurationDisplay = (mins: number) => {
        if (mins <= 0) return '0 min';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m (${mins} min)`;
        if (h > 0) return `${h}h (${mins} min)`;
        return `${mins} min`;
    };

    // Calculate details, prices and durations
    const quoteBreakdown = useMemo(() => {
        const items: { name: string; price: number; duration?: number; detail?: string }[] = [];
        let total = 0;
        let totalMinutes = 0;

        const sizeItem = sizeCategory?.items.find(i => i.id === selectedSizeId);

        let basePrice = selectedBaseService ? (currentStylist?.customServicePrices?.[selectedBaseService.id]?.price ?? selectedBaseService.price) : 0;
        let baseDuration = selectedBaseService ? (currentStylist?.customServicePrices?.[selectedBaseService.id]?.duration ?? selectedBaseService.duration ?? 0) : 0;
        
        let sizePrice = sizeItem ? (currentStylist?.customQuoterConfig?.[sizeItem.id] ?? sizeItem.price) : 0;
        let sizeDuration = sizeItem ? (currentStylist?.customQuoterConfig?.[`${sizeItem.id}_dur`] ?? (sizeItem as any).duration ?? 0) : 0;

        if (selectedBaseService) {
            const combinedPrice = basePrice + sizePrice;
            const combinedDuration = baseDuration + sizeDuration;
            if (sizeItem && sizePrice > 0) {
                const combinedName = `${selectedBaseService.name} (${sizeItem.name})`;
                items.push({ name: combinedName, price: combinedPrice, duration: combinedDuration });
            } else if (sizeItem) {
                const combinedName = `${selectedBaseService.name} (${sizeItem.name})`;
                items.push({ name: combinedName, price: basePrice, duration: combinedDuration });
            } else {
                items.push({ name: selectedBaseService.name, price: basePrice, duration: baseDuration });
            }
            total += combinedPrice;
            totalMinutes += combinedDuration;
        } else if (sizeItem) {
            items.push({ name: `Largo: ${sizeItem.name}`, price: sizePrice, duration: sizeDuration });
            total += sizePrice;
            totalMinutes += sizeDuration;
        }

        // Styles / Decor
        if (styleCategory) {
            styleCategory.items.forEach(item => {
                const selection = selectedStyles[item.id];
                if (selection?.checked) {
                    const customPrice = currentStylist?.customQuoterConfig?.[item.id];
                    const unitPrice = customPrice !== undefined ? customPrice : item.price;
                    const customDur = currentStylist?.customQuoterConfig?.[`${item.id}_dur`];
                    const unitDur = customDur !== undefined ? customDur : ((item as any).duration ?? 0);
                    const hasUnit = !!item.unit;
                    const qty = hasUnit ? selection.qty : 1;
                    const price = unitPrice * qty;
                    const itemTotalDur = unitDur * qty;

                    let unitText = item.unit;
                    if (item.unit === 'por pieza') {
                        unitText = qty === 1 ? 'pieza' : 'piezas';
                    } else if (item.unit === 'por uña') {
                        unitText = qty === 1 ? 'uña' : 'uñas';
                    }
                    items.push({
                        name: item.name,
                        price,
                        duration: itemTotalDur,
                        detail: hasUnit ? `(${qty} ${unitText})` : undefined
                    });
                    total += price;
                    totalMinutes += itemTotalDur;
                }
            });
        }

        // Extras
        if (extrasCategory) {
            extrasCategory.items.forEach(item => {
                if (selectedExtras[item.id]) {
                    const customPrice = currentStylist?.customQuoterConfig?.[item.id];
                    const price = customPrice !== undefined ? customPrice : item.price;
                    const customDur = currentStylist?.customQuoterConfig?.[`${item.id}_dur`];
                    const duration = customDur !== undefined ? customDur : ((item as any).duration ?? 0);
                    items.push({ name: item.name, price, duration });
                    total += price;
                    totalMinutes += duration;
                }
            });
        }

        return { items, total, totalMinutes };
    }, [selectedBaseService, selectedSizeId, selectedStyles, selectedExtras, sizeCategory, styleCategory, extrasCategory, currentStylist]);

    // Deduplicación: Recordar última cotización guardada para evitar duplicar registros si no se ha modificado nada
    const [lastSavedQuote, setLastSavedQuote] = useState<{ quote: Quote; hash: string } | null>(null);

    const currentConfigHash = useMemo(() => {
        return JSON.stringify({
            svc: selectedBaseServiceId,
            stylist: selectedStylistId,
            size: selectedSizeId,
            styles: selectedStyles,
            extras: selectedExtras,
            img: uploadedImageUrl || referenceImage,
            total: quoteBreakdown.total,
            dur: quoteBreakdown.totalMinutes
        });
    }, [selectedBaseServiceId, selectedStylistId, selectedSizeId, selectedStyles, selectedExtras, uploadedImageUrl, referenceImage, quoteBreakdown]);

    // Reset all selections
    const handleReset = () => {
        if (baseServices.length > 0) {
            setSelectedBaseServiceId(String(baseServices[0].id));
        } else {
            setSelectedBaseServiceId('');
        }
        if (sizeCategory && sizeCategory.items.length > 0) {
            setSelectedSizeId(sizeCategory.items[0].id);
        } else {
            setSelectedSizeId('');
        }
        setSelectedStyles({});
        setSelectedExtras({});
        setReferenceImage(null);
        setUploadedImageUrl(null);
        setLastSavedQuote(null);
    };

    // Save current quote to Supabase database
    const saveQuoteToDatabase = async (): Promise<Quote | null> => {
        if (!selectedBaseService) {
            showToast('Selecciona un servicio base para cotizar', 'error');
            return null;
        }

        if (!referenceImage && !uploadedImageUrl) {
            showToast('📸 Debes subir o pegar la foto del diseño de referencia (es obligatoria para cotizar)', 'error');
            return null;
        }

        // Si esta misma cotización ya se guardó y no ha cambiado nada, reutilizarla
        if (lastSavedQuote && lastSavedQuote.hash === currentConfigHash) {
            return lastSavedQuote.quote;
        }

        try {
            const sizeItem = sizeCategory?.items.find(i => i.id === selectedSizeId);

            const stylesList = styleCategory?.items
                .filter(item => selectedStyles[item.id]?.checked)
                .map(item => {
                    const sel = selectedStyles[item.id];
                    const customPrice = currentStylist?.customQuoterConfig?.[item.id];
                    const unitPrice = customPrice !== undefined ? customPrice : item.price;
                    const customDur = currentStylist?.customQuoterConfig?.[`${item.id}_dur`];
                    const unitDur = customDur !== undefined ? customDur : ((item as any).duration ?? 0);
                    const qty = item.unit ? sel.qty : 1;
                    return {
                        id: item.id,
                        name: item.name,
                        qty,
                        price: unitPrice * qty,
                        duration: unitDur * qty,
                        unit: item.unit
                    };
                }) || [];

            const extrasList = extrasCategory?.items
                .filter(item => selectedExtras[item.id])
                .map(item => {
                    const customPrice = currentStylist?.customQuoterConfig?.[item.id];
                    const price = customPrice !== undefined ? customPrice : item.price;
                    const customDur = currentStylist?.customQuoterConfig?.[`${item.id}_dur`];
                    const duration = customDur !== undefined ? customDur : ((item as any).duration ?? 0);
                    return {
                        id: item.id,
                        name: item.name,
                        price,
                        duration
                    };
                }) || [];

            const saved = await createQuote({
                serviceId: selectedBaseService.id,
                stylistId: selectedStylistId ? Number(selectedStylistId) : null,
                sizeId: selectedSizeId || null,
                sizeName: sizeItem?.name || null,
                styles: stylesList,
                extras: extrasList,
                referenceImageUrl: uploadedImageUrl || referenceImage,
                totalPrice: quoteBreakdown.total,
                totalDuration: quoteBreakdown.totalMinutes,
            });

            if (saved) {
                setLastSavedQuote({ quote: saved, hash: currentConfigHash });
            }

            return saved;
        } catch (err) {
            console.error('Error al registrar cotización:', err);
            return null;
        }
    };

    const handleSaveOnlyQuote = async () => {
        if (!selectedBaseService) {
            showToast('Selecciona un servicio base para guardar la cotización', 'error');
            return;
        }
        if (lastSavedQuote && lastSavedQuote.hash === currentConfigHash) {
            showToast('Esta cotización ya se encuentra guardada en tu Historial 📋', 'info');
            setActiveTab('history');
            return;
        }
        const saved = await saveQuoteToDatabase();
        if (saved) {
            showToast('¡Cotización guardada exitosamente en tu Historial! 📋', 'success');
            setActiveTab('history');
        }
    };

    // Generate online booking link
    const buildBookingUrl = (quoteId?: string) => {
        const slug = businessConfig?.slug || businessConfig?.brandSlug || '';
        if (!slug || !selectedBaseService) return '';
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.citalink.app';
        
        if (quoteId) {
            return `${origin}/reserva/${slug}?quote=${quoteId}`;
        }

        const params = new URLSearchParams();
        params.set('svc', String(selectedBaseService.id));
        if (selectedSizeId) params.set('size', selectedSizeId);
        if (selectedStylistId) params.set('stylist', selectedStylistId);
        if (uploadedImageUrl) params.set('ref', uploadedImageUrl);
        
        const activeExtras = Object.entries(selectedExtras)
            .filter(([_, active]) => active)
            .map(([id]) => id);
        if (activeExtras.length > 0) {
            params.set('extras', activeExtras.join(','));
        }

        return `${origin}/reserva/${slug}?${params.toString()}`;
    };

    const handleCopyWhatsAppText = async () => {
        const savedQuote = await saveQuoteToDatabase();
        if (!savedQuote) return;
        const bookingUrl = buildBookingUrl(savedQuote.id);
        const text = `📅 Puedes agendar tu cita en el día y hora que prefieras desde este enlace:\n${bookingUrl}`;

        try {
            await navigator.clipboard.writeText(text);
            showToast('¡Texto copiado para WhatsApp y guardado en tu historial! 💬', 'success');
        } catch (_) {
            showToast('No se pudo copiar el texto automáticamente.', 'error');
        }
    };

    const handleCopyBookingLinkOnly = async () => {
        const savedQuote = await saveQuoteToDatabase();
        if (!savedQuote) return;
        const bookingUrl = buildBookingUrl(savedQuote.id);

        try {
            await navigator.clipboard.writeText(bookingUrl);
            showToast('¡Enlace único copiado y guardado en tu historial! 🔗', 'success');
        } catch (_) {
            showToast('No se pudo copiar el enlace automáticamente.', 'error');
        }
    };

    const captureQuoteCanvas = async () => {
        if (!ticketRef.current) return null;
        return await html2canvas(ticketRef.current, {
            backgroundColor: null,
            scale: 3,
            logging: false,
            useCORS: true,
            allowTaint: true,
            onclone: (clonedDoc) => {
                if (clonedDoc.documentElement) {
                    (clonedDoc.documentElement.style as any).zoom = '1';
                }
                if (clonedDoc.body) {
                    (clonedDoc.body.style as any).zoom = 'normal';
                    clonedDoc.body.style.minHeight = 'auto';
                }

                const clonedEl = clonedDoc.getElementById('printable-quote-card');
                if (clonedEl) {
                    clonedEl.style.width = '480px';
                    clonedEl.style.minWidth = '480px';
                    clonedEl.style.maxWidth = '480px';
                    clonedEl.style.margin = '0 auto';
                    clonedEl.style.boxSizing = 'border-box';
                    clonedEl.style.transform = 'none';

                    const allElements = clonedEl.querySelectorAll('*');
                    allElements.forEach((node) => {
                        const el = node as HTMLElement;
                        if (el.style) {
                            el.style.backdropFilter = 'none';
                            (el.style as any).webkitBackdropFilter = 'none';
                            el.style.letterSpacing = 'normal';
                            el.style.wordSpacing = 'normal';
                            const tagName = el.tagName.toLowerCase();
                            if (tagName === 'h3' || tagName === 'p' || tagName === 'span') {
                                el.style.lineHeight = '1.3';
                            }
                        }
                    });
                }
            }
        });
    };

    const handleDownloadImage = async () => {
        const savedQuote = await saveQuoteToDatabase();
        if (!savedQuote) return;
        try {
            const canvas = await captureQuoteCanvas();
            if (!canvas) return;
            
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `cotizacion-${businessConfig.name?.replace(/\s+/g, '-').toLowerCase() || 'uñas'}.png`;
            link.href = dataUrl;
            link.click();
            showToast('¡Foto de cotización descargada y guardada en historial! 🎨', 'success');
        } catch (error) {
            console.error('Error generating image:', error);
            showToast('Error al generar la imagen', 'error');
        }
    };

    const handleCopyImage = async () => {
        const savedQuote = await saveQuoteToDatabase();
        if (!savedQuote) return;
        try {
            const canvas = await captureQuoteCanvas();
            if (!canvas) return;
            
            canvas.toBlob((blob) => {
                if (blob) {
                    navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]).then(() => {
                        showToast('¡Foto de cotización copiada! 📋 Pégala en WhatsApp.', 'success');
                    }).catch(err => {
                        console.error('Clipboard write error:', err);
                        showToast('No se pudo copiar la imagen automáticamente. Descárgala en PNG.', 'error');
                    });
                }
            }, 'image/png');
        } catch (error) {
            console.error('Error generating image:', error);
            showToast('Error al generar la imagen', 'error');
        }
    };

    // Filtered quotes in history
    const pendingQuotesCount = useMemo(() => quotes.filter(q => q.status === 'pendiente').length, [quotes]);

    const filteredQuotes = useMemo(() => {
        return quotes.filter(q => {
            if (historyFilter === 'pending' && q.status !== 'pendiente') return false;
            if (historyFilter === 'booked' && q.status !== 'agendada') return false;
            if (historySearch.trim()) {
                const term = historySearch.toLowerCase();
                const serviceName = services.find(s => Number(s.id) === Number(q.serviceId))?.name?.toLowerCase() || '';
                const stylistName = stylists.find(s => Number(s.id) === Number(q.stylistId))?.name?.toLowerCase() || '';
                const clientName = q.clientName?.toLowerCase() || '';
                const clientPhone = q.clientPhone || '';
                return serviceName.includes(term) || stylistName.includes(term) || clientName.includes(term) || clientPhone.includes(term);
            }
            return true;
        });
    }, [quotes, historyFilter, historySearch, services, stylists]);

    const handleDeleteQuote = async (quoteId: string) => {
        await deleteQuote(quoteId);
        setQuoteToDelete(null);
    };

    const openLightbox = (src: string) => {
        setModalImageSrc(src);
        setIsPhotoModalOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-10 h-10 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
            </div>
        );
    }

    if (userRole === 'employee' && userStylistId && !qualifiedStylists.some(st => st.id === userStylistId)) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
                <Calculator size={48} className="text-slate-500 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Cotizador no Disponible</h2>
                <p className="text-slate-400 max-w-md text-sm">Tu perfil de colaborador no tiene asignados servicios con cotizador de uñas.</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #printable-quote-card, #printable-quote-card * {
                        visibility: visible;
                    }
                    #printable-quote-card {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white !important;
                        color: black !important;
                        border: none !important;
                        box-shadow: none !important;
                    }
                    #printable-quote-card * {
                        color: black !important;
                    }
                }
            `}</style>

            {/* Header with Title and Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Calculator className="text-accent" /> Cotizador de Uñas
                    </h2>
                    <p className="text-sm text-muted mt-1">Calcula presupuestos, genera enlaces inteligentes y gestiona tus cotizaciones.</p>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-2xl border border-white/10 self-start md:self-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('calculator')}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                            activeTab === 'calculator'
                                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/20'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Calculator size={15} />
                        <span>Cotizador</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                            activeTab === 'history'
                                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/20'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <History size={15} />
                        <span>Historial</span>
                        {pendingQuotesCount > 0 && (
                            <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
                                {pendingQuotesCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ═════════ TAB 1: CALCULATOR / COTIZADOR ═════════ */}
            {activeTab === 'calculator' && (
                <>
                    <div className="flex items-center justify-end gap-3 -mt-2">
                        {qualifiedStylists.length > 1 && (
                            <div className="flex items-center gap-2 bg-slate-900/80 border border-white/10 px-3 py-2 rounded-2xl">
                                <User size={16} className="text-accent" />
                                <select
                                    value={selectedStylistId}
                                    onChange={e => setSelectedStylistId(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                                >
                                    <option value="" className="bg-slate-900 text-white">General / Sin asignar</option>
                                    {qualifiedStylists.map(st => (
                                        <option key={st.id} value={st.id} className="bg-slate-900 text-white">
                                            Cotizar con: {st.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={handleReset}
                            className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                        >
                            <RotateCcw size={14} />
                            <span>Limpiar</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        
                        {/* ── Left Side: Interactive Calculator Form ── */}
                        <div className="lg:col-span-7 space-y-6">
                            
                            {/* Reference Design Photo Uploader */}
                            <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-3 bg-slate-900/60 shadow-xl">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <ImageIcon size={17} className="text-pink-400" /> Foto del Diseño a Cotizar
                                        <span className="text-pink-300 font-extrabold text-[11px] bg-pink-500/20 border border-pink-500/35 px-2 py-0.5 rounded-full">
                                            Obligatoria *
                                        </span>
                                        {isUploadingPhoto && (
                                            <span className="text-[11px] text-cyan-400 flex items-center gap-1 font-normal">
                                                <Loader2 size={12} className="animate-spin" /> Guardando en la nube...
                                            </span>
                                        )}
                                    </h3>
                                    {referenceImage && (
                                        <button
                                            type="button"
                                            onClick={() => { setReferenceImage(null); setUploadedImageUrl(null); }}
                                            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold transition-colors bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20"
                                        >
                                            <Trash2 size={13} /> Eliminar Foto
                                        </button>
                                    )}
                                </div>

                                {!referenceImage ? (
                                    <label className="border-2 border-dashed border-pink-400/40 hover:border-pink-400 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-center gap-3 cursor-pointer bg-slate-950/50 hover:bg-pink-500/5 transition-all text-center sm:text-left group shadow-inner">
                                        <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0 group-hover:scale-110 transition-transform shadow-lg shadow-pink-500/10">
                                            <Upload size={18} />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-bold text-slate-200">
                                                Subir foto o presionar <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-[10px] text-pink-300 font-mono">Ctrl + V</kbd> para pegar desde WhatsApp
                                            </p>
                                            <p className="text-[11px] text-pink-300/80 font-medium">
                                                * Requerida para que se guarde en tu historial y se asigne automáticamente a la cita de la clienta.
                                            </p>
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                        />
                                    </label>
                                ) : (
                                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/70 p-3 rounded-xl border border-white/10">
                                        <div
                                            onClick={() => openLightbox(referenceImage)}
                                            className="relative w-full sm:w-28 h-28 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-slate-900 shadow-md cursor-pointer group"
                                            title="Haz clic para ver en pantalla completa"
                                        >
                                            <img
                                                decoding="async" loading="lazy"
                                                src={referenceImage}
                                                alt="Diseño de referencia"
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1 font-bold text-xs">
                                                <Maximize2 size={16} />
                                                <span>Ampliar</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-2 text-left w-full">
                                            <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                                ✨ Foto guardada y lista para la reserva
                                            </p>
                                            <p className="text-[11px] text-slate-300">
                                                Esta imagen se vinculará directamente a la cita cuando la clienta reserve o cuando tú la agendes.
                                            </p>
                                            <div className="flex items-center gap-3 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => openLightbox(referenceImage)}
                                                    className="px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/30 text-pink-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
                                                >
                                                    <Eye size={14} /> Ampliar Foto 🔍
                                                </button>
                                                <label className="text-[11px] text-slate-400 hover:text-slate-200 font-bold cursor-pointer underline flex items-center gap-1">
                                                    <Upload size={12} /> Cambiar Foto
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleImageUpload}
                                                        className="hidden"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Base Services */}
                            {baseServices.length > 0 && (
                                <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <h3 className="text-md font-bold text-white flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-accent"></span> Servicio Principal (Base)
                                        </h3>
                                        <span className="text-xs text-slate-400 font-semibold">
                                            {baseServices.length} disponibles
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {baseServices.map(service => {
                                            const isSelected = selectedBaseServiceId === String(service.id);
                                            const customPrice = currentStylist?.customServicePrices?.[service.id]?.price;
                                            const effectivePrice = customPrice !== undefined ? customPrice : service.price;
                                            const customDuration = currentStylist?.customServicePrices?.[service.id]?.duration;
                                            const effectiveDuration = customDuration !== undefined ? customDuration : service.duration;

                                            return (
                                                <button
                                                    key={service.id}
                                                    type="button"
                                                    onClick={() => setSelectedBaseServiceId(prev => prev === String(service.id) ? '' : String(service.id))}
                                                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all duration-300 text-left ${
                                                        isSelected
                                                            ? 'bg-accent/15 border-accent text-white shadow-glow-sm'
                                                            : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0 pr-2">
                                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-accent bg-accent' : 'border-white/20 bg-slate-900'}`}>
                                                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="text-sm font-bold block truncate">{service.name}</span>
                                                            <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                                                <Clock size={11} className="text-slate-400" />
                                                                {effectiveDuration} min
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="font-extrabold text-accent text-sm shrink-0">
                                                        ${effectivePrice}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Sizes */}
                            {sizeCategory && (
                                <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <h3 className="text-md font-bold text-white flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-cyan-400"></span> {sizeCategory.name}
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        {sizeCategory.items.map(item => {
                                            const isSelected = selectedSizeId === item.id;
                                            const customPrice = currentStylist?.customQuoterConfig?.[item.id];
                                            const effectivePrice = customPrice !== undefined ? customPrice : item.price;
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => setSelectedSizeId(prev => prev === item.id ? '' : item.id)}
                                                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer select-none ${
                                                        isSelected
                                                            ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-glow-sm'
                                                            : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-400'
                                                    }`}
                                                >
                                                    <p className="text-xs font-bold leading-tight">{item.name}</p>
                                                    <p className="text-[11px] font-extrabold text-cyan-400 mt-1">
                                                        {effectivePrice > 0 ? `+$${effectivePrice}` : 'Sin costo'}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Styles & Nail Art */}
                            {styleCategory && (
                                <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <h3 className="text-md font-bold text-white flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> {styleCategory.name}
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                                        {styleCategory.items.map(item => {
                                            const isChecked = selectedStyles[item.id]?.checked || false;
                                            const qty = selectedStyles[item.id]?.qty || 1;
                                            const customPrice = currentStylist?.customQuoterConfig?.[item.id];
                                            const effectivePrice = customPrice !== undefined ? customPrice : item.price;
                                            const hasUnit = !!item.unit;

                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                                                        isChecked
                                                            ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                                                            : 'bg-white/5 border-white/10 text-slate-400'
                                                    }`}
                                                >
                                                    <div
                                                        onClick={() => {
                                                            setSelectedStyles(prev => ({
                                                                ...prev,
                                                                [item.id]: {
                                                                    checked: !prev[item.id]?.checked,
                                                                    qty: prev[item.id]?.qty || 1
                                                                }
                                                            }));
                                                        }}
                                                        className="flex items-center justify-between cursor-pointer select-none"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${isChecked ? 'border-emerald-500 bg-emerald-500' : 'border-white/20 bg-slate-900'}`}>
                                                                {isChecked && <span className="text-[10px] text-slate-950 font-black">✓</span>}
                                                            </div>
                                                            <span className="text-xs font-bold leading-snug">{item.name}</span>
                                                        </div>
                                                        <span className="text-xs font-extrabold text-emerald-400 shrink-0">
                                                            ${effectivePrice} {hasUnit ? 'c/u' : ''}
                                                        </span>
                                                    </div>

                                                    {isChecked && hasUnit && (
                                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-emerald-500/20 text-xs">
                                                            <span className="text-[11px] text-emerald-300 font-medium">Cantidad:</span>
                                                            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedStyles(prev => ({
                                                                            ...prev,
                                                                            [item.id]: { checked: true, qty: Math.max(1, (prev[item.id]?.qty || 1) - 1) }
                                                                        }));
                                                                    }}
                                                                    className="p-1 hover:text-white text-emerald-400"
                                                                >
                                                                    <Minus size={12} />
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max="100"
                                                                    value={qty}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onChange={(e) => {
                                                                        e.stopPropagation();
                                                                        const val = parseInt(e.target.value, 10);
                                                                        setSelectedStyles(prev => ({
                                                                            ...prev,
                                                                            [item.id]: { checked: true, qty: isNaN(val) ? 1 : Math.max(1, Math.min(100, val)) }
                                                                        }));
                                                                    }}
                                                                    className="w-8 text-center bg-transparent font-black text-xs text-white focus:outline-none p-0"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedStyles(prev => ({
                                                                            ...prev,
                                                                            [item.id]: { checked: true, qty: (prev[item.id]?.qty || 1) + 1 }
                                                                        }));
                                                                    }}
                                                                    className="p-1 hover:text-white text-emerald-400"
                                                                >
                                                                    <Plus size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Extras / Retiros */}
                            {extrasCategory && (
                                <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <h3 className="text-md font-bold text-white flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-pink-400"></span> {extrasCategory.name}
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                                        {extrasCategory.items.map(item => {
                                            const isChecked = !!selectedExtras[item.id];
                                            const customPrice = currentStylist?.customQuoterConfig?.[item.id];
                                            const effectivePrice = customPrice !== undefined ? customPrice : item.price;
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => setSelectedExtras(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                                    className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none text-left ${
                                                        isChecked
                                                            ? 'bg-pink-500/15 border-pink-400 text-white shadow-glow-sm'
                                                            : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-400'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${isChecked ? 'border-pink-400 bg-pink-500' : 'border-white/20 bg-slate-900'}`}>
                                                            {isChecked && <span className="text-[10px] text-slate-950 font-black">✓</span>}
                                                        </div>
                                                        <span className="text-xs font-bold leading-snug">{item.name}</span>
                                                    </div>
                                                    <span className="text-xs font-extrabold text-pink-400 shrink-0">
                                                        +${effectivePrice}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* ── Right Side: Live Ticket Card & Actions ── */}
                        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
                            
                            {/* Card Theme Selector & Reset Button */}
                            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 p-2 rounded-2xl border border-white/10">
                                <div className="flex items-center gap-1.5">
                                    <Sparkles size={14} className="text-pink-400" />
                                    <div className="flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setCardTheme('pink')}
                                            className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                                                cardTheme === 'pink' ? 'bg-pink-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            🌸 Rosa Chic
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCardTheme('dark')}
                                            className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                                                cardTheme === 'dark' ? 'bg-slate-800 text-white shadow-md border border-white/20' : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            🖤 Dark
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCardTheme('gold')}
                                            className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                                                cardTheme === 'gold' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            👑 Oro
                                        </button>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="px-3 py-1 rounded-xl bg-white/10 hover:bg-red-500/20 text-slate-300 hover:text-red-300 font-bold text-xs border border-white/10 hover:border-red-500/30 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer ml-auto"
                                    title="Limpiar y reiniciar cotizador"
                                >
                                    <RotateCcw size={13} className="text-red-400" />
                                    <span>Limpiar</span>
                                </button>
                            </div>

                            {/* Ticket Card */}
                            <div
                                ref={ticketRef}
                                id="printable-quote-card"
                                className={`p-6 rounded-3xl transition-all duration-300 shadow-2xl relative overflow-hidden text-slate-900 border ${
                                    cardTheme === 'pink'
                                        ? 'bg-gradient-to-br from-pink-100 via-rose-50 to-pink-200 border-pink-300 shadow-pink-500/10'
                                        : cardTheme === 'gold'
                                        ? 'bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-200 border-amber-300 shadow-amber-500/10'
                                        : 'bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-slate-700 text-white shadow-cyan-500/5'
                                }`}
                            >
                                {/* Header / Logo */}
                                <div className="text-center pb-4 border-b border-black/5 relative z-10">
                                    {(businessConfig?.logoUrl || businessConfig?.logo) ? (
                                        <img
                                            decoding="async" loading="lazy"
                                            src={businessConfig.logoUrl || businessConfig.logo}
                                            alt={businessConfig.name || 'Logo'}
                                            className="w-14 h-14 rounded-full mx-auto object-cover border-2 border-white shadow-md mb-2 bg-white"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center mx-auto mb-2 text-lg font-black shadow-md">
                                            💅
                                        </div>
                                    )}
                                    <h3 className="font-extrabold text-lg tracking-tight leading-snug">
                                        {businessConfig.name || 'Salón de Belleza'}
                                    </h3>
                                    <p className={`text-xs font-semibold ${cardTheme === 'pink' ? 'text-pink-600' : cardTheme === 'gold' ? 'text-amber-700' : 'text-slate-400'}`}>
                                        Tu Cotización de Uñas ✨
                                    </p>
                                    {currentStylist && (
                                        <div className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold bg-white/70 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-black/5 shadow-xs">
                                            <span>✨ Atendido por:</span>
                                            <span className="underline">{currentStylist.name}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Inner breakdown box */}
                                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 my-4 shadow-sm border border-black/5">
                                    <div className={`flex items-center gap-1.5 pb-2 mb-2 border-b font-bold text-xs ${
                                        cardTheme === 'pink' ? 'border-pink-100 text-pink-700' : cardTheme === 'gold' ? 'border-amber-100 text-amber-800' : 'border-white/10 text-slate-700'
                                    }`}>
                                        <span className="text-sm">💅</span>
                                        <span>Tus Servicios Seleccionados</span>
                                    </div>

                                    <div className="space-y-2 min-h-[60px]">
                                        {quoteBreakdown.items.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic text-center py-4">
                                                Selecciona las opciones para ver tu resumen...
                                            </p>
                                        ) : (
                                            quoteBreakdown.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-xs pb-1.5 border-b border-black/5 last:border-0 last:pb-0">
                                                    <div className="text-left pr-2">
                                                        <p className="font-bold leading-snug">{item.name}</p>
                                                        {item.detail && (
                                                            <p className={`text-[10px] ${
                                                                cardTheme === 'pink' ? 'text-pink-600 font-semibold' : cardTheme === 'gold' ? 'text-amber-700 font-semibold' : 'text-slate-500'
                                                            }`}>
                                                                {item.detail}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className={`font-black text-sm shrink-0 ${
                                                        cardTheme === 'pink' ? 'text-pink-700' : cardTheme === 'gold' ? 'text-amber-800' : 'text-emerald-600'
                                                    }`}>
                                                        ${item.price}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Total & Duration */}
                                    <div className={`mt-3 pt-3 border-t flex justify-between items-center ${
                                        cardTheme === 'pink' ? 'border-pink-200' : cardTheme === 'gold' ? 'border-amber-200' : 'border-slate-200'
                                    }`}>
                                        <div>
                                            <span className={`text-[10px] uppercase font-black tracking-wider block ${
                                                cardTheme === 'pink' ? 'text-pink-600' : cardTheme === 'gold' ? 'text-amber-700' : 'text-slate-500'
                                            }`}>
                                                TOTAL A PAGAR
                                            </span>
                                            <p className="text-2xl font-black leading-none mt-0.5 text-slate-900">
                                                ${quoteBreakdown.total} <span className="text-xs font-semibold">MXN</span>
                                            </p>
                                            {quoteBreakdown.totalMinutes > 0 && (
                                                <p className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${
                                                    cardTheme === 'pink' ? 'text-pink-700' : cardTheme === 'gold' ? 'text-amber-800' : 'text-slate-700'
                                                }`}>
                                                    <Clock size={12} />
                                                    <span>Tiempo: {formatDurationDisplay(quoteBreakdown.totalMinutes)}</span>
                                                </p>
                                            )}
                                        </div>
                                        <div className={`px-3 py-1.5 rounded-full font-bold text-xs tracking-wide border leading-none shrink-0 ${
                                            cardTheme === 'pink'
                                                ? 'bg-pink-50 border-pink-200 text-pink-700'
                                                : cardTheme === 'gold'
                                                ? 'bg-amber-50 border-amber-200 text-amber-800'
                                                : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                        }`}>
                                            <span>Tu Cotización ✨</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-center relative z-10">
                                    <p className={`text-[10px] font-bold tracking-wide ${
                                        cardTheme === 'pink' ? 'text-pink-900/80' : cardTheme === 'gold' ? 'text-amber-950/80' : 'text-slate-400'
                                    }`}>
                                        ¡Gracias por tu preferencia! 💕 • Te esperamos pronto
                                    </p>
                                </div>
                            </div>

                            {/* Instrucción Rápida: Captura & Guardado */}
                            <div className="p-3.5 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-left flex items-start gap-3 shadow-inner">
                                <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 shrink-0 mt-0.5">
                                    <Camera size={18} />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-pink-300">
                                        📸 Envío de Cotización por WhatsApp
                                    </p>
                                    <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                                        Toma una <strong>captura de pantalla</strong> a la tarjeta de arriba para enviarla por WhatsApp y presiona <strong className="text-white">Guardar en Historial</strong> para tener la cotización lista en tu panel.
                                    </p>
                                </div>
                            </div>

                            {/* Actions Group */}
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={handleSaveOnlyQuote}
                                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-400 hover:to-rose-500 text-white font-black text-sm tracking-wide shadow-xl shadow-pink-500/25 border border-pink-400/30 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                                >
                                    <History size={18} />
                                    <span>Guardar en Historial</span>
                                </button>

                                {/* Barra Desplegable para Opciones de Descarga de Imagen */}
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setShowImageExportOptions(!showImageExportOptions)}
                                        className="w-full px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white flex items-center justify-between transition-colors cursor-pointer"
                                    >
                                        <span className="flex items-center gap-2">
                                            <ImageIcon size={14} className="text-pink-400" />
                                            <span>Opciones de exportación de imagen (Descargar/Copiar)</span>
                                        </span>
                                        {showImageExportOptions ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                                    </button>
                                    
                                    {showImageExportOptions && (
                                        <div className="p-3 pt-1 space-y-2 border-t border-white/5 animate-fade-in">
                                            <button
                                                type="button"
                                                onClick={handleDownloadImage}
                                                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                                            >
                                                <Download size={15} className="text-pink-400" />
                                                <span>Descargar Cotización en Imagen (PNG)</span>
                                            </button>
                                            
                                            <button
                                                type="button"
                                                onClick={handleCopyImage}
                                                className="w-full py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                                            >
                                                <ImageIcon size={15} className="text-cyan-400" />
                                                <span>Copiar Imagen para Pegar en WhatsApp</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* WhatsApp Booking Link Box */}
                                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2.5 text-left">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <MessageCircle size={14} /> Link de Reserva para WhatsApp
                                        </span>
                                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                                            Con Foto Automática
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                                        Envía este enlace a tu clienta. Al abrirlo, se le cargará su servicio, diseño, precio y foto sin tener que buscar nada:
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={handleCopyWhatsAppText}
                                            className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                                        >
                                            <MessageCircle size={15} />
                                            <span>Copiar Mensaje WhatsApp</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCopyBookingLinkOnly}
                                            className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 active:scale-95 transition-all cursor-pointer"
                                        >
                                            <LinkIcon size={14} />
                                            <span>Copiar Solo Enlace</span>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-slate-400 hover:text-red-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                                >
                                    <RotateCcw size={14} className="text-red-400" />
                                    <span>Limpiar Ticket / Empezar Nueva Cotización</span>
                                </button>
                            </div>

                        </div>

                    </div>
                </>
            )}

            {/* ═════════ TAB 2: QUOTES HISTORY (CRM) ═════════ */}
            {activeTab === 'history' && (
                <div className="space-y-6 animate-fade-in text-left">
                    {/* Filters & Search Bar */}
                    <div className="glass-card p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <button
                                type="button"
                                onClick={() => setHistoryFilter('all')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    historyFilter === 'all'
                                        ? 'bg-pink-500 text-white shadow-md'
                                        : 'bg-white/5 text-slate-400 hover:text-white'
                                }`}
                            >
                                Todas ({quotes.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setHistoryFilter('pending')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    historyFilter === 'pending'
                                        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                                        : 'bg-white/5 text-slate-400 hover:text-white'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                Pendientes ({pendingQuotesCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => setHistoryFilter('booked')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    historyFilter === 'booked'
                                        ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                                        : 'bg-white/5 text-slate-400 hover:text-white'
                                }`}
                            >
                                Agendadas ({quotes.filter(q => q.status === 'agendada').length})
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full md:w-72">
                            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value)}
                                placeholder="Buscar por servicio, profesional..."
                                className="w-full pl-9 pr-4 py-1.5 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:border-pink-400 outline-none transition-colors"
                            />
                            {historySearch && (
                                <button
                                    type="button"
                                    onClick={() => setHistorySearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Quotation List */}
                    {filteredQuotes.length === 0 ? (
                        <div className="glass-card p-12 rounded-3xl border border-white/10 text-center space-y-3">
                            <div className="w-16 h-16 rounded-full bg-pink-500/10 text-pink-400 flex items-center justify-center mx-auto border border-pink-500/20">
                                <History size={32} />
                            </div>
                            <h4 className="text-lg font-bold text-white">No se encontraron cotizaciones</h4>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                Las cotizaciones que calcules y compartas con tus clientas se guardarán aquí automáticamente.
                            </p>
                            <button
                                type="button"
                                onClick={() => setActiveTab('calculator')}
                                className="mt-2 px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-xs transition-all inline-flex items-center gap-2"
                            >
                                <Calculator size={14} /> Crear Nueva Cotización
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredQuotes.map((quote) => {
                                const serviceName = services.find(s => Number(s.id) === Number(quote.serviceId))?.name || 'Servicio de Uñas';
                                const stylistName = stylists.find(s => Number(s.id) === Number(quote.stylistId))?.name;
                                const isBooked = quote.status === 'agendada';
                                const quoteUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://www.citalink.app'}/reserva/${businessConfig?.slug || businessConfig?.brandSlug || ''}?quote=${quote.id}`;

                                return (
                                    <div
                                        key={quote.id}
                                        className={`glass-card rounded-2xl border p-4 transition-all duration-300 flex flex-col justify-between space-y-3 ${
                                            isBooked
                                                ? 'bg-emerald-500/[0.03] border-emerald-500/30'
                                                : 'bg-slate-900/70 border-white/10 hover:border-pink-500/30'
                                        }`}
                                    >
                                        <div>
                                            {/* Header with status badge & date */}
                                            <div className="flex items-center justify-between gap-2 mb-3">
                                                {isBooked ? (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                                        <CheckCircle size={11} /> Agendada
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Pendiente
                                                    </span>
                                                )}

                                                <span className="text-[11px] text-slate-400 font-medium">
                                                    {format(new Date(quote.createdAt), 'd MMM, h:mm a', { locale: es })}
                                                </span>
                                            </div>

                                            {/* Main Info: Photo & Service */}
                                            <div className="flex gap-3 items-start">
                                                {quote.referenceImageUrl ? (
                                                    <div
                                                        onClick={() => openLightbox(quote.referenceImageUrl!)}
                                                        className="w-16 h-16 rounded-xl overflow-hidden border border-white/15 bg-black shrink-0 cursor-pointer relative group"
                                                        title="Ver foto de referencia"
                                                    >
                                                        <img src={quote.referenceImageUrl} alt="Diseño" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                            <Maximize2 size={13} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="w-16 h-16 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20 flex items-center justify-center shrink-0">
                                                        <ImageIcon size={22} />
                                                    </div>
                                                )}

                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-bold text-white leading-tight truncate">
                                                        {serviceName}
                                                    </h4>
                                                    {quote.sizeName && (
                                                        <span className="inline-block text-[11px] font-semibold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded mt-1">
                                                            {quote.sizeName}
                                                        </span>
                                                    )}
                                                    {stylistName && (
                                                        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 truncate">
                                                            <User size={11} className="text-pink-400" /> {stylistName}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Styles / Extras details preview */}
                                            {((quote.styles && quote.styles.length > 0) || (quote.extras && quote.extras.length > 0)) && (
                                                <div className="mt-3 pt-2 border-t border-white/5 text-[11px] text-slate-300 space-y-1">
                                                    {quote.styles?.map((st: any, i: number) => (
                                                        <div key={i} className="flex justify-between">
                                                            <span className="text-slate-400 truncate pr-2">• {st.name}{st.qty > 1 ? ` (x${st.qty})` : ''}</span>
                                                            <span className="font-semibold text-slate-200">+${st.price}</span>
                                                        </div>
                                                    ))}
                                                    {quote.extras?.map((ex: any, i: number) => (
                                                        <div key={i} className="flex justify-between">
                                                            <span className="text-slate-400 truncate pr-2">• {ex.name}</span>
                                                            <span className="font-semibold text-pink-300">+${ex.price}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Price & Duration */}
                                            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Total Cotizado</span>
                                                    <span className="text-lg font-black text-emerald-400 leading-tight">
                                                        ${quote.totalPrice} <span className="text-[10px] font-normal text-slate-400">MXN</span>
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Duración</span>
                                                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1 justify-end">
                                                        <Clock size={11} className="text-cyan-400" /> {quote.totalDuration} min
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="pt-2 border-t border-white/10 space-y-2">
                                            {!isBooked ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedQuoteForBooking(quote);
                                                        setIsDirectBookingModalOpen(true);
                                                    }}
                                                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-extrabold text-xs shadow-md shadow-pink-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                                >
                                                    <CalendarPlus size={14} />
                                                    <span>Agendar Cita Directamente</span>
                                                </button>
                                            ) : (
                                                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-xs font-bold text-emerald-300">
                                                    ✓ Cita agendada en tu calendario
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const text = `📅 Puedes agendar tu cita en el día y hora que prefieras desde este enlace:\n${quoteUrl}`;
                                                        navigator.clipboard.writeText(text);
                                                        showToast('¡Texto copiado para WhatsApp! 💬', 'success');
                                                    }}
                                                    className="py-2 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                                >
                                                    <MessageCircle size={13} />
                                                    <span>WhatsApp</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(quoteUrl);
                                                        showToast('¡Enlace de reserva copiado! 🔗', 'success');
                                                    }}
                                                    className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                                >
                                                    <LinkIcon size={12} />
                                                    <span>Copiar Link</span>
                                                </button>
                                            </div>

                                            {/* Delete quote button */}
                                            <div className="pt-1 flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => setQuoteToDelete(quote.id)}
                                                    className="text-[11px] text-slate-500 hover:text-red-400 font-semibold flex items-center gap-1 transition-colors py-1 px-2"
                                                >
                                                    <Trash2 size={12} /> Invalidad / Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Confirmación de eliminación de cotización */}
            {quoteToDelete && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in text-left">
                    <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto">
                            <AlertCircle size={24} />
                        </div>
                        <div className="text-center space-y-1">
                            <h4 className="text-base font-bold text-white">¿Eliminar esta cotización?</h4>
                            <p className="text-xs text-slate-400">
                                Al eliminarla, el enlace enviado a la clienta quedará <strong>invalidado de inmediato</strong> y ya no podrá agendar con ese precio o diseño.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setQuoteToDelete(null)}
                                className="py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDeleteQuote(quoteToDelete)}
                                disabled={isDeleting}
                                className="py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs transition-colors disabled:opacity-50"
                            >
                                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Direct Booking from Quote */}
            <QuoteDirectBookingModal
                quote={selectedQuoteForBooking}
                isOpen={isDirectBookingModalOpen}
                onClose={() => {
                    setIsDirectBookingModalOpen(false);
                    setSelectedQuoteForBooking(null);
                }}
            />

            {/* Lightbox Modal: Full Screen Reference Photo */}
            {isPhotoModalOpen && modalImageSrc && (
                <div
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setIsPhotoModalOpen(false)}
                >
                    <div
                        className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-white/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950/90 text-left">
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                <ImageIcon size={16} className="text-pink-400" /> Diseño de Referencia
                            </h4>
                            <button
                                type="button"
                                onClick={() => setIsPhotoModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-3 overflow-auto flex items-center justify-center bg-slate-950/90">
                            <img
                                decoding="async" loading="lazy"
                                src={modalImageSrc}
                                alt="Diseño de referencia a detalle"
                                className="max-h-[78vh] w-auto object-contain rounded-lg shadow-xl"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
