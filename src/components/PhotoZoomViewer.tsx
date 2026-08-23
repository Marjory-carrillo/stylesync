import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut, RotateCcw, X, Maximize2, Image as ImageIcon } from 'lucide-react';

interface PhotoZoomViewerProps {
    photoUrl: string | null;
    onClose: () => void;
    title?: string;
}

export default function PhotoZoomViewer({
    photoUrl,
    onClose,
    title = 'Foto de Referencia'
}: PhotoZoomViewerProps) {
    const [zoomScale, setZoomScale] = useState(1);
    const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0, hasMoved: false });

    // Reset zoom when photo opens/closes
    useEffect(() => {
        setZoomScale(1);
        setPanPosition({ x: 0, y: 0 });
        setIsDragging(false);
    }, [photoUrl]);

    // Lock body scroll whenever modal is active
    useEffect(() => {
        if (photoUrl) {
            const originalOverflow = document.body.style.overflow;
            const originalTouchAction = document.body.style.touchAction;
            document.body.style.overflow = 'hidden';
            document.body.style.touchAction = 'none';
            return () => {
                document.body.style.overflow = originalOverflow;
                document.body.style.touchAction = originalTouchAction;
            };
        }
    }, [photoUrl]);

    // Global keyboard shortcuts (ESC, +, -, 0)
    useEffect(() => {
        if (!photoUrl) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === '+' || e.key === '=') {
                setZoomScale(prev => Math.min(Number((prev + 0.5).toFixed(1)), 4));
            } else if (e.key === '-' || e.key === '_') {
                setZoomScale(prev => {
                    const next = Math.max(Number((prev - 0.5).toFixed(1)), 1);
                    if (next === 1) setPanPosition({ x: 0, y: 0 });
                    return next;
                });
            } else if (e.key === '0') {
                setZoomScale(1);
                setPanPosition({ x: 0, y: 0 });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [photoUrl, onClose]);

    if (!photoUrl) return null;

    const handleZoomIn = () => {
        setZoomScale(prev => Math.min(Number((prev + 0.5).toFixed(1)), 4));
    };

    const handleZoomOut = () => {
        setZoomScale(prev => {
            const next = Math.max(Number((prev - 0.5).toFixed(1)), 1);
            if (next === 1) setPanPosition({ x: 0, y: 0 });
            return next;
        });
    };

    const handleResetZoom = () => {
        setZoomScale(1);
        setPanPosition({ x: 0, y: 0 });
    };

    const handleToggleZoom = () => {
        if (zoomScale === 1) {
            setZoomScale(2.5);
        } else {
            handleResetZoom();
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoomScale <= 1) return;
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            panX: panPosition.x,
            panY: panPosition.y,
            hasMoved: false
        };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || zoomScale <= 1) return;
        e.preventDefault();
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            dragStartRef.current.hasMoved = true;
        }
        setPanPosition({
            x: dragStartRef.current.panX + dx,
            y: dragStartRef.current.panY + dy
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (zoomScale <= 1 || e.touches.length !== 1) return;
        setIsDragging(true);
        dragStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            panX: panPosition.x,
            panY: panPosition.y,
            hasMoved: false
        };
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging || zoomScale <= 1 || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - dragStartRef.current.x;
        const dy = e.touches[0].clientY - dragStartRef.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            dragStartRef.current.hasMoved = true;
        }
        setPanPosition({
            x: dragStartRef.current.panX + dx,
            y: dragStartRef.current.panY + dy
        });
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    const handleWheelZoom = (e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.deltaY < 0) {
            setZoomScale(prev => Math.min(Number((prev + 0.3).toFixed(1)), 4));
        } else {
            setZoomScale(prev => {
                const next = Math.max(Number((prev - 0.3).toFixed(1)), 1);
                if (next === 1) setPanPosition({ x: 0, y: 0 });
                return next;
            });
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-between p-0 animate-fade-in select-none overscroll-contain"
            onClick={onClose}
            onWheel={handleWheelZoom}
        >
            {/* Top Floating Controls Bar */}
            <div
                className="w-full h-16 bg-[#080d1a]/95 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 flex items-center justify-between z-30 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                        <ImageIcon size={14} /> {title}
                    </span>
                    <span className="text-xs font-bold text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl">
                        {Math.round(zoomScale * 100)}%
                    </span>
                </div>

                {/* Interactive Zoom Controls */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                        onClick={handleZoomOut}
                        disabled={zoomScale <= 1}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-white border border-white/10 transition-all cursor-pointer active:scale-95"
                        title="Reducir (-)"
                    >
                        <ZoomOut size={16} />
                    </button>
                    <button
                        onClick={handleResetZoom}
                        disabled={zoomScale === 1 && panPosition.x === 0 && panPosition.y === 0}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-white border border-white/10 transition-all cursor-pointer active:scale-95"
                        title="Restablecer (0)"
                    >
                        <RotateCcw size={16} />
                    </button>
                    <button
                        onClick={handleZoomIn}
                        disabled={zoomScale >= 4}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-white border border-white/10 transition-all cursor-pointer active:scale-95"
                        title="Aumentar (+)"
                    >
                        <ZoomIn size={16} />
                    </button>

                    <button
                        onClick={handleToggleZoom}
                        className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 px-3.5 py-2 rounded-xl transition-all shadow-md cursor-pointer active:scale-95 ml-2"
                    >
                        <Maximize2 size={14} />
                        {zoomScale > 1 ? 'Ajustar' : 'Ampliar 2.5x'}
                    </button>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl bg-white/10 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-white/10 hover:border-red-500/30 transition-all cursor-pointer active:scale-95 ml-2"
                        title="Cerrar (ESC)"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Main Image Stage with Drag & Wheel Zoom */}
            <div
                className="w-full flex-1 flex items-center justify-center overflow-hidden relative cursor-default p-4"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={(e) => {
                    if (e.target === e.currentTarget) onClose();
                }}
            >
                <img
                    decoding="async"
                    loading="lazy"
                    src={photoUrl}
                    alt={title}
                    style={{
                        transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomScale})`,
                        transformOrigin: 'center center',
                        transition: isDragging ? 'none' : 'transform 0.18s cubic-bezier(0.2, 0, 0, 1)'
                    }}
                    className={`max-h-[82vh] max-w-[92vw] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 select-none ${
                        zoomScale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
                    }`}
                    draggable={false}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!dragStartRef.current.hasMoved) {
                            handleToggleZoom();
                        }
                    }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                />
            </div>

            {/* Bottom Helper Hint */}
            <div className="pb-3 text-center pointer-events-none z-20">
                <p className="text-[11px] font-medium text-slate-400/80 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/5 inline-block">
                    💡 Usa la rueda del ratón o los botones para acercar/alejar • Arrastra para moverte
                </p>
            </div>
        </div>,
        document.body
    );
}
