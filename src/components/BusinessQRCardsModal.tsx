import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Download, Copy, Check, QrCode, Calendar, Star, X, Edit2, Infinity } from 'lucide-react';
import { useUIStore } from '../lib/store/uiStore';
import { useTenantData } from '../lib/store/queries/useTenantData';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function BusinessQRCardsModal({ isOpen, onClose }: Props) {
    const { showToast } = useUIStore();
    const { data: tenant, updateTenantData } = useTenantData();

    const businessName = tenant?.name || 'Mi Negocio';
    const businessSlug = tenant?.slug || '';
    const logoUrl = tenant?.logoUrl || '';

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.citalink.app';
    const bookingUrl = `${baseUrl}/reserva/${businessSlug}`;
    const reviewUrl = `${baseUrl}/review/${businessSlug}`;

    // Messages state
    const [bookingMsg, setBookingMsg] = useState<string>(
        (tenant as any)?.qr_booking_message || 'Agenda tu próxima cita aquí 👇'
    );
    const [reviewMsg, setReviewMsg] = useState<string>(
        (tenant as any)?.qr_review_message || '¿Cómo fue tu experiencia? Déjanos tu reseña 🌟'
    );

    const [isSavingMsgs, setIsSavingMsgs] = useState(false);
    const [isDownloadingBooking, setIsDownloadingBooking] = useState(false);
    const [isDownloadingReview, setIsDownloadingReview] = useState(false);
    const [copiedLink, setCopiedLink] = useState<'booking' | 'review' | null>(null);

    const bookingCardRef = useRef<HTMLDivElement>(null);
    const reviewCardRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const handleSaveMessages = async () => {
        try {
            setIsSavingMsgs(true);
            await updateTenantData({
                qr_booking_message: bookingMsg,
                qr_review_message: reviewMsg
            } as any);
            showToast('Mensajes guardados con éxito', 'success');
        } catch (err: any) {
            showToast('Error al guardar mensajes: ' + err.message, 'error');
        } finally {
            setIsSavingMsgs(false);
        }
    };

    const handleCopy = (url: string, type: 'booking' | 'review') => {
        navigator.clipboard.writeText(url);
        setCopiedLink(type);
        showToast('Enlace copiado al portapapeles', 'success');
        setTimeout(() => setCopiedLink(null), 2000);
    };

    const downloadCardPNG = async (ref: React.RefObject<HTMLDivElement | null>, filename: string, cardId: string, setDownloading: (val: boolean) => void) => {
        if (!ref.current) return;
        try {
            setDownloading(true);
            const canvas = await html2canvas(ref.current, {
                scale: 3, // 3x ultra-HD resolution for crisp print quality
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.querySelector(`[data-card-id="${cardId}"]`);
                    if (el) {
                        const nodes = el.querySelectorAll('*');
                        nodes.forEach((n: any) => {
                            n.style.letterSpacing = '0.02em';
                            n.style.wordSpacing = 'normal';
                        });

                        // Target general header & headline texts to shift them up visually by 16px
                        const generalTexts = el.querySelectorAll('h3, p, .qr-citalink-text span');
                        generalTexts.forEach((t: any) => {
                            t.style.transform = 'translateY(-16px)';
                        });

                        // Target footer business name specifically: remove overflow clipping, expand line height, shift up +1
                        const businessNameTexts = el.querySelectorAll('.qr-business-name');
                        businessNameTexts.forEach((t: any) => {
                            t.style.transform = 'translateY(-3px)';
                            t.style.overflow = 'visible';
                            t.style.lineHeight = '1.6';
                            t.style.display = 'inline-block';
                            t.style.position = 'relative';
                            t.style.zIndex = '10';
                        });
                    }
                }
            });
            const image = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            link.download = `${filename}.png`;
            link.href = image;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Hoja QR Tamaño Carta (PNG) descargada', 'success');
        } catch (err: any) {
            console.error('Error rendering QR card PNG:', err);
            showToast('Error al generar la imagen: ' + err.message, 'error');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto custom-scrollbar">
            <div className="bg-[#0b1329] border border-white/10 rounded-3xl max-w-5xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-auto relative">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 text-violet-400 rounded-2xl">
                            <QrCode size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Hojas QR Tamaño Carta (8.5" x 11")</h2>
                            <p className="text-xs text-slate-400">Descarga e imprime estas hojas limpias centradas en alta calidad para colocar en tu mostrador.</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Editable Messages Settings */}
                <div className="bg-slate-950/70 p-4 rounded-2xl border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <Edit2 size={13} className="text-amber-400" /> Personalizar Textos de las Hojas
                        </span>
                        <button
                            onClick={handleSaveMessages}
                            disabled={isSavingMsgs}
                            className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-all disabled:opacity-50 cursor-pointer shadow-md"
                        >
                            {isSavingMsgs ? 'Guardando...' : 'Guardar Textos'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                Texto Hoja de Reservas
                            </label>
                            <input
                                type="text"
                                value={bookingMsg}
                                onChange={(e) => setBookingMsg(e.target.value)}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                Texto Hoja de Reseñas
                            </label>
                            <input
                                type="text"
                                value={reviewMsg}
                                onChange={(e) => setReviewMsg(e.target.value)}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Printable Cards Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* ── HOJA 1: QR DE RESERVAS (TAMAÑO CARTA CENTRADO Perfect) ── */}
                    <div className="flex flex-col gap-3 items-center">
                        <div className="w-full flex items-center justify-between px-1">
                            <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                                <Calendar size={14} /> Hoja Tamaño Carta — Reservas
                            </span>
                            <button
                                onClick={() => handleCopy(bookingUrl, 'booking')}
                                className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg transition-all"
                            >
                                {copiedLink === 'booking' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                {copiedLink === 'booking' ? '¡Copiado!' : 'Copiar Link'}
                            </button>
                        </div>

                        {/* Scrollable preview wrapper for mobile viewports */}
                        <div className="w-full overflow-x-auto custom-scrollbar flex justify-center bg-black/40 p-3 rounded-2xl border border-white/5">
                            {/* FIXED 612px x 792px LETTER SIZE SHEET */}
                            <div
                                ref={bookingCardRef}
                                data-card-id="booking"
                                style={{
                                    width: '612px',
                                    height: '792px',
                                    minWidth: '612px',
                                    minHeight: '792px',
                                    letterSpacing: '0.02em',
                                    wordSpacing: 'normal',
                                    fontFamily: 'Arial, Helvetica, sans-serif'
                                }}
                                className="bg-white text-slate-900 border border-slate-300 rounded-3xl shadow-2xl flex flex-col shrink-0 box-border overflow-hidden"
                            >
                                {/* Header - Fixed Height */}
                                <div className="h-[140px] flex-none flex items-end justify-center pb-6">
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0">
                                            <Infinity className="w-7 h-7 text-white stroke-[2.5]" />
                                        </div>
                                        <div className="text-4xl font-bold flex items-center pt-1 qr-citalink-text" style={{ letterSpacing: '0.02em' }}>
                                            <span className="text-slate-900">Cita</span>
                                            <span className="text-violet-600">Link</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Body - Fills remaining space */}
                                <div className="flex-1 flex flex-col items-center justify-center space-y-8 px-12">
                                    {/* Headline Message */}
                                    <div className="space-y-3 max-w-[500px] text-center qr-headline-text">
                                        <h3
                                            className="text-3xl font-bold text-slate-900 px-2"
                                            style={{ letterSpacing: '0.02em', lineHeight: '1.35', wordBreak: 'break-word' }}
                                        >
                                            {bookingMsg}
                                        </h3>
                                        <p
                                            className="text-sm font-bold text-slate-500 uppercase"
                                            style={{ letterSpacing: '0.05em', lineHeight: '1.4' }}
                                        >
                                            Escanea con la cámara de tu celular para agendar al instante
                                        </p>
                                    </div>

                                    {/* Large Clean QR Code */}
                                    <div className="p-4 bg-white rounded-3xl border-4 border-slate-100 shadow-xl">
                                        <img
                                            decoding="async" loading="lazy"
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(bookingUrl)}`}
                                            alt={`QR Reservas ${businessName}`}
                                            className="w-56 h-56 object-contain"
                                            crossOrigin="anonymous"
                                        />
                                    </div>
                                </div>

                                {/* Footer - Fixed Height */}
                                <div className="h-[140px] flex-none flex items-start justify-center pt-6">
                                    <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-200 w-3/4 relative z-10">
                                        {logoUrl ? (
                                            <img decoding="async" loading="lazy" src={logoUrl} alt={businessName} className="w-12 h-12 mt-1 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0 relative z-10" />
                                        ) : null}
                                        <div className="flex flex-col justify-center max-w-[340px] py-1 relative z-10 overflow-visible">
                                            <span
                                                className="font-bold text-xl text-slate-800 whitespace-nowrap qr-business-name relative z-10 inline-block"
                                                style={{ letterSpacing: '0.02em', lineHeight: '1.6', overflow: 'visible' }}
                                            >
                                                {businessName}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Download Button */}
                        <button
                            onClick={() => downloadCardPNG(bookingCardRef, `Hoja_Carta_QR_Reservas_${businessSlug}`, 'booking', setIsDownloadingBooking)}
                            disabled={isDownloadingBooking}
                            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:brightness-110 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            <Download size={15} />
                            <span>{isDownloadingBooking ? 'Generando PNG Carta...' : 'Descargar Hoja Reservas (Tamaño Carta PNG)'}</span>
                        </button>
                    </div>

                    {/* ── HOJA 2: QR DE RESEÑAS (TAMAÑO CARTA CENTRADO Perfect) ── */}
                    <div className="flex flex-col gap-3 items-center">
                        <div className="w-full flex items-center justify-between px-1">
                            <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                <Star size={14} /> Hoja Tamaño Carta — Reseñas
                            </span>
                            <button
                                onClick={() => handleCopy(reviewUrl, 'review')}
                                className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg transition-all"
                            >
                                {copiedLink === 'review' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                {copiedLink === 'review' ? '¡Copiado!' : 'Copiar Link'}
                            </button>
                        </div>

                        {/* Scrollable preview wrapper for mobile viewports */}
                        <div className="w-full overflow-x-auto custom-scrollbar flex justify-center bg-black/40 p-3 rounded-2xl border border-white/5">
                            {/* FIXED 612px x 792px LETTER SIZE SHEET */}
                            <div
                                ref={reviewCardRef}
                                data-card-id="review"
                                style={{
                                    width: '612px',
                                    height: '792px',
                                    minWidth: '612px',
                                    minHeight: '792px',
                                    letterSpacing: '0.02em',
                                    wordSpacing: 'normal',
                                    fontFamily: 'Arial, Helvetica, sans-serif'
                                }}
                                className="bg-white text-slate-900 border border-slate-300 rounded-3xl shadow-2xl flex flex-col shrink-0 box-border overflow-hidden"
                            >
                                {/* Header - Fixed Height */}
                                <div className="h-[140px] flex-none flex items-end justify-center pb-6">
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0">
                                            <Infinity className="w-7 h-7 text-white stroke-[2.5]" />
                                        </div>
                                        <div className="text-4xl font-bold flex items-center pt-1 qr-citalink-text" style={{ letterSpacing: '0.02em' }}>
                                            <span className="text-slate-900">Cita</span>
                                            <span className="text-violet-600">Link</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Body - Fills remaining space */}
                                <div className="flex-1 flex flex-col items-center justify-center space-y-8 px-12">
                                    {/* Headline Message */}
                                    <div className="space-y-3 max-w-[500px] text-center qr-headline-text">
                                        <h3
                                            className="text-3xl font-bold text-slate-900 px-2"
                                            style={{ letterSpacing: '0.02em', lineHeight: '1.35', wordBreak: 'break-word' }}
                                        >
                                            {reviewMsg}
                                        </h3>
                                        <p
                                            className="text-sm font-bold text-slate-500 uppercase"
                                            style={{ letterSpacing: '0.05em', lineHeight: '1.4' }}
                                        >
                                            Escanea con la cámara de tu celular y déjanos tu opinión
                                        </p>
                                    </div>

                                    {/* Large Clean QR Code */}
                                    <div className="p-4 bg-white rounded-3xl border-4 border-slate-100 shadow-xl">
                                        <img
                                            decoding="async" loading="lazy"
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(reviewUrl)}`}
                                            alt={`QR Reseñas ${businessName}`}
                                            className="w-56 h-56 object-contain"
                                            crossOrigin="anonymous"
                                        />
                                    </div>
                                </div>

                                {/* Footer - Fixed Height */}
                                <div className="h-[140px] flex-none flex items-start justify-center pt-6">
                                    <div className="flex items-center justify-center gap-3 pt-4 border-t border-slate-200 w-3/4 relative z-10">
                                        {logoUrl ? (
                                            <img decoding="async" loading="lazy" src={logoUrl} alt={businessName} className="w-12 h-12 mt-1 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0 relative z-10" />
                                        ) : null}
                                        <div className="flex flex-col justify-center max-w-[340px] py-1 relative z-10 overflow-visible">
                                            <span
                                                className="font-bold text-xl text-slate-800 whitespace-nowrap qr-business-name relative z-10 inline-block"
                                                style={{ letterSpacing: '0.02em', lineHeight: '1.6', overflow: 'visible' }}
                                            >
                                                {businessName}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Download Button */}
                        <button
                            onClick={() => downloadCardPNG(reviewCardRef, `Hoja_Carta_QR_Resenas_${businessSlug}`, 'review', setIsDownloadingReview)}
                            disabled={isDownloadingReview}
                            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            <Download size={15} />
                            <span>{isDownloadingReview ? 'Generando PNG Carta...' : 'Descargar Hoja Reseñas (Tamaño Carta PNG)'}</span>
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
