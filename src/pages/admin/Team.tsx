import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../lib/store/authStore';
import { useUIStore } from '../../lib/store/uiStore';
import { useStylists } from '../../lib/store/queries/useStylists';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { getPlanLimits, getPlanBadgeStyles, getEffectiveMaxEmployees, canAddEmployee, isInTrial } from '../../lib/planLimits';
import { supabase } from '../../lib/supabaseClient';
import { Users, Mail, Shield, Plus, Trash2, AlertCircle, Copy, Check, Info, UserCheck, Clock, Loader2, Sparkles } from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import { z } from 'zod';

interface TeamMember {
    id: string;
    email: string;
    role: 'owner' | 'admin' | 'employee';
    created_at: string;
    stylist_id?: number | null;
    user_id?: string | null;
}

export default function Team() {
    const { tenantId, userRole } = useAuthStore();
    const { showToast } = useUIStore();
    const { stylists } = useStylists();
    const { data: businessConfig } = useTenantData();
    const plan = businessConfig?.plan || 'free';
    const limits = getPlanLimits(plan);
    const badge = getPlanBadgeStyles(plan);
    const inTrial = isInTrial(businessConfig?.trialEndsAt);
    const extraEmployeesPaid = businessConfig?.extraEmployeesPaid || 0;
    const effectiveMaxEmployees = inTrial ? 4 : getEffectiveMaxEmployees(plan, extraEmployeesPaid);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'employee'>('employee');
    const [inviteStylistId, setInviteStylistId] = useState<string>('');
    const [confirmRevoke, setConfirmRevoke] = useState<{ open: boolean; memberId: string | null; email: string | null }>({ open: false, memberId: null, email: null });
    const [inviteError, setInviteError] = useState<string | null>(null);
    const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

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

    // Identificar los profesionales que ya tienen un correo asignado
    const assignedStylistIds = useMemo(() => {
        return new Set(
            members
                .map(m => m.stylist_id)
                .filter((id): id is number => id !== null && id !== undefined)
        );
    }, [members]);

    // Filtrar los profesionales disponibles para no repetir asignaciones
    const availableStylists = useMemo(() => {
        return stylists.filter(s => !assignedStylistIds.has(s.id));
    }, [stylists, assignedStylistIds]);

    const handleStylistChange = (stylistId: string) => {
        setInviteStylistId(stylistId);
        if (stylistId) {
            setInviteRole('employee');
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail || !tenantId || isSubmitting) return;

        const check = canAddEmployee(plan, members.length, businessConfig?.trialEndsAt, extraEmployeesPaid);
        if (!check.allowed) {
            showToast(check.message || 'Límite de equipo alcanzado', 'error');
            return;
        }

        const emailResult = z.string().email('El correo electrónico es inválido.').safeParse(inviteEmail.trim());
        if (!emailResult.success) {
            setInviteError(emailResult.error.issues[0].message);
            return;
        }
        setInviteError(null);
        setIsSubmitting(true);

        try {
            const { error } = await supabase
                .from('tenant_users')
                .insert({
                    tenant_id: tenantId,
                    email: inviteEmail.trim().toLowerCase(),
                    role: inviteRole,
                    stylist_id: (inviteRole === 'employee' && inviteStylistId) ? parseInt(inviteStylistId) : null
                });

            if (error) throw error;

            showToast('Se ha agregado al equipo correctamente', 'success');
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
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyDirectLink = (email: string) => {
        const link = `${window.location.origin}/login?email=${encodeURIComponent(email)}`;
        navigator.clipboard.writeText(link);
        setCopiedEmail(email);
        showToast('Enlace directo de acceso copiado al portapapeles', 'success');
        setTimeout(() => setCopiedEmail(null), 2500);
    };

    const removeMember = (id: string, email: string) => {
        setConfirmRevoke({ open: true, memberId: id, email });
    };

    const confirmRevokeAction = async () => {
        const { memberId } = confirmRevoke;
        if (!memberId) return;

        try {
            const { error } = await supabase.from('tenant_users').delete().eq('id', memberId);
            if (error) throw error;
            showToast('Acceso revocado', 'success');
            fetchMembers();
        } catch (error: any) {
            console.error('Error removing member:', error);
            showToast('Error al remover miembro', 'error');
        } finally {
            setConfirmRevoke({ open: false, memberId: null, email: null });
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

    if (plan === 'lite') {
        return (
            <div className="animate-fade-in flex flex-col items-center justify-center p-8 sm:p-12 text-center max-w-lg mx-auto min-h-[60vh]">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-6 shadow-xl shadow-amber-500/10">
                    <Users size={32} />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                    Módulo de Equipo y Permisos
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                    Tu negocio cuenta actualmente con el <strong className="text-amber-400 font-bold">Plan Esencial</strong>, diseñado especialmente para negocios con 1 solo profesional activo.
                </p>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300 text-left space-y-2 mb-6 w-full">
                    <p className="font-bold text-white flex items-center gap-1.5">
                        <Sparkles size={14} className="text-accent" /> ¿Necesitas agregar colaboradores?
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                        Al actualizar a <strong>Plan Pro</strong> o <strong>Business</strong> podrás invitar estilistas adicionales, asignar roles y gestionar permisos individuales de acceso.
                    </p>
                </div>
                <a
                    href="/admin/settings"
                    className="btn bg-accent text-slate-950 font-black text-xs uppercase px-6 py-3 rounded-xl shadow-lg hover:brightness-110 transition-all"
                >
                    Ver Planes en Configuración
                </a>
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
                <section className="glass-panel p-8 rounded-3xl border border-white/10 relative overflow-hidden h-fit transition-all hover:border-blue-500/30">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full"></div>
                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-glow-sm">
                            <Plus size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white tracking-tight">Nuevo Integrante</h3>
                    </div>

                    <form onSubmit={handleInvite} className="space-y-5 relative z-10">
                        {/* 1. SELECCIONAR PROFESIONAL A VINCULAR (Arriba del correo) */}
                        <div className="bg-white/[0.04] p-5 rounded-2xl border border-white/10 transition-all focus-within:border-blue-500/50 hover:border-white/15 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-300">
                                    <UserCheck size={16} className="text-blue-400" />
                                    <span>Perfil de Profesional a Vincular</span>
                                </label>
                                {inviteStylistId ? (
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1.5 animate-fade-in">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                        Agenda Personal
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-semibold text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                                        Opcional
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                Selecciona al profesional del salón para que al iniciar sesión solo pueda ver y gestionar sus propias citas asignadas.
                            </p>
                            <div className="relative">
                                <select
                                    value={inviteStylistId}
                                    onChange={(e) => handleStylistChange(e.target.value)}
                                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-3.5 pl-4 pr-10 text-white focus:outline-none focus:border-blue-500/60 font-medium appearance-none transition-all cursor-pointer hover:border-white/25 shadow-inner"
                                >
                                    <option value="">✨ Sin vincular (Acceso general a todas las citas / Recepción)</option>
                                    {availableStylists.map(s => (
                                        <option key={s.id} value={s.id} className="bg-slate-900 text-white py-2">
                                            {s.name} ({s.role || 'Profesional'})
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                                    ▼
                                </div>
                            </div>
                            {stylists.length > 0 && availableStylists.length === 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs p-3 rounded-xl flex items-center gap-2">
                                    <AlertCircle size={15} className="shrink-0 text-amber-400" />
                                    <span>Todos los profesionales registrados ya tienen una cuenta de acceso vinculada.</span>
                                </div>
                            )}
                        </div>

                        {/* 2. CORREO ELECTRÓNICO DE ACCESO */}
                        <div className="bg-white/[0.04] p-5 rounded-2xl border border-white/10 transition-all focus-within:border-blue-500/50 hover:border-white/15">
                            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-300 mb-1.5">
                                <Mail size={16} className="text-blue-400" />
                                <span>Correo Electrónico de Acceso</span>
                            </label>
                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-3">
                                {inviteStylistId
                                    ? `Ingresa el correo con el que ${availableStylists.find(s => s.id.toString() === inviteStylistId)?.name || 'el profesional'} iniciará sesión.`
                                    : 'El integrante del equipo ingresará a CitaLink utilizando esta cuenta de correo.'}
                            </p>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/60 font-medium placeholder:text-slate-600 transition-all shadow-inner"
                                    placeholder="ejemplo@correo.com"
                                />
                            </div>
                            {inviteError && (
                                <div className="mt-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-bold p-3 rounded-xl animate-fade-in flex items-center gap-2">
                                    <AlertCircle size={15} className="shrink-0" />
                                    <span>{inviteError}</span>
                                </div>
                            )}
                        </div>

                        {/* 3. NIVEL DE PERMISO */}
                        <div className="bg-white/[0.04] p-5 rounded-2xl border border-white/10 hover:border-white/15">
                            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-300 mb-1.5">
                                <Shield size={16} className="text-blue-400" />
                                <span>Nivel de Permiso</span>
                            </label>
                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-4">
                                Define el tipo de acceso y las acciones permitidas para esta cuenta.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <button
                                    type="button"
                                    className={`group p-4 rounded-xl border text-left transition-all duration-300 cursor-pointer ${inviteRole === 'employee' ? 'border-blue-500/60 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.18)] ring-1 ring-blue-500/30' : 'border-white/10 bg-slate-900/50 hover:bg-white/5'}`}
                                    onClick={() => setInviteRole('employee')}
                                >
                                    <div className="font-bold text-white flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2">
                                            Profesional
                                            {inviteStylistId && (
                                                <span className="text-[9px] font-bold text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded">
                                                    Vinculado
                                                </span>
                                            )}
                                        </span>
                                        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${inviteRole === 'employee' ? 'bg-blue-500 scale-125 shadow-[0_0_8px_#3b82f6]' : 'bg-slate-700'}`}></div>
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-2 leading-relaxed font-medium">
                                        Acceso limitado a su propia agenda personal. Sin ver finanzas ni clientes globales.
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    className={`group p-4 rounded-xl border text-left transition-all duration-300 cursor-pointer ${inviteRole === 'admin' ? 'border-violet-500/60 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.18)] ring-1 ring-violet-500/30' : 'border-white/10 bg-slate-900/50 hover:bg-white/5'}`}
                                    onClick={() => setInviteRole('admin')}
                                >
                                    <div className="font-bold text-white flex items-center justify-between text-sm">
                                        <span>Administrador</span>
                                        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${inviteRole === 'admin' ? 'bg-violet-500 scale-125 shadow-[0_0_8px_#8b5cf6]' : 'bg-slate-700'}`}></div>
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-2 leading-relaxed font-medium">
                                        Control total sobre agenda completa, finanzas, servicios y equipo.
                                    </div>
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all shadow-[0_8px_25px_rgba(37,99,235,0.35)] active:scale-95 group cursor-pointer disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={20} className="animate-spin" />
                                    <span>Agregando integrante...</span>
                                </>
                            ) : (
                                <>
                                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                                    <span>Agregar al Equipo</span>
                                </>
                            )}
                        </button>
                    </form>
                </section>

                {/* ── Member List ── */}
                <section className="glass-panel p-8 rounded-3xl border border-white/10 relative overflow-hidden flex flex-col min-h-[500px]">
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-glow-sm">
                                <Users size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight">Integrantes Activos</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Gestión de Cuentas</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}>{limits.name}</span>
                            <span className="bg-white/5 border border-white/10 text-slate-400 font-black text-[10px] px-3 py-1.5 rounded-full uppercase tracking-tighter">
                                {members.length}/{effectiveMaxEmployees}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar relative z-10">
                        {loading ? (
                            <div className="space-y-4">
                                {Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-4 animate-pulse">
                                        <div className="flex justify-between items-center">
                                            <div className="flex gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-white/5"></div>
                                                <div className="space-y-2">
                                                    <div className="h-4 w-32 bg-white/5 rounded"></div>
                                                    <div className="h-3 w-20 bg-white/5 rounded"></div>
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-lg bg-white/5"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : members.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full p-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10 animate-fade-in">
                                <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center mb-6">
                                    <Users size={40} className="text-slate-700" />
                                </div>
                                <h4 className="text-xl font-bold text-white mb-2">Equipo Vacío</h4>
                                <p className="text-sm text-slate-400 max-w-[240px] leading-relaxed">Aún no has agregado a ningún colaborador para administrar este negocio.</p>
                            </div>
                        ) : (
                            members.map((member, index) => {
                                const linkedStylist = member.stylist_id ? stylists.find(s => s.id === member.stylist_id) : null;
                                const isConnected = !!member.user_id;

                                return (
                                    <div
                                        key={member.id}
                                        className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-white/20 hover:bg-white/[0.08] transition-all group animate-fade-in-up gap-4"
                                        style={{ animationDelay: `${index * 50}ms` }}
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center font-black text-slate-300 uppercase shadow-xl group-hover:scale-105 transition-transform shrink-0">
                                                {member.email.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-white text-base truncate max-w-[160px] sm:max-w-xs" title={member.email}>
                                                    {member.email}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                    {member.role === 'admin' ? (
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-md">Administrador</span>
                                                    ) : (
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">Profesional</span>
                                                    )}
                                                    {linkedStylist && (
                                                        <span className="text-[9px] font-bold text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-md truncate flex items-center gap-1">
                                                            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></div>
                                                            Vínculo: {linkedStylist.name}
                                                        </span>
                                                    )}
                                                    {isConnected ? (
                                                        <span className="text-[9px] font-bold text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                            <UserCheck size={10} /> Cuenta activa
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                            <Clock size={10} /> Pendiente 1er ingreso
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => copyDirectLink(member.email)}
                                                className="p-2.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/20 rounded-xl transition-all active:scale-90"
                                                title="Copiar enlace de acceso para enviar al colaborador"
                                            >
                                                {copiedEmail === member.email ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                            </button>
                                            <button
                                                onClick={() => removeMember(member.id, member.email)}
                                                className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl transition-all active:scale-90"
                                                title="Revocar acceso permanente"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>
            </div>

            {/* Explanatory Info Card */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                        <Info size={22} />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-base font-bold text-white">¿Cómo funciona el acceso de colaboradores?</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Al agregar el correo del colaborador, queda registrado en tu equipo. Cuando esa persona inicie sesión o se registre en <strong>/login</strong> con ese mismo correo, entrará automáticamente a tu negocio con su rol asignado. Puedes usar el botón de <strong>Copiar Enlace</strong> en la tarjeta del integrante para compartirle el link directo por WhatsApp.
                        </p>
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmRevoke.open}
                title="Revocar Acceso"
                message={`¿Estás seguro de que deseas quitar el acceso a ${confirmRevoke.email}? El usuario ya no podrá entrar al panel de administración de este negocio.`}
                confirmLabel="Revocar"
                onConfirm={confirmRevokeAction}
                onCancel={() => setConfirmRevoke({ open: false, memberId: null, email: null })}
                danger
            />
        </div>
    );
}
