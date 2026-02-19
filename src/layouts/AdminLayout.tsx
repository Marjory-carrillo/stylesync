import { useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Scissors, Calendar, Settings as SettingsIcon, LogOut } from 'lucide-react';

export default function AdminLayout() {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const auth = localStorage.getItem('stylesync_admin_auth');
        if (!auth) {
            navigate('/login');
        }
    }, [navigate]);

    const handleLogout = () => {
        if (confirm('¿Cerrar sesión?')) {
            localStorage.removeItem('stylesync_admin_auth');
            navigate('/login');
        }
    };

    const isActive = (path: string) => location.pathname === path;

    const navLinkClass = (path: string) => `
        flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 group
        ${isActive(path)
            ? 'bg-gradient-to-r from-accent/10 to-transparent text-accent border-l-4 border-accent font-semibold'
            : 'text-muted hover:text-white hover:bg-white/5'}
    `;

    return (
        <div className="flex h-screen overflow-hidden text-sm">
            {/* Sidebar with Glass Effect */}
            <aside className="glass-panel flex flex-col w-64 h-full z-10 transition-all duration-300">
                <div className="p-6 flex items-center gap-sm border-b border-white/5">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-accent to-orange-600 shadow-glow">
                        <Scissors className="text-slate-900" size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight text-white">StyleSync</h1>
                        <p className="text-xs text-muted">Admin Panel</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 px-4 mt-2">Menu</div>

                    <Link to="/admin" className={navLinkClass('/admin')}>
                        <LayoutDashboard size={18} className={isActive('/admin') ? 'text-accent' : ''} />
                        <span>Dashboard</span>
                    </Link>
                    <Link to="/admin/appointments" className={navLinkClass('/admin/appointments')}>
                        <Calendar size={18} className={isActive('/admin/appointments') ? 'text-accent' : ''} />
                        <span>Agenda</span>
                    </Link>

                    <Link to="/admin/services" className={navLinkClass('/admin/services')}>
                        <Scissors size={18} className={isActive('/admin/services') ? 'text-accent' : ''} />
                        <span>Servicios</span>
                    </Link>

                    <Link to="/admin/staff" className={navLinkClass('/admin/staff')}>
                        <Users size={18} className={isActive('/admin/staff') ? 'text-accent' : ''} />
                        <span>Estilistas</span>
                    </Link>

                    <Link to="/admin/clients" className={navLinkClass('/admin/clients')}>
                        <Users size={18} className={isActive('/admin/clients') ? 'text-accent' : ''} />
                        <span>Clientes</span>
                    </Link>

                    <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 px-4 mt-6">Gestión</div>

                    <Link to="/admin/settings" className={navLinkClass('/admin/settings')}>
                        <SettingsIcon size={18} className={isActive('/admin/settings') ? 'text-accent' : ''} />
                        <span>Configuración</span>
                    </Link>
                </nav>

                <div className="p-4 border-t border-white/5">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-4 w-full px-4 py-3 rounded-lg text-danger hover:bg-danger/10 transition-colors"
                    >
                        <LogOut size={18} />
                        <span className="font-medium">Cerrar Sesión</span>
                    </button>
                    <div className="mt-4 text-xs text-center text-muted/50">
                        v1.0.0 Premium
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto relative">
                {/* Background decorative elements */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                    <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[100px]"></div>
                    <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-blue-600/5 blur-[100px]"></div>
                </div>

                <div className="relative z-10 p-8 container mx-auto max-w-7xl animate-fade-in">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}


