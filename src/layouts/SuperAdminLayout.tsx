import { Building2, Paintbrush, Settings as SettingsIcon, ShieldCheck, LogOut, Inbox } from 'lucide-react';
import { useStore } from '../lib/store';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
export default function SuperAdminLayout() {
    const { user, isSuperAdmin } = useStore();
    const navigate = useNavigate();
    const location = useLocation();

    if (!isSuperAdmin) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="p-8 bg-white rounded-lg shadow-md text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Acceso Denegado</h2>
                    <p className="text-gray-600">No tienes permisos para acceder a esta sección.</p>
                    <button onClick={() => navigate('/admin')} className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        Volver al Panel Normal
                    </button>
                </div>
            </div>
        );
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    // The navItems array is no longer used directly for rendering, but kept for reference if needed elsewhere
    const navItems = [
        { path: '/super-admin', icon: Building2, label: 'Negocios' },
        { path: '/super-admin/prospectos', icon: Inbox, label: 'Prospectos' },
        { path: '/super-admin/branding', icon: Paintbrush, label: 'Branding' },
        { path: '/super-admin/settings', icon: SettingsIcon, label: 'Ajustes Globales' }
    ];

    return (
        <div className="admin-layout" style={{ display: 'flex', minHeight: '100vh', background: '#0f172a' }}>
            <aside className="admin-sidebar" style={{
                width: '280px',
                background: '#1e293b',
                color: 'white',
                padding: 'var(--space-lg)',
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div className="sidebar-header" style={{ marginBottom: 'var(--space-xl)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#f59e0b', padding: '8px', borderRadius: '8px' }}>
                        <ShieldCheck size={24} color="white" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0 }}>CitaLink</h1>
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f59e0b', fontWeight: '700' }}>Super Admin</span>
                    </div>
                </div>

                <nav style={{ flex: 1 }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {navItems.map(item => (
                            <li key={item.path} style={{ marginBottom: '8px' }}>
                                <Link
                                    to={item.path}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        color: location.pathname === item.path ? 'white' : '#94a3b8',
                                        background: location.pathname === item.path ? '#334155' : 'transparent',
                                        textDecoration: 'none',
                                        fontWeight: '500',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <item.icon size={20} />
                                    {item.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="sidebar-footer" style={{ marginTop: 'auto', paddingTop: 'var(--space-lg)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ padding: '0 16px', marginBottom: '16px' }}>
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>Sesión como</p>
                        <p style={{ fontSize: '0.9rem', color: 'white', margin: 0, fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            color: '#ef4444',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: '600',
                            textAlign: 'left'
                        }}
                    >
                        <LogOut size={20} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside >

            <main style={{ flex: 1, padding: 'var(--space-xl)', background: '#0f172a', color: 'white', overflowY: 'auto' }}>
                <Outlet />
            </main>
        </div >
    );
}
