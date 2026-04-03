import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/store/authStore';
import {
    Building2, ChevronRight, Infinity as InfinityIcon,
    Scissors, Sparkles, Flower2, Briefcase, MoreHorizontal, LogOut,
} from 'lucide-react';
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

const CATEGORY_STYLES: Record<string, {
    accent: string; border: string; text: string; glow: string;
    iconBg: string; btnGradient: string; badgeBg: string; stripe: string;
}> = {
    barbershop: {
        accent: 'bg-amber-500', border: 'border-amber-500/30', text: 'text-amber-400',
        glow: '0 0 50px rgba(245,158,11,0.18)', iconBg: 'from-amber-500/40 to-orange-600/30',
        btnGradient: 'from-amber-500 to-orange-500', badgeBg: 'bg-amber-500/10 border-amber-500/20',
        stripe: 'bg-gradient-to-b from-amber-500 to-orange-500',
    },
    beauty_salon: {
        accent: 'bg-pink-500', border: 'border-pink-500/30', text: 'text-pink-400',
        glow: '0 0 50px rgba(236,72,153,0.18)', iconBg: 'from-pink-500/40 to-rose-600/30',
        btnGradient: 'from-pink-500 to-rose-500', badgeBg: 'bg-pink-500/10 border-pink-500/20',
        stripe: 'bg-gradient-to-b from-pink-500 to-rose-500',
    },
    nail_bar: {
        accent: 'bg-rose-500', border: 'border-rose-500/30', text: 'text-rose-400',
        glow: '0 0 50px rgba(244,63,94,0.18)', iconBg: 'from-rose-500/40 to-pink-600/30',
        btnGradient: 'from-rose-500 to-pink-500', badgeBg: 'bg-rose-500/10 border-rose-500/20',
        stripe: 'bg-gradient-to-b from-rose-500 to-pink-500',
    },
    spa: {
        accent: 'bg-emerald-500', border: 'border-emerald-500/30', text: 'text-emerald-400',
        glow: '0 0 50px rgba(16,185,129,0.18)', iconBg: 'from-emerald-500/40 to-teal-600/30',
        btnGradient: 'from-emerald-500 to-teal-500', badgeBg: 'bg-emerald-500/10 border-emerald-500/20',
        stripe: 'bg-gradient-to-b from-emerald-500 to-teal-500',
    },
    consulting: {
        accent: 'bg-blue-500', border: 'border-blue-500/30', text: 'text-blue-400',
        glow: '0 0 50px rgba(59,130,246,0.18)', iconBg: 'from-blue-500/40 to-indigo-600/30',
        btnGradient: 'from-blue-500 to-indigo-500', badgeBg: 'bg-blue-500/10 border-blue-500/20',
        stripe: 'bg-gradient-to-b from-blue-500 to-indigo-500',
    },
    other: {
        accent: 'bg-violet-500', border: 'border-violet-500/30', text: 'text-violet-400',
        glow: '0 0 50px rgba(139,92,246,0.18)', iconBg: 'from-violet-500/40 to-purple-600/30',
        btnGradient: 'from-violet-500 to-purple-500', badgeBg: 'bg-violet-500/10 border-violet-500/20',
        stripe: 'bg-gradient-to-b from-violet-500 to-purple-500',
    },
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
        <div
            className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at 30% 20%, #0a1018 0%, #040b10 100%)' }}
        >
            {/* Ambient glows */}
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-violet-500/8 rounded-full blur-[180px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
            <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] bg-blue-500/6 rounded-full blur-[150px] pointer-events-none animate-pulse" style={{ animationDuration: '12s' }} />

            {/* Header */}
            <div className="text-center mb-10 relative z-10 animate-fade-in">
                <div className="mx-auto mb-6 flex items-center justify-center">
                    <div className="relative flex items-center justify-center w-16 h-16 group cursor-default">
                        <div className="absolute inset-0 bg-violet-500 blur-2xl opacity-30 rounded-full group-hover:opacity-50 transition-opacity" />
                        <div className="absolute inset-[-4px] rounded-full bg-gradient-to-br from-violet-500/20 to-transparent" />
                        <InfinityIcon className="w-16 h-16 text-violet-400 relative z-10 drop-shadow-lg" strokeWidth={2.5} />
                    </div>
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3 leading-tight">
                    Selecciona tu sucursal
                </h1>
                <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
                    Tienes{' '}
                    <span className="text-violet-400 font-bold">{userTenants.length} negocios</span>{' '}
                    bajo tu cuenta. Elige uno para administrarlo.
                </p>
            </div>

            {/* Cards Grid */}
            <div className={`grid gap-5 max-w-5xl w-full relative z-10 ${
                userTenants.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-3xl' :
                userTenants.length >= 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
                'grid-cols-1 max-w-md'
            }`}>
                {userTenants.map((tenant, idx) => {
                    const cat = tenant.category || 'other';
                    const styles = CATEGORY_STYLES[cat] || CATEGORY_STYLES.other;
                    const IconComponent = CATEGORY_ICONS[cat] || Building2;
                    const label = CATEGORY_LABELS[cat] || cat;
                    const isRecent = tenant.id === lastUsed;

                    return (
                        <button
                            key={tenant.id}
                            onClick={() => handleSelect(tenant.id)}
                            className={`group relative text-left rounded-2xl border overflow-hidden transition-all duration-400 hover:scale-[1.03] active:scale-[0.98] animate-scale-in ${
                                isRecent ? styles.border : 'border-white/[0.07] hover:border-white/20'
                            }`}
                            style={{
                                animationDelay: `${idx * 0.1}s`,
                                background: isRecent ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                                boxShadow: isRecent ? styles.glow : 'none',
                            }}
                        >
                            {/* Top accent stripe */}
                            <div className={`h-[3px] w-full ${styles.stripe} opacity-${isRecent ? '100' : '0'} group-hover:opacity-100 transition-opacity duration-400`} />

                            {/* Inner gradient overlay on hover */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none" />

                            <div className="relative z-10 p-6">
                                {/* Recent badge */}
                                {isRecent && (
                                    <div className="absolute top-4 right-4">
                                        <span className={`text-[8px] font-black uppercase tracking-[0.22em] ${styles.text} px-2.5 py-1 rounded-full border ${styles.badgeBg} backdrop-blur-sm`}>
                                            ✦ Reciente
                                        </span>
                                    </div>
                                )}

                                {/* Logo / Icon */}
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border overflow-hidden transition-all duration-300 group-hover:scale-110 ${
                                    isRecent
                                        ? `${styles.border} bg-gradient-to-br ${styles.iconBg}`
                                        : 'border-white/10 bg-white/[0.04] group-hover:border-white/20'
                                }`}>
                                    {tenant.logoUrl ? (
                                        <img src={tenant.logoUrl} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <IconComponent
                                            size={28}
                                            className={`transition-colors duration-300 ${isRecent ? styles.text : `text-slate-400 group-hover:${styles.text}`}`}
                                        />
                                    )}
                                </div>

                                {/* Name */}
                                <h3 className="text-lg font-black text-white tracking-tight mb-1 uppercase leading-tight line-clamp-2">
                                    {tenant.name}
                                </h3>

                                {/* Category + Slug */}
                                <div className="flex items-center gap-2 mb-5 flex-wrap">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isRecent ? styles.text : 'text-slate-500 group-hover:text-slate-400'} transition-colors`}>
                                        {label}
                                    </span>
                                    <span className="text-slate-700">•</span>
                                    <span className="text-[10px] text-slate-600 font-mono truncate">
                                        /{tenant.slug}
                                    </span>
                                </div>

                                {/* CTA Button */}
                                <div className={`inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-300 ${
                                    isRecent
                                        ? `bg-gradient-to-r ${styles.btnGradient} text-white shadow-lg`
                                        : 'bg-white/[0.04] text-slate-400 border border-white/[0.07] group-hover:bg-white/[0.08] group-hover:text-white group-hover:border-white/15'
                                }`}>
                                    <span>Administrar</span>
                                    <ChevronRight size={16} className="group-hover:translate-x-1.5 transition-transform duration-300" />
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="mt-12 relative z-10 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-xs text-slate-500">
                        Sesión activa:{' '}
                        <span className="text-slate-300 font-medium">{user?.email}</span>
                    </p>
                </div>
                <button
                    onClick={() => supabase.auth.signOut()}
                    className="flex items-center gap-2 text-xs text-red-400/40 hover:text-red-400 transition-colors duration-200 group"
                >
                    <LogOut size={12} className="group-hover:translate-x-[-2px] transition-transform" />
                    Cerrar Sesión
                </button>
            </div>
        </div>
    );
}
