
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { StoreProvider, useStore } from './lib/store';
import AdminLayout from './layouts/AdminLayout';
import ClientLayout from './layouts/ClientLayout';
import Dashboard from './pages/admin/Dashboard';
import Appointments from './pages/admin/Appointments';
import Clients from './pages/admin/Clients';
import Services from './pages/admin/Services';
import Staff from './pages/admin/Staff';
import Settings from './pages/admin/Settings';
import Team from './pages/admin/Team';
import Commissions from './pages/admin/Commissions';
import Booking from './pages/client/Booking';
import Login from './pages/Login';
import CreateBusiness from './pages/admin/CreateBusiness';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import SuperAdminPanel from './pages/admin/SuperAdminPanel';
import Leads from './pages/admin/Leads';
import GlobalSettings from './pages/admin/GlobalSettings';
import Branding from './pages/admin/Branding';
import BrandingManager from './components/BrandingManager';
import ToastContainer from './components/Toast';
import SplashScreen from './components/SplashScreen';
import Landing from './pages/Landing';

const AdminRoute = () => {
  const { user, loadingAuth, isSuperAdmin, tenantId, userRole } = useStore();

  if (loadingAuth) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace />;

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
  const { user, loadingAuth, isSuperAdmin } = useStore();

  if (loadingAuth) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/admin" replace />;

  return <Outlet />;
};

const OnboardingRoute = () => {
  const { user, loadingAuth, tenantId } = useStore();

  if (loadingAuth) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (tenantId) return <Navigate to="/admin" replace />;

  return <Outlet />;
};



function App() {
  return (
    <StoreProvider>
      <BrandingManager />
      <ToastContainer />
      <Router>
        <Routes>
          {/* Main Landing */}
          <Route path="/" element={<Landing />} />

          {/* Client Routes */}
          <Route path="/reserva/:slug" element={<ClientLayout />}>
            <Route index element={<Booking />} />
          </Route>

          <Route path="/login" element={<Login />} />

          {/* Onboarding Route (User logged in, no tenant) */}
          <Route element={<OnboardingRoute />}>
            <Route path="/create-business" element={<CreateBusiness />} />
          </Route>

          {/* Admin Routes (User logged in + Tenant) */}
          <Route path="/admin" element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="clients" element={<Clients />} />
              <Route path="services" element={<Services />} />
              <Route path="staff" element={<Staff />} />
              <Route path="team" element={<Team />} />
              <Route path="settings" element={<Settings />} />
              <Route path="commissions" element={<Commissions />} />
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
      </Router>
    </StoreProvider>
  );
}

export default App;
