import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../lib/store/authStore';
import { ChevronDown, Building2, Check } from 'lucide-react';

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
        <div ref={dropdownRef} className="relative mx-4 mb-4">
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/15 transition-all duration-200 group"
            >
                {/* Mini Logo */}
                <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center overflow-hidden shrink-0">
                    {activeTenant?.logoUrl ? (
                        <img src={activeTenant.logoUrl} className="w-full h-full object-cover" alt="" />
                    ) : (
                        <Building2 size={14} className="text-accent" />
                    )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0 text-left">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-0.5">Sucursal</div>
                    <div className="text-sm font-bold text-white truncate leading-tight">
                        {activeTenant?.name || 'Seleccionar'}
                    </div>
                </div>

                {/* Chevron */}
                <ChevronDown
                    size={14}
                    className={`text-slate-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0c1220] border border-white/10 rounded-xl shadow-2xl shadow-black/60 z-50 overflow-hidden animate-fade-in">
                    <div className="p-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                        {userTenants.map(tenant => {
                            const isActive = tenant.id === tenantId;
                            return (
                                <button
                                    key={tenant.id}
                                    onClick={() => handleSwitch(tenant.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-150 ${
                                        isActive
                                            ? 'bg-accent/10 text-white'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    {/* Mini logo */}
                                    <div className={`w-7 h-7 rounded-md flex items-center justify-center overflow-hidden shrink-0 ${
                                        isActive ? 'bg-accent/20 border border-accent/30' : 'bg-white/5 border border-white/10'
                                    }`}>
                                        {tenant.logoUrl ? (
                                            <img src={tenant.logoUrl} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <Building2 size={12} className={isActive ? 'text-accent' : 'text-slate-600'} />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className={`text-xs font-bold truncate ${isActive ? 'text-white' : ''}`}>
                                            {tenant.name}
                                        </div>
                                        <div className="text-[10px] text-slate-600 font-mono truncate">
                                            /{tenant.slug}
                                        </div>
                                    </div>

                                    {/* Check */}
                                    {isActive && (
                                        <Check size={14} className="text-accent shrink-0" />
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
