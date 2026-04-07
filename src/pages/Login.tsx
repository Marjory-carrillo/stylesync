
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Mail, Loader2, Lock, Infinity as InfinityIcon, Eye, EyeOff, Copy, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

import { useAuthStore } from '../lib/store/authStore';

export default function Login() {
    const { user, isSuperAdmin } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [copiedPw, setCopiedPw] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const inviteEmail = searchParams.get('email');
    const invitePw = searchParams.get('pw');

    const [isInviteFlow, setIsInviteFlow] = useState(!!inviteEmail && !!invitePw);

    // Pre-fill credentials from magic link redirect
    useEffect(() => {
        if (inviteEmail) setEmail(inviteEmail);
        if (invitePw) setPassword(invitePw);
    }, [inviteEmail, invitePw]);

    // If arriving via magic link invite, sign out the auto-session
    // so the user can see their credentials before logging in manually
    useEffect(() => {
        if (inviteEmail && invitePw && user) {
            supabase.auth.signOut();
        }
    }, []); // run once on mount

    useEffect(() => {
        // Don't auto-redirect if we're showing invite credentials
        if (isInviteFlow) return;
        if (user) {
            if (isSuperAdmin) {
                navigate('/super-admin');
            } else {
                navigate('/admin');
            }
        }
    }, [user, isSuperAdmin, navigate, isInviteFlow]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setIsInviteFlow(false); // Allow redirect after manual login

        try {
            // Eliminar espacios y CUALQUIER caracter invisible o erróneo que los teclados móviles/autocompletar inyecten
            const trimmedEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '').toLowerCase();

            if (isResetting) {
                const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
                    redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) throw error;
                setResetSent(true);
            } else if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email: trimmedEmail,
                    password,
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email: trimmedEmail,
                    password,
                });
                if (error) throw error;
            }
            // Navigation will be handled by useEffect observing 'user' state
        } catch (err: any) {
            console.error('Auth error:', err);
            setError(err.message || (isSignUp ? 'Error al crear cuenta.' : 'Credenciales incorrectas o error de conexión.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-bg)] text-white flex items-center justify-center p-4 relative overflow-hidden">

            {/* Ambient Background Effects */}
            <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-[var(--color-accent)]/20 rounded-full blur-[128px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-[var(--color-primary)]/10 rounded-full blur-[128px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10 animate-fade-in">

                {/* Logo / Brand Area */}
                <div className="text-center mb-8">
                    <div className="mx-auto mb-6 flex items-center justify-center">
                        <div className="relative flex items-center justify-center w-16 h-16 group cursor-pointer">
                            <div className="absolute inset-0 bg-violet-500 blur-xl opacity-40 group-hover:opacity-60 transition-opacity rounded-full"></div>
                            <InfinityIcon className="w-16 h-16 text-violet-400 relative z-10" strokeWidth={2.5} />
                        </div>
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter text-white mb-2">
                        Cita<span className="text-violet-400">Link</span>
                    </h1>
                    <p className="text-violet-400/80 font-medium tracking-widest uppercase text-xs">Gestión Inteligente</p>
                </div>

                {/* Login Card */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">

                    {/* Subtle border gradient on hover */}
                    <div className="absolute inset-0 rounded-3xl border border-white/0 group-hover:border-white/10 transition-colors pointer-events-none" />

                    {/* Welcome banner shown when arriving via magic link with credentials */}
                {inviteEmail && invitePw && (
                    <div className="mb-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                        <p className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                            <CheckCircle2 size={16} /> ¡Bienvenido a CítaLink!
                        </p>
                        <p className="text-xs text-slate-400">Tus credenciales de acceso — guárdalas en un lugar seguro:</p>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-xl">
                                <span className="text-xs text-slate-400 font-medium">Email</span>
                                <span className="text-xs font-bold text-white">{inviteEmail}</span>
                            </div>
                            <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-xl gap-2">
                                <span className="text-xs text-slate-400 font-medium">Contraseña</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white font-mono">{showPassword ? invitePw : '••••••••'}</span>
                                    <button type="button" onClick={() => setShowPassword(p => !p)} className="text-slate-500 hover:text-white transition-colors">{showPassword ? <EyeOff size={12}/> : <Eye size={12}/>}</button>
                                    <button type="button" onClick={() => { navigator.clipboard.writeText(invitePw!); setCopiedPw(true); setTimeout(() => setCopiedPw(false), 2000); }} className="text-slate-500 hover:text-emerald-400 transition-colors">{copiedPw ? <CheckCircle2 size={12} className="text-emerald-400"/> : <Copy size={12}/>}</button>
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-600">Haz clic en <strong className="text-slate-400">Entrar</strong> para acceder ahora.</p>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6 relative z-10">

                        {/* Email Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300 ml-1">Email</label>
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-amber-400 transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                                    placeholder="tu@email.com"
                                    autoFocus
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input (Hidden if resetting) */}
                        {!isResetting && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-sm font-medium text-slate-300">Contraseña</label>
                                    {!isSignUp && (
                                        <button
                                            type="button"
                                            onClick={() => { setIsResetting(true); setError(''); }}
                                            className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
                                        >
                                            ¿Olvidaste tu contraseña?
                                        </button>
                                    )}
                                </div>
                                <div className="relative group/input">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-amber-400 transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                                        placeholder="••••••••"
                                        required={!isResetting}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 animate-shake">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                {error}
                            </div>
                        )}

                        {/* Success Message for Reset */}
                        {resetSent && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-sm text-center">
                                Te hemos enviado un enlace para restablecer tu contraseña. Revisa tu correo electrónico.
                            </div>
                        )}

                        {/* Submit Button */}
                        {!resetSent && (
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all group/btn ${loading
                                    ? 'bg-slate-700 cursor-not-allowed opacity-70'
                                    : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 hover:scale-[1.02] shadow-orange-500/20'
                                    }`}
                            >
                                {loading ? (
                                    <><Loader2 className="animate-spin" size={18} /> {isResetting ? 'Enviando...' : isSignUp ? 'Creando...' : 'Entrando...'}</>
                                ) : (
                                    <>{isResetting ? 'Enviar Enlace de Recuperación' : isSignUp ? 'Crear Cuenta' : 'Entrar'} <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" /></>
                                )}
                            </button>
                        )}

                        <div className="text-center mt-4 flex flex-col gap-2">
                            {isResetting ? (
                                <button
                                    type="button"
                                    onClick={() => { setIsResetting(false); setResetSent(false); setError(''); }}
                                    className="text-sm text-slate-400 hover:text-white transition-colors"
                                >
                                    Volver a Iniciar Sesión
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
                                    className="text-sm text-slate-400 hover:text-white transition-colors"
                                >
                                    {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿Eres nuevo empleado? Crea tu cuenta'}
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="mt-8 text-center space-y-2">
                    <a href="/" className="text-slate-500 hover:text-white text-sm transition-colors duration-200 block">
                        ← Volver al sitio
                    </a>
                    <button
                        onClick={() => {
                            localStorage.clear();
                            window.location.reload();
                        }}
                        className="text-xs text-red-500/50 hover:text-red-400 transition-colors"
                    >
                        ¿Problemas de acceso? Limpiar datos
                    </button>
                </div>
            </div>
        </div>
    );
}
