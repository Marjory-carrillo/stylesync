import { Building2, Paintbrush, Settings as SettingsIcon, LogOut, Inbox, Infinity as InfinityIcon, Menu, X } from 'lucide-react';
import { useAuthStore } from '../lib/store/authStore';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useState, useEffect } from 'react';

export default function SuperAdminLayout() {
    const { user, isSuperAdmin } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Cerrar menú al cambiar de ruta
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    if (!isSuperAdmin) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="p-8 bg-white rounded-lg shadow-md text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Acceso Denegado</h2>
                    <p className="text-gray-600">No tienes permisos para acceder a esta sección.</p>
                    <button onClick={() => navigate('/admin')} className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Volver al Panel Normal
                    </button>
                </div>
            </div>
        );
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const navItems = [
        { path: '/super-admin', icon: Building2, label: 'Negocios' },
        { path: '/super-admin/prospectos', icon: Inbox, label: 'Prospectos' },
        { path: '/super-admin/branding', icon: Paintbrush, label: 'Branding' },
        { path: '/super-admin/settings', icon: SettingsIcon, label: 'Ajustes Globales' }
    ];

    return (
        <div className="flex min-h-screen bg-[#0f172a]">
            {/* Mobile Header (Only Mobile) */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#1e293b] border-b border-white/10 flex items-center justify-between px-6 z-[50]">
                <div className="flex items-center gap-3">
                    <InfinityIcon className="w-6 h-6 text-violet-500" />
                    <h1 className="text-lg font-black text-white">Cita<span className="text-violet-500">Link</span> <span className="text-[10px] text-amber-500">HQ</span></h1>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar (Responsive) */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 w-[280px] bg-[#1e293b] text-white p-8 flex flex-col 
                border-right border-white/10 transition-transform duration-300 ease-in-out z-[70]
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="mb-10 flex items-center gap-3">
                    <div className="relative flex items-center justify-center w-8 h-8 group cursor-pointer">
                        <div className="absolute inset-0 bg-violet-500 blur-md opacity-20 group-hover:opacity-60 transition-opacity rounded-full"></div>
                        <InfinityIcon className="w-8 h-8 text-violet-500 relative z-10" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-white m-0 leading-tight">Cita<span className="text-violet-500">Link</span></h1>
                        <span className="text-[10px] uppercase tracking-widest text-amber-500 font-bold">Super Admin</span>
                    </div>
                </div>

                <nav className="flex-1">
                    <ul className="space-y-2 p-0 m-0 list-none">
                        {navItems.map(item => (
                            <li key={item.path}>
                                <Link
                                    to={item.path}
                                    className={`
                                        flex items-center gap-4 px-4 py-3 rounded-xl transition-all font-medium
                                        ${location.pathname === item.path
                                            ? 'bg-slate-700 text-white shadow-lg shadow-black/20'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'}
                                    `}
                                >
                                    <item.icon size={20} />
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="mt-auto pt-6 border-t border-white/10">
                    <div className="px-4 mb-4">
                        <p className="text-[11px] text-slate-500 uppercase font-black tracking-tighter">Sesión de Poder</p>
                        <p className="text-xs text-white font-bold truncate">{user?.email}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors font-bold text-sm"
                    >
                        <LogOut size={20} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 p-6 lg:p-10 pt-24 lg:pt-10 h-screen overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
