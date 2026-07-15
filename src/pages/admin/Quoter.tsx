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
        }
        if (sizeCategory && sizeCategory.items.length > 0) {
            setSelectedSizeId(sizeCategory.items[0].id);
        }
        setSelectedStyles({});
        setSelectedExtras({});
        showToast('Cotizador reiniciado', 'info');
    };

    // Format text quote for sharing
    const getFormattedQuoteText = () => {
        const name = businessConfig.name || 'CitaLink Nail Salon';
        let text = `💅 *COTIZACIÓN DE UÑAS* 💅\n*${name}*\n\n`;
        quoteBreakdown.items.forEach(item => {
            const detailText = item.detail ? ` ${item.detail}` : '';
            text += `• ${item.name}${detailText}: *$${item.price} MXN*\n`;
        });
        text += `\n💵 *TOTAL: $${quoteBreakdown.total} MXN*\n\n`;
        text += `👉 ¡Reserva tu cita aquí! https://stylesync.citalink.site/${businessConfig.slug}`;
        return encodeURIComponent(text);
    };

    const handleCopy = () => {
        const name = businessConfig.name || 'CitaLink Nail Salon';
        let text = `💅 COTIZACIÓN DE UÑAS 💅\n${name}\n\n`;
        quoteBreakdown.items.forEach(item => {
            const detailText = item.detail ? ` ${item.detail}` : '';
            text += `• ${item.name}${detailText}: $${item.price} MXN\n`;
        });
        text += `\nTOTAL: $${quoteBreakdown.total} MXN\n\n`;
        text += `Reserva tu cita aquí: https://stylesync.citalink.site/${businessConfig.slug}`;

        navigator.clipboard.writeText(text);
        showToast('Cotización copiada al portapapeles 📋', 'success');
    };

    const handleShareWhatsApp = () => {
        const text = getFormattedQuoteText();
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadImage = async () => {
        if (!ticketRef.current) return;
        try {
            const element = ticketRef.current;
            const canvas = await html2canvas(element, {
                backgroundColor: '#0f172a',
                scale: 3,
                logging: false,
                useCORS: true,
                onclone: (clonedDoc) => {
                    const clonedEl = clonedDoc.getElementById('printable-quote-card');
                    if (clonedEl) {
                        clonedEl.style.background = '#0f172a';
                        clonedEl.style.backgroundImage = 'none';
                        clonedEl.style.backdropFilter = 'none';
                        clonedEl.style.width = '380px';
                        clonedEl.style.borderRadius = '24px';
                        clonedEl.style.border = '1px solid rgba(255, 255, 255, 0.15)';
                        clonedEl.style.boxShadow = 'none';
                    }
                }
            });
            
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `cotizacion-${businessConfig.name?.replace(/\s+/g, '-').toLowerCase() || 'nail-design'}.png`;
            link.href = dataUrl;
            link.click();
            showToast('Imagen descargada con éxito 🎨', 'success');
        } catch (error) {
            console.error('Error generating image:', error);
            showToast('Error al generar la imagen', 'error');
        }
    };

    const handleCopyImage = async () => {
        if (!ticketRef.current) return;
        try {
            const element = ticketRef.current;
            const canvas = await html2canvas(element, {
                backgroundColor: '#0f172a',
                scale: 3,
                logging: false,
                useCORS: true,
                onclone: (clonedDoc) => {
                    const clonedEl = clonedDoc.getElementById('printable-quote-card');
                    if (clonedEl) {
                        clonedEl.style.background = '#0f172a';
                        clonedEl.style.backgroundImage = 'none';
                        clonedEl.style.backdropFilter = 'none';
                        clonedEl.style.width = '380px';
                        clonedEl.style.borderRadius = '24px';
                        clonedEl.style.border = '1px solid rgba(255, 255, 255, 0.15)';
                        clonedEl.style.boxShadow = 'none';
                    }
                }
            });
            
            canvas.toBlob((blob) => {
                if (blob) {
                    navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]).then(() => {
                        showToast('¡Imagen de ticket copiada al portapapeles! 📋 Lista para pegar en WhatsApp.', 'success');
                    }).catch(err => {
                        console.error('Clipboard write error:', err);
                        showToast('No se pudo copiar la imagen al portapapeles. Prueba a descargarla.', 'error');
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
                                                <div className="flex items-center gap-2 bg-slate-950/50 rounded-lg p-1 border border-white/5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const qty = Math.max(1, selection.qty - 1);
                                                            setSelectedStyles(prev => ({
                                                                ...prev,
                                                                [item.id]: { ...selection, qty }
                                                            }));
                                                        }}
                                                        className="w-6 h-6 rounded bg-white/5 flex items-center justify-center hover:bg-white/10 text-white"
                                                    >
                                                        <Minus size={12} />
                                                    </button>
                                                    <span className="text-xs font-bold w-5 text-center text-white">{selection.qty}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const qty = Math.min(10, selection.qty + 1);
                                                            setSelectedStyles(prev => ({
                                                                ...prev,
                                                                [item.id]: { ...selection, qty }
                                                            }));
                                                        }}
                                                        className="w-6 h-6 rounded bg-white/5 flex items-center justify-center hover:bg-white/10 text-white"
                                                    >
                                                        <Plus size={12} />
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
                    
                    {/* The Ticket card */}
                    <div ref={ticketRef} id="printable-quote-card" className="glass-panel p-6 border border-white/10 rounded-3xl shadow-2xl relative overflow-hidden bg-gradient-to-b from-[#0f172a] to-[#1e293b]/70">
                        {/* Branded elements */}
                        <div className="text-center pb-6 border-b border-dashed border-white/10 space-y-3">
                            <div className="w-16 h-16 rounded-full mx-auto overflow-hidden bg-slate-800 border border-white/10 flex items-center justify-center">
                                {businessConfig.logoUrl ? (
                                    <img src={businessConfig.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <Sparkles size={28} className="text-accent" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white">{businessConfig.name || 'CitaLink Nail Salon'}</h3>
                                <p className="text-[10px] text-slate-500 tracking-widest uppercase">Presupuesto de Diseño</p>
                            </div>
                        </div>

                        {/* Breakdown items */}
                        <div className="py-6 space-y-4">
                            {quoteBreakdown.items.length === 0 ? (
                                <p className="text-sm text-slate-500 italic text-center">Selecciona las técnicas y decoración para cotizar.</p>
                            ) : (
                                <div className="space-y-3">
                                    {quoteBreakdown.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-start text-sm">
                                            <div className="text-left">
                                                <p className="font-semibold text-slate-200">{item.name}</p>
                                                {item.detail && <p className="text-xs text-slate-500">{item.detail}</p>}
                                            </div>
                                            <span className="font-bold text-white shrink-0">${item.price} MXN</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Grand Total */}
                        <div className="pt-6 border-t border-dashed border-white/10 flex justify-between items-center">
                            <div className="text-left">
                                <span className="text-xs uppercase font-bold text-slate-500">Total</span>
                                <p className="text-2xl font-black text-white">${quoteBreakdown.total} <span className="text-xs font-semibold text-slate-400">MXN</span></p>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider">
                                Cotizado
                            </div>
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
