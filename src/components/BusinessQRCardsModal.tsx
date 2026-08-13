import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { Download, Copy, Check, QrCode, Calendar, Star, X, Edit2 } from 'lucide-react';
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
            showToast('Mensajes de tarjetas QR guardados', 'success');
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

    const downloadCardPNG = async (ref: React.RefObject<HTMLDivElement | null>, filename: string, setDownloading: (val: boolean) => void) => {
        if (!ref.current) return;
        try {
            setDownloading(true);
            // Ensure images inside the card are loaded
            const canvas = await html2canvas(ref.current, {
                scale: 3, // High DPI rendering for crisp print quality
                useCORS: true,
                backgroundColor: '#070b16',
                logging: false,
            });
            const image = canvas.toDataURL('image/png', 1.0);
            const link = document.createElement('a');
            link.download = `${filename}.png`;
            link.href = image;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Tarjeta QR descargada con éxito', 'success');
        } catch (err: any) {
            console.error('Error rendering QR card PNG:', err);
            showToast('Error al generar la imagen QR: ' + err.message, 'error');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto custom-scrollbar">
            <div className="bg-[#0b1329] border border-white/10 rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8 relative">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400 rounded-2xl">
                            <QrCode size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Tarjetas QR Imprimibles</h2>
                            <p className="text-xs text-slate-400">Imprime y coloca estas tarjetas en tu mostrador o espejos para tus clientes.</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Editable Messages Bar */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Edit2 size={13} className="text-amber-400" /> Personalizar Mensajes en Tarjetas
                        </span>
                        <button
                            onClick={handleSaveMessages}
                            disabled={isSavingMsgs}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all text-xs font-bold disabled:opacity-50"
                        >
                            {isSavingMsgs ? 'Guardando...' : 'Guardar Mensajes'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                Mensaje en Tarjeta de Reservas
                            </label>
                            <input
                                type="text"
                                value={bookingMsg}
                                onChange={(e) => setBookingMsg(e.target.value)}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                Mensaje en Tarjeta de Reseñas
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

                {/* Printable Cards Grid (Preview & Render Targets) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* ── CARD 1: QR DE RESERVAS ── */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                                <Calendar size={14} /> Tarjeta QR — Reservas
                            </span>
                            <button
                                onClick={() => handleCopy(bookingUrl, 'booking')}
                                className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg transition-all"
                            >
                                {copiedLink === 'booking' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                {copiedLink === 'booking' ? '¡Copiado!' : 'Copiar Link'}
                            </button>
                        </div>

                        {/* Card Target for html2canvas */}
                        <div
                            ref={bookingCardRef}
                            className="bg-gradient-to-b from-[#0a1128] via-[#070b16] to-[#04070e] border-2 border-cyan-500/30 rounded-3xl p-6 flex flex-col items-center justify-between text-center shadow-2xl relative overflow-hidden aspect-[4/5] min-h-[380px]"
                        >
                            {/* Decorative Background Accents */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                            {/* CitaLink Top Header Badge */}
                            <div className="flex items-center gap-2 bg-slate-900/90 border border-cyan-500/30 px-3.5 py-1.5 rounded-full shadow-lg">
                                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center font-black text-slate-950 text-[9px]">
                                    CL
                                </div>
                                <span className="font-black tracking-tight text-xs text-white">CitaLink</span>
                            </div>

                            {/* Message Header */}
                            <div className="my-auto py-2 space-y-1">
                                <p className="text-base sm:text-lg font-black text-white leading-tight px-2">
                                    {bookingMsg}
                                </p>
                            </div>

                            {/* QR Code Container */}
                            <div className="p-3 bg-white rounded-2xl shadow-2xl border-4 border-slate-900 my-auto">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(bookingUrl)}`}
                                    alt={`QR Reservas ${businessName}`}
                                    className="w-40 h-40 object-contain"
                                    crossOrigin="anonymous"
                                />
                            </div>

                            {/* Business Footer */}
                            <div className="mt-auto pt-3 flex items-center gap-2 border-t border-white/10 w-full justify-center">
                                {logoUrl ? (
                                    <img src={logoUrl} alt={businessName} className="w-6 h-6 rounded-lg object-cover border border-white/20" />
                                ) : null}
                                <span className="font-black text-xs text-slate-200 truncate max-w-[200px]">{businessName}</span>
                            </div>
                        </div>

                        {/* Download PNG Button */}
                        <button
                            onClick={() => downloadCardPNG(bookingCardRef, `Tarjeta_QR_Reservas_${businessSlug}`, setIsDownloadingBooking)}
                            disabled={isDownloadingBooking}
                            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            <Download size={15} />
                            <span>{isDownloadingBooking ? 'Generando PNG...' : 'Descargar Tarjeta QR Reservas (PNG)'}</span>
                        </button>
                    </div>

                    {/* ── CARD 2: QR DE RESEÑAS ── */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                                <Star size={14} /> Tarjeta QR — Reseñas
                            </span>
                            <button
                                onClick={() => handleCopy(reviewUrl, 'review')}
                                className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg transition-all"
                            >
                                {copiedLink === 'review' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                {copiedLink === 'review' ? '¡Copiado!' : 'Copiar Link'}
                            </button>
                        </div>

                        {/* Card Target for html2canvas */}
                        <div
                            ref={reviewCardRef}
                            className="bg-gradient-to-b from-[#181106] via-[#070b16] to-[#04070e] border-2 border-amber-500/30 rounded-3xl p-6 flex flex-col items-center justify-between text-center shadow-2xl relative overflow-hidden aspect-[4/5] min-h-[380px]"
                        >
                            {/* Decorative Background Accents */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

                            {/* CitaLink Top Header Badge */}
                            <div className="flex items-center gap-2 bg-slate-900/90 border border-amber-500/30 px-3.5 py-1.5 rounded-full shadow-lg">
                                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-black text-slate-950 text-[9px]">
                                    CL
                                </div>
                                <span className="font-black tracking-tight text-xs text-white">CitaLink</span>
                            </div>

                            {/* Message Header */}
                            <div className="my-auto py-2 space-y-1">
                                <p className="text-base sm:text-lg font-black text-white leading-tight px-2">
                                    {reviewMsg}
                                </p>
                            </div>

                            {/* QR Code Container */}
                            <div className="p-3 bg-white rounded-2xl shadow-2xl border-4 border-slate-900 my-auto">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(reviewUrl)}`}
                                    alt={`QR Reseñas ${businessName}`}
                                    className="w-40 h-40 object-contain"
                                    crossOrigin="anonymous"
                                />
                            </div>

                            {/* Business Footer */}
                            <div className="mt-auto pt-3 flex items-center gap-2 border-t border-white/10 w-full justify-center">
                                {logoUrl ? (
                                    <img src={logoUrl} alt={businessName} className="w-6 h-6 rounded-lg object-cover border border-white/20" />
                                ) : null}
                                <span className="font-black text-xs text-slate-200 truncate max-w-[200px]">{businessName}</span>
                            </div>
                        </div>

                        {/* Download PNG Button */}
                        <button
                            onClick={() => downloadCardPNG(reviewCardRef, `Tarjeta_QR_Resenas_${businessSlug}`, setIsDownloadingReview)}
                            disabled={isDownloadingReview}
                            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            <Download size={15} />
                            <span>{isDownloadingReview ? 'Generando PNG...' : 'Descargar Tarjeta QR Reseñas (PNG)'}</span>
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
