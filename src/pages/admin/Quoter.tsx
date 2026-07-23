import { useState, useMemo, useRef } from 'react';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useNailCalculator } from '../../lib/store/queries/useNailCalculator';
import { Calculator, Copy, Share2, Printer, Sparkles, Plus, Minus } from 'lucide-react';
import { useUIStore } from '../../lib/store/uiStore';
import html2canvas from 'html2canvas';

export default function Quoter() {
    const { showToast } = useUIStore();
    const { data: tenantConfig } = useTenantData();
    const businessConfig = tenantConfig || {} as any;
    const { config, isLoading } = useNailCalculator();
    
    const ticketRef = useRef<HTMLDivElement>(null);

    // Selection states
    const [selectedBaseId, setSelectedBaseId] = useState<string>('');
    const [selectedSizeId, setSelectedSizeId] = useState<string>('');
    const [selectedStyles, setSelectedStyles] = useState<Record<string, { checked: boolean; qty: number }>>({});
    const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({});
    const [cardTheme, setCardTheme] = useState<'pink' | 'dark' | 'gold'>('pink');

    // Categorized config items
    const baseCategory = useMemo(() => config.find(c => c.id === 'base_services'), [config]);
    const sizeCategory = useMemo(() => config.find(c => c.id === 'sizes'), [config]);
    const styleCategory = useMemo(() => config.find(c => c.id === 'styles'), [config]);
    const extrasCategory = useMemo(() => config.find(c => c.id === 'extras'), [config]);

    // Set initial base and size on config load
    useMemo(() => {
        if (baseCategory && baseCategory.items.length > 0 && !selectedBaseId) {
            setSelectedBaseId(baseCategory.items[0].id);
        }
        if (sizeCategory && sizeCategory.items.length > 0 && !selectedSizeId) {
            setSelectedSizeId(sizeCategory.items[0].id);
        }
    }, [config, baseCategory, sizeCategory, selectedBaseId, selectedSizeId]);

    // Calculate details and prices
    const quoteBreakdown = useMemo(() => {
        const items: { name: string; price: number; detail?: string }[] = [];
        let total = 0;

        // Base service
        if (baseCategory) {
            const baseItem = baseCategory.items.find(i => i.id === selectedBaseId);
            if (baseItem) {
                items.push({ name: baseItem.name, price: baseItem.price });
                total += baseItem.price;
            }
        }

        // Size
        if (sizeCategory) {
            const sizeItem = sizeCategory.items.find(i => i.id === selectedSizeId);
            if (sizeItem) {
                items.push({ name: `${sizeCategory.name}: ${sizeItem.name}`, price: sizeItem.price });
                total += sizeItem.price;
            }
        }

        // Styles / Decor
        if (styleCategory) {
            styleCategory.items.forEach(item => {
                const selection = selectedStyles[item.id];
                if (selection?.checked) {
                    const hasUnit = !!item.unit;
                    const qty = hasUnit ? selection.qty : 1;
                    const price = item.price * qty;
                    let unitText = item.unit;
                    if (item.unit === 'por pieza') {
                        unitText = qty === 1 ? 'pieza' : 'piezas';
                    } else if (item.unit === 'por uña') {
                        unitText = qty === 1 ? 'uña' : 'uñas';
                    }
                    items.push({
                        name: item.name,
                        price,
                        detail: hasUnit ? `(${qty} ${unitText})` : undefined
                    });
                    total += price;
                }
            });
        }

        // Extras
        if (extrasCategory) {
            extrasCategory.items.forEach(item => {
                if (selectedExtras[item.id]) {
                    items.push({ name: item.name, price: item.price });
                    total += item.price;
                }
            });
        }

        return { items, total };
    }, [config, selectedBaseId, selectedSizeId, selectedStyles, selectedExtras, baseCategory, sizeCategory, styleCategory, extrasCategory]);

    // Reset all selections
    const handleReset = () => {
        if (baseCategory && baseCategory.items.length > 0) {
            setSelectedBaseId(baseCategory.items[0].id);
        } else {
            setSelectedBaseId('');
        }
        if (sizeCategory && sizeCategory.items.length > 0) {
            setSelectedSizeId(sizeCategory.items[0].id);
        } else {
            setSelectedSizeId('');
        }
        setSelectedStyles({});
        setSelectedExtras({});
    };

    // Build text format for WhatsApp / Clipboard
    const generateSummaryText = () => {
        const bName = businessConfig.name || 'CitaLink Nail Salon';
        let text = `💅 *COTIZACIÓN DE MANICURA — ${bName.toUpperCase()}*\n\n`;
        
        quoteBreakdown.items.forEach(item => {
            text += `• *${item.name}*: $${item.price} MXN ${item.detail ? item.detail : ''}\n`;
        });

        text += `\n✨ *TOTAL: $${quoteBreakdown.total} MXN*\n\n`;
        text += `_Cotización generada el ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}_\n`;
        text += `Reserva tu cita aquí: ${window.location.origin}/reserva/${businessConfig.slug || ''}`;

        return text;
    };

    const handleCopy = () => {
        const text = generateSummaryText();
        navigator.clipboard.writeText(text);
        showToast('Resumen copiado al portapapeles 📋', 'success');
    };

    const handleShareWhatsApp = () => {
        const text = encodeURIComponent(generateSummaryText());
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    };

    const handlePrint = () => {
        window.print();
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
                const clonedEl = clonedDoc.getElementById('printable-quote-card');
                if (clonedEl) {
                    clonedEl.style.width = '380px';
                    clonedEl.style.minWidth = '380px';
                    clonedEl.style.maxWidth = '380px';
                    clonedEl.style.margin = '0 auto';
                    clonedEl.style.boxSizing = 'border-box';
                    clonedEl.style.transform = 'none';

                    // Eliminar filtros de backdrop-blur que rompen la alineacion en html2canvas
                    const allElements = clonedEl.querySelectorAll('*');
                    allElements.forEach((node) => {
                        const el = node as HTMLElement;
                        if (el.style) {
                            el.style.backdropFilter = 'none';
                            (el.style as any).webkitBackdropFilter = 'none';
                        }
                    });
                }
            }
        });
    };

    const handleDownloadImage = async () => {
        try {
            const canvas = await captureQuoteCanvas();
            if (!canvas) return;
            
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `cotizacion-${businessConfig.name?.replace(/\s+/g, '-').toLowerCase() || 'uñas'}.png`;
            link.href = dataUrl;
            link.click();
            showToast('¡Foto de cotización descargada con éxito! 🎨', 'success');
        } catch (error) {
            console.error('Error generating image:', error);
            showToast('Error al generar la imagen', 'error');
        }
    };

    const handleCopyImage = async () => {
        try {
            const canvas = await captureQuoteCanvas();
            if (!canvas) return;
            
            canvas.toBlob((blob) => {
                if (blob) {
                    navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]).then(() => {
                        showToast('¡Foto de cotización copiada! 📋 Pégala directamente en WhatsApp.', 'success');
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-10 h-10 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
            <style>{`
                @media print {
                    /* Ocultar todo excepto la tarjeta de cotización */
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

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Calculator className="text-accent" /> Cotizador de Uñas
                    </h2>
                    <p className="text-sm text-muted mt-1">Calcula presupuestos de manicura y compártelos con tus clientas.</p>
                </div>
                <button onClick={handleReset} className="btn btn-ghost border border-white/10 text-white hover:bg-white/5">
                    Reiniciar Cotización
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* ── Left Side: Interactive Calculator Form ── */}
                <div className="lg:col-span-7 space-y-6">
                    
                    {/* Base Services */}
                    {baseCategory && (
                        <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                            <h3 className="text-md font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                                <span className="w-2 h-2 rounded-full bg-accent"></span> {baseCategory.name}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {baseCategory.items.map(item => (
                                    <label
                                        key={item.id}
                                        className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all duration-300 ${
                                            selectedBaseId === item.id
                                                ? 'bg-accent/10 border-accent text-white shadow-glow-sm'
                                                : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                name="baseService"
                                                checked={selectedBaseId === item.id}
                                                onChange={() => setSelectedBaseId(item.id)}
                                                className="w-4 h-4 text-accent border-white/10 focus:ring-accent bg-slate-900"
                                            />
                                            <span className="text-sm font-semibold">{item.name}</span>
                                        </div>
                                        <span className="text-sm font-bold text-accent">${item.price}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Sizes / Length */}
                    {sizeCategory && (
                        <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                            <h3 className="text-md font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                                <span className="w-2 h-2 rounded-full bg-cyan-400"></span> {sizeCategory.name}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {sizeCategory.items.map(item => (
                                    <label
                                        key={item.id}
                                        className={`flex flex-col items-center justify-center p-4 rounded-xl border cursor-pointer text-center select-none transition-all duration-300 ${
                                            selectedSizeId === item.id
                                                ? 'bg-cyan-400/10 border-cyan-400 text-white shadow-[0_0_15px_rgba(34,211,238,0.1)]'
                                                : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="nailSize"
                                            checked={selectedSizeId === item.id}
                                            onChange={() => setSelectedSizeId(item.id)}
                                            className="sr-only"
                                        />
                                        <span className="text-sm font-bold">{item.name}</span>
                                        <span className="text-xs text-cyan-400 font-bold mt-1">
                                            {item.price === 0 ? 'Sin costo' : `+$${item.price}`}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Styles / Designs */}
                    {styleCategory && (
                        <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                            <h3 className="text-md font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span> {styleCategory.name}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {styleCategory.items.map(item => {
                                    const selection = selectedStyles[item.id] || { checked: false, qty: 1 };
                                    const hasUnit = !!item.unit;
                                    return (
                                        <div
                                            key={item.id}
                                            className={`p-3.5 rounded-xl border transition-all duration-300 flex items-center justify-between gap-3 ${
                                                selection.checked
                                                    ? 'bg-emerald-500/10 border-emerald-500 text-white'
                                                    : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                            }`}
                                        >
                                            <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selection.checked}
                                                    onChange={e => {
                                                        const checked = e.target.checked;
                                                        setSelectedStyles(prev => ({
                                                            ...prev,
                                                            [item.id]: { ...selection, checked }
                                                        }));
                                                    }}
                                                    className="w-4 h-4 rounded text-emerald-500 border-white/10 focus:ring-emerald-500 bg-slate-900 cursor-pointer"
                                                />
                                                <div className="text-left">
                                                    <p className="text-sm font-semibold">{item.name}</p>
                                                    <p className="text-xs text-emerald-400 font-bold">
                                                        ${item.price} <span className="text-slate-500 font-normal">{item.unit ? `c/u` : ''}</span>
                                                    </p>
                                                </div>
                                            </label>

                                            {selection.checked && hasUnit && (
                                                <div className="flex items-center gap-1 bg-slate-950/70 rounded-xl p-1 border border-white/10 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const qty = Math.max(1, selection.qty - 1);
                                                            setSelectedStyles(prev => ({
                                                                ...prev,
                                                                [item.id]: { ...selection, qty }
                                                            }));
                                                        }}
                                                        className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/15 text-white active:scale-95 transition-all"
                                                        title="Restar 1"
                                                    >
                                                        <Minus size={13} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={item.unit === 'por uña' ? 10 : 100}
                                                        value={selection.qty === 0 ? '' : selection.qty}
                                                        onFocus={(e) => e.target.select()}
                                                        onChange={(e) => {
                                                            const maxVal = item.unit === 'por uña' ? 10 : 100;
                                                            const rawVal = e.target.value;
                                                            let parsed = rawVal === '' ? 1 : parseInt(rawVal, 10);
                                                            if (isNaN(parsed)) parsed = 1;
                                                            const qty = Math.min(maxVal, Math.max(1, parsed));
                                                            setSelectedStyles(prev => ({
                                                                ...prev,
                                                                [item.id]: { ...selection, qty }
                                                            }));
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-10 text-center bg-transparent border-0 text-xs font-black text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded py-0.5"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const maxVal = item.unit === 'por uña' ? 10 : 100;
                                                            const qty = Math.min(maxVal, selection.qty + 1);
                                                            setSelectedStyles(prev => ({
                                                                ...prev,
                                                                [item.id]: { ...selection, qty }
                                                            }));
                                                        }}
                                                        className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/15 text-white active:scale-95 transition-all"
                                                        title="Sumar 1"
                                                    >
                                                        <Plus size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Extras */}
                    {extrasCategory && (
                        <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                            <h3 className="text-md font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                                <span className="w-2 h-2 rounded-full bg-violet-400"></span> {extrasCategory.name}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {extrasCategory.items.map(item => {
                                    const isChecked = !!selectedExtras[item.id];
                                    return (
                                        <label
                                            key={item.id}
                                            className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all duration-300 ${
                                                isChecked
                                                    ? 'bg-violet-500/10 border-violet-500 text-white'
                                                    : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={e => {
                                                    const val = e.target.checked;
                                                    setSelectedExtras(prev => ({
                                                        ...prev,
                                                        [item.id]: val
                                                    }));
                                                }}
                                                className="w-4 h-4 rounded text-violet-500 border-white/10 focus:ring-violet-500 bg-slate-900 cursor-pointer"
                                            />
                                            <div className="text-left flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate">{item.name}</p>
                                                <p className="text-xs text-violet-400 font-bold mt-0.5">${item.price}</p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>

                {/* ── Right Side: Quote Summary / Ticket View ── */}
                <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-4">
                    
                    {/* Theme Selector for Ticket Card */}
                    <div className="flex items-center justify-between gap-2 px-1">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Sparkles size={14} className="text-pink-400" /> Estilo de la Foto:
                        </span>
                        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/10">
                            <button
                                type="button"
                                onClick={() => setCardTheme('pink')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                    cardTheme === 'pink'
                                        ? 'bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                🌸 Rosa Chic
                            </button>
                            <button
                                type="button"
                                onClick={() => setCardTheme('dark')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                    cardTheme === 'dark'
                                        ? 'bg-gradient-to-r from-indigo-600 to-slate-700 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                🖤 Dark
                            </button>
                            <button
                                type="button"
                                onClick={() => setCardTheme('gold')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                    cardTheme === 'gold'
                                        ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                👑 Oro
                            </button>
                        </div>
                    </div>

                    {/* The Ticket card */}
                    <div
                        ref={ticketRef}
                        id="printable-quote-card"
                        className={`p-6 sm:p-7 rounded-[32px] shadow-2xl relative overflow-hidden border transition-all duration-300 ${
                            cardTheme === 'pink'
                                ? 'bg-gradient-to-b from-[#fce7f3] via-[#fbcfe8] to-[#f472b6] border-pink-300/50 text-slate-800'
                                : cardTheme === 'gold'
                                ? 'bg-gradient-to-b from-[#fef3c7] via-[#fde68a] to-[#d97706] border-amber-300/50 text-slate-900'
                                : 'bg-gradient-to-b from-[#0f172a] via-[#1e1b4b] to-[#0f172a] border-white/15 text-white'
                        }`}
                    >
                        {/* Decorative ambient blobs */}
                        <div className={`absolute -top-12 -right-12 w-36 h-36 rounded-full blur-2xl pointer-events-none ${
                            cardTheme === 'pink' ? 'bg-pink-400/30' : cardTheme === 'gold' ? 'bg-amber-400/30' : 'bg-purple-500/20'
                        }`} />
                        <div className={`absolute -bottom-12 -left-12 w-36 h-36 rounded-full blur-2xl pointer-events-none ${
                            cardTheme === 'pink' ? 'bg-rose-400/30' : cardTheme === 'gold' ? 'bg-yellow-400/30' : 'bg-indigo-500/20'
                        }`} />

                        {/* Header / Brand info */}
                        <div className="text-center pb-5 space-y-2 relative z-10">
                            <div className={`w-16 h-16 rounded-full mx-auto overflow-hidden shadow-lg p-0.5 border ${
                                cardTheme === 'pink'
                                    ? 'bg-white border-pink-300'
                                    : cardTheme === 'gold'
                                    ? 'bg-white border-amber-300'
                                    : 'bg-slate-900 border-white/20'
                            }`}>
                                {businessConfig.logoUrl ? (
                                    <img src={businessConfig.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center font-black text-2xl text-pink-500">
                                        💅
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className={`text-xl font-black tracking-tight ${
                                    cardTheme === 'pink' ? 'text-pink-950 font-serif' : cardTheme === 'gold' ? 'text-amber-950 font-serif' : 'text-white'
                                }`}>
                                    {businessConfig.name || 'Salon de Uñas'}
                                </h3>
                                <p className={`text-xs font-bold mt-0.5 ${
                                    cardTheme === 'pink' ? 'text-pink-800/90' : cardTheme === 'gold' ? 'text-amber-900/90' : 'text-slate-400'
                                }`}>
                                    Tu Cotización de Uñas ✨
                                </p>
                            </div>
                        </div>

                        {/* Inner Card Container */}
                        <div className={`rounded-2xl p-5 shadow-lg border relative z-10 ${
                            cardTheme === 'pink'
                                ? 'bg-white border-pink-200/80 text-slate-800'
                                : cardTheme === 'gold'
                                ? 'bg-white border-amber-200/80 text-slate-900'
                                : 'bg-slate-900 border-white/10 text-slate-100'
                        }`}>
                            {/* Title inside card */}
                            <div className={`flex items-center gap-2 pb-3 mb-3 border-b font-bold text-xs ${
                                cardTheme === 'pink' ? 'border-pink-100 text-pink-700' : cardTheme === 'gold' ? 'border-amber-100 text-amber-800' : 'border-white/10 text-slate-300'
                            }`}>
                                <span className="text-sm">💅</span> Tus Servicios Seleccionados
                            </div>

                            {/* Breakdown Items */}
                            <div className="space-y-3 min-h-[80px]">
                                {quoteBreakdown.items.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic text-center py-4">
                                        Selecciona las opciones para ver tu resumen...
                                    </p>
                                ) : (
                                    quoteBreakdown.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs pb-2 border-b border-black/5 last:border-0 last:pb-0">
                                            <div className="text-left pr-2">
                                                <p className="font-bold leading-snug">{item.name}</p>
                                                {item.detail && (
                                                    <p className={`text-[10px] ${
                                                        cardTheme === 'pink' ? 'text-pink-600 font-semibold' : cardTheme === 'gold' ? 'text-amber-700 font-semibold' : 'text-slate-400'
                                                    }`}>
                                                        {item.detail}
                                                    </p>
                                                )}
                                            </div>
                                            <span className={`font-black text-sm shrink-0 ${
                                                cardTheme === 'pink'
                                                    ? 'text-pink-700'
                                                    : cardTheme === 'gold'
                                                    ? 'text-amber-800'
                                                    : 'text-emerald-400'
                                            }`}>
                                                ${item.price}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Total Box */}
                            <div className={`mt-4 pt-3 border-t flex justify-between items-center ${
                                cardTheme === 'pink' ? 'border-pink-200' : cardTheme === 'gold' ? 'border-amber-200' : 'border-white/10'
                            }`}>
                                <div>
                                    <span className={`text-[10px] uppercase font-black tracking-wider block ${
                                        cardTheme === 'pink' ? 'text-pink-600' : cardTheme === 'gold' ? 'text-amber-700' : 'text-slate-400'
                                    }`}>
                                        Total a Pagar
                                    </span>
                                    <p className="text-2xl font-black leading-none mt-0.5">
                                        ${quoteBreakdown.total} <span className="text-xs font-semibold">MXN</span>
                                    </p>
                                </div>
                                <div className={`px-3 py-1.5 rounded-xl font-bold text-xs tracking-wide border ${
                                    cardTheme === 'pink'
                                        ? 'bg-pink-50 border-pink-200 text-pink-700'
                                        : cardTheme === 'gold'
                                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                }`}>
                                    Tu Cotización ✨
                                </div>
                            </div>
                        </div>

                        {/* Card Footer branding */}
                        <div className="mt-4 text-center relative z-10">
                            <p className={`text-[10px] font-bold tracking-wide ${
                                cardTheme === 'pink' ? 'text-pink-900/80' : cardTheme === 'gold' ? 'text-amber-950/80' : 'text-slate-400'
                            }`}>
                                ¡Gracias por tu preferencia! 💕 • Te esperamos pronto
                            </p>
                        </div>
                    </div>

                    {/* Actions button group */}
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={handleShareWhatsApp}
                            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all text-white font-bold flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-500/20"
                        >
                            <Share2 size={18} />
                            Compartir en WhatsApp (Texto)
                        </button>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-all text-xs font-bold"
                            >
                                <Copy size={16} />
                                Copiar Texto
                            </button>
                            <button
                                type="button"
                                onClick={handleCopyImage}
                                className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 transition-all text-xs font-bold"
                            >
                                <Copy size={16} />
                                Copiar Imagen
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadImage}
                                className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-all text-xs font-bold"
                            >
                                <Sparkles size={16} />
                                Descargar PNG
                            </button>
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-all text-xs font-bold"
                            >
                                <Printer size={16} />
                                Imprimir
                            </button>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
