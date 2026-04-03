import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../lib/store/authStore';
import { ChevronDown, Building2, Check, Scissors, Sparkles, Flower2, Briefcase, MoreHorizontal } from 'lucide-react';

const CATEGORY_ICONS: Record<string, any> = {
    barbershop: Scissors,
    beauty_salon: Sparkles,
    nail_bar: Sparkles,
    spa: Flower2,
    consulting: Briefcase,
    other: MoreHorizontal,
};

const CATEGORY_GRADIENTS: Record<string, { from: string; to: string; border: string; text: string; bg: string }> = {
    barbershop: { from: 'from-amber-500/20', to: 'to-orange-600/10', border: 'border-amber-500/25', text: 'text-amber-400', bg: 'bg-amber-500/10' },
    beauty_salon: { from: 'from-pink-500/20', to: 'to-rose-600/10', border: 'border-pink-500/25', text: 'text-pink-400', bg: 'bg-pink-500/10' },
    nail_bar: { from: 'from-rose-500/20', to: 'to-pink-600/10', border: 'border-rose-500/25', text: 'text-rose-400', bg: 'bg-rose-500/10' },
    spa: { from: 'from-emerald-500/20', to: 'to-teal-600/10', border: 'border-emerald-500/25', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    consulting: { from: 'from-blue-500/20', to: 'to-indigo-600/10', border: 'border-blue-500/25', text: 'text-blue-400', bg: 'bg-blue-500/10' },
    other: { from: 'from-slate-500/20', to: 'to-slate-600/10', border: 'border-slate-500/25', text: 'text-slate-400', bg: 'bg-slate-500/10' },
};

export default function BranchSwitcher() {
    const { tenantId, userTenants, switchActiveTenant } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Only render if owner has 2+ tenants
    if (userTenants.length < 2) return null;

    const activeTenant = userTenants.find(t => t.id === tenantId);
    
    // Style props for active tenant
    const activeCat = activeTenant?.category || 'other';
    const ActiveIcon = CATEGORY_ICONS[activeCat] || Building2;
    const activeGradient = CATEGORY_GRADIENTS[activeCat] || CATEGORY_GRADIENTS.other;

    const handleSwitch = (id: string) => {
        if (id === tenantId) {
            setIsOpen(false);
            return;
        }
        switchActiveTenant(id);
        setIsOpen(false);
        // Force reload all data by refreshing page
        window.location.href = '/admin';
    };

    return (
        <div ref={dropdownRef} className="relative mx-4 mb-4 z-[60]">
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl bg-[#0b1019] border ${isOpen ? activeGradient.border : 'border-white/5'} hover:border-white/15 transition-all duration-300 group shadow-[0_4px_20px_rgba(0,0,0,0.4)] relative overflow-hidden`}
            >
                {/* Mini Logo */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border transition-all duration-500 relative z-10 ${isOpen ? `${activeGradient.border} ${activeGradient.bg}` : 'border-white/5 bg-white/[0.03]'}`}>
                    {activeTenant?.logoUrl ? (
                        <img src={activeTenant.logoUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                        <ActiveIcon size={16} className={`${isOpen ? activeGradient.text : 'text-slate-400 group-hover:text-white'} transition-colors`} />
                    )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0 text-left">
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] leading-none mb-1 group-hover:text-slate-400 transition-colors">Sucursal Activa</div>
                    <div className="text-sm font-bold text-white truncate leading-tight group-hover:text-white transition-colors">
                        {activeTenant?.name || 'Seleccionar'}
                    </div>
                </div>

                {/* Chevron */}
                <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-white' : 'group-hover:text-slate-300'}`}
                />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 right-0 p-2 bg-[#0b1019]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/80 z-50 overflow-hidden animate-fade-in origin-top">
                    {/* Glowing Accent Ring */}
                    <div className="absolute inset-0 rounded-2xl border border-white/5 pointer-events-none" />
                    
                    <div className="max-h-[280px] overflow-y-auto custom-scrollbar pr-1 relative z-10 flex flex-col gap-1">
                        {userTenants.map(tenant => {
                            const isActive = tenant.id === tenantId;
                            const cat = tenant.category || 'other';
                            const Ico = CATEGORY_ICONS[cat] || Building2;
                            const gradient = CATEGORY_GRADIENTS[cat] || CATEGORY_GRADIENTS.other;

                            return (
                                <button
                                    key={tenant.id}
                                    onClick={() => handleSwitch(tenant.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                                        isActive
                                            ? `bg-gradient-to-r ${gradient.from} to-transparent border border-transparent`
                                            : 'border border-transparent hover:bg-white/[0.03] hover:border-white/[0.05]'
                                    }`}
                                >
                                    {/* Active Glow Decor */}
                                    {isActive && <div className={`absolute left-0 top-0 bottom-0 w-1 ${gradient.bg} rounded-l-xl`} />}

                                    {/* Mini logo */}
                                    <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center overflow-hidden shrink-0 transition-transform duration-300 group-hover:scale-105 ${
                                        isActive ? `${gradient.bg} border ${gradient.border}` : 'bg-white/5 border border-white/5'
                                    }`}>
                                        {tenant.logoUrl ? (
                                            <img src={tenant.logoUrl} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <Ico size={14} className={isActive ? gradient.text : 'text-slate-500 group-hover:text-slate-300 transition-colors'} />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className={`text-sm font-bold truncate tracking-tight transition-colors ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                                            {tenant.name}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono truncate transition-colors group-hover:text-slate-400">
                                            /{tenant.slug}
                                        </div>
                                    </div>

                                    {/* Check */}
                                    {isActive && (
                                        <Check size={16} className={`${gradient.text} shrink-0 drop-shadow-lg`} strokeWidth={3} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
