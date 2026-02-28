import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabaseClient';
import { Users, Mail, Shield, Plus, Trash2 } from 'lucide-react';

interface TeamMember {
    id: string;
    email: string;
    role: 'owner' | 'admin' | 'employee';
    created_at: string;
    stylist_id?: number | null;
}

export default function Team() {
    const { tenantId, userRole, showToast, stylists } = useStore();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'employee'>('employee');
    const [inviteStylistId, setInviteStylistId] = useState<string>('');

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
                    role: inviteRole,
                    stylist_id: inviteStylistId ? parseInt(inviteStylistId) : null
                });

            if (error) throw error;

            showToast('Se ha agregado al equipo', 'success');
            setInviteEmail('');
            setInviteStylistId('');
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
        <div className="animate-fade-in flex flex-col gap-8 h-full pb-10">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl -z-10 animate-pulse-soft"></div>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl glass-card text-blue-400">
                        <Shield size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">Equipo y Permisos</h1>
                        <p className="text-sm text-slate-400 mt-1 font-medium tracking-wide">Gestiona el acceso de tus colaboradores al sistema</p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* ── Invite Section ── */}
                <section className="glass-panel p-8 rounded-3xl border border-white/10 relative overflow-hidden h-fit">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full"></div>
                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                            <Plus size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white">Nuevo Integrante</h3>
                    </div>

                    <form onSubmit={handleInvite} className="space-y-6 relative z-10">
                        <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
                            <label className="block text-sm font-semibold text-slate-300 mb-2">Correo Electrónico de Acceso</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                <input
                                    type="email"
                                    required
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500 font-medium placeholder:text-slate-600"
                                    placeholder="correo@ejemplo.com"
                                />
                            </div>
                        </div>

                        <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
                            <label className="block text-sm font-semibold text-slate-300 mb-4">Nivel de Permiso</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    className={`p-4 rounded-xl border text-left transition-all duration-300 ${inviteRole === 'employee' ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-white/5 bg-black/20 hover:bg-white/5'}`}
                                    onClick={() => setInviteRole('employee')}
                                >
                                    <div className="font-bold text-white flex items-center justify-between">
                                        Empleado
                                        {inviteRole === 'employee' && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-2 leading-relaxed">Solo lee y gestiona citas en la agenda y prospectos.</div>
                                </button>
                                <button
                                    type="button"
                                    className={`p-4 rounded-xl border text-left transition-all duration-300 ${inviteRole === 'admin' ? 'border-violet-500 bg-violet-500/10 shadow-[0_0_15px_rgba(139,92,246,0.2)]' : 'border-white/5 bg-black/20 hover:bg-white/5'}`}
                                    onClick={() => setInviteRole('admin')}
                                >
                                    <div className="font-bold text-white flex items-center justify-between">
                                        Administrador
                                        {inviteRole === 'admin' && <div className="w-2 h-2 rounded-full bg-violet-500"></div>}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-2 leading-relaxed">Acceso integral a finanzas, equipo y configuración del negocio.</div>
                                </button>
                            </div>
                        </div>

                        {inviteRole === 'employee' && stylists.length > 0 && (
                            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
                                <label className="block text-sm font-semibold text-slate-300 mb-2">Vincular a Perfil Público (Opcional)</label>
                                <p className="text-xs text-slate-400 mb-3">Si seleccionas un perfil, este empleado solo verá su propia agenda personal.</p>
                                <div className="relative">
                                    <select
                                        value={inviteStylistId}
                                        onChange={(e) => setInviteStylistId(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500 font-medium appearance-none"
                                    >
                                        <option value="">Sin vincular (verá toda la agenda)</option>
                                        {stylists.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} - {s.role}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                        ▼
                                    </div>
                                </div>
                            </div>
                        )}

                        <button type="submit" className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_30px_-5px_rgba(37,99,235,0.4)]">
                            <Plus size={20} />
                            Enviar Invitación
                        </button>
                    </form>
                </section>

                {/* ── Member List ── */}
                <section className="glass-panel p-8 rounded-3xl border border-white/10 relative overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-6 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                                <Users size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white">Integrantes Activos</h3>
                        </div>
                        <span className="bg-white/10 border border-white/5 text-slate-300 font-bold text-xs px-3 py-1.5 rounded-full">{members.length} Cuentas</span>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar relative z-10">
                        {loading ? (
                            <div className="animate-pulse flex flex-col items-center justify-center p-12 space-y-4">
                                <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                                <span className="text-slate-400 font-medium">Sincronizando equipo...</span>
                            </div>
                        ) : members.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-black/20 rounded-2xl border border-dashed border-white/10">
                                <Users size={48} className="mx-auto mb-4 text-slate-600" />
                                <h4 className="text-lg font-bold text-white mb-1">Equipo Vacío</h4>
                                <p className="text-sm text-slate-400 max-w-xs">Aún no has invitado a ningún colaborador para administrar este negocio.</p>
                            </div>
                        ) : (
                            members.map(member => {
                                const linkedStylist = member.stylist_id ? stylists.find(s => s.id === member.stylist_id) : null;
                                return (
                                    <div key={member.id} className="flex items-center justify-between p-4 bg-slate-900/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center font-bold text-slate-300 uppercase shadow-inner">
                                                {member.email.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-white truncate max-w-[150px] sm:max-w-[200px] md:max-w-xs">{member.email}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {member.role === 'admin' ? (
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-md">Admin</span>
                                                    ) : (
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">Empleado</span>
                                                    )}
                                                    {linkedStylist && (
                                                        <span className="text-[10px] font-medium text-slate-400 border border-slate-700 bg-slate-800/50 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                                                            🔗 {linkedStylist.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeMember(member.id, member.email)}
                                            className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 border border-transparent rounded-xl transition-all"
                                            title="Revocar acceso"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
