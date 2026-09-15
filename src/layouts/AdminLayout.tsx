import { useState, useEffect, useMemo, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../lib/store/authStore';
import { useTenantData } from '../lib/store/queries/useTenantData';
import { useStylists } from '../lib/store/queries/useStylists';
import { useServices } from '../lib/store/queries/useServices';
import { useRealtimeNotifications, type AdminNotification } from '../lib/store/useRealtimeNotifications';
import { useCancellationLog } from '../lib/store/queries/useCancellationLog';
import { LayoutDashboard, Users, Sparkles, Calendar, LogOut, Menu, X, ShieldCheck, Infinity as InfinityIcon, Percent, CalendarPlus, Calculator, CreditCard, ArrowRight, BellRing, Wrench, Share2, ChevronDown, Building2, UserCheck, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import BusinessQRCardsModal from '../components/BusinessQRCardsModal';
import AdminBookingModal from '../components/AdminBookingModal';
import NotificationBell from '../components/NotificationBell';
import BranchSwitcher from '../components/BranchSwitcher';
import PWAInstallBanner from '../components/PWAInstallBanner';
import PaymentBlockedScreen from '../components/PaymentBlockedScreen';
import OnboardingWizard from '../components/OnboardingWizard';
import { isAccountActive, isNailCalculatorEnabled } from '../lib/planLimits';
import { useUIStore } from '../lib/store/uiStore';

export default function AdminLayout() {
    const { t } = useTranslation();
    const { isCalendarFullscreen, isSidebarCollapsed, toggleSidebar } = useUIStore();
    const { isSuperAdmin, userRole, userStylistId } = useAuthStore();
    const { data: tenantConfig } = useTenantData();
    const { stylists } = useStylists();
    const { services } = useServices();
    const businessConfig = tenantConfig || {} as any;
    const isEmployee = userRole === 'employee';
    const location = useLocation();
    const navigate = useNavigate();
    const isDashboardRoute = location.pathname === '/admin' || location.pathname === '/admin/';
    const effectiveCalendarFullscreen = isCalendarFullscreen && isDashboardRoute;
    const mainRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (effectiveCalendarFullscreen) {
            mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [effectiveCalendarFullscreen]);

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isNewApptModalOpen, setIsNewApptModalOpen] = useState(false);
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);
    
    type OpenAccordionType = 'tools' | 'business_config' | string | null;

    const isToolsActive = useMemo(() => {
        return location.pathname.startsWith('/admin/social-content');
    }, [location.pathname]);

    const isBusinessConfigActive = useMemo(() => {
        return ['/admin/staff', '/admin/services', '/admin/team'].some(p => location.pathname.startsWith(p));
    }, [location.pathname]);

    const [openAccordion, setOpenAccordion] = useState<OpenAccordionType>(() => {
        if (location.pathname.startsWith('/admin/social-content')) return 'tools';
        if (['/admin/staff', '/admin/services', '/admin/team'].some(p => location.pathname.startsWith(p))) return 'business_config';
        const saved = localStorage.getItem('citalink_active_accordion');
        if (saved === 'tools') return 'tools';
        if (saved === 'business_config') return 'business_config';
        if (saved === 'none') return null;
        return 'business_config';
    });

    // Auto-expand active accordion on route change
    useEffect(() => {
        if (isToolsActive) {
            setOpenAccordion('tools');
            localStorage.setItem('citalink_active_accordion', 'tools');
        } else if (isBusinessConfigActive) {
            setOpenAccordion('business_config');
            localStorage.setItem('citalink_active_accordion', 'business_config');
        }
    }, [isToolsActive, isBusinessConfigActive]);

    const toggleAccordion = (id: string) => {
        setOpenAccordion(prev => {
            const next = prev === id ? null : id;
            localStorage.setItem('citalink_active_accordion', next || 'none');
            return next;
        });
    };

    const isToolsOpen = openAccordion === 'tools';
    const isBusinessConfigOpen = openAccordion === 'business_config';

    const toggleTools = () => toggleAccordion('tools');
    const toggleBusinessConfig = () => toggleAccordion('business_config');

    const [activeToast, setActiveToast] = useState<AdminNotification | null>(null);
    const { notifications, unreadCount, markAllRead, dismiss, clearAll } = useRealtimeNotifications();
    const { getMonthlyCancellations } = useCancellationLog();

    // Escuchar notificaciones en tiempo real para desplegar Toast flotante
    useEffect(() => {
        const handleRealtimeNotif = (e: Event) => {
            const notif = (e as CustomEvent).detail as AdminNotification;
            if (notif) {
                setActiveToast(notif);
                const timer = setTimeout(() => {
                    setActiveToast(null);
                }, 7000);
                return () => clearTimeout(timer);
            }
        };

        window.addEventListener('citalink:realtime-notification', handleRealtimeNotif);
        return () => window.removeEventListener('citalink:realtime-notification', handleRealtimeNotif);
    }, []);

    // Detectar si el usuario debe ver el Asistente de Bienvenida y limpiar URL
    useEffect(() => {
        if (window.location.hash && (window.location.hash.includes('error') || window.location.hash.includes('access_token'))) {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
        const urlParams = new URLSearchParams(window.location.search);
        let paramsChanged = false;
        ['email', 'pw', 'password'].forEach(p => {
            if (urlParams.has(p)) {
                urlParams.delete(p);
                paramsChanged = true;
            }
        });
        const isWelcomeUrl = urlParams.get('welcome') === 'true';
        if (isWelcomeUrl) {
            urlParams.delete('welcome');
            paramsChanged = true;
        }
        if (paramsChanged) {
            const newSearch = urlParams.toString() ? `?${urlParams.toString()}` : '';
            window.history.replaceState({}, document.title, window.location.pathname + newSearch);
        }

        const tenantId = tenantConfig?.id || localStorage.getItem('citalink_tenant_id') || 'current';
        const isLocallyDismissed = localStorage.getItem(`citalink_onboarding_dismissed_${tenantId}`) === 'true';

        if (
            (isWelcomeUrl || (tenantConfig && tenantConfig.onboarding_completed === false)) &&
            !isLocallyDismissed &&
            userRole === 'owner' &&
            !isSuperAdmin
        ) {
            setIsOnboardingOpen(true);
        }
    }, [tenantConfig?.id, tenantConfig?.onboarding_completed, userRole, isSuperAdmin]);

    // Control dinámico de scroll y alturas para el Panel de Admin
    useEffect(() => {
        document.documentElement.classList.add('admin-layout-active');
        document.body.classList.add('admin-layout-active');
        return () => {
            document.documentElement.classList.remove('admin-layout-active');
            document.body.classList.remove('admin-layout-active');
        };
    }, []);

    // PWA manifest dinámico para admin — apunta a /admin con iconos estáticos (compatible con iOS Safari & Android)
    useEffect(() => {
        const adminManifest = {
            name: 'CitaLink Admin',
            short_name: 'CitaLink',
            description: 'Panel de gestión de citas y clientes para administradores',
            start_url: '/admin',
            scope: '/',
            display: 'standalone',
            orientation: 'portrait-primary',
            background_color: '#0f172a',
            theme_color: '#7c3aed',
            icons: [
                { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
                { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
            ],
        };

        const stringManifest = JSON.stringify(adminManifest);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(stringManifest);
        
        const el = document.querySelector('#pwa-manifest') as HTMLLinkElement;
        if (el) el.href = dataUri;

        // Asegurar apple-touch-icon estático para iOS Safari
        let appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
        if (!appleIcon) {
            appleIcon = document.createElement('link');
            appleIcon.rel = 'apple-touch-icon';
            document.head.appendChild(appleIcon);
        }
        appleIcon.href = '/assets/icon-192.png';

        document.title = 'CitaLink Admin — Panel de Control';
        let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement;
        if (appleTitle) appleTitle.content = 'CitaLink Admin';
    }, []);



    const handleLogout = async () => {
        setIsLogoutModalOpen(true);
    };

    const confirmLogout = async () => {
        try {
            localStorage.removeItem('citalink_tenant_id');
            await supabase.auth.signOut();
            navigate('/login');
        } catch (error) {
            console.error("Error signing out:", error);
            localStorage.removeItem('citalink_tenant_id');
            navigate('/login');
        }
    };

    const isActive = (path: string) => location.pathname === path;

    const navLinkClass = (path: string) => `
        flex items-center ${isSidebarCollapsed ? 'lg:justify-center lg:px-2 py-3 px-4 gap-4' : 'gap-4 px-4 py-3'} rounded-xl transition-all duration-200 group
        ${isActive(path)
            ? 'bg-accent/10 text-accent font-semibold border border-accent/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
            : 'text-slate-400 hover:text-white hover:bg-white/5'}
    `;

    const subNavLinkClass = (path: string) => `
        flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all
        ${isActive(path)
            ? 'bg-accent/15 text-accent border border-accent/25 shadow-sm font-semibold'
            : 'text-slate-400 hover:text-white hover:bg-white/5'}
    `;

    // Check if account is suspended/blocked
    const accountStatus = isAccountActive(
        businessConfig?.subscriptionType,
        businessConfig?.paymentStatus,
        businessConfig?.gracePeriodEndsAt,
        businessConfig?.trialEndsAt
    );

    const showNailCalculator = useMemo(() => {
        if (!isNailCalculatorEnabled(businessConfig)) return false;
        if (isEmployee && userStylistId) {
            const myStylist = stylists.find(s => s.id === userStylistId);
            if (myStylist) {
                if (myStylist.serviceIds && myStylist.serviceIds.length > 0) {
                    return services.some(s => s.enableQuoter && myStylist.serviceIds!.map(Number).includes(Number(s.id)));
                }
                return services.some(s => s.enableQuoter);
            }
        }
        return true;
    }, [businessConfig, isEmployee, userStylistId, stylists, services]);

    // SuperAdmin can bypass blocks for support purposes
    if (accountStatus.blocked && !isSuperAdmin) {
        return <PaymentBlockedScreen businessName={businessConfig?.name} />;
    }

    const closeMobileMenu = () => setIsMobileMenuOpen(false);

    return (
        <div className="flex h-screen overflow-hidden bg-[var(--color-bg)] text-slate-200">
            {/* Mobile Header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[var(--color-bg-secondary)] border-b border-white/10 z-[100] px-4 flex items-center justify-between">
                <button onClick={() => { closeMobileMenu(); navigate('/admin'); }} className="flex items-center gap-2">
                    <div className="relative flex items-center justify-center w-8 h-8 group">
                        <div className="absolute inset-0 bg-violet-500 blur-md opacity-20 group-hover:opacity-60 transition-opacity rounded-full"></div>
                        <InfinityIcon className="w-8 h-8 text-violet-500 relative z-10" strokeWidth={2.5} />
                    </div>
                    <span className="font-bold text-white tracking-tight">Cita<span className="text-violet-500">Link</span> Admin</span>
                </button>
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
                        className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-accent transition-all active:scale-90 cursor-pointer"
                        aria-label="Menu"
                    >
                        <Menu size={24} />
                    </button>
                </div>
            </header>

            {/* Overlay for mobile menu */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[140] lg:hidden animate-fade-in"
                    onClick={closeMobileMenu}
                />
            )}

            {/* Sidebar Navigation */}
            <aside className={`
                fixed inset-y-0 left-0 shrink-0 bg-[#0f172a] shadow-2xl z-[150] transform transition-all duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isSidebarCollapsed ? 'w-72 lg:w-20 lg:my-3 lg:ml-3 lg:mr-0 lg:rounded-3xl' : 'w-72 lg:w-64 lg:m-4 lg:rounded-[2.5rem]'}
                lg:relative lg:translate-x-0 lg:glass-panel lg:border-none lg:flex lg:flex-col
            `}>
                <div className={`p-4 lg:p-5 flex items-center ${isSidebarCollapsed ? 'lg:flex-col lg:gap-3 lg:justify-center justify-between' : 'justify-between'} border-b border-white/5 transition-all`}>
                    <button onClick={() => { closeMobileMenu(); navigate('/admin'); }} className={`flex items-center ${isSidebarCollapsed ? 'lg:justify-center gap-3' : 'gap-3'}`} title="CitaLink Admin">
                        <div className="relative flex items-center justify-center w-8 h-8 group cursor-pointer shrink-0">
                            <div className="absolute inset-0 bg-violet-500 blur-md opacity-20 group-hover:opacity-60 transition-opacity rounded-full"></div>
                            <InfinityIcon className="w-8 h-8 text-violet-500 relative z-10" strokeWidth={2.5} />
                        </div>
                        <div className={`text-left animate-fade-in ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>
                            <h1 className="text-lg font-black tracking-tight text-white leading-none">Cita<span className="text-violet-500">Link</span></h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Admin Panel</p>
                        </div>
                    </button>

                    {/* Botón de Colapsar / Expandir Barra Lateral (Solo Desktop) */}
                    <button
                        type="button"
                        onClick={toggleSidebar}
                        className="hidden lg:flex p-1.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer active:scale-90"
                        title={isSidebarCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
                    >
                        {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                    </button>

                    {/* Botón Cerrar (Solo Móvil) */}
                    <button
                        className="lg:hidden p-2 hover:bg-white/5 rounded-lg text-slate-500 cursor-pointer"
                        onClick={closeMobileMenu}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Branch Switcher (multi-business owners) */}
                <div className={isSidebarCollapsed ? 'lg:hidden' : ''}>
                    <BranchSwitcher />
                </div>

                {/* Desktop "Nueva Cita" Button */}
                <div className={`${isSidebarCollapsed ? 'px-2 py-2' : 'px-4 py-2'} hidden lg:block`}>
                    <button
                        onClick={() => setIsNewApptModalOpen(true)}
                        title="Nueva Cita"
                        className={`w-full flex items-center justify-center ${isSidebarCollapsed ? 'p-3' : 'gap-2.5 py-3 px-4'} rounded-2xl
                            bg-gradient-to-r from-accent to-orange-500 hover:from-accent hover:to-orange-600
                            text-white font-bold text-sm shadow-lg shadow-accent/20 active:scale-95 transition-all border border-accent/10`}
                    >
                        <CalendarPlus size={18} className="shrink-0" />
                        {!isSidebarCollapsed && <span>Nueva Cita</span>}
                    </button>
                </div>

                <nav className={`flex-1 ${isSidebarCollapsed ? 'lg:p-2 lg:space-y-2 p-4 space-y-1.5' : 'p-4 space-y-1.5'} overflow-y-auto overflow-x-hidden custom-scrollbar transition-all`}>
                    <div className={`text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3 px-4 mt-2 ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>Menú Principal</div>

                    {/* 1. Dashboard */}
                    <Link to="/admin" onClick={closeMobileMenu} className={navLinkClass('/admin')} title={t('nav.dashboard')}>
                        <LayoutDashboard size={18} className="shrink-0" />
                        <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>{t('nav.dashboard')}</span>
                    </Link>

                    {/* 2. Cotizador y después anticipos según apliquen */}
                    {showNailCalculator && (
                        <Link to="/admin/quoter" onClick={closeMobileMenu} className={navLinkClass('/admin/quoter')} title="Cotizador de Uñas">
                            <Calculator size={18} className="shrink-0" />
                            <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>Cotizador de Uñas</span>
                        </Link>
                    )}

                    {businessConfig?.depositEnabled && (
                        <Link to="/admin/deposits" onClick={closeMobileMenu} className={navLinkClass('/admin/deposits')} title="Anticipos">
                            <CreditCard size={18} className="shrink-0" />
                            <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>Anticipos</span>
                        </Link>
                    )}

                    {/* 3. Agenda */}
                    <Link to="/admin/appointments" onClick={closeMobileMenu} className={navLinkClass('/admin/appointments')} title={t('nav.appointments')}>
                        <Calendar size={18} className="shrink-0" />
                        <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>{t('nav.appointments')}</span>
                    </Link>

                    {/* 4. Herramientas */}
                    {!isEmployee && (
                        <>
                            {isSidebarCollapsed ? (
                                <>
                                    <Link
                                        to="/admin/social-content"
                                        onClick={closeMobileMenu}
                                        className={`hidden lg:flex ${navLinkClass('/admin/social-content')}`}
                                        title="Contenido para redes"
                                    >
                                        <Share2 size={18} className="shrink-0 text-violet-400" />
                                    </Link>
                                    <div className="pt-1 lg:hidden">
                                        <button
                                            type="button"
                                            onClick={toggleTools}
                                            className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs font-bold uppercase tracking-wider cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Wrench size={16} className="text-violet-400 group-hover:scale-110 transition-transform" />
                                                <span>Herramientas</span>
                                                {isToolsActive && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                                                )}
                                            </div>
                                            <ChevronDown
                                                size={14}
                                                className={`transition-transform duration-300 ${isToolsOpen ? 'rotate-180 text-violet-400' : 'text-slate-600'}`}
                                            />
                                        </button>

                                        {isToolsOpen && (
                                            <div className="ml-3 pl-3 border-l border-white/10 space-y-1 mt-1 animate-fade-in">
                                                <Link
                                                    to="/admin/social-content"
                                                    onClick={closeMobileMenu}
                                                    className={subNavLinkClass('/admin/social-content')}
                                                >
                                                    <Share2 size={15} className="shrink-0 text-violet-400" />
                                                    <span className="truncate">Contenido para redes</span>
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="pt-1">
                                    <button
                                        type="button"
                                        onClick={toggleTools}
                                        className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs font-bold uppercase tracking-wider cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Wrench size={16} className="text-violet-400 group-hover:scale-110 transition-transform" />
                                            <span>Herramientas</span>
                                            {isToolsActive && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                                            )}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            className={`transition-transform duration-300 ${isToolsOpen ? 'rotate-180 text-violet-400' : 'text-slate-600'}`}
                                        />
                                    </button>

                                    {isToolsOpen && (
                                        <div className="ml-3 pl-3 border-l border-white/10 space-y-1 mt-1 animate-fade-in">
                                            <Link
                                                to="/admin/social-content"
                                                onClick={closeMobileMenu}
                                                className={subNavLinkClass('/admin/social-content')}
                                            >
                                                <Share2 size={15} className="shrink-0 text-violet-400" />
                                                <span className="truncate">Contenido para redes</span>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* 5. Clientes */}
                    {!isEmployee && (
                        <Link to="/admin/clients" onClick={closeMobileMenu} className={navLinkClass('/admin/clients')} title={t('nav.clients')}>
                            <Users size={18} className="shrink-0" />
                            <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>{t('nav.clients')}</span>
                        </Link>
                    )}

                    {/* 6. Configuración de negocio */}
                    {!isEmployee && (
                        <>
                            {isSidebarCollapsed ? (
                                <>
                                    <div className="hidden lg:flex flex-col space-y-2">
                                        <Link
                                            to="/admin/staff"
                                            onClick={closeMobileMenu}
                                            className={navLinkClass('/admin/staff')}
                                            title={t('nav.stylists')}
                                        >
                                            <UserCheck size={18} className="shrink-0 text-sky-400" />
                                        </Link>

                                        <Link
                                            to="/admin/services"
                                            onClick={closeMobileMenu}
                                            className={navLinkClass('/admin/services')}
                                            title={t('nav.services')}
                                        >
                                            <Sparkles size={18} className="shrink-0 text-amber-400" />
                                        </Link>

                                        {businessConfig?.plan !== 'lite' && (
                                            <Link
                                                to="/admin/team"
                                                onClick={closeMobileMenu}
                                                className={navLinkClass('/admin/team')}
                                                title={t('nav.team')}
                                            >
                                                <ShieldCheck size={18} className="shrink-0 text-emerald-400" />
                                            </Link>
                                        )}
                                    </div>
                                    <div className="pt-1 lg:hidden">
                                        <button
                                            type="button"
                                            onClick={toggleBusinessConfig}
                                            className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs font-bold uppercase tracking-wider cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Building2 size={16} className="text-sky-400 group-hover:scale-110 transition-transform" />
                                                <span>Configuración de negocio</span>
                                                {isBusinessConfigActive && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                                                )}
                                            </div>
                                            <ChevronDown
                                                size={14}
                                                className={`transition-transform duration-300 ${isBusinessConfigOpen ? 'rotate-180 text-sky-400' : 'text-slate-600'}`}
                                            />
                                        </button>

                                        {isBusinessConfigOpen && (
                                            <div className="ml-3 pl-3 border-l border-white/10 space-y-1 mt-1 animate-fade-in">
                                                <Link
                                                    to="/admin/staff"
                                                    onClick={closeMobileMenu}
                                                    className={subNavLinkClass('/admin/staff')}
                                                >
                                                    <UserCheck size={15} className="shrink-0 text-sky-400" />
                                                    <span>{t('nav.stylists')}</span>
                                                </Link>

                                                <Link
                                                    to="/admin/services"
                                                    onClick={closeMobileMenu}
                                                    className={subNavLinkClass('/admin/services')}
                                                >
                                                    <Sparkles size={15} className="shrink-0 text-amber-400" />
                                                    <span>{t('nav.services')}</span>
                                                </Link>

                                                {businessConfig?.plan !== 'lite' && (
                                                    <Link
                                                        to="/admin/team"
                                                        onClick={closeMobileMenu}
                                                        className={subNavLinkClass('/admin/team')}
                                                    >
                                                        <ShieldCheck size={15} className="shrink-0 text-emerald-400" />
                                                        <span>{t('nav.team')}</span>
                                                    </Link>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="pt-1">
                                    <button
                                        type="button"
                                        onClick={toggleBusinessConfig}
                                        className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs font-bold uppercase tracking-wider cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Building2 size={16} className="text-sky-400 group-hover:scale-110 transition-transform" />
                                            <span>Configuración de negocio</span>
                                            {isBusinessConfigActive && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                                            )}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            className={`transition-transform duration-300 ${isBusinessConfigOpen ? 'rotate-180 text-sky-400' : 'text-slate-600'}`}
                                        />
                                    </button>

                                    {isBusinessConfigOpen && (
                                        <div className="ml-3 pl-3 border-l border-white/10 space-y-1 mt-1 animate-fade-in">
                                            <Link
                                                to="/admin/staff"
                                                onClick={closeMobileMenu}
                                                className={subNavLinkClass('/admin/staff')}
                                            >
                                                <UserCheck size={15} className="shrink-0 text-sky-400" />
                                                <span>{t('nav.stylists')}</span>
                                            </Link>

                                            <Link
                                                to="/admin/services"
                                                onClick={closeMobileMenu}
                                                className={subNavLinkClass('/admin/services')}
                                            >
                                                <Sparkles size={15} className="shrink-0 text-amber-400" />
                                                <span>{t('nav.services')}</span>
                                            </Link>

                                            {businessConfig?.plan !== 'lite' && (
                                                <Link
                                                    to="/admin/team"
                                                    onClick={closeMobileMenu}
                                                    className={subNavLinkClass('/admin/team')}
                                                >
                                                    <ShieldCheck size={15} className="shrink-0 text-emerald-400" />
                                                    <span>{t('nav.team')}</span>
                                                </Link>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* 7. Nómina */}
                    {!isEmployee && userRole === 'owner' && businessConfig?.plan !== 'lite' && (
                        <Link to="/admin/commissions" onClick={closeMobileMenu} className={navLinkClass('/admin/commissions')} title={t('nav.commissions')}>
                            <Percent size={18} className="shrink-0" />
                            <span className={`flex-1 text-left ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>{t('nav.commissions')}</span>
                            {!businessConfig?.commissionsEnabled && (
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/10 shrink-0 ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>
                                    Inactivo
                                </span>
                            )}
                        </Link>
                    )}

                    {/* 8. Ajustes */}
                    {!isEmployee && (
                        <Link to="/admin/settings" onClick={closeMobileMenu} className={navLinkClass('/admin/settings')} title={t('nav.settings')}>
                            <Settings size={18} className="shrink-0" />
                            <span className={isSidebarCollapsed ? 'lg:hidden' : ''}>{t('nav.settings')}</span>
                        </Link>
                    )}
                </nav>

                <div className={`mt-auto border-t border-white/5 bg-[var(--color-bg-tertiary)]/50 flex flex-col gap-2 ${isSidebarCollapsed ? 'p-4 lg:p-2 lg:items-center' : 'p-4'}`}>
                    {/* Notification Bell — Desktop sidebar */}
                    <div className={`hidden lg:flex items-center ${isSidebarCollapsed ? 'justify-center p-2' : 'justify-between px-4 py-3'}`}>
                        {!isSidebarCollapsed && <span className="text-xs text-slate-500 font-medium">Notificaciones</span>}
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
                    {isSuperAdmin && (
                        <button
                            onClick={() => {
                                localStorage.removeItem('citalink_tenant_id');
                                closeMobileMenu();
                                navigate('/super-admin');
                            }}
                            title="Volver a HQ"
                            className={`flex items-center ${isSidebarCollapsed ? 'lg:justify-center lg:p-3 gap-4 px-4 py-3' : 'gap-4 px-4 py-3'} w-full rounded-xl text-amber-400 hover:bg-amber-400/10 transition-all duration-200 group`}
                        >
                            <ShieldCheck size={18} className="group-hover:-translate-y-1 transition-transform shrink-0" />
                            <span className={`font-medium flex-1 text-left ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>Volver a HQ</span>
                        </button>
                    )}
                    <button
                        onClick={() => { closeMobileMenu(); handleLogout(); }}
                        className={`flex items-center ${isSidebarCollapsed ? 'lg:justify-center lg:p-3 gap-4 px-4 py-3' : 'gap-4 px-4 py-3'} w-full rounded-xl text-red-400 hover:bg-red-400/10 transition-all duration-200 group`}
                        aria-label={t('nav.logout')}
                        title={t('nav.logout')}
                    >
                        <LogOut size={18} className="group-hover:-translate-x-1 transition-transform shrink-0" />
                        <span className={`font-medium ${isSidebarCollapsed ? 'lg:hidden' : ''}`}>{t('nav.logout')}</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main
                ref={mainRef}
                role="main"
                className={`flex-1 min-w-0 relative bg-transparent transition-all duration-500 ease-in-out ${
                    effectiveCalendarFullscreen
                        ? 'h-screen overflow-hidden flex flex-col pt-16 lg:pt-0'
                        : 'overflow-y-auto pt-16 lg:pt-0'
                }`}
            >
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 opacity-40">
                    <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[var(--color-accent)]/10 blur-[120px]"></div>
                    <div className="absolute bottom-[-5%] left-[-5%] w-[400px] h-[400px] rounded-full bg-[var(--color-primary)]/10 blur-[120px]"></div>
                </div>

                <div className={`relative z-10 w-full transition-all duration-500 ease-in-out ${
                    effectiveCalendarFullscreen
                        ? 'h-full flex-1 flex flex-col p-2 sm:p-3 overflow-hidden min-h-0'
                        : 'p-4 md:p-6 lg:p-8 max-w-none pb-6'
                }`}>
                    <Outlet />
                </div>
                {!effectiveCalendarFullscreen && <PWAInstallBanner businessName={businessConfig?.name || 'CitaLink Admin'} />}
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
            <BusinessQRCardsModal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} />
            <OnboardingWizard
                isOpen={isOnboardingOpen}
                onClose={() => {
                    const tenantId = tenantConfig?.id || localStorage.getItem('citalink_tenant_id') || 'current';
                    localStorage.setItem(`citalink_onboarding_dismissed_${tenantId}`, 'true');
                    setIsOnboardingOpen(false);
                }}
            />

            {/* Floating Realtime Alert Toast */}
            {activeToast && (
                <div className="fixed top-5 right-5 z-[300] max-w-sm w-full bg-[#0d1829]/95 backdrop-blur-md border border-accent/40 rounded-2xl p-4 shadow-2xl shadow-accent/20 animate-slide-down">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center text-accent shrink-0 mt-0.5">
                                <BellRing size={20} className="animate-bounce-subtle" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                                        {activeToast.type === 'new' ? '✨ Nueva Cita' : activeToast.type === 'cancel' ? '⚠️ Cancelación' : '🔄 Reprogramada'}
                                    </span>
                                </div>
                                <h4 className="text-sm font-bold text-white mt-1 truncate">
                                    {activeToast.clientName}
                                </h4>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    📆 {activeToast.date} {activeToast.time ? `· ${activeToast.time}` : ''}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setActiveToast(null)}
                            className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-end gap-2">
                        <button
                            onClick={() => {
                                setActiveToast(null);
                                navigate('/admin/appointments');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-accent text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md hover:brightness-110 active:scale-95 transition-all"
                        >
                            <span>Ver en Agenda</span>
                            <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
