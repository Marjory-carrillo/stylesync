import { ShieldAlert, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

interface PaymentBlockedScreenProps {
    businessName?: string;
}

export default function PaymentBlockedScreen({ businessName = 'tu negocio' }: PaymentBlockedScreenProps) {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    // Direct WhatsApp message link to you
    const supportPhone = '5213312345678'; // Reemplazar con tu número real
    const whatsappMessage = `Hola, mi negocio "${businessName}" está suspendido por pago en CitaLink. Me gustaría reactivar mi servicio.`;
    const whatsappUrl = `https://wa.me/${supportPhone}?text=${encodeURIComponent(whatsappMessage)}`;

    return (
        <div 
            className="min-h-screen flex flex-col items-center justify-center p-6 text-center select-none"
            style={{ background: 'radial-gradient(ellipse at 20% 50%, #0f1921 0%, #050c11 100%)' }}
        >
            <div className="max-w-md w-full bg-[#0a0f1a] border border-red-500/20 rounded-[2.5rem] p-10 text-center backdrop-blur-md shadow-[0_0_50px_rgba(239,68,68,0.1)] relative overflow-hidden animate-scale-in">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-transparent"></div>
                
                {/* Red warning shield indicator */}
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-lg shadow-red-500/5 animate-pulse-soft">
                    <ShieldAlert size={38} />
                </div>
                
                <h2 className="text-3xl font-black text-white mb-3 tracking-tight uppercase">Servicio Suspendido</h2>
                <p className="text-slate-400 mb-6 leading-relaxed text-sm">
                    El acceso a la administración de <span className="text-white font-bold">"{businessName}"</span> se encuentra temporalmente inactivo debido a un cargo pendiente o falta de pago.
                </p>
                
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 mb-8 text-xs text-slate-500 italic">
                    "Tus clientes y citas siguen registrados, pero necesitas reactivar tu suscripción para gestionar el panel."
                </div>
                
                <div className="space-y-3">
                    <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <MessageCircle size={18} />
                        Contactar Soporte (Reactivar)
                    </a>
                    
                    <button
                        onClick={handleLogout}
                        className="w-full py-4 px-6 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-400 hover:text-white font-bold uppercase tracking-widest text-xs transition-all"
                    >
                        Cerrar Sesión
                    </button>
                </div>
            </div>
            
            <p className="mt-8 text-slate-600 text-xs font-bold uppercase tracking-widest">
                CitaLink SASS
            </p>
        </div>
    );
}
