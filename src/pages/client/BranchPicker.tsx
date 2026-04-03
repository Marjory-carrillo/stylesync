import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { MapPin, ChevronRight, Infinity as InfinityIcon, Building2, Scissors, Sparkles, Flower2, Briefcase } from 'lucide-react';
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

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    barbershop: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
    beauty_salon: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400' },
    nail_bar: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400' },
    spa: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    consulting: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
};

export default function BranchPicker() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [branches, setBranches] = useState<BranchInfo[]>([]);
    const [brandName, setBrandName] = useState('');
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

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
                // It's a direct slug → go to normal booking
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
                // Only 1 branch with this brand_slug → go directly
                navigate(`/reserva/${brandTenants[0].slug}`, { replace: true });
                return;
            }

            // Extract brand name from the slug
            const formatted = slug!.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            setBrandName(formatted);
            setBranches(brandTenants);
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

    return (
        <div className="min-h-screen flex flex-col items-center p-4 pt-12 md:pt-20 relative overflow-hidden" style={{ background: 'radial-gradient(ellipse at 30% 20%, #0f1921 0%, #050c11 100%)' }}>
            {/* Ambient glows */}
            <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-violet-500/8 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] bg-blue-500/8 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="text-center mb-8 relative z-10 animate-fade-in max-w-lg">
                <div className="mx-auto mb-4 flex items-center justify-center">
                    <div className="relative flex items-center justify-center w-12 h-12">
                        <div className="absolute inset-0 bg-violet-500 blur-xl opacity-25 rounded-full"></div>
                        <InfinityIcon className="w-12 h-12 text-violet-400 relative z-10" strokeWidth={2.5} />
                    </div>
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2">
                    {brandName}
                </h1>
                <p className="text-slate-400 text-sm">
                    Elige la sucursal donde quieres reservar tu cita
                </p>
            </div>

            {/* Branch Cards */}
            <div className="w-full max-w-lg space-y-3 relative z-10">
                {branches.map((branch, idx) => {
                    const cat = branch.category || 'other';
                    const colors = CATEGORY_COLORS[cat] || { bg: 'bg-white/5', border: 'border-white/10', text: 'text-slate-400' };
                    const IconComponent = CATEGORY_ICONS[cat] || Building2;

                    return (
                        <button
                            key={branch.id}
                            onClick={() => navigate(`/reserva/${branch.slug}`)}
                            className="w-full group flex items-center gap-4 p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] animate-scale-in text-left"
                            style={{ animationDelay: `${idx * 0.08}s` }}
                        >
                            {/* Icon/Logo */}
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${colors.bg} border ${colors.border} overflow-hidden`}>
                                {branch.logo_url ? (
                                    <img src={branch.logo_url} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <IconComponent size={24} className={colors.text} />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-white truncate mb-0.5">
                                    {branch.name}
                                </h3>
                                {branch.address && (
                                    <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                        <MapPin size={11} className="shrink-0" />
                                        <span className="truncate">{branch.address}</span>
                                    </div>
                                )}
                                {branch.description && !branch.address && (
                                    <p className="text-xs text-slate-500 truncate">{branch.description}</p>
                                )}
                            </div>

                            {/* Arrow */}
                            <ChevronRight size={18} className="text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
                        </button>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="mt-10 text-center relative z-10">
                <p className="text-[10px] text-slate-600 flex items-center justify-center gap-1">
                    Reservas por <span className="text-violet-400 font-bold">CitaLink</span>
                </p>
            </div>
        </div>
    );
}
