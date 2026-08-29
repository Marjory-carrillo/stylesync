import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import { useAuthStore, isUserSuperAdmin } from './lib/store/authStore';
import { supabase } from './lib/supabaseClient';
import { applyZoom } from './lib/useAppZoom';
import AdminLayout from './layouts/AdminLayout';
import ClientLayout from './layouts/ClientLayout';
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Appointments = lazy(() => import('./pages/admin/Appointments'));
const Clients = lazy(() => import('./pages/admin/Clients'));
const Services = lazy(() => import('./pages/admin/Services'));
const Staff = lazy(() => import('./pages/admin/Staff'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const Deposits = lazy(() => import('./pages/admin/Deposits'));
const Quoter = lazy(() => import('./pages/admin/Quoter'));
const Team = lazy(() => import('./pages/admin/Team'));
const Commissions = lazy(() => import('./pages/admin/Commissions'));
const Booking = lazy(() => import('./pages/client/Booking'));
const BranchPicker = lazy(() => import('./pages/client/BranchPicker'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const CreateBusiness = lazy(() => import('./pages/admin/CreateBusiness'));
const SelectBusiness = lazy(() => import('./pages/admin/SelectBusiness'));
const SuperAdminPanel = lazy(() => import('./pages/admin/SuperAdminPanel'));
const SuperAdminCosts = lazy(() => import('./pages/admin/SuperAdminCosts'));
const SuperAdminMarketplace = lazy(() => import('./pages/admin/SuperAdminMarketplace'));
const SalesTracker = lazy(() => import('./pages/admin/SalesTracker'));
const CitalinkClients = lazy(() => import('./pages/admin/CitalinkClients'));
const GlobalSettings = lazy(() => import('./pages/admin/GlobalSettings'));
const Branding = lazy(() => import('./pages/admin/Branding'));
const Landing = lazy(() => import('./pages/Landing'));
const Explore = lazy(() => import('./pages/Explore'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Reschedule = lazy(() => import('./pages/client/Reschedule'));
const PublicReview = lazy(() => import('./pages/PublicReview'));

import { useGlobalStore } from './lib/store/useGlobalStore';
import { Settings as SettingsIcon, RefreshCw, Loader2 } from 'lucide-react';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import BrandingManager from './components/BrandingManager';
import ToastContainer from './components/Toast';
import SplashScreen from './components/SplashScreen';
import ErrorBoundary from './components/ErrorBoundary';
const MaintenancePage = () => (
  <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0f172a] text-center">
    <div className="w-20 h-20 mb-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center animate-pulse shadow-[0_0_50px_-10px_rgba(59,130,246,0.5)]">
      <SettingsIcon className="w-10 h-10 text-blue-400 animate-spin-slow" />
    </div>
    <h1 className="text-4xl font-black text-white mb-4 tracking-tight uppercase italic underline decoration-blue-500/50 underline-offset-8">Modo Mantenimiento</h1>
    <div className="max-w-md p-8 glass-panel border border-white/10 rounded-3xl mt-4">
      <p className="text-slate-400 text-lg leading-relaxed mb-6 font-medium">Estamos realizando mejoras globales para ofrecerte una experiencia increíble. 🚀</p>
      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 mb-6 text-sm text-slate-500 italic">"CitaLink: Unificando tu negocio, paso a paso."</div>
      <p className="text-blue-400 font-bold uppercase tracking-widest text-sm">Estaremos de vuelta en unos minutos</p>
    </div>
    <button
      onClick={() => import('./lib/supabaseClient').then(m => m.supabase.auth.signOut())}
      className="mt-8 text-slate-600 hover:text-slate-400 text-xs font-bold uppercase tracking-widest transition-colors"
    >
      Cerrar Sesión actual
    </button>
  </div>
);

const PendingAccessScreen = ({ email, message }: { email?: string; message?: string }) => {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('citalink_tenant_id');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'radial-gradient(ellipse at 20% 50%, #0f1921 0%, #050c11 100%)' }}>
      <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-10 text-center backdrop-blur-sm shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-4xl">
          ⏳
        </div>
        <h2 className="text-2xl font-black text-white mb-3">Acceso Pendiente</h2>
        <p className="text-slate-400 mb-6 leading-relaxed">
          Tu cuenta (<span className="text-white font-semibold">{email}</span>) está registrada pero aún no ha sido asignada a un negocio.
        </p>
        <p className="text-sm text-slate-500 mb-8">
          {message || 'Si eres dueño de un negocio, contacta al administrador de CitaLink. Si eres especialista o colaborador, pide al dueño que te agregue desde Equipo y Permisos.'}
        </p>
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full py-3 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
          >
            {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>{retrying ? 'Reintentando...' : 'Reintentar Conexión'}</span>
          </button>
          <button
            onClick={handleSignOut}
            className="w-full py-3 px-6 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold transition-all cursor-pointer shadow-lg"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminRoute = () => {
  const { user, loadingAuth, loadingTenant, tenantId, userRole, userTenants } = useAuthStore();
  const config = useGlobalStore(s => s.config);
  const loadingConfig = useGlobalStore(s => s.loadingConfig);
  const isSuperAdmin = isUserSuperAdmin(user);

  if (loadingAuth || loadingTenant || loadingConfig) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace />;

  // Maintenance Mode BLOCK (Allowed only for Super Admin)
  if (config?.maintenance_mode && !isSuperAdmin) {
    return <MaintenancePage />;
  }

  // Super Admin sin tenant seleccionado → HQ
  if (isSuperAdmin && !tenantId) return <Navigate to="/super-admin" replace />;

  // Empleado cuyo correo no está registrado como invitado
  if (!isSuperAdmin && !tenantId && (userRole as any) === 'no_tenant') {
    return (
      <PendingAccessScreen
        email={user.email}
        message="Pide al dueño del negocio que te agregue desde la sección Equipo y Permisos usando este mismo correo."
      />
    );
  }

  // Owner con múltiples negocios sin uno seleccionado → selector
  if (!isSuperAdmin && !tenantId && userRole === 'owner' && userTenants.length > 1) {
    return <Navigate to="/select-business" replace />;
  }

  // Usuario normal sin tenant → mostrar pantalla de espera
  if (!isSuperAdmin && !tenantId) {
    return (
      <PendingAccessScreen
        email={user.email}
      />
    );
  }

  return <Outlet />;
};

const SuperAdminRoute = () => {
  const { user, loadingAuth } = useAuthStore();
  const isSuperAdmin = isUserSuperAdmin(user);

  if (loadingAuth) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/admin" replace />;

  return <Outlet />;
};

const ClientRoute = () => {
  const config = useGlobalStore(s => s.config);
  const loadingConfig = useGlobalStore(s => s.loadingConfig);
  if (loadingConfig) return <SplashScreen />;
  if (config?.maintenance_mode) return <MaintenancePage />;
  return <ClientLayout />;
};

const OnboardingRoute = () => {
  const { user, loadingAuth, tenantId } = useAuthStore();
  const config = useGlobalStore(s => s.config);
  const loadingConfig = useGlobalStore(s => s.loadingConfig);
  const isSuperAdmin = isUserSuperAdmin(user);

  if (loadingAuth || loadingConfig) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace />;

  // Maintenance Mode BLOCK
  if (config?.maintenance_mode && !isSuperAdmin) {
    return <MaintenancePage />;
  }

  if (tenantId) return <Navigate to="/admin" replace />;

  // Only SuperAdmin can access /create-business
  // Regular users without tenant → redirect to /admin (will show "Acceso Pendiente")
  if (!isSuperAdmin && window.location.pathname === '/create-business') {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
};



function App() {
  const { userRole, setAuth, setTenantData, setUserTenants } = useAuthStore();
  const fetchGlobalConfig = useGlobalStore(s => s.fetchGlobalConfig);

  useEffect(() => {
    fetchGlobalConfig();
  }, [fetchGlobalConfig]);

  useEffect(() => {
    applyZoom(85);
    let mounted = true;
    let isFetchingContext = false;

    const loadUserContext = async (session: any, event?: string) => {
      // Si no hay sesión ni usuario: si es un evento explícito de SIGNED_OUT o inicio sin sesión
      if (!session?.user) {
        if (mounted) {
          useAuthStore.getState().resetForSignOut();
        }
        return;
      }

      const user = session.user;
      const isSuperAdmin = isUserSuperAdmin(user);
      const currentAuthState = useAuthStore.getState();

      // Si es un simple refresco de token y el usuario ya está autenticado con su tenant activo,
      // solo actualizamos las credenciales de sesión sin re-consultar destructivamente la base de datos
      if (
        (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
        currentAuthState.user?.id === user.id &&
        (currentAuthState.tenantId || isSuperAdmin)
      ) {
        if (mounted) {
          useAuthStore.getState().setAuth({ user, session, loadingAuth: false });
          useAuthStore.getState().setLoadingTenant(false);
        }
        return;
      }

      if (isSuperAdmin) {
        if (mounted) {
          useAuthStore.getState().setAuth({ user, session, loadingAuth: false });
          useAuthStore.getState().setTenantData({ tenantId: null, userRole: 'admin', userStylistId: null });
          useAuthStore.getState().setUserTenants([]);
        }
        return;
      }

      // Prevenir ejecuciones concurrentes / race conditions
      if (isFetchingContext) return;
      isFetchingContext = true;

      try {
        const userEmail = (user.email || '').toLowerCase().trim();

        // Consultas en paralelo para dueño y empleado
        const [ownerRes, employeeRes] = await Promise.allSettled([
          supabase
            .from('tenants')
            .select('id, name, slug, logo_url, category')
            .eq('owner_id', user.id),
          supabase
            .from('tenant_users')
            .select('tenant_id, role, stylist_id')
            .ilike('email', userEmail)
            .maybeSingle()
        ]);

        const ownerTenants = ownerRes.status === 'fulfilled' ? ownerRes.value.data || [] : [];
        const userData = employeeRes.status === 'fulfilled' ? employeeRes.value.data : null;

        if (ownerTenants.length > 0) {
          const tenantSummaries = ownerTenants.map(t => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            logoUrl: t.logo_url || '',
            category: t.category || '',
          }));

          if (ownerTenants.length === 1) {
            const singleTenantId = ownerTenants[0].id;
            localStorage.setItem('citalink_tenant_id', singleTenantId);
            if (mounted) {
              useAuthStore.getState().setAuth({ user, session, loadingAuth: false });
              useAuthStore.getState().setUserTenants(tenantSummaries);
              useAuthStore.getState().setTenantData({ tenantId: singleTenantId, userRole: 'owner', userStylistId: null });
            }
            return;
          }

          // Dueño con múltiples sucursales
          const savedTenantId = localStorage.getItem('citalink_tenant_id');
          const validSaved = savedTenantId && ownerTenants.some(t => t.id === savedTenantId);
          // Si no hay sucursal guardada válida, usar la primera por defecto para no dejar al usuario en blanco
          const resolvedTenantId = validSaved ? savedTenantId : ownerTenants[0].id;
          localStorage.setItem('citalink_tenant_id', resolvedTenantId);

          if (mounted) {
            useAuthStore.getState().setAuth({ user, session, loadingAuth: false });
            useAuthStore.getState().setUserTenants(tenantSummaries);
            useAuthStore.getState().setTenantData({
              tenantId: resolvedTenantId,
              userRole: 'owner',
              userStylistId: null
            });
          }
          return;
        }

        // Si no es dueño pero es empleado asignado a un negocio
        if (userData?.tenant_id) {
          localStorage.setItem('citalink_tenant_id', userData.tenant_id);
          if (mounted) {
            useAuthStore.getState().setAuth({ user, session, loadingAuth: false });
            useAuthStore.getState().setUserTenants([]);
            useAuthStore.getState().setTenantData({
              tenantId: userData.tenant_id,
              userRole: userData.role || 'employee',
              userStylistId: userData.stylist_id || null
            });
          }
          return;
        }

        // Si la consulta fue exitosa pero el usuario legítimamente no tiene negocio asignado
        if (mounted) {
          useAuthStore.getState().setAuth({ user, session, loadingAuth: false });
          useAuthStore.getState().setUserTenants([]);
          useAuthStore.getState().setTenantData({
            tenantId: null,
            userRole: 'no_tenant',
            userStylistId: null
          });
        }
      } catch (err) {
        console.error("Error in loadUserContext:", err);
        // En caso de fallo transitorio de red, preservar el tenant actual si ya existía
        if (mounted) {
          const authState = useAuthStore.getState();
          useAuthStore.getState().setAuth({ user, session, loadingAuth: false });
          if (!authState.tenantId) {
            const cachedTenantId = localStorage.getItem('citalink_tenant_id');
            if (cachedTenantId) {
              useAuthStore.getState().setTenantData({
                tenantId: cachedTenantId,
                userRole: authState.userRole || 'owner',
                userStylistId: authState.userStylistId
              });
            }
          }
        }
      } finally {
        isFetchingContext = false;
        if (mounted) {
          useAuthStore.getState().setLoadingAuth(false);
          useAuthStore.getState().setLoadingTenant(false);
        }
      }
    };

    // Safety fallback timer extendido a 12s para redes móviles sin ser destructivo
    const safetyTimer = setTimeout(() => {
      const authState = useAuthStore.getState();
      if (mounted && (authState.loadingAuth || authState.loadingTenant)) {
        console.warn("Safety timer: releasing loading locks without destroying session");
        useAuthStore.getState().setLoadingAuth(false);
        useAuthStore.getState().setLoadingTenant(false);
      }
      if (mounted && useGlobalStore.getState().loadingConfig) {
        useGlobalStore.setState({ loadingConfig: false });
      }
    }, 12000);

    // Suscripción reactiva única a Supabase Auth (emite INITIAL_SESSION automáticamente)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      loadUserContext(session, event);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [setAuth, setTenantData, setUserTenants]);

  return (
      <ErrorBoundary>
        <Router>
          <BrandingManager />
          <ToastContainer />
          <Suspense fallback={<SplashScreen />}>
            <Routes>
              {/* Main Landing & Marketplace */}
              <Route path="/" element={<Landing />} />
              <Route path="/explorar" element={<Explore />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />

              {/* Self-Reschedule (fully public, no auth) */}
              <Route path="/reagendar/:id" element={<Reschedule />} />

              {/* Public Review Routes */}
              <Route path="/review/:slug" element={<PublicReview />} />
              <Route path="/evaluar/:slug" element={<PublicReview />} />

              {/* Client Routes - Clean root slug & backwards-compatibility aliases */}
              <Route path="/reserva/:slug" element={<ClientRoute />}>
                <Route index element={<Booking />} />
              </Route>
              <Route path="/b/:slug" element={<ClientRoute />}>
                <Route index element={<Booking />} />
              </Route>

              {/* Multi-Branch Client Route */}
              <Route path="/sucursales/:slug" element={<BranchPicker />} />

              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Onboarding Route (User logged in, no tenant) */}
              <Route element={<OnboardingRoute />}>
                <Route path="/create-business" element={<CreateBusiness />} />
                <Route path="/select-business" element={<SelectBusiness />} />
              </Route>

              {/* Admin Routes (User logged in + Tenant) */}
              <Route path="/admin" element={<AdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="appointments" element={<Appointments />} />
                  <Route path="deposits" element={<Deposits />} />
                  <Route path="quoter" element={<Quoter />} />

                  {/* Rutas protegidas para empleados */}
                  <Route element={userRole !== 'employee' ? <Outlet /> : <Navigate to="/admin" replace />}>
                    <Route path="clients" element={<Clients />} />
                    <Route path="services" element={<Services />} />
                    <Route path="staff" element={<Staff />} />
                    <Route path="team" element={<Team />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="commissions" element={<Commissions />} />
                  </Route>
                </Route>
              </Route>

              {/* Super Admin Routes */}
              <Route path="/super-admin" element={<SuperAdminRoute />}>
                <Route element={<SuperAdminLayout />}>
                  <Route index element={<SuperAdminPanel />} />
                  <Route path="clientes" element={<CitalinkClients />} />
                  <Route path="costos" element={<SuperAdminCosts />} />
                  <Route path="marketplace" element={<SuperAdminMarketplace />} />
                  <Route path="cazador" element={<SalesTracker />} />
                  <Route path="prospectos" element={<CitalinkClients />} />
                  <Route path="branding" element={<Branding />} />
                  <Route path="settings" element={<GlobalSettings />} />
                </Route>
              </Route>

              {/* Clean Direct Business Route (e.g. citalink.app/barberia-el-neon) */}
              <Route path="/:slug" element={<ClientRoute />}>
                <Route index element={<Booking />} />
              </Route>
            </Routes>
          </Suspense>
        </Router>
      </ErrorBoundary>
  );
}

export default App;
