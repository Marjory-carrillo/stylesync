import { useState, useEffect } from 'react';
import { ShieldAlert, MessageCircle, Check, Star, Sparkles, LogOut, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store/authStore';
import { useStripeCheckout } from '../lib/store/queries/useStripeCheckout';

interface PaymentBlockedScreenProps {
    businessName?: string;
}

export default function PaymentBlockedScreen({ businessName = 'tu negocio' }: PaymentBlockedScreenProps) {
    const navigate = useNavigate();
    const { tenantId } = useAuthStore();
    const { redirectToCheckout, isCheckoutLoading } = useStripeCheckout();
    const [barberCount, setBarberCount] = useState<number | null>(null);
    const [loadingCount, setLoadingCount] = useState(true);

    useEffect(() => {
        const fetchBarberCount = async () => {
            if (!tenantId) {
                setLoadingCount(false);
                return;
            }
            try {
                const { count, error } = await supabase
                    .from('stylists')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId);

                if (!error && count !== null) {
                    setBarberCount(count);
                }
            } catch (err) {
                console.error("Error fetching stylists count:", err);
            } finally {
                setLoadingCount(false);
            }
        };
        fetchBarberCount();
    }, [tenantId]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    // Direct WhatsApp message link for manual/custom support
    const supportPhone = '528681239154'; 
    const whatsappMessage = `Hola, mi negocio "${businessName}" está suspendido por pago en CitaLink. Me gustaría reactivar mi servicio.`;
    const whatsappUrl = `https://wa.me/${supportPhone}?text=${encodeURIComponent(whatsappMessage)}`;

    const recommendedPlan: 'lite' | 'pro' = barberCount === 1 ? 'lite' : 'pro';

    return (
        <div 
            className="min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8 text-center select-none"
            style={{ background: 'radial-gradient(ellipse at 50% 50%, #0f172a 0%, #020617 100%)' }}
        >
            <div className="max-w-4xl w-full bg-[#0a0f24]/80 border border-red-500/10 rounded-[3rem] p-6 md:p-12 text-center backdrop-blur-xl shadow-[0_0_80px_rgba(239,68,68,0.07)] relative overflow-hidden animate-scale-in">
                {/* Red animated top accent line */}
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-red-500 to-transparent"></div>
                
                {/* Header Section */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 animate-pulse-soft shadow-lg shadow-red-500/5">
                        <ShieldAlert size={32} />
                    </div>
                    
                    <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase">
                        Realiza tu pago para seguir con CitaLink 🚀
                    </h2>
                    <p className="text-slate-400 mt-3 max-w-2xl leading-relaxed text-sm md:text-base">
                        Tu período de prueba o de gracia para <span className="text-white font-bold">"{businessName}"</span> ha expirado. 
                        Elige uno de nuestros planes recomendados a continuación para reactivar tu servicio al instante.
                    </p>

                    {!loadingCount && barberCount !== null && (
                        <div className="mt-4 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                            <Sparkles size={14} className="animate-pulse" />
                            <span>
                                Detectamos <strong>{barberCount} profesional{barberCount > 1 ? 'es' : ''}</strong> registrado{barberCount > 1 ? 's' : ''}. 
                                Te recomendamos el plan <strong>{recommendedPlan === 'lite' ? 'Esencial' : 'Pro'}</strong>.
                            </span>
                        </div>
                    )}
                </div>

                {/* Plans Grid */}
                <div className="grid md:grid-cols-2 gap-6 mb-10 max-w-3xl mx-auto">
                    {/* Plan Esencial (Lite) */}
                    <div className={`relative rounded-3xl p-6 transition-all duration-300 border flex flex-col text-left group ${
                        recommendedPlan === 'lite' 
                            ? 'bg-[#111827] border-teal-500/40 shadow-[0_0_30px_rgba(20,184,166,0.15)] scale-[1.02] md:scale-[1.03]' 
                            : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
                    }`}>
                        {recommendedPlan === 'lite' && (
                            <span className="absolute -top-3.5 right-6 px-3.5 py-1 text-[10px] font-black uppercase tracking-widest text-teal-400 bg-teal-500/10 border border-teal-500/30 rounded-full flex items-center gap-1 shadow-sm">
                                <Star size={10} className="fill-teal-400" /> Recomendado
                            </span>
                        )}
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                Plan Esencial
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Ideal para profesionales individuales</p>
                        </div>
                        <div className="flex items-baseline gap-1 my-3">
                            <span className="text-3xl font-black text-white">$349</span>
                            <span className="text-slate-400 text-xs font-semibold uppercase">MXN/mes</span>
                        </div>
                        <ul className="space-y-2.5 my-6 text-xs text-slate-300 flex-1">
                            <li className="flex items-center gap-2.5">
                                <span className="p-0.5 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0"><Check size={12} strokeWidth={3} /></span>
                                <span>1 Profesional incluido</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                                <span className="p-0.5 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0"><Check size={12} strokeWidth={3} /></span>
                                <span>Citas Ilimitadas 24/7</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                                <span className="p-0.5 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0"><Check size={12} strokeWidth={3} /></span>
                                <span>Recordatorios por WhatsApp</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                                <span className="p-0.5 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0"><Check size={12} strokeWidth={3} /></span>
                                <span>App PWA Instalable</span>
                            </li>
                        </ul>
                        <button
                            onClick={() => redirectToCheckout('lite')}
                            disabled={isCheckoutLoading}
                            className={`w-full py-3.5 px-6 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] ${
                                recommendedPlan === 'lite'
                                    ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/20'
                                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/5'
                            }`}
                        >
                            {isCheckoutLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>Pagar Esencial <ArrowRight size={14} /></>
                            )}
                        </button>
                    </div>
 
                    {/* Plan Pro */}
                    <div className={`relative rounded-3xl p-6 transition-all duration-300 border flex flex-col text-left group ${
                        recommendedPlan === 'pro' 
                            ? 'bg-[#111827] border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.15)] scale-[1.02] md:scale-[1.03]' 
                            : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10'
                    }`}>
                        {recommendedPlan === 'pro' && (
                            <span className="absolute -top-3.5 right-6 px-3.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center gap-1 shadow-sm">
                                <Star size={10} className="fill-amber-400" /> Recomendado
                            </span>
                        )}
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                Plan Pro
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Para equipos y salones en crecimiento</p>
                        </div>
                        <div className="flex items-baseline gap-1 my-3">
                            <span className="text-3xl font-black text-white">$649</span>
                            <span className="text-slate-400 text-xs font-semibold uppercase">MXN/mes</span>
                        </div>
                        <ul className="space-y-2.5 my-6 text-xs text-slate-300 flex-1">
                            <li className="flex items-center gap-2.5">
                                <span className="p-0.5 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0"><Check size={12} strokeWidth={3} /></span>
                                <span>2 Profesionales incluidos (+249/mes c/u)</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                                <span className="p-0.5 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0"><Check size={12} strokeWidth={3} /></span>
                                <span>Todo el plan Esencial</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                                <span className="p-0.5 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0"><Check size={12} strokeWidth={3} /></span>
                                <span>Nóminas y Reportes en PDF</span>
                            </li>
                        </ul>
                        <button
                            onClick={() => redirectToCheckout('pro')}
                            disabled={isCheckoutLoading}
                            className={`w-full py-3.5 px-6 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] ${
                                recommendedPlan === 'pro'
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20'
                                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/5'
                            }`}
                        >
                            {isCheckoutLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>Pagar Pro <ArrowRight size={14} /></>
                            )}
                        </button>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 border-t border-white/5 pt-8 max-w-md mx-auto">
                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto py-3 px-6 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <MessageCircle size={16} /> Contactar Soporte
                    </a>
                    
                    <button
                        onClick={handleLogout}
                        className="w-full sm:w-auto py-3 px-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <LogOut size={16} /> Cerrar Sesión
                    </button>
                </div>
            </div>
            
            <p className="mt-8 text-slate-600 text-xs font-bold uppercase tracking-widest">
                CitaLink SASS
            </p>
        </div>
    );
}
