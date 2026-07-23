import { useState } from 'react';
import { ZoomIn, ZoomOut, Sliders, X } from 'lucide-react';
import { useAppZoom, MIN_ZOOM, MAX_ZOOM } from '../lib/useAppZoom';

export default function AppZoomControl() {
    const { zoom, setZoom, zoomIn, zoomOut } = useAppZoom();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="fixed bottom-4 left-4 z-[9999] flex flex-col sm:flex-row items-start sm:items-center gap-2 print:hidden select-none">
            {/* Toggle Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`px-3 py-2 rounded-2xl backdrop-blur-xl border transition-all duration-300 shadow-2xl flex items-center gap-2 ${
                    isOpen || zoom !== 100
                        ? 'bg-accent/25 border-accent/40 text-accent shadow-accent/20 scale-105'
                        : 'bg-[#0c101d]/90 border-white/10 text-slate-300 hover:text-white hover:border-white/20'
                }`}
                title="Ajustar Zoom de la Aplicación"
            >
                <Sliders size={16} />
                <span className="text-xs font-black tracking-tight">Zoom: {zoom}%</span>
            </button>

            {/* Expanded Zoom Control Bar */}
            {isOpen && (
                <div className="flex items-center gap-1.5 p-2 rounded-2xl bg-[#0c101d]/95 backdrop-blur-2xl border border-white/15 shadow-2xl animate-fade-in flex-wrap max-w-[90vw]">
                    <button
                        type="button"
                        onClick={zoomOut}
                        disabled={zoom <= MIN_ZOOM}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/20 disabled:opacity-30 text-white transition-all"
                        title="Reducir Zoom (-5%)"
                    >
                        <ZoomOut size={16} />
                    </button>

                    {/* Quick Presets for Mobile */}
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                        {[85, 100, 115, 125].map(lvl => (
                            <button
                                key={lvl}
                                type="button"
                                onClick={() => setZoom(lvl)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-black transition-all ${
                                    zoom === lvl
                                        ? 'bg-accent text-[#0c101d] shadow-md shadow-accent/20'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {lvl}%
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={zoomIn}
                        disabled={zoom >= MAX_ZOOM}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/20 disabled:opacity-30 text-white transition-all"
                        title="Aumentar Zoom (+5%)"
                    >
                        <ZoomIn size={16} />
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all ml-1"
                        title="Cerrar panel de zoom"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}
