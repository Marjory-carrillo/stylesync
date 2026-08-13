import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useReviews } from '../lib/store/queries/useReviews';
import { Star, CheckCircle2, ArrowRight, Store, Sparkles, MapPin } from 'lucide-react';

export default function PublicReview() {
    const { slug } = useParams<{ slug: string }>();

    const { data: tenant, isLoading: isTenantLoading } = useQuery({
        queryKey: ['public_tenant_review', slug],
        queryFn: async () => {
            if (!slug) return null;
            const { data, error } = await supabase
                .from('tenants')
                .select('id, name, slug, logo_url, address')
                .eq('slug', slug)
                .single();

            if (error) {
                console.warn('[PublicReview] Error fetching tenant:', error);
                return null;
            }
            return data;
        },
        enabled: !!slug,
    });

    const tenantId = tenant?.id;
    const { addReview, isAdding } = useReviews(tenantId);

    const [rating, setRating] = useState<number>(5);
    const [hoverRating, setHoverRating] = useState<number | null>(null);
    const [clientName, setClientName] = useState<string>('');
    const [comment, setComment] = useState<string>('');
    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenantId) return;
        setErrorMsg(null);

        try {
            await addReview({
                tenantId,
                clientName: clientName.trim() || 'Cliente Anónimo',
                rating,
                comment: comment.trim() || undefined
            });
            setIsSubmitted(true);
        } catch (err: any) {
            console.error('Error submitting review:', err);
            setErrorMsg(err.message || 'Ocurrió un error al enviar la reseña');
        }
    };

    if (isTenantLoading) {
        return (
            <div className="min-h-screen bg-[#0a0f1d] flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
                    <p className="text-sm font-semibold text-slate-400">Cargando...</p>
                </div>
            </div>
        );
    }

    if (!tenant) {
        return (
            <div className="min-h-screen bg-[#0a0f1d] flex items-center justify-center p-4">
                <div className="glass-panel p-8 rounded-3xl max-w-md w-full text-center space-y-4 border border-white/10">
                    <Store className="w-12 h-12 text-slate-500 mx-auto" />
                    <h2 className="text-xl font-bold text-white">Negocio No Encontrado</h2>
                    <p className="text-sm text-slate-400">El enlace de reseñas no corresponde a ningún negocio activo.</p>
                </div>
            </div>
        );
    }

    const businessName = tenant.name || 'El Negocio';
    const activeRating = hoverRating !== null ? hoverRating : rating;

    return (
        <div className="min-h-screen bg-[#070b16] text-white flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-hidden">
            {/* Background Glow Effects */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

            {/* Header / Brand Badge */}
            <header className="w-full max-w-md flex items-center justify-between py-4 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center font-black text-slate-950 text-xs shadow-lg shadow-emerald-500/20">
                        CL
                    </div>
                    <span className="font-black tracking-tight text-sm text-white">CitaLink</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    Reseña Oficial
                </span>
            </header>

            {/* Main Content Container */}
            <main className="w-full max-w-md my-auto py-6 relative z-10">
                {!isSubmitted ? (
                    <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fade-in">
                        {/* Business Info Header */}
                        <div className="text-center space-y-3">
                            {tenant.logo_url ? (
                                <img
                                    src={tenant.logo_url}
                                    alt={businessName}
                                    className="w-20 h-20 rounded-2xl mx-auto object-cover border-2 border-white/10 shadow-xl"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-xl">
                                    <Store className="w-10 h-10" />
                                </div>
                            )}

                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight">{businessName}</h1>
                                {tenant.address && (
                                    <p className="text-xs text-slate-400 flex items-center justify-center gap-1 mt-1">
                                        <MapPin className="w-3.5 h-3.5 text-rose-400" />
                                        <span>{tenant.address}</span>
                                    </p>
                                )}
                            </div>

                            <p className="text-xs text-slate-300 font-medium">
                                ¿Cómo fue tu experiencia hoy? Califica tu servicio:
                            </p>
                        </div>

                        {/* Interactive Star Rating */}
                        <div className="flex flex-col items-center gap-2 py-2">
                            <div className="flex items-center justify-center gap-2">
                                {[1, 2, 3, 4, 5].map((star) => {
                                    const isFilled = star <= activeRating;
                                    return (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setRating(star)}
                                            onMouseEnter={() => setHoverRating(star)}
                                            onMouseLeave={() => setHoverRating(null)}
                                            className="p-1.5 transition-transform hover:scale-125 active:scale-95 cursor-pointer focus:outline-none"
                                            title={`${star} estrellas`}
                                        >
                                            <Star
                                                className={`w-9 h-9 sm:w-10 sm:h-10 transition-colors duration-200 ${
                                                    isFilled
                                                        ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                                                        : 'text-slate-600 hover:text-slate-400'
                                                }`}
                                            />
                                        </button>
                                    );
                                })}
                            </div>

                            <span className="text-xs font-bold text-amber-400 tracking-wide mt-1">
                                {activeRating === 5 && '🌟 ¡Excelente! Excelente experiencia'}
                                {activeRating === 4 && '😊 ¡Muy Bueno! Gran servicio'}
                                {activeRating === 3 && '😐 Normal. Aceptable'}
                                {activeRating === 2 && '🙁 Regular. Puede mejorar'}
                                {activeRating === 1 && '😞 Mala experiencia'}
                            </span>
                        </div>

                        {/* Form Inputs */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Tu Nombre (opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: Valeria Hernández"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 transition-colors font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Tu Comentario o Reseña (opcional)
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Cuéntanos qué fue lo que más te gustó o qué podemos mejorar..."
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60 transition-colors font-medium resize-none"
                                />
                            </div>

                            {errorMsg && (
                                <p className="text-xs text-rose-400 font-semibold text-center bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                                    {errorMsg}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={isAdding}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                {isAdding ? (
                                    <span>Guardando...</span>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        <span>Enviar Reseña</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                ) : (
                    /* Thank You Celebration Screen */
                    <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-8 text-center space-y-6 shadow-2xl animate-fade-in">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto text-slate-950 shadow-xl shadow-amber-500/30 animate-bounce">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-white">¡Muchas Gracias!</h2>
                            <p className="text-sm text-slate-300 leading-relaxed font-medium">
                                Tu reseña de <span className="text-amber-400 font-bold">{rating} estrellas</span> para <strong className="text-white">{businessName}</strong> ha sido enviada exitosamente.
                            </p>
                        </div>

                        <div className="pt-2 flex flex-col gap-3">
                            <Link
                                to={`/reserva/${slug}`}
                                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                            >
                                <span>Agendar Mi Próxima Cita</span>
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="w-full max-w-md text-center py-4 text-xs text-slate-500 relative z-10">
                <span>Powered by </span>
                <span className="font-bold text-slate-400">CitaLink</span>
            </footer>
        </div>
    );
}
