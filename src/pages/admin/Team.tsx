import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabaseClient';
import { Users, Mail, Shield, Plus, Trash2 } from 'lucide-react';

interface TeamMember {
    id: string;
    email: string;
    role: 'owner' | 'admin' | 'employee';
    created_at: string;
}

export default function Team() {
    const { tenantId, userRole, showToast } = useStore();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'employee'>('employee');

    useEffect(() => {
        if (tenantId) fetchMembers();
    }, [tenantId]);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('tenant_users')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMembers(data || []);
        } catch (error: any) {
            console.error('Error fetching members:', error);
            showToast(`Error al cargar: ${error.message || 'desconocido'}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail || !tenantId) return;

        try {
            const { error } = await supabase
                .from('tenant_users')
                .insert({
                    tenant_id: tenantId,
                    email: inviteEmail.trim(),
                    role: inviteRole
                });

            if (error) throw error;

            showToast('Se ha agregado al equipo', 'success');
            setInviteEmail('');
            fetchMembers();
        } catch (error: any) {
            console.error('Error inviting member:', error);
            if (error.code === '23505') {
                showToast('Este correo ya está en tu equipo', 'error');
            } else {
                showToast(`Error: ${error.message || 'al invitar usuario'}`, 'error');
            }
        }
    };

    const removeMember = async (id: string, email: string) => {
        if (!confirm(`¿Estás seguro de quitar el acceso a ${email}?`)) return;

        try {
            const { error } = await supabase.from('tenant_users').delete().eq('id', id);
            if (error) throw error;
            showToast('Acceso revocado', 'success');
            fetchMembers();
        } catch (error: any) {
            console.error('Error removing member:', error);
            showToast('Error al remover miembro', 'error');
        }
    };

    if (userRole === 'employee') {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
                <Shield size={48} className="text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Acceso Restringido</h2>
                <p className="text-muted">Solo los dueños y administradores pueden modificar el equipo.</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-8 pb-10">
            <div>
                <h2 className="text-2xl font-bold text-white">Equipo y Permisos</h2>
                <p className="text-sm text-muted">Añade empleados y controla a qué secciones del sistema pueden acceder.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* ── Invite Section ── */}
                <section className="glass-panel p-6 rounded-xl space-y-6 h-fit">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                            <Plus size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white">Dar Acceso a Nuevo Integrante</h3>
                    </div>

                    <form onSubmit={handleInvite} className="space-y-4">
                        <div>
                            <label className="block text-sm text-muted mb-1">Correo Electrónico (Con el que iniciará sesión)</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className="input pl-10 w-full"
                                    placeholder="ejemplo@correo.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-muted mb-1">Nivel de Permiso</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    className={`p-3 rounded-lg border text-left transition-colors ${inviteRole === 'employee' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 hover:bg-white/5'}`}
                                    onClick={() => setInviteRole('employee')}
                                >
                                    <div className="font-bold text-white">Empleado</div>
                                    <div className="text-xs text-muted mt-1">Solo puede ver y gestionar las Citas en la Agenda.</div>
                                </button>
                                <button
                                    type="button"
                                    className={`p-3 rounded-lg border text-left transition-colors ${inviteRole === 'admin' ? 'border-accent bg-accent/10' : 'border-white/10 hover:bg-white/5'}`}
                                    onClick={() => setInviteRole('admin')}
                                >
                                    <div className="font-bold text-white">Administrador</div>
                                    <div className="text-xs text-muted mt-1">Control total. Puede ver finanzas y configuraciones.</div>
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary w-full mt-4">
                            Agregar al Equipo
                        </button>
                    </form>
                </section>

                {/* ── Member List ── */}
                <section className="glass-panel p-6 rounded-xl space-y-6">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                                <Users size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white">Integrantes Actuales</h3>
                        </div>
                        <span className="bg-white/10 text-white text-xs px-2 py-1 rounded-full">{members.length} Invitados</span>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <div className="animate-pulse flex items-center justify-center p-8 text-muted">Cargando...</div>
                        ) : members.length === 0 ? (
                            <div className="p-8 text-center bg-white/5 rounded-lg border border-white/5">
                                <Users size={32} className="mx-auto mb-2 text-white/20" />
                                <p className="text-muted">No has invitado a nadie todavía.</p>
                            </div>
                        ) : (
                            members.map(member => (
                                <div key={member.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                                    <div>
                                        <p className="font-medium text-white">{member.email}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {member.role === 'admin' ? (
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded-full">Admin</span>
                                            ) : (
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">Empleado</span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeMember(member.id, member.email)}
                                        className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Revocar acceso"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
