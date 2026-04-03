import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/store/authStore';
import { Building2, ChevronRight, Infinity as InfinityIcon, Scissors, Sparkles, Flower2, Briefcase, MoreHorizontal, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const CATEGORY_ICONS: Record<string, any> = {
    barbershop: Scissors,
    beauty_salon: Sparkles,
    nail_bar: Sparkles,
    spa: Flower2,
    consulting: Briefcase,
    other: MoreHorizontal,
};

const CATEGORY_LABELS: Record<string, string> = {
    barbershop: 'Barbería',
    beauty_salon: 'Salón de Belleza',
    nail_bar: "Nail's",
    spa: 'Spa',
    consulting: 'Clínica',
    other: 'Otro',
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    barbershop: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
    beauty_salon: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400', glow: 'shadow-pink-500/20' },
    nail_bar: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', glow: 'shadow-rose-500/20' },
    spa: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
    consulting: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
    other: { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400', glow: 'shadow-slate-500/20' },
};

export default function SelectBusiness() {
    const { userTenants, switchActiveTenant, user } = useAuthStore();
    const navigate = useNavigate();

    const lastUsed = localStorage.getItem('citalink_tenant_id');

    const handleSelect = (tenantId: string) => {
        switchActiveTenant(tenantId);
        navigate('/admin', { replace: true });
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden" style={{ background: 'radial-gradient(ellipse at 30% 20%, #0f1921 0%, #050c11 100%)' }}>
            {/* Ambient glows */}
            <div className="absolute top-[-15%] right-[-10%] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

            {/* Header */}
            <div className="text-center mb-10 relative z-10 animate-fade-in">
                <div className="mx-auto mb-4 flex items-center justify-center">
                    <div className="relative flex items-center justify-center w-14 h-14">
                        <div className="absolute inset-0 bg-violet-500 blur-xl opacity-30 rounded-full"></div>
                        <InfinityIcon className="w-14 h-14 text-violet-400 relative z-10" strokeWidth={2.5} />
                    </div>
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2">
                    ¿A cuál sucursal quieres entrar?
                </h1>
                <p className="text-slate-500 text-sm max-w-md mx-auto">
                    Tienes acceso a <span className="text-white font-bold">{userTenants.length} negocios</span>. Selecciona uno para administrarlo.
                </p>
            </div>

            {/* Business Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl w-full relative z-10">
                {userTenants.map((tenant, idx) => {
                    const cat = tenant.category || 'other';
                    const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
                    const IconComponent = CATEGORY_ICONS[cat] || Building2;
                    const label = CATEGORY_LABELS[cat] || cat;
                    const isLast = tenant.id === lastUsed;

                    return (
                        <button
                            key={tenant.id}
                            onClick={() => handleSelect(tenant.id)}
                            className={`group relative text-left p-6 rounded-[1.8rem] border transition-all duration-500 hover:scale-[1.03] active:scale-[0.98] overflow-hidden animate-scale-in ${
                                isLast
                                    ? `${colors.bg} ${colors.border} shadow-xl ${colors.glow}`
                                    : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/20'
                            }`}
                            style={{ animationDelay: `${idx * 0.08}s` }}
                        >
                            {/* Glow on hover */}
                            <div className="absolute -right-6 -top-6 w-20 h-20 bg-white/[0.03] blur-xl rounded-full group-hover:bg-white/[0.06] transition-colors" />

                            {/* Last-used badge */}
                            {isLast && (
                                <div className="absolute top-3 right-3">
                                    <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${colors.text} px-2 py-0.5 rounded-full ${colors.bg} border ${colors.border}`}>
                                        Reciente
                                    </span>
                                </div>
                            )}

                            {/* Logo / Icon */}
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border ${
                                isLast ? `${colors.bg} ${colors.border}` : 'bg-white/5 border-white/10'
                            } overflow-hidden shadow-lg`}>
                                {tenant.logoUrl ? (
                                    <img src={tenant.logoUrl} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <IconComponent size={24} className={isLast ? colors.text : 'text-slate-500 group-hover:text-white transition-colors'} />
                                )}
                            </div>

                            {/* Name */}
                            <h3 className="text-lg font-black text-white tracking-tight mb-1 uppercase leading-tight">
                                {tenant.name}
                            </h3>

                            {/* Category + Slug */}
                            <div className="flex items-center gap-2 mb-4">
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${isLast ? colors.text : 'text-slate-500'}`}>
                                    {label}
                                </span>
                                <span className="text-slate-700">•</span>
                                <span className="text-[10px] text-slate-600 font-mono truncate">
                                    citalink.app/{tenant.slug}
                                </span>
                            </div>

                            {/* CTA */}
                            <div className={`flex items-center gap-2 text-sm font-bold ${isLast ? colors.text : 'text-slate-400 group-hover:text-white'} transition-colors`}>
                                <span>Administrar</span>
                                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="mt-10 relative z-10 flex flex-col items-center gap-3">
                <p className="text-xs text-slate-600">
                    Sesión activa: <span className="text-slate-400 font-medium">{user?.email}</span>
                </p>
                <button
                    onClick={() => supabase.auth.signOut()}
                    className="flex items-center gap-2 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                >
                    <LogOut size={12} /> Cerrar Sesión
                </button>
            </div>
        </div>
    );
}
