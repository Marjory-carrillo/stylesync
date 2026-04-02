import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../lib/store/authStore';
import { useTenantData } from '../lib/store/queries/useTenantData';
import { useRealtimeNotifications } from '../lib/store/useRealtimeNotifications';
import { useCancellationLog } from '../lib/store/queries/useCancellationLog';
import { LayoutDashboard, Users, Scissors, Calendar, Settings as SettingsIcon, LogOut, Menu, X, ShieldCheck, Infinity as InfinityIcon, Percent, CalendarPlus } from 'lucide-react';
import AdminBookingModal from '../components/AdminBookingModal';
import NotificationBell from '../components/NotificationBell';

export default function AdminLayout() {
    const { t, i18n } = useTranslation();
    const { isSuperAdmin, userRole } = useAuthStore();
    const { data: tenantConfig } = useTenantData();
    const businessConfig = tenantConfig || {} as any;
    const isEmployee = userRole === 'employee';
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isNewApptModalOpen, setIsNewApptModalOpen] = useState(false);
    const { notifications, unreadCount, markAllRead, dismiss, clearAll } = useRealtimeNotifications();
    const { getMonthlyCancellations } = useCancellationLog();

    const toggleLanguage = () => {
        const newLang = i18n.language === 'es' ? 'en' : 'es';
        i18n.changeLanguage(newLang);
    };

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
                <div className="flex items-center gap-2">
                    <NotificationBell
                        notifications={notifications}
                        unreadCount={unreadCount}
                        onMarkAllRead={markAllRead}
                        onDismiss={dismiss}
                        onClearAll={clearAll}
                        getMonthlyCancellations={getMonthlyCancellations}
                    />
                    <button
                        onClick={() => setIsNewApptModalOpen(true)}
                        className="p-2.5 bg-accent/10 hover:bg-accent/20 rounded-xl text-accent transition-all active:scale-90 border border-accent/20"
                        aria-label="Nueva Cita"
                        title="Nueva Cita"
                    >
                        <CalendarPlus size={22} />
                    </button>
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-accent transition-all active:scale-90"
                        aria-label="Menu"
                    >
                        <Menu size={24} />
                    </button>
                </div>
            </header>

            {/* Overlay for mobile menu */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-[40] lg:hidden animate-fade-in"
                    onClick={closeMobileMenu}
                />
            )}

            {/* Sidebar Navigation */}
            <aside className={`
                fixed inset-y-0 left-0 w-72 bg-[#0f172a] shadow-2xl z-50 transform transition-all duration-500 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:relative lg:translate-x-0 lg:m-6 lg:rounded-[2.5rem] lg:glass-panel lg:border-none
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

                    <Link to="/admin" onClick={closeMobileMenu} className={navLinkClass('/admin')}>
                        <LayoutDashboard size={18} />
                        <span>{t('nav.dashboard')}</span>
                    </Link>

                    <Link to="/admin/appointments" onClick={closeMobileMenu} className={navLinkClass('/admin/appointments')}>
                        <Calendar size={18} />
                        <span>{t('nav.appointments')}</span>
                    </Link>

                    {!isEmployee && (
                        <Link to="/admin/clients" onClick={closeMobileMenu} className={navLinkClass('/admin/clients')}>
                            <Users size={18} />
                            <span>{t('nav.clients')}</span>
                        </Link>
                    )}

                    {!isEmployee && (
                        <>
                            <Link to="/admin/services" onClick={closeMobileMenu} className={navLinkClass('/admin/services')}>
                                <Scissors size={18} />
                                <span>{t('nav.services')}</span>
                            </Link>
                            <Link to="/admin/staff" onClick={closeMobileMenu} className={navLinkClass('/admin/staff')}>
                                <Users size={18} />
                                <span>{t('nav.stylists')}</span>
                            </Link>

                            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3 px-4 mt-8">Configuración</div>

                            <Link to="/admin/team" onClick={closeMobileMenu} className={navLinkClass('/admin/team')}>
                                <Users size={18} />
                                <span>{t('nav.team')}</span>
                            </Link>

                            <Link to="/admin/settings" onClick={closeMobileMenu} className={navLinkClass('/admin/settings')}>
                                <SettingsIcon size={18} />
                                <span>{t('nav.settings')}</span>
                            </Link>
                            {userRole === 'owner' && businessConfig?.commissionsEnabled && (
                                <Link to="/admin/commissions" onClick={closeMobileMenu} className={navLinkClass('/admin/commissions')}>
                                    <Percent size={18} />
                                    <span>{t('nav.commissions')}</span>
                                </Link>
                            )}
                        </>
                    )}
                </nav>

                <div className="p-4 mt-auto border-t border-white/5 bg-[var(--color-bg-tertiary)]/50 flex flex-col gap-2">
                    {/* Notification Bell — Desktop sidebar */}
                    <div className="hidden lg:flex items-center justify-between px-4 py-3">
                        <span className="text-xs text-slate-500 font-medium">Notificaciones</span>
                        <NotificationBell
                            notifications={notifications}
                            unreadCount={unreadCount}
                            onMarkAllRead={markAllRead}
                            onDismiss={dismiss}
                            onClearAll={clearAll}
                            direction="up"
                            getMonthlyCancellations={getMonthlyCancellations}
                        />
                    </div>
                    <button
                        onClick={toggleLanguage}
                        className="flex items-center gap-4 w-full px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 group"
                        aria-label="Cambiar Idioma"
                    >
                        <div className="w-5 h-5 flex items-center justify-center font-bold text-[10px] border border-white/20 rounded-md">
                            {i18n.language.toUpperCase().substring(0, 2)}
                        </div>
                        <span className="font-medium flex-1 text-left">
                            {i18n.language.startsWith('es') ? 'English Language' : 'Idioma Español'}
                        </span>
                    </button>
                    {isSuperAdmin && (
                        <button
                            onClick={() => {
                                localStorage.removeItem('citalink_tenant_id');
                                closeMobileMenu();
                                navigate('/super-admin');
                            }}
                            className="flex items-center gap-4 w-full px-4 py-3 rounded-xl text-amber-400 hover:bg-amber-400/10 transition-all duration-200 group"
                        >
                            <ShieldCheck size={18} className="group-hover:-translate-y-1 transition-transform" />
                            <span className="font-medium flex-1 text-left">Volver a HQ</span>
                        </button>
                    )}
                    <button
                        onClick={() => { closeMobileMenu(); handleLogout(); }}
                        className="flex items-center gap-4 w-full px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all duration-200 group"
                        aria-label={t('nav.logout')}
                    >
                        <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium">{t('nav.logout')}</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main role="main" className="flex-1 overflow-y-auto relative pt-16 lg:pt-0 bg-transparent">
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
            {isNewApptModalOpen && (
                <AdminBookingModal isOpen={true} onClose={() => setIsNewApptModalOpen(false)} />
            )}
        </div>
    );
}
