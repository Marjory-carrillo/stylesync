import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { LayoutDashboard, Users, Scissors, Calendar, Settings as SettingsIcon, LogOut, Menu, X } from 'lucide-react';

export default function AdminLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        if (confirm('¿Cerrar sesión?')) {
            try {
                await supabase.auth.signOut();
                navigate('/login');
            } catch (error) {
                console.error("Error signing out:", error);
                navigate('/login');
            }
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
        <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-200">
            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900/80 backdrop-blur-xl border-b border-white/5 z-50 px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-accent to-orange-600">
                        <Scissors className="text-slate-950" size={18} />
                    </div>
                    <span className="font-bold text-white tracking-tight">StyleSync</span>
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
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

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-white/5 z-[70] 
                lg:relative lg:translate-x-0 transition-transform duration-300 ease-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                flex flex-col shadow-2xl lg:shadow-none
            `}>
                <div className="p-6 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-accent to-orange-600 shadow-glow">
                            <Scissors className="text-slate-950" size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-white leading-none">StyleSync</h1>
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

                    <Link to="/admin" onClick={closeMobileMenu} className={navLinkClass('/admin')}>
                        <LayoutDashboard size={18} />
                        <span>Dashboard</span>
                    </Link>
                    <Link to="/admin/appointments" onClick={closeMobileMenu} className={navLinkClass('/admin/appointments')}>
                        <Calendar size={18} />
                        <span>Agenda</span>
                    </Link>
                    <Link to="/admin/services" onClick={closeMobileMenu} className={navLinkClass('/admin/services')}>
                        <Scissors size={18} />
                        <span>Servicios</span>
                    </Link>
                    <Link to="/admin/staff" onClick={closeMobileMenu} className={navLinkClass('/admin/staff')}>
                        <Users size={18} />
                        <span>Estilistas</span>
                    </Link>
                    <Link to="/admin/clients" onClick={closeMobileMenu} className={navLinkClass('/admin/clients')}>
                        <Users size={18} />
                        <span>Clientes</span>
                    </Link>

                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3 px-4 mt-8">Configuración</div>

                    <Link to="/admin/settings" onClick={closeMobileMenu} className={navLinkClass('/admin/settings')}>
                        <SettingsIcon size={18} />
                        <span>Ajustes del Negocio</span>
                    </Link>
                </nav>

                <div className="p-4 mt-auto border-t border-white/5 bg-slate-900/50">
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
            <main className="flex-1 overflow-y-auto relative pt-16 lg:pt-0">
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 opacity-40">
                    <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[120px]"></div>
                    <div className="absolute bottom-[-5%] left-[-5%] w-[400px] h-[400px] rounded-full bg-blue-600/10 blur-[120px]"></div>
                </div>

                <div className="relative z-10 p-4 md:p-8 container mx-auto max-w-7xl">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}


