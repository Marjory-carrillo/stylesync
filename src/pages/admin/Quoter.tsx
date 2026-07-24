import { useState, useMemo, useRef, useEffect } from 'react';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useNailCalculator } from '../../lib/store/queries/useNailCalculator';
import { Calculator, Sparkles, Plus, Minus, Upload, Image as ImageIcon, Trash2, Maximize2, Eye, X, RotateCcw, Download } from 'lucide-react';
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

    // Reference photo state & lightbox modal
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState<boolean>(false);

    // Listener for Ctrl + V image paste from WhatsApp / Clipboard
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            setReferenceImage(event.target?.result as string);
                            showToast('📸 Foto de referencia pegada desde el portapapeles', 'success');
                        };
                        reader.readAsDataURL(blob);
                    }
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [showToast]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setReferenceImage(event.target?.result as string);
                showToast('📸 Foto de referencia cargada', 'success');
            };
            reader.readAsDataURL(file);
        }
    };

    // Categorized config items
    const baseCategory = useMemo(() => config.find(c => c.id === 'base_services'), [config]);
    const sizeCategory = useMemo(() => config.find(c => c.id === 'sizes'), [config]);
    const styleCategory = useMemo(() => config.find(c => c.id === 'styles'), [config]);
    const extrasCategory = useMemo(() => config.find(c => c.id === 'extras'), [config]);

    // Calculate details and prices
    const quoteBreakdown = useMemo(() => {
        const items: { name: string; price: number; detail?: string }[] = [];
        let total = 0;

        const baseItem = baseCategory?.items.find(i => i.id === selectedBaseId);
        const sizeItem = sizeCategory?.items.find(i => i.id === selectedSizeId);

        // Combined Base service + Size into a single line item with summed price
        if (baseItem) {
            if (sizeItem && sizeItem.price > 0) {
                const combinedName = `${baseItem.name} (${sizeItem.name})`;
                const combinedPrice = baseItem.price + sizeItem.price;
                items.push({ name: combinedName, price: combinedPrice });
                total += combinedPrice;
            } else if (sizeItem) {
                const combinedName = `${baseItem.name} (${sizeItem.name})`;
                items.push({ name: combinedName, price: baseItem.price });
                total += baseItem.price;
            } else {
                items.push({ name: baseItem.name, price: baseItem.price });
                total += baseItem.price;
            }
        } else if (sizeItem) {
            items.push({ name: `Largo: ${sizeItem.name}`, price: sizeItem.price });
            total += sizeItem.price;
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



    const captureQuoteCanvas = async () => {
        if (!ticketRef.current) return null;
        return await html2canvas(ticketRef.current, {
            backgroundColor: null,
            scale: 3,
            logging: false,
            useCORS: true,
            allowTaint: true,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc) => {
                const clonedEl = clonedDoc.getElementById('printable-quote-card');
                if (clonedEl) {
                    clonedEl.style.width = '480px';
                    clonedEl.style.minWidth = '480px';
                    clonedEl.style.maxWidth = '480px';
                    clonedEl.style.margin = '0 auto';
                    clonedEl.style.padding = '32px';
                    clonedEl.style.boxSizing = 'border-box';
                    clonedEl.style.transform = 'none';

                    // Ocultar elementos flotantes con blur que desalinean bordes en html2canvas
                    const blobs = clonedEl.querySelectorAll('.blur-2xl');
                    blobs.forEach(b => ((b as HTMLElement).style.display = 'none'));

                    // Limpiar animaciones, transiciones y filtros que distorsionan fuentes
                    const allElements = clonedEl.querySelectorAll('*');
                    allElements.forEach((node) => {
                        const el = node as HTMLElement;
                        if (el.style) {
                            el.style.backdropFilter = 'none';
                            (el.style as any).webkitBackdropFilter = 'none';
                            el.style.animation = 'none';
                            el.style.transition = 'none';
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
                <button
                    type="button"
                    onClick={handleReset}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-400 hover:to-rose-500 text-white font-black text-xs sm:text-sm tracking-wide shadow-xl shadow-pink-500/30 border border-pink-400/50 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <RotateCcw size={16} />
                    <span>Reiniciar Cotización</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* ── Left Side: Interactive Calculator Form ── */}
                <div className="lg:col-span-7 space-y-6">
                    
                    {/* Reference Design Photo Uploader */}
                    <div className="glass-card p-5 rounded-2xl border border-white/10 space-y-3 bg-slate-900/60 shadow-xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <ImageIcon size={17} className="text-pink-400" /> Foto del Diseño a Cotizar (Opcional)
                            </h3>
                            {referenceImage && (
                                <button
                                    type="button"
                                    onClick={() => setReferenceImage(null)}
                                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 font-semibold transition-colors bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20"
                                >
                                    <Trash2 size={13} /> Eliminar Foto
                                </button>
                            )}
                        </div>

                        {!referenceImage ? (
                            <label className="border-2 border-dashed border-white/15 hover:border-pink-400/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-center gap-3 cursor-pointer bg-slate-950/40 hover:bg-white/5 transition-all text-center sm:text-left group">
                                <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0 group-hover:scale-110 transition-transform">
                                    <Upload size={18} />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-slate-200">
                                        Subir foto o presionar <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-[10px] text-pink-300 font-mono">Ctrl + V</kbd> para pegar desde el portapapeles
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        Ve la foto enviada por la clienta mientras calculas el precio sin cambiar de app.
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
                                {/* Clickable thumbnail with zoom overlay */}
                                <div
                                    onClick={() => setIsPhotoModalOpen(true)}
                                    className="relative w-full sm:w-28 h-28 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-slate-900 shadow-md cursor-pointer group"
                                    title="Haz clic para ver en pantalla completa"
                                >
                                    <img
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
                                        ✨ Guía activa para calcular tu servicio
                                    </p>
                                    <p className="text-[11px] text-slate-300">
                                        Haz clic en la foto o presiona el botón para examinar detalles, trazos o cristales en tamaño completo.
                                    </p>
                                    <div className="flex items-center gap-3 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setIsPhotoModalOpen(true)}
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
                    {baseCategory && (
                        <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                            <h3 className="text-md font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
                                <span className="w-2 h-2 rounded-full bg-accent"></span> {baseCategory.name}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {baseCategory.items.map(item => {
                                    const isSelected = selectedBaseId === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setSelectedBaseId(prev => prev === item.id ? '' : item.id)}
                                            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all duration-300 text-left ${
                                                isSelected
                                                    ? 'bg-accent/10 border-accent text-white shadow-glow-sm'
                                                    : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'border-accent bg-accent' : 'border-white/20 bg-slate-900'}`}>
                                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                                                </div>
                                                <span className="text-sm font-semibold">{item.name}</span>
                                            </div>
                                            <span className="text-sm font-bold text-accent">${item.price}</span>
                                        </button>
                                    );
                                })}
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
                                {sizeCategory.items.map(item => {
                                    const isSelected = selectedSizeId === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setSelectedSizeId(prev => prev === item.id ? '' : item.id)}
                                            className={`flex flex-col items-center justify-center p-4 rounded-xl border cursor-pointer text-center select-none transition-all duration-300 ${
                                                isSelected
                                                    ? 'bg-cyan-400/10 border-cyan-400 text-white shadow-[0_0_15px_rgba(34,211,238,0.1)]'
                                                    : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                            }`}
                                        >
                                            <span className="text-sm font-bold">{item.name}</span>
                                            <span className="text-xs text-cyan-400 font-bold mt-1">
                                                {item.price === 0 ? 'Sin costo' : `+$${item.price}`}
                                            </span>
                                        </button>
                                    );
                                })}
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
                <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-6 z-10">
                    
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
                        className={`pt-8 pb-7 px-6 sm:px-8 rounded-[36px] shadow-2xl relative overflow-hidden border transition-all duration-300 max-w-[480px] mx-auto ${
                            cardTheme === 'pink'
                                ? 'bg-gradient-to-b from-[#fce7f3] via-[#fbcfe8] to-[#f472b6] border-pink-300/50 text-slate-800'
                                : cardTheme === 'gold'
                                ? 'bg-gradient-to-b from-[#fef3c7] via-[#fde68a] to-[#d97706] border-amber-300/50 text-slate-900'
                                : 'bg-gradient-to-b from-[#0f172a] via-[#1e1b4b] to-[#0f172a] border-white/15 text-white'
                        }`}
                    >
                        {/* Header / Brand info */}
                        <div className="text-center pt-2 pb-5 space-y-2 relative z-10">
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
                                <h3 className={`text-2xl font-black tracking-tight ${
                                    cardTheme === 'pink' ? 'text-pink-950 font-serif' : cardTheme === 'gold' ? 'text-amber-950 font-serif' : 'text-white'
                                }`}>
                                    {businessConfig.name || 'Salon de Uñas'}
                                </h3>
                                <p className={`text-xs font-bold mt-1 tracking-wider uppercase ${
                                    cardTheme === 'pink' ? 'text-pink-800/90' : cardTheme === 'gold' ? 'text-amber-900/90' : 'text-slate-400'
                                }`}>
                                    Presupuesto Personalizado ✨
                                </p>
                            </div>
                        </div>

                        {/* Optional Reference Image Preview inside card */}
                        {referenceImage && (
                            <div className="mb-4 relative z-10">
                                <div className={`rounded-2xl p-2.5 border shadow-inner text-center ${
                                    cardTheme === 'pink' ? 'bg-white/80 border-pink-200' : cardTheme === 'gold' ? 'bg-white/80 border-amber-200' : 'bg-slate-900/80 border-white/10'
                                }`}>
                                    <p className={`text-[10px] font-black uppercase tracking-wider mb-2 ${
                                        cardTheme === 'pink' ? 'text-pink-700' : cardTheme === 'gold' ? 'text-amber-800' : 'text-cyan-400'
                                    }`}>
                                        📸 Foto de Referencia Solicitada
                                    </p>
                                    <div className="w-full h-36 rounded-xl overflow-hidden border border-black/10 bg-slate-950">
                                        <img src={referenceImage} alt="Diseño solicitado" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Inner Card Container */}
                        <div className={`rounded-2xl p-5 sm:p-6 shadow-xl border relative z-10 space-y-4 ${
                            cardTheme === 'pink'
                                ? 'bg-white border-pink-200/90 text-slate-800'
                                : cardTheme === 'gold'
                                ? 'bg-white border-amber-200/90 text-slate-900'
                                : 'bg-slate-900/95 border-white/10 text-slate-100'
                        }`}>
                            {/* Title inside card */}
                            <div className={`flex items-center justify-between pb-3 border-b font-bold text-xs ${
                                cardTheme === 'pink' ? 'border-pink-100 text-pink-700' : cardTheme === 'gold' ? 'border-amber-100 text-amber-800' : 'border-white/10 text-slate-300'
                            }`}>
                                <span className="flex items-center gap-1.5 font-black uppercase tracking-wider">
                                    <span>💅</span> Servicios Incluidos
                                </span>
                                <span className="text-[10px] opacity-75">MXN</span>
                            </div>

                            {/* Breakdown Items */}
                            <div className="space-y-3 min-h-[90px]">
                                {quoteBreakdown.items.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic text-center py-6">
                                        Selecciona opciones en el panel para generar la cotización...
                                    </p>
                                ) : (
                                    quoteBreakdown.items.map((item, idx) => (
                                        <div key={idx} className="w-full flex items-center justify-between gap-4 py-2 border-b border-black/5 last:border-0">
                                            <div className="flex-1 text-left min-w-0 pr-2">
                                                <span className="font-bold text-sm leading-snug block break-words">{item.name}</span>
                                                {item.detail && (
                                                    <span className={`text-[11px] block mt-0.5 ${
                                                        cardTheme === 'pink' ? 'text-pink-600 font-semibold' : cardTheme === 'gold' ? 'text-amber-700 font-semibold' : 'text-slate-400'
                                                    }`}>
                                                        {item.detail}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`font-black text-base text-right shrink-0 whitespace-nowrap leading-none ${
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

                            {/* Total Box Banner */}
                            <div className={`pt-4 border-t flex justify-between items-center rounded-xl p-3.5 ${
                                cardTheme === 'pink'
                                    ? 'bg-pink-50/80 border border-pink-200/80 text-pink-950'
                                    : cardTheme === 'gold'
                                    ? 'bg-amber-50/80 border border-amber-200/80 text-amber-950'
                                    : 'bg-white/5 border border-white/10 text-white'
                            }`}>
                                <div>
                                    <span className={`text-[10px] uppercase font-black tracking-widest block ${
                                        cardTheme === 'pink' ? 'text-pink-600' : cardTheme === 'gold' ? 'text-amber-800' : 'text-slate-400'
                                    }`}>
                                        Total Estimado
                                    </span>
                                    <p className="text-3xl font-black leading-none mt-1">
                                        ${quoteBreakdown.total} <span className="text-xs font-bold opacity-75">MXN</span>
                                    </p>
                                </div>
                                <div className={`flex items-center justify-center text-center px-4 py-2 rounded-full font-bold text-xs tracking-wider border leading-none shrink-0 ${
                                    cardTheme === 'pink'
                                        ? 'bg-pink-500 text-white border-pink-400 shadow-md shadow-pink-500/20'
                                        : cardTheme === 'gold'
                                        ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/20'
                                        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                }`}>
                                    <span>Tu Cotización ✨</span>
                                </div>
                            </div>
                        </div>

                        {/* Card Footer branding */}
                        <div className="mt-5 text-center relative z-10 space-y-1">
                            <p className={`text-[11px] font-bold tracking-wide ${
                                cardTheme === 'pink' ? 'text-pink-900/90' : cardTheme === 'gold' ? 'text-amber-950/90' : 'text-slate-300'
                            }`}>
                                ¡Gracias por consultar con nosotros! 💕 • Te esperamos pronto
                            </p>
                            <p className={`text-[9px] opacity-75 ${
                                cardTheme === 'pink' ? 'text-pink-800' : cardTheme === 'gold' ? 'text-amber-900' : 'text-slate-400'
                            }`}>
                                Precios aproximados sujetos a evaluación presencial
                            </p>
                        </div>
                    </div>

                    {/* Actions button group */}
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={handleDownloadImage}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 hover:from-pink-400 hover:to-rose-500 text-white font-black text-sm tracking-wide shadow-xl shadow-pink-500/25 border border-pink-400/30 active:scale-95 transition-all flex items-center justify-center gap-2.5"
                        >
                            <Download size={18} />
                            <span>Descargar Cotización en Imagen (PNG)</span>
                        </button>
                        
                        <button
                            type="button"
                            onClick={handleCopyImage}
                            className="w-full py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/15 text-slate-200 hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
                        >
                            <ImageIcon size={16} className="text-cyan-400" />
                            <span>Copiar Imagen para Pegar en WhatsApp</span>
                        </button>
                    </div>

                </div>

            </div>

            {/* Lightbox Modal: Foto de Referencia en Pantalla Completa */}
            {isPhotoModalOpen && referenceImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setIsPhotoModalOpen(false)}
                >
                    <div
                        className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-white/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950/90">
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
                                src={referenceImage}
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
