
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { StoreProvider, useStore } from './lib/store';
import AdminLayout from './layouts/AdminLayout';
import ClientLayout from './layouts/ClientLayout';
import Dashboard from './pages/admin/Dashboard';
import Appointments from './pages/admin/Appointments';
import Clients from './pages/admin/Clients';
import Services from './pages/admin/Services';
import Staff from './pages/admin/Staff';
import Settings from './pages/admin/Settings';
import Booking from './pages/client/Booking';
import Login from './pages/Login';
import CreateBusiness from './pages/admin/CreateBusiness';

const AdminRoute = () => {
  const { user, loadingAuth, tenantId } = useStore();

  if (loadingAuth) return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!tenantId) return <Navigate to="/create-business" replace />;

  return <Outlet />;
};

const OnboardingRoute = () => {
  const { user, loadingAuth, tenantId } = useStore();

  if (loadingAuth) return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (tenantId) return <Navigate to="/admin" replace />;

  return <Outlet />;
};

function App() {
  return (
    <StoreProvider>
      <Router>
        <Routes>
          {/* Client Routes (Public for now) */}
          <Route path="/" element={<ClientLayout />}>
            <Route index element={<Navigate to="/login" />} />
            <Route path="reserva/:slug" element={<Booking />} />
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
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
        <DebugOverlay />
      </Router>
    </StoreProvider>
  );
}

const DebugOverlay = () => {
  const { user, tenantId, loadingAuth } = useStore();
  const location = useLocation();

  // Show in all environments for debugging
  // if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-black/80 text-white p-4 rounded-lg text-xs font-mono border border-white/20 shadow-xl pointer-events-none">
      <h3 className="font-bold text-accent mb-2 border-b border-white/20 pb-1">Debug State</h3>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <span className="text-slate-400">Path:</span>
        <span className="text-yellow-400">{location.pathname}</span>

        <span className="text-slate-400">Loading:</span>
        <span className={loadingAuth ? "text-red-400 font-bold" : "text-green-400"}>
          {String(loadingAuth)}
        </span>

        <span className="text-slate-400">User:</span>
        <span className={user ? "text-green-400" : "text-red-400"}>
          {user ? user.email : 'NULL'}
        </span>

        <span className="text-slate-400">Tenant:</span>
        <span className={tenantId ? "text-green-400" : "text-yellow-400"}>
          {tenantId || 'NULL'}
        </span>
      </div>
    </div>
  );
};

export default App;
