import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { MapPin, ChevronRight, Infinity as InfinityIcon, Building2, Scissors, Sparkles, Flower2, Briefcase, Clock } from 'lucide-react';
import SplashScreen from '../../components/SplashScreen';

interface BranchInfo {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    logo_url: string | null;
    category: string | null;
    description: string | null;
}

const CATEGORY_ICONS: Record<string, any> = {
    barbershop: Scissors,
    beauty_salon: Sparkles,
    nail_bar: Sparkles,
    spa: Flower2,
    consulting: Briefcase,
};

const CATEGORY_LABELS: Record<string, string> = {
    barbershop: 'Barbería',
    beauty_salon: 'Salón de Belleza',
    nail_bar: "Nail's",
    spa: 'Spa',
    consulting: 'Clínica / Consultoría',
    other: 'Negocio',
};

const CATEGORY_STYLES: Record<string, {
    border: string; glow: string; text: string; bg: string; iconBg: string;
    gradient: string; badgeBg: string; badgeText: string;
}> = {
    barbershop: {
        border: 'border-amber-500/25', glow: 'rgba(245,158,11,0.18)', text: 'text-amber-400',
        bg: 'bg-amber-500/5', iconBg: 'bg-gradient-to-br from-amber-500/30 to-orange-600/20',
        gradient: 'from-amber-500/10 via-transparent to-transparent',
        badgeBg: 'bg-amber-500/10 border-amber-500/20', badgeText: 'text-amber-400',
    },
    beauty_salon: {
        border: 'border-pink-500/25', glow: 'rgba(236,72,153,0.18)', text: 'text-pink-400',
        bg: 'bg-pink-500/5', iconBg: 'bg-gradient-to-br from-pink-500/30 to-rose-600/20',
        gradient: 'from-pink-500/10 via-transparent to-transparent',
        badgeBg: 'bg-pink-500/10 border-pink-500/20', badgeText: 'text-pink-400',
    },
    nail_bar: {
        border: 'border-rose-500/25', glow: 'rgba(244,63,94,0.18)', text: 'text-rose-400',
        bg: 'bg-rose-500/5', iconBg: 'bg-gradient-to-br from-rose-500/30 to-pink-600/20',
        gradient: 'from-rose-500/10 via-transparent to-transparent',
        badgeBg: 'bg-rose-500/10 border-rose-500/20', badgeText: 'text-rose-400',
    },
    spa: {
        border: 'border-emerald-500/25', glow: 'rgba(16,185,129,0.18)', text: 'text-emerald-400',
        bg: 'bg-emerald-500/5', iconBg: 'bg-gradient-to-br from-emerald-500/30 to-teal-600/20',
        gradient: 'from-emerald-500/10 via-transparent to-transparent',
        badgeBg: 'bg-emerald-500/10 border-emerald-500/20', badgeText: 'text-emerald-400',
    },
    consulting: {
        border: 'border-blue-500/25', glow: 'rgba(59,130,246,0.18)', text: 'text-blue-400',
        bg: 'bg-blue-500/5', iconBg: 'bg-gradient-to-br from-blue-500/30 to-indigo-600/20',
        gradient: 'from-blue-500/10 via-transparent to-transparent',
        badgeBg: 'bg-blue-500/10 border-blue-500/20', badgeText: 'text-blue-400',
    },
    other: {
        border: 'border-violet-500/20', glow: 'rgba(139,92,246,0.15)', text: 'text-violet-400',
        bg: 'bg-violet-500/5', iconBg: 'bg-gradient-to-br from-violet-500/25 to-purple-600/15',
        gradient: 'from-violet-500/10 via-transparent to-transparent',
        badgeBg: 'bg-violet-500/10 border-violet-500/20', badgeText: 'text-violet-400',
    },
};

export default function BranchPicker() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [branches, setBranches] = useState<BranchInfo[]>([]);
    const [brandName, setBrandName] = useState('');
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [brandCategory, setBrandCategory] = useState('other');

    useEffect(() => {
        if (!slug) return;
        const fetchBranches = async () => {
            setLoading(true);

            // First try as a regular tenant slug (single business)
            const { data: directTenant } = await supabase
                .from('tenants')
                .select('id')
                .eq('slug', slug)
                .maybeSingle();

            if (directTenant) {
                navigate(`/reserva/${slug}`, { replace: true });
                return;
            }

            // Try as a brand_slug (multi-branch)
            const { data: brandTenants, error } = await supabase
                .from('tenants')
                .select('id, name, slug, address, logo_url, category, description')
                .eq('brand_slug', slug);

            if (error || !brandTenants || brandTenants.length === 0) {
                setNotFound(true);
                setLoading(false);
                return;
            }

            if (brandTenants.length === 1) {
                navigate(`/reserva/${brandTenants[0].slug}`, { replace: true });
                return;
            }

            const formatted = slug!.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            setBrandName(formatted);
            setBranches(brandTenants);
            // Use the first branch's category as brand identity
            setBrandCategory(brandTenants[0].category || 'other');
            setLoading(false);
        };

        fetchBranches();
    }, [slug, navigate]);

    if (loading) return <SplashScreen />;

    if (notFound) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at 30% 20%, #0f1921 0%, #050c11 100%)' }}>
                <div className="text-center">
                    <div className="text-6xl mb-4">🔍</div>
                    <h1 className="text-2xl font-black text-white mb-2">No encontrado</h1>
                    <p className="text-slate-400">No se encontró un negocio con ese enlace.</p>
                </div>
            </div>
        );
    }

    const brandStyles = CATEGORY_STYLES[brandCategory] || CATEGORY_STYLES.other;

    return (
        <div
            className="min-h-screen flex flex-col items-center p-4 pt-12 md:pt-20 relative overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at 30% 20%, #0a1018 0%, #040b10 100%)' }}
        >
            {/* Ambient glows — dynamic by brand category */}
            <div
                className="absolute top-[-5%] right-[-5%] w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none opacity-60 animate-pulse"
                style={{ background: brandStyles.glow, animationDuration: '7s' }}
            />
            <div
                className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none opacity-40 animate-pulse"
                style={{ background: 'rgba(59,130,246,0.1)', animationDuration: '11s' }}
            />
            <div className="absolute top-[45%] left-[45%] w-[250px] h-[250px] bg-violet-700/5 rounded-full blur-[90px] pointer-events-none" />

            {/* Header */}
            <div className="text-center mb-10 relative z-10 animate-fade-in max-w-lg">
                {/* Logo / Brand Icon */}
                <div className="mx-auto mb-5 flex items-center justify-center">
                    <div className="relative flex items-center justify-center w-16 h-16">
                        <div
                            className="absolute inset-0 rounded-full blur-2xl opacity-40 animate-pulse"
                            style={{ background: brandStyles.glow, animationDuration: '4s' }}
                        />
                        <div className={`absolute inset-[-6px] rounded-full bg-gradient-to-br ${brandStyles.gradient} opacity-60`} />
                        <InfinityIcon className="w-14 h-14 text-violet-400 relative z-10 drop-shadow-lg" strokeWidth={2.5} />
                    </div>
                </div>

                {/* Brand Name */}
                <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3 leading-tight">
                    {brandName}
                </h1>

                {/* Category badge */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-widest mb-3 ${brandStyles.badgeBg} ${brandStyles.badgeText}`}>
                    <span>Elige tu sucursal</span>
                </div>

                <p className="text-slate-500 text-sm leading-relaxed">
                    Selecciona la sucursal donde quieres reservar tu cita
                </p>
            </div>

            {/* Branch Cards */}
            <div className="w-full max-w-lg flex flex-col gap-4 relative z-10">
                {branches.map((branch, idx) => {
                    const cat = branch.category || 'other';
                    const styles = CATEGORY_STYLES[cat] || CATEGORY_STYLES.other;
                    const IconComponent = CATEGORY_ICONS[cat] || Building2;
                    const isHovered = hoveredId === branch.id;
                    const label = CATEGORY_LABELS[cat] || 'Negocio';

                    return (
                        <button
                            key={branch.id}
                            onClick={() => navigate(`/reserva/${branch.slug}`)}
                            onMouseEnter={() => setHoveredId(branch.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            className={`w-full group relative flex items-center gap-5 p-5 rounded-2xl border backdrop-blur-sm transition-all duration-400 text-left overflow-hidden animate-scale-in ${
                                isHovered ? styles.border : 'border-white/[0.07] hover:border-white/15'
                            }`}
                            style={{
                                animationDelay: `${idx * 0.1}s`,
                                background: isHovered ? `rgba(10,16,24,0.9)` : 'rgba(255,255,255,0.02)',
                                boxShadow: isHovered ? `0 8px 40px ${styles.glow}, 0 0 0 1px ${styles.glow}` : 'none',
                                transform: isHovered ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
                            }}
                        >
                            {/* Hover gradient overlay */}
                            <div className={`absolute inset-0 bg-gradient-to-r ${styles.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

                            {/* Left accent stripe */}
                            <div
                                className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl transition-all duration-300 ${styles.bg}`}
                                style={{ opacity: isHovered ? 1 : 0 }}
                            />

                            {/* Icon / Logo */}
                            <div className={`w-16 h-16 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border transition-all duration-300 ${
                                isHovered ? `${styles.border} ${styles.iconBg}` : 'border-white/[0.08] bg-white/[0.03]'
                            }`}
                                style={{ transform: isHovered ? 'scale(1.06)' : 'scale(1)' }}
                            >
                                {branch.logo_url ? (
                                    <img src={branch.logo_url} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <IconComponent size={26} className={`transition-colors duration-300 ${isHovered ? styles.text : 'text-slate-500'}`} />
                                )}
                            </div>

                            {/* Info — fixed min-height so all cards align */}
                            <div className="flex-1 min-w-0 min-h-[52px] flex flex-col justify-center">
                                <h3 className="text-base font-black text-white truncate mb-1 tracking-tight">
                                    {branch.name}
                                </h3>
                                {branch.address ? (
                                    <div className="flex items-center gap-1.5 text-slate-500 text-xs group-hover:text-slate-400 transition-colors">
                                        <MapPin size={11} className={`shrink-0 ${isHovered ? styles.text : ''} transition-colors`} />
                                        <span className="truncate">{branch.address}</span>
                                    </div>
                                ) : branch.description ? (
                                    <p className="text-xs text-slate-500 truncate group-hover:text-slate-400 transition-colors">{branch.description}</p>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                                        <Clock size={11} className="shrink-0" />
                                        <span>{label}</span>
                                    </div>
                                )}
                            </div>

                            {/* Arrow */}
                            <ChevronRight
                                size={20}
                                className={`shrink-0 transition-all duration-300 ${isHovered ? `${styles.text} translate-x-1` : 'text-slate-600'}`}
                            />
                        </button>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="mt-12 text-center relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.05]">
                    <InfinityIcon size={12} className="text-violet-400" strokeWidth={2.5} />
                    <p className="text-[11px] text-slate-600">
                        Reservas impulsadas por{' '}
                        <span className="text-violet-400 font-bold">CitaLink</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
