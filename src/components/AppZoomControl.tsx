import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Sliders, X } from 'lucide-react';
import { useAppZoom, MIN_ZOOM, MAX_ZOOM } from '../lib/useAppZoom';

export default function AppZoomControl() {
    const { zoom, setZoom, zoomIn, zoomOut } = useAppZoom();
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative inline-flex items-center select-none print:hidden" ref={popoverRef}>
            {/* Header Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-black transition-all active:scale-95 ${
                    isOpen || zoom !== 100
                        ? 'bg-accent/20 border-accent/40 text-accent shadow-sm'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Ajustar Zoom de Pantalla"
                aria-label="Ajustar Zoom"
            >
                <Sliders size={14} />
                <span>{zoom}%</span>
            </button>

            {/* Dropdown Popover */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 z-[9999] min-w-[230px] p-3 rounded-2xl bg-[#0c101d]/95 backdrop-blur-2xl border border-white/15 shadow-2xl animate-fade-in flex flex-col gap-2.5 text-left">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Zoom de pantalla</span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 bg-white/5 p-1.5 rounded-xl border border-white/5">
                        <button
                            type="button"
                            onClick={zoomOut}
                            disabled={zoom <= MIN_ZOOM}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30 text-white transition-all"
                            title="Disminuir (-5%)"
                        >
                            <ZoomOut size={14} />
                        </button>

                        <span className="text-xs font-black text-white">{zoom}%</span>

                        <button
                            type="button"
                            onClick={zoomIn}
                            disabled={zoom >= MAX_ZOOM}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30 text-white transition-all"
                            title="Aumentar (+5%)"
                        >
                            <ZoomIn size={14} />
                        </button>
                    </div>

                    {/* Presets */}
                    <div className="grid grid-cols-4 gap-1">
                        {[85, 100, 115, 125].map(lvl => (
                            <button
                                key={lvl}
                                type="button"
                                onClick={() => {
                                    setZoom(lvl);
                                }}
                                className={`py-1.5 rounded-lg text-[11px] font-black transition-all ${
                                    zoom === lvl
                                        ? 'bg-accent text-[#0c101d] shadow-sm'
                                        : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                {lvl}%
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
