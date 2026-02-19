import { useEffect, useState } from 'react';
import { useStore } from '../../lib/store';
import { Building2, ExternalLink, Trash2, Search, Calendar } from 'lucide-react';

export default function SuperAdminPanel() {
    const { allTenants, fetchAllTenants, switchTenant, deleteTenant } = useStore();
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchAllTenants();
    }, [fetchAllTenants]);

    const filteredTenants = allTenants.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: 'var(--space-xl)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="text-3xl font-bold" style={{ margin: 0 }}>Gestión de Negocios</h1>
                    <p style={{ color: '#94a3b8', marginTop: '4px' }}>Control central de todos los clientes de la plataforma</p>
                </div>
                {/* <button className="btn btn-primary" onClick={() => setIsCreating(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PlusCircle size={20} />
                    Nuevo Negocio
                </button> */}
            </header>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
                <StatCard icon={<Building2 size={24} />} title="Total Negocios" value={allTenants.length} color="#3b82f6" />
                <StatCard icon={<Calendar size={24} />} title="Citas Hoy" value="--" color="#10b981" />
                <StatCard icon={<Users size={24} />} title="Total Usuarios" value="--" color="#f59e0b" />
            </div>

            <div className="card" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', padding: 'var(--space-lg)' }}>
                <div style={{ marginBottom: 'var(--space-lg)', position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o enlace..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 12px 12px 40px',
                            background: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '12px',
                            color: 'white',
                            outline: 'none'
                        }}
                    />
                </div>

                <div className="overflow-x-auto">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid #334155' }}>
                                <th style={{ padding: '16px', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Negocio</th>
                                <th style={{ padding: '16px', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Enlace / Slug</th>
                                <th style={{ padding: '16px', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Categoría</th>
                                <th style={{ padding: '16px', color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTenants.map(tenant => (
                                <tr key={tenant.id} style={{ borderBottom: '1px solid #0f172a', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                background: '#334155',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden'
                                            }}>
                                                {tenant.logoUrl ? (
                                                    <img src={tenant.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <Building2 size={20} color="#94a3b8" />
                                                )}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600' }}>{tenant.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{tenant.address || 'Sin dirección'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <code style={{ background: '#0f172a', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9rem', color: '#3b82f6' }}>
                                            {tenant.slug}
                                        </code>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            background: '#334155',
                                            color: '#e2e8f0',
                                            textTransform: 'capitalize'
                                        }}>
                                            {tenant.category}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => switchTenant(tenant.id)}
                                                className="btn"
                                                style={{
                                                    padding: '8px 12px',
                                                    fontSize: '0.8rem',
                                                    background: '#3b82f6',
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                <ExternalLink size={14} />
                                                Acceder
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm(`¿Estás seguro de eliminar "${tenant.name}"? Esta acción es irreversible.`)) {
                                                        deleteTenant(tenant.id);
                                                    }
                                                }}
                                                className="btn"
                                                style={{
                                                    padding: '8px',
                                                    background: 'transparent',
                                                    border: '1px solid #ef4444',
                                                    color: '#ef4444'
                                                }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredTenants.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                                        No se encontraron negocios.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, title, value, color }: { icon: any, title: string, value: any, color: string }) {
    return (
        <div className="card" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '12px', background: `${color}20`, color: color, borderRadius: '12px' }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{title}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{value}</div>
            </div>
        </div>
    );
}

function Users({ size }: { size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    );
}
