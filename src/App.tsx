import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import { useAuthStore } from './lib/store/authStore';
import { supabase } from './lib/supabaseClient';
import AdminLayout from './layouts/AdminLayout';
import ClientLayout from './layouts/ClientLayout';
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Appointments = lazy(() => import('./pages/admin/Appointments'));
const Clients = lazy(() => import('./pages/admin/Clients'));
const Services = lazy(() => import('./pages/admin/Services'));
const Staff = lazy(() => import('./pages/admin/Staff'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const Team = lazy(() => import('./pages/admin/Team'));
const Commissions = lazy(() => import('./pages/admin/Commissions'));
const Booking = lazy(() => import('./pages/client/Booking'));
const Login = lazy(() => import('./pages/Login'));
const CreateBusiness = lazy(() => import('./pages/admin/CreateBusiness'));
const SuperAdminPanel = lazy(() => import('./pages/admin/SuperAdminPanel'));
const Leads = lazy(() => import('./pages/admin/Leads'));
const GlobalSettings = lazy(() => import('./pages/admin/GlobalSettings'));
const Branding = lazy(() => import('./pages/admin/Branding'));
const Landing = lazy(() => import('./pages/Landing'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

import { useGlobalStore } from './lib/store/useGlobalStore';
import { Settings as SettingsIcon } from 'lucide-react';
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

const AdminRoute = () => {
  const { user, loadingAuth, tenantId, userRole } = useAuthStore();
  const config = useGlobalStore(s => s.config);
  const loadingConfig = useGlobalStore(s => s.loadingConfig);
  const isSuperAdmin = user?.user_metadata?.is_super_admin === true;

  if (loadingAuth || loadingConfig) return <SplashScreen />;
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'radial-gradient(ellipse at 20% 50%, #0f1921 0%, #050c11 100%)' }}>
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl p-10 text-center backdrop-blur-sm shadow-2xl">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-4xl">
            ⏳
          </div>
          <h2 className="text-2xl font-black text-white mb-3">Acceso Pendiente</h2>
          <p className="text-slate-400 mb-6 leading-relaxed">
            Tu cuenta (<span className="text-white font-semibold">{user.email}</span>) está registrada pero aún no ha sido asignada a un negocio.
          </p>
          <p className="text-sm text-slate-500 mb-8">
            Pide al dueño del negocio que te agregue desde la sección <strong className="text-slate-300">Equipo y Permisos</strong> usando este mismo correo.
          </p>
          <button
            onClick={() => { import('./lib/supabaseClient').then(m => m.supabase.auth.signOut()); }}
            className="w-full py-3 px-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold transition-all"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  // Usuario normal sin tenant → onboarding crear negocio
  if (!isSuperAdmin && !tenantId) return <Navigate to="/create-business" replace />;

  return <Outlet />;
};

const SuperAdminRoute = () => {
  const { user, loadingAuth } = useAuthStore();
  const isSuperAdmin = user?.user_metadata?.is_super_admin === true;

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
  const isSuperAdmin = user?.user_metadata?.is_super_admin === true;

  if (loadingAuth || loadingConfig) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace />;

  // Maintenance Mode BLOCK
  if (config?.maintenance_mode && !isSuperAdmin) {
    return <MaintenancePage />;
  }

  if (tenantId) return <Navigate to="/admin" replace />;

  return <Outlet />;
};



function App() {
  const { userRole, setAuth, setTenantData } = useAuthStore();
  const fetchGlobalConfig = useGlobalStore(s => s.fetchGlobalConfig);

  useEffect(() => {
    fetchGlobalConfig();
  }, [fetchGlobalConfig]);

  useEffect(() => {
    let mounted = true;

    const loadUserContext = async (session: any) => {
      if (!session?.user) {
        if (mounted) {
          setAuth({ user: null, session: null, loadingAuth: false });
          setTenantData({ tenantId: null, userRole: null, userStylistId: null });
        }
        return;
      }

      const user = session.user;
      const isSuperAdmin = user.user_metadata?.is_super_admin === true;

      if (isSuperAdmin) {
        if (mounted) {
          setAuth({ user, session, loadingAuth: false });
          setTenantData({ tenantId: null, userRole: 'admin', userStylistId: null });
        }
        return;
      }

      // Primero verificamos si el usuario es DUEÑO (Owner) de un negocio
      const { data: ownerTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (ownerTenant) {
        if (mounted) {
          setAuth({ user, session, loadingAuth: false });
          setTenantData({
            tenantId: ownerTenant.id,
            userRole: 'owner',
            userStylistId: null
          });
        }
        return;
      }

      // Si no es dueño, verificamos si es EMPLEADO (en tabla users)
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id, role, stylist_id')
        .eq('id', user.id)
        .maybeSingle();

      if (mounted) {
        setAuth({ user, session, loadingAuth: false });
        setTenantData({
          tenantId: userData?.tenant_id || null,
          userRole: userData?.role || null,
          userStylistId: userData?.stylist_id || null
        });
      }
    };

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await loadUserContext(session);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserContext(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setAuth, setTenantData]);

  return (
      <ErrorBoundary>
        <Router>
          <BrandingManager />
          <ToastContainer />
          <Suspense fallback={<SplashScreen />}>
            <Routes>
              {/* Main Landing */}
              <Route path="/" element={<Landing />} />

              {/* Client Routes */}
              <Route path="/reserva/:slug" element={<ClientRoute />}>
                <Route index element={<Booking />} />
              </Route>

              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Onboarding Route (User logged in, no tenant) */}
              <Route element={<OnboardingRoute />}>
                <Route path="/create-business" element={<CreateBusiness />} />
              </Route>

              {/* Admin Routes (User logged in + Tenant) */}
              <Route path="/admin" element={<AdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="appointments" element={<Appointments />} />

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
                  <Route path="prospectos" element={<Leads />} />
                  <Route path="branding" element={<Branding />} />
                  <Route path="settings" element={<GlobalSettings />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </Router>
      </ErrorBoundary>
  );
}

export default App;
