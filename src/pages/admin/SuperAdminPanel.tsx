import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../../lib/store';
import { Building2, Trash2, Search, Users, Activity, ChevronRight, LayoutDashboard } from 'lucide-react';

export default function SuperAdminPanel() {
    const { allTenants, fetchAllTenants, switchTenant, deleteTenant } = useStore();
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchAllTenants();
    }, [fetchAllTenants]);

    const filteredTenants = useMemo(() => {
        return allTenants.filter(t =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.category?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allTenants, searchTerm]);

    return (
        <div className="animate-fade-in flex flex-col gap-8 h-full pb-10">
            {/* Header / Command Center */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
                {/* Subtle background glow for the header */}
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl -z-10 animate-pulse-soft"></div>

                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl glass-card text-accent">
                        <LayoutDashboard size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">CitaLink <span className="text-accent font-light">HQ</span></h1>
                        <p className="text-sm text-text-muted mt-1 font-medium tracking-wide">Centro de Comando de Negocios</p>
                    </div>
                </div>
            </header>

            {/* Quick Stats - Premium Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    icon={<Building2 size={24} />}
                    title="Total Negocios Activos"
                    value={allTenants.length}
                    color="text-blue-400"
                    bgGlow="bg-blue-500"
                    delay="0"
                />
                <StatCard
                    icon={<Activity size={24} />}
                    title="Estado del Sistema"
                    value="En Línea"
                    color="text-emerald-400"
                    bgGlow="bg-emerald-500"
                    delay="1"
                />
                {/* Placeholder for future growth metrics */}
                <StatCard
                    icon={<Users size={24} />}
                    title="Crecimiento Total"
                    value="+12%"
                    color="text-amber-400"
                    bgGlow="bg-amber-500"
                    delay="2"
                />
            </div>

            {/* Main Content Area */}
            <div className="glass-panel rounded-2xl overflow-hidden flex flex-col min-h-[500px]">
                {/* Search Bar Container */}
                <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                    <div className="relative group max-w-xl">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="text-slate-400 group-focus-within:text-accent transition-colors" size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar proveedor por nombre, enlace o categoría..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full glass-card bg-black/20 border-white/10 text-white rounded-xl py-3.5 pl-12 pr-4 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all font-medium placeholder:text-slate-500"
                        />
                        {/* Subtle glow effect behind search when focused */}
                        <div className="absolute -inset-0.5 bg-accent/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition duration-500 -z-10"></div>
                    </div>
                </div>

                {/* Tenant List Grid */}
                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                    {filteredTenants.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-60 py-12">
                            <Building2 size={48} className="text-white/20 mb-4" />
                            <h3 className="text-lg font-bold text-white mb-2">Sin resultados</h3>
                            <p className="text-sm text-slate-400 max-w-sm">No se encontraron negocios activos que coincidan con la búsqueda actual.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {filteredTenants.map((tenant, idx) => (
                                <div
                                    key={tenant.id}
                                    className="glass-card flex items-center p-4 border-white/5 hover:border-accent/30 transition-all duration-300 group"
                                    style={{ animationDelay: `${idx * 0.05}s` }}
                                >
                                    {/* Logo / Avatar */}
                                    <div className="w-14 h-14 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group-hover:border-accent/40 transition-colors">
                                        {tenant.logoUrl ? (
                                            <img src={tenant.logoUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <Building2 size={24} className="text-slate-500 group-hover:text-accent transition-colors" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 ml-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-base font-bold text-white truncate">{tenant.name}</h3>
                                            <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-black tracking-wider uppercase text-slate-300 border border-white/5 truncate max-w-[100px]">
                                                {tenant.category || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <span className="truncate bg-black/30 px-2 py-0.5 rounded-md border border-white/5 font-mono text-accent/80">/{tenant.slug}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            onClick={async () => { await switchTenant(tenant.id); }}
                                            className="p-2.5 rounded-xl bg-accent/10 text-accent hover:bg-accent hover:text-slate-900 font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(var(--hue-accent),100%,50%,0.1)] hover:shadow-[0_0_20px_rgba(var(--hue-accent),100%,50%,0.4)]"
                                            title="Ingresar al Panel"
                                        >
                                            <span className="hidden sm:inline pl-1 text-sm">Gestionar</span>
                                            <ChevronRight size={18} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (window.confirm(`¿⚠️ PELIGRO: Estás seguro de eliminar el negocio "${tenant.name}" permanentemente?\n\nEsta acción eliminará todos sus datos, clientes y citas.`)) {
                                                    deleteTenant(tenant.id);
                                                }
                                            }}
                                            className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 border border-transparent transition-all"
                                            title="Eliminar Negocio"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, title, value, color, bgGlow, delay }: { icon: any, title: string, value: any, color: string, bgGlow: string, delay: string }) {
    return (
        <div
            className="animate-scale-in glass-card p-6 flex items-center gap-5 border border-white/5 hover:border-white/10 relative overflow-hidden group"
            style={{ animationDelay: `0.${delay}s` }}
        >
            {/* Subtle corner glow */}
            <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity ${bgGlow}`}></div>

            <div className={`p-4 rounded-2xl bg-white/5 border border-white/5 shadow-inner ${color}`}>
                {icon}
            </div>
            <div className="relative z-10">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{title}</div>
                <div className="text-3xl font-black text-white tracking-tight">{value}</div>
            </div>
        </div>
    );
}
