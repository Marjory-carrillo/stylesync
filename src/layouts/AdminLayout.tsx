import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../lib/store';
import { LayoutDashboard, Users, Scissors, Calendar, Settings as SettingsIcon, LogOut, Menu, X, ShieldCheck, Infinity as InfinityIcon } from 'lucide-react';

export default function AdminLayout() {
    const { isSuperAdmin, userRole } = useStore();
    const isEmployee = userRole === 'employee';
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    const handleLogout = async () => {
        setIsLogoutModalOpen(true);
    };

    const confirmLogout = async () => {
        try {
            await supabase.auth.signOut();
            navigate('/login');
        } catch (error) {
            console.error("Error signing out:", error);
            navigate('/login');
        }
    };

    const isActive = (path: string) => location.pathname === path;

    const navLinkClass = (path: string) => `
        flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group
        ${isActive(path)
            ? 'bg-accent/10 text-accent font-semibold border border-accent/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
            : 'text-slate-400 hover:text-white hover:bg-white/5'}
    `;

    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    return (
        <div className="flex h-screen overflow-hidden bg-[var(--color-bg)] text-slate-200">
            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[var(--color-bg-secondary)] border-b border-white/10 z-[100] px-4 flex items-center justify-between">
                <div className="relative flex items-center justify-center w-8 h-8">
                    <div className="absolute inset-0 bg-violet-500 blur-md opacity-20 rounded-full"></div>
                    <InfinityIcon className="w-8 h-8 text-violet-500 relative z-10" strokeWidth={2.5} />
                </div>
                <span className="font-bold text-white tracking-tight">Cita<span className="text-violet-500">Link</span> Admin</span>
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-accent transition-all active:scale-90"
                    aria-label="Menu"
                >
                    <Menu size={24} />
                </button>
            </header>

            {/* Overlay for mobile menu */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden animate-fade-in"
                    onClick={closeMobileMenu}
                />
            )}

            {/* Sidebar Navigation */}
            <aside className={`
                fixed inset-y-0 left-0 w-72 glass-panel m-4 border-none shadow-[0_0_50px_rgba(0,0,0,0.5)] z-50 transform transition-all duration-500 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)]'}
                lg:relative lg:translate-x-0 lg:m-6 lg:rounded-[2.5rem]
            `}>
                <div className="p-6 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="relative flex items-center justify-center w-8 h-8 group cursor-pointer">
                            <div className="absolute inset-0 bg-violet-500 blur-md opacity-20 group-hover:opacity-60 transition-opacity rounded-full"></div>
                            <InfinityIcon className="w-8 h-8 text-violet-500 relative z-10" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight text-white leading-none">Cita<span className="text-violet-500">Link</span></h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Admin Panel</p>
                        </div>
                    </div>
                    <button
                        className="lg:hidden p-2 hover:bg-white/5 rounded-lg text-slate-500"
                        onClick={closeMobileMenu}
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3 px-4 mt-2">Menú Principal</div>

                    {!isEmployee && (
                        <Link to="/admin" onClick={closeMobileMenu} className={navLinkClass('/admin')}>
                            <LayoutDashboard size={18} />
                            <span>Dashboard</span>
                        </Link>
                    )}

                    <Link to="/admin/appointments" onClick={closeMobileMenu} className={navLinkClass('/admin/appointments')}>
                        <Calendar size={18} />
                        <span>Agenda</span>
                    </Link>

                    <Link to="/admin/clients" onClick={closeMobileMenu} className={navLinkClass('/admin/clients')}>
                        <Users size={18} />
                        <span>Clientes</span>
                    </Link>

                    {!isEmployee && (
                        <>
                            <Link to="/admin/services" onClick={closeMobileMenu} className={navLinkClass('/admin/services')}>
                                <Scissors size={18} />
                                <span>Servicios</span>
                            </Link>
                            <Link to="/admin/staff" onClick={closeMobileMenu} className={navLinkClass('/admin/staff')}>
                                <Users size={18} />
                                <span>Estilistas</span>
                            </Link>

                            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3 px-4 mt-8">Configuración</div>

                            <Link to="/admin/team" onClick={closeMobileMenu} className={navLinkClass('/admin/team')}>
                                <Users size={18} />
                                <span>Equipo y Roles</span>
                            </Link>

                            <Link to="/admin/settings" onClick={closeMobileMenu} className={navLinkClass('/admin/settings')}>
                                <SettingsIcon size={18} />
                                <span>Ajustes del Negocio</span>
                            </Link>
                        </>
                    )}
                </nav>

                <div className="p-4 mt-auto border-t border-white/5 bg-[var(--color-bg-tertiary)]/50 flex flex-col gap-2">
                    {isSuperAdmin && (
                        <Link
                            to="/super-admin"
                            onClick={() => {
                                localStorage.removeItem('stylesync_tenant_id');
                                // Force a full reload to clear state and hit the /super-admin cleanly
                                window.location.href = '/super-admin';
                            }}
                            className="flex items-center gap-4 w-full px-4 py-3 rounded-xl text-amber-400 hover:bg-amber-400/10 transition-all duration-200 group"
                        >
                            <ShieldCheck size={18} className="group-hover:-translate-y-1 transition-transform" />
                            <span className="font-medium flex-1 text-left">Volver a HQ</span>
                        </Link>
                    )}
                    <button
                        onClick={() => { closeMobileMenu(); handleLogout(); }}
                        className="flex items-center gap-4 w-full px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all duration-200 group"
                    >
                        <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium">Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto relative pt-16 lg:pt-0 bg-transparent">
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 opacity-40">
                    <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent)]/10 blur-[120px]"></div>
                    <div className="absolute bottom-[-5%] left-[-5%] w-[400px] h-[400px] rounded-full bg-[var(--color-primary)]/10 blur-[120px]"></div>
                </div>

                <div className="relative z-10 p-4 md:p-8 container mx-auto max-w-7xl">
                    <Outlet />
                </div>
            </main>

            {/* Logout Modal */}
            {isLogoutModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsLogoutModalOpen(false)} />
                    <div className="relative bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-fade-in text-center">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <LogOut className="text-red-500" size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">¿Cerrar sesión?</h3>
                        <p className="text-sm text-slate-400 mb-6">¿Estás seguro que deseas salir de tu cuenta?</p>

                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setIsLogoutModalOpen(false)}
                                className="flex-1 py-3 rounded-xl font-medium border border-white/10 hover:bg-white/5 transition-colors text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmLogout}
                                className="flex-1 py-3 rounded-xl font-bold bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all text-white"
                            >
                                Sí, salir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
