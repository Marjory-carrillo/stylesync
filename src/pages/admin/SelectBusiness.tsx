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

const CATEGORY_GRADIENTS: Record<string, { from: string; to: string; border: string; text: string; glow: string }> = {
    barbershop: { from: 'from-amber-500/20', to: 'to-orange-600/10', border: 'border-amber-500/25', text: 'text-amber-400', glow: '0 0 40px rgba(245,158,11,0.15)' },
    beauty_salon: { from: 'from-pink-500/20', to: 'to-rose-600/10', border: 'border-pink-500/25', text: 'text-pink-400', glow: '0 0 40px rgba(236,72,153,0.15)' },
    nail_bar: { from: 'from-rose-500/20', to: 'to-pink-600/10', border: 'border-rose-500/25', text: 'text-rose-400', glow: '0 0 40px rgba(244,63,94,0.15)' },
    spa: { from: 'from-emerald-500/20', to: 'to-teal-600/10', border: 'border-emerald-500/25', text: 'text-emerald-400', glow: '0 0 40px rgba(16,185,129,0.15)' },
    consulting: { from: 'from-blue-500/20', to: 'to-indigo-600/10', border: 'border-blue-500/25', text: 'text-blue-400', glow: '0 0 40px rgba(59,130,246,0.15)' },
    other: { from: 'from-slate-500/20', to: 'to-slate-600/10', border: 'border-slate-500/25', text: 'text-slate-400', glow: '0 0 40px rgba(100,116,139,0.1)' },
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
            {/* Multi-layered ambient glows */}
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-violet-500/8 rounded-full blur-[180px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
            <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] bg-blue-500/6 rounded-full blur-[150px] pointer-events-none animate-pulse" style={{ animationDuration: '12s' }} />
            <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-violet-600/5 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="text-center mb-12 relative z-10 animate-fade-in">
                <div className="mx-auto mb-6 flex items-center justify-center">
                    <div className="relative flex items-center justify-center w-16 h-16 group cursor-default">
                        <div className="absolute inset-0 bg-violet-500 blur-2xl opacity-30 rounded-full group-hover:opacity-50 transition-opacity"></div>
                        <div className="absolute inset-[-4px] rounded-full bg-gradient-to-br from-violet-500/20 to-transparent"></div>
                        <InfinityIcon className="w-16 h-16 text-violet-400 relative z-10 drop-shadow-lg" strokeWidth={2.5} />
                    </div>
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3 leading-tight">
                    Selecciona tu sucursal
                </h1>
                <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
                    Tienes <span className="text-violet-400 font-bold">{userTenants.length} negocios</span> bajo tu cuenta.
                    <br className="hidden md:block" /> Elige uno para administrarlo.
                </p>
            </div>

            {/* Business Cards Grid */}
            <div className={`grid gap-5 max-w-5xl w-full relative z-10 ${
                userTenants.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-3xl' :
                userTenants.length >= 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
                'grid-cols-1 max-w-md'
            }`}>
                {userTenants.map((tenant, idx) => {
                    const cat = tenant.category || 'other';
                    const gradients = CATEGORY_GRADIENTS[cat] || CATEGORY_GRADIENTS.other;
                    const IconComponent = CATEGORY_ICONS[cat] || Building2;
                    const label = CATEGORY_LABELS[cat] || cat;
                    const isLast = tenant.id === lastUsed;

                    return (
                        <button
                            key={tenant.id}
                            onClick={() => handleSelect(tenant.id)}
                            className={`group relative text-left rounded-[1.8rem] border transition-all duration-500 hover:scale-[1.03] active:scale-[0.98] overflow-hidden animate-scale-in ${
                                isLast
                                    ? `${gradients.border} bg-gradient-to-br ${gradients.from} ${gradients.to}`
                                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15'
                            }`}
                            style={{ 
                                animationDelay: `${idx * 0.1}s`,
                                boxShadow: isLast ? gradients.glow : 'none'
                            }}
                        >
                            {/* Inner gradient highlight */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[1.8rem]" />
                            
                            <div className="relative z-10 p-7">
                                {/* Last-used badge */}
                                {isLast && (
                                    <div className="absolute top-5 right-5">
                                        <span className={`text-[7px] font-black uppercase tracking-[0.25em] ${gradients.text} px-2.5 py-1 rounded-full bg-black/30 border ${gradients.border} backdrop-blur-sm`}>
                                            ✦ Reciente
                                        </span>
                                    </div>
                                )}

                                {/* Logo / Icon */}
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border overflow-hidden transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl ${
                                    isLast ? `${gradients.border} bg-black/30` : 'border-white/10 bg-white/[0.03]'
                                }`}>
                                    {tenant.logoUrl ? (
                                        <img src={tenant.logoUrl} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <IconComponent size={28} className={`${isLast ? gradients.text : 'text-slate-600 group-hover:text-white'} transition-colors duration-300`} />
                                    )}
                                </div>

                                {/* Name */}
                                <h3 className="text-xl font-black text-white tracking-tight mb-1.5 uppercase leading-tight">
                                    {tenant.name}
                                </h3>

                                {/* Category + Slug */}
                                <div className="flex items-center gap-2 mb-5">
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isLast ? gradients.text : 'text-slate-500'}`}>
                                        {label}
                                    </span>
                                    <span className="text-slate-700">•</span>
                                    <span className="text-[10px] text-slate-600 font-mono truncate">
                                        /{tenant.slug}
                                    </span>
                                </div>

                                {/* CTA */}
                                <div className={`inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-all duration-300 ${
                                    isLast
                                        ? `${gradients.text} bg-black/20 border ${gradients.border}`
                                        : 'text-slate-400 group-hover:text-white bg-white/[0.03] border border-white/[0.06] group-hover:border-white/15'
                                }`}>
                                    <span>Administrar</span>
                                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform duration-300" />
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="mt-12 relative z-10 flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                    <p className="text-xs text-slate-500">
                        Sesión activa: <span className="text-slate-300 font-medium">{user?.email}</span>
                    </p>
                </div>
                <button
                    onClick={() => supabase.auth.signOut()}
                    className="flex items-center gap-2 text-xs text-red-400/50 hover:text-red-400 transition-colors duration-200 group"
                >
                    <LogOut size={12} className="group-hover:translate-x-[-2px] transition-transform" /> Cerrar Sesión
                </button>
            </div>
        </div>
    );
}
