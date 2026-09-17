
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Mail, Loader2, Lock, Infinity as InfinityIcon, Eye, EyeOff, Copy, CheckCircle2, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

import { useAuthStore, isUserSuperAdmin } from '../lib/store/authStore';

export default function Login() {
    const { user, isSuperAdmin } = useAuthStore();
    const [savedAccount, setSavedAccount] = useState<{ email: string; name?: string } | null>(() => {
        try {
            const raw = localStorage.getItem('citalink_saved_account');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });
    const [email, setEmail] = useState(() => {
        return localStorage.getItem('citalink_saved_email') || '';
    });
    const [password, setPassword] = useState('');
    const [rememberEmail, setRememberEmail] = useState(() => {
        return localStorage.getItem('citalink_remember_email') !== 'false';
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [copiedPw, setCopiedPw] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const passwordInputRef = useRef<HTMLInputElement>(null);
    const inviteEmail = searchParams.get('email');
    const invitePw = searchParams.get('pw');

    const [isInviteFlow, setIsInviteFlow] = useState(!!inviteEmail && !!invitePw);

    // Auto-enfocar el campo de contraseña si el correo ya está recordado (activa la barra de autocompletar Face ID en Safari)
    useEffect(() => {
        if (email && !password && passwordInputRef.current) {
            const timer = setTimeout(() => {
                passwordInputRef.current?.focus();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, []);

    // Pre-fill credentials from magic link redirect and sanitize URL bar immediately
    useEffect(() => {
        if (inviteEmail) setEmail(inviteEmail);
        if (invitePw) setPassword(invitePw);
        if (inviteEmail || invitePw || window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
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
            // Eliminar espacios y caracteres no válidos para email (permitiendo + para aliases)
            const trimmedEmail = email.replace(/[^a-zA-Z0-9@._+-]/g, '').toLowerCase();

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
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: trimmedEmail,
                    password,
                });
                if (error) throw error;

                // Guardar correo y cuenta para autocompletar en próximas sesiones en Safari iOS y navegadores
                if (rememberEmail) {
                    try {
                        localStorage.setItem('citalink_saved_email', trimmedEmail);
                        localStorage.setItem('citalink_remember_email', 'true');
                        const account = {
                            email: trimmedEmail,
                            name: data?.user?.user_metadata?.name || data?.user?.user_metadata?.full_name || trimmedEmail.split('@')[0],
                            timestamp: Date.now()
                        };
                        localStorage.setItem('citalink_saved_account', JSON.stringify(account));
                    } catch (e) {
                        console.debug('Storage error:', e);
                    }
                } else {
                    try {
                        localStorage.removeItem('citalink_saved_email');
                        localStorage.removeItem('citalink_saved_account');
                        localStorage.setItem('citalink_remember_email', 'false');
                    } catch (e) {
                        console.debug('Storage error:', e);
                    }
                }

                // Guardar credenciales en el Llavero de iCloud / Administrador nativo de contraseñas
                if (typeof window !== 'undefined' && (window as any).PasswordCredential && navigator.credentials) {
                    try {
                        const cred = new (window as any).PasswordCredential({
                            id: trimmedEmail,
                            password: password,
                            name: trimmedEmail,
                        });
                        await navigator.credentials.store(cred);
                    } catch (credErr) {
                        console.debug('Keychain store skipped:', credErr);
                    }
                }

                // Navegación nativa para que WebKit (Safari en iOS) detecte el envío exitoso
                // y dispare la ventana nativa: "¿Deseas guardar esta contraseña en el llavero de iCloud?"
                const target = isUserSuperAdmin(data?.user) ? '/super-admin' : '/admin';
                window.location.href = target;
                return;
            }
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

                {/* Tarjeta de Acceso Rápido si ya existe una cuenta guardada en este dispositivo */}
                {email && !isResetting && !isSignUp && (
                    <div className="mb-5 bg-gradient-to-r from-violet-600/15 via-fuchsia-600/10 to-amber-500/15 border border-violet-500/30 rounded-2xl p-3.5 shadow-lg flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-amber-500 flex items-center justify-center font-black text-white text-base shadow-md shrink-0">
                                {email.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Cuenta en este dispositivo</span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                </div>
                                <p className="text-sm font-semibold text-white truncate">{email}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                try {
                                    localStorage.removeItem('citalink_saved_account');
                                    localStorage.removeItem('citalink_saved_email');
                                } catch (_) {}
                                setSavedAccount(null);
                                setEmail('');
                                setPassword('');
                            }}
                            className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors shrink-0 ml-2"
                        >
                            Cambiar
                        </button>
                    </div>
                )}

                <form onSubmit={handleLogin} method="post" action="/login" autoComplete="on" className="space-y-5 relative z-10">

                        {/* Email Input */}
                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-slate-300 ml-1">Email</label>
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-amber-400 transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    inputMode="email"
                                    autoComplete="username email"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                                    placeholder="tu@email.com"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input (Hidden if resetting) */}
                        {!isResetting && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center ml-1">
                                    <label htmlFor="password" className="text-sm font-medium text-slate-300">Contraseña</label>
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
                                        ref={passwordInputRef}
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete={isSignUp ? "new-password" : "current-password"}
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-11 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all font-mono"
                                        placeholder="••••••••"
                                        required={!isResetting}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(p => !p)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                                        tabIndex={-1}
                                        aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                                {/* Acceso Rápido Face ID / Llavero de iCloud en iOS */}
                                {!isSignUp && (
                                    <button
                                        type="button"
                                        onClick={() => passwordInputRef.current?.focus()}
                                        className="w-full py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-amber-400/90 hover:text-amber-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <KeyRound size={13} className="text-amber-400 shrink-0" />
                                        <span>Usar Llavero de iCloud / Face ID</span>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Recordar credenciales en este dispositivo */}
                        {!isResetting && !isSignUp && (
                            <div className="flex items-center justify-between px-1 pt-0.5">
                                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-400 hover:text-slate-200 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={rememberEmail}
                                        onChange={(e) => setRememberEmail(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500/30 focus:ring-offset-0 cursor-pointer accent-amber-500"
                                    />
                                    <span>Mantener sesión iniciada y recordar correo</span>
                                </label>
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
