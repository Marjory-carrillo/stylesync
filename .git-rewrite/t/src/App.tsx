
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
      </Router>
    </StoreProvider>
  );
}

export default App;
