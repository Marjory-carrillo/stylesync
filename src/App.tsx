
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
import Booking from './pages/client/Booking';
import Login from './pages/Login';
import CreateBusiness from './pages/admin/CreateBusiness';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import SuperAdminPanel from './pages/admin/SuperAdminPanel';
import BrandingManager from './components/BrandingManager';
import ToastContainer from './components/Toast';
import SplashScreen from './components/SplashScreen';

const AdminRoute = () => {
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

const HomeRedirect = () => {
  const { user, loadingAuth, isSuperAdmin } = useStore();

  if (loadingAuth) return <SplashScreen />;

  // If user is logged in as admin, go to admin
  if (user) {
    if (isSuperAdmin) {
      return <Navigate to="/super-admin" replace />;
    } else {
      return <Navigate to="/admin" replace />;
    }
  }

  // Check for last visited tenant slug for clients
  const lastSlug = localStorage.getItem('citalink_last_slug') || localStorage.getItem('stylesync_last_slug');
  if (lastSlug) {
    return <Navigate to={`/reserva/${lastSlug}`} replace />;
  }

  // fallback to login
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <StoreProvider>
      <BrandingManager />
      <ToastContainer />
      <Router>
        <Routes>
          {/* Main Landing / Smart Redirect */}
          <Route path="/" element={<HomeRedirect />} />

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
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>

          {/* Super Admin Routes */}
          <Route path="/super-admin" element={<SuperAdminRoute />}>
            <Route element={<SuperAdminLayout />}>
              <Route index element={<SuperAdminPanel />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </StoreProvider>
  );
}

export default App;
