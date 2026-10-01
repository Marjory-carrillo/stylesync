
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Mail, Loader2, Lock, Infinity as InfinityIcon, Eye, EyeOff, Copy, CheckCircle2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

import { useAuthStore, isUserSuperAdmin } from '../lib/store/authStore';
import { setupGoogleIdentity } from '../lib/services/googleIdentity';

export default function Login() {
    const { user, isSuperAdmin } = useAuthStore();
    const [gisLoaded, setGisLoaded] = useState(false);
    const googleBtnContainerRef = useRef<HTMLDivElement>(null);
    const [email, setEmail] = useState(() => {
        return localStorage.getItem('citalink_saved_email') || '';
    });
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [signUpSuccess, setSignUpSuccess] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [copiedPw, setCopiedPw] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(() => {
        try {
            return parseInt(sessionStorage.getItem('citalink_failed_logins') || '0', 10);
        } catch {
            return 0;
        }
    });
    const [lockoutRemaining, setLockoutRemaining] = useState(() => {
        try {
            const until = parseInt(sessionStorage.getItem('citalink_login_lockout') || '0', 10);
            const diff = Math.ceil((until - Date.now()) / 1000);
            return diff > 0 ? diff : 0;
        } catch {
            return 0;
        }
    });
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const passwordInputRef = useRef<HTMLInputElement>(null);
    const inviteEmail = searchParams.get('email');
    const invitePw = searchParams.get('pw');

    const [isInviteFlow, setIsInviteFlow] = useState(!!inviteEmail && !!invitePw);
    const [showPasswordField, setShowPasswordField] = useState(() => !!(inviteEmail && invitePw));

    // Pre-fill credentials from magic link redirect and sanitize URL bar immediately
    useEffect(() => {
        if (inviteEmail) setEmail(inviteEmail);
        if (invitePw) {
            setPassword(invitePw);
            setShowPasswordField(true);
        }
        if (inviteEmail || invitePw || window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [inviteEmail, invitePw]);

    // Security: Purgar inmediatamente cualquier contraseña vieja guardada en localStorage
    useEffect(() => {
        try {
            localStorage.removeItem('citalink_saved_pw');
        } catch (_) {}
    }, []);

    // Temporizador de cuenta regresiva para el bloqueo por intentos fallidos
    useEffect(() => {
        if (lockoutRemaining <= 0) return;
        const timer = setInterval(() => {
            setLockoutRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    try {
                        sessionStorage.removeItem('citalink_login_lockout');
                        sessionStorage.removeItem('citalink_failed_logins');
                    } catch (_) {}
                    setFailedAttempts(0);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [lockoutRemaining]);

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

    // Inicializar Google Identity Services nativo en citalink.app
    useEffect(() => {
        let isMounted = true;
        if (!showPasswordField && !isResetting && !isSignUp) {
            setupGoogleIdentity({
                container: googleBtnContainerRef.current,
                buttonText: 'continue_with',
                buttonTheme: 'outline',
                buttonShape: 'pill',
                buttonWidth: 340,
                enableOneTap: false,
                onSuccess: ({ user: signedInUser }) => {
                    if (!isMounted) return;
                    const target = isUserSuperAdmin(signedInUser) ? '/super-admin' : '/admin';
                    navigate(target, { replace: true });
                },
                onError: (err) => {
                    if (!isMounted) return;
                    setError(err);
                }
            }).then((ready) => {
                if (isMounted && ready) {
                    setGisLoaded(true);
                }
            });
        }
        return () => {
            isMounted = false;
        };
    }, [showPasswordField, isResetting, isSignUp, navigate]);

    const handleGoogleLogin = async () => {
        setError('');
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/admin`,
                },
            });
            if (error) throw error;
        } catch (err: any) {
            console.error('Error Google OAuth login:', err);
            if (err?.message?.includes('provider') || err?.message?.includes('Unsupported')) {
                setError('El acceso con Google requiere habilitar el proveedor en Supabase. Puedes acceder abajo con tu correo y contraseña.');
            } else {
                setError(err?.message || 'Error al conectar con Google.');
            }
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (lockoutRemaining > 0) return;

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
                const { data: signUpData, error } = await supabase.auth.signUp({
                    email: trimmedEmail,
                    password,
                });
                if (error) throw error;
                if (signUpData.session) {
                    navigate('/admin', { replace: true });
                    return;
                } else {
                    setSignUpSuccess(true);
                }
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: trimmedEmail,
                    password,
                });
                if (error) throw error;

                // Reiniciar contador de fallos tras inicio de sesión exitoso
                setFailedAttempts(0);
                try {
                    sessionStorage.removeItem('citalink_failed_logins');
                    sessionStorage.removeItem('citalink_login_lockout');
                    localStorage.setItem('citalink_saved_email', trimmedEmail);
                } catch (_) {}

                // Navegar inmediatamente con React Router sin congelar la app con recargas
                const target = isUserSuperAdmin(data?.user) ? '/super-admin' : '/admin';
                navigate(target, { replace: true });
                return;
            }
        } catch (err: any) {
            console.error('Auth error:', err);
            
            // Protección contra fuerza bruta: registrar intento fallido
            if (!isResetting && !isSignUp) {
                const nextFailed = failedAttempts + 1;
                setFailedAttempts(nextFailed);
                try {
                    sessionStorage.setItem('citalink_failed_logins', String(nextFailed));
                } catch (_) {}

                if (nextFailed >= 5) {
                    const lockSeconds = 45;
                    setLockoutRemaining(lockSeconds);
                    try {
                        sessionStorage.setItem('citalink_login_lockout', String(Date.now() + lockSeconds * 1000));
                    } catch (_) {}
                    setError('Demasiados intentos fallidos. Por seguridad, el acceso se ha bloqueado temporalmente por 45 segundos.');
                    return;
                }
            }

            setError(err.message || (isSignUp ? 'Error al crear cuenta.' : 'Credenciales incorrectas o error de conexión.'));
        } finally {
            setLoading(false);
        }
    };

    const handleContinueOrSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!email.trim()) {
            setError('Por favor ingresa tu correo electrónico.');
            return;
        }

        // Si estamos restableciendo contraseña, enviar directamente
        if (isResetting) {
            handleLogin(e);
            return;
        }

        // Si estamos en activación de colaborador (isSignUp), validamos contraseña y enviamos
        if (isSignUp) {
            if (!password) {
                setError('Por favor define tu contraseña de acceso.');
                passwordInputRef.current?.focus();
                return;
            }
            handleLogin(e);
            return;
        }

        // Si la contraseña aún no está visible, la desplegamos y enfocamos el campo
        if (!showPasswordField) {
            setShowPasswordField(true);
            setTimeout(() => passwordInputRef.current?.focus(), 80);
            return;
        }

        if (!password) {
            setError('Por favor ingresa tu contraseña.');
            passwordInputRef.current?.focus();
            return;
        }

        handleLogin(e);
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

                {/* CitaLink Dark Glassmorphic Login Card */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">

                    {/* Subtle border gradient on hover */}
                    <div className="absolute inset-0 rounded-3xl border border-white/0 group-hover:border-white/10 transition-colors pointer-events-none" />

                    {/* Welcome banner shown when arriving via magic link with credentials */}
                    {inviteEmail && invitePw && (
                        <div className="mb-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                            <p className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                                <CheckCircle2 size={16} /> ¡Bienvenido a CitaLink!
                            </p>
                            <p className="text-xs text-slate-400">Tus credenciales de acceso asignadas:</p>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-xl text-xs">
                                    <span className="text-slate-400 font-medium">Email</span>
                                    <span className="font-bold text-white">{inviteEmail}</span>
                                </div>
                                <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-xl text-xs gap-2">
                                    <span className="text-slate-400 font-medium">Contraseña</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white font-mono">{showPassword ? invitePw : '••••••••'}</span>
                                        <button type="button" onClick={() => setShowPassword(p => !p)} className="text-slate-500 hover:text-white transition-colors">{showPassword ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                                        <button type="button" onClick={() => { navigator.clipboard.writeText(invitePw!); setCopiedPw(true); setTimeout(() => setCopiedPw(false), 2000); }} className="text-slate-500 hover:text-emerald-400 transition-colors">{copiedPw ? <CheckCircle2 size={14} className="text-emerald-400"/> : <Copy size={14}/>}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Panel de Instrucciones para Colaboradores */}
                    {isSignUp && !signUpSuccess && (
                        <div className="mb-5 bg-gradient-to-r from-violet-600/15 via-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl p-4 text-xs space-y-2 text-slate-300 animate-fade-in">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                                <Sparkles size={16} className="text-amber-400" />
                                <span>Activación de Cuenta para Colaboradores</span>
                            </div>
                            <p className="leading-relaxed">
                                Ingresa el <strong>mismo correo electrónico</strong> con el que el administrador o dueño te dio de alta en el negocio.
                            </p>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                Crea tu contraseña personal. Al entrar, tu cuenta se vinculará de inmediato para gestionar tu agenda de citas, clientes y comisiones asignadas.
                            </p>
                        </div>
                    )}

                    {/* Mensaje de cuenta creada con éxito */}
                    {signUpSuccess && (
                        <div className="mb-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-4 rounded-2xl text-xs space-y-2 text-center animate-fade-in">
                            <p className="font-bold text-sm text-emerald-400">¡Cuenta creada con éxito!</p>
                            <p className="text-slate-300">Si tu correo requiere confirmación, revisa tu bandeja de entrada. De lo contrario, ya puedes iniciar sesión con tu correo y contraseña.</p>
                            <button
                                type="button"
                                onClick={() => { setIsSignUp(false); setSignUpSuccess(false); }}
                                className="mt-2 text-xs font-bold text-white underline hover:text-emerald-300 cursor-pointer"
                            >
                                Ir a Iniciar Sesión
                            </button>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-5 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm flex items-center gap-2 animate-shake">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Success Message for Reset */}
                    {resetSent && (
                        <div className="mb-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl text-sm text-center">
                            Te hemos enviado un enlace para restablecer tu contraseña. Revisa tu correo electrónico.
                        </div>
                    )}

                    <form onSubmit={handleContinueOrSubmit} method="post" action="/login" autoComplete="on" className="space-y-5 relative z-10">

                        {/* Email Input */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-1">
                                <label htmlFor="email" className="text-sm font-medium text-slate-300">
                                    {isSignUp ? 'Correo de colaborador registrado' : 'Email'}
                                </label>
                                {showPasswordField && !isResetting && !isSignUp && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowPasswordField(false);
                                            setPassword('');
                                        }}
                                        className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                                    >
                                        Cambiar correo
                                    </button>
                                )}
                            </div>
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-amber-400 transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    inputMode="email"
                                    autoComplete="username"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all text-sm"
                                    placeholder={isSignUp ? "tu-correo-registrado@email.com" : "tu@email.com"}
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input (Visible en modo contraseña o en registro de colaborador) */}
                        {(showPasswordField || isSignUp) && !isResetting && (
                            <div className="space-y-2 animate-fade-in">
                                <div className="flex justify-between items-center ml-1">
                                    <label htmlFor="password" className="text-sm font-medium text-slate-300">
                                        {isSignUp ? 'Crea tu contraseña' : 'Contraseña'}
                                    </label>
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
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-11 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all font-mono text-sm"
                                        placeholder="••••••••"
                                        required
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
                            </div>
                        )}

                        {/* Primary Button */}
                        {!resetSent && !signUpSuccess && (
                            <button
                                type="submit"
                                disabled={loading || lockoutRemaining > 0}
                                className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all group/btn ${
                                    loading || lockoutRemaining > 0
                                        ? 'bg-slate-700 cursor-not-allowed opacity-70'
                                        : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 hover:scale-[1.01] shadow-orange-500/20 active:scale-[0.99] cursor-pointer'
                                    }`}
                            >
                                {loading ? (
                                    <><Loader2 className="animate-spin" size={18} /> {isResetting ? 'Enviando...' : isSignUp ? 'Activando...' : 'Entrando...'}</>
                                ) : lockoutRemaining > 0 ? (
                                    <>Acceso Bloqueado ({lockoutRemaining}s) <Lock size={16} /></>
                                ) : isResetting ? (
                                    <>Enviar Enlace de Recuperación <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" /></>
                                ) : isSignUp ? (
                                    <>Activar Cuenta de Colaborador <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" /></>
                                ) : showPasswordField ? (
                                    <>Entrar <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" /></>
                                ) : (
                                    <>Continuar <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" /></>
                                )}
                            </button>
                        )}

                        {/* Reset password back button */}
                        {isResetting && (
                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsResetting(false); setResetSent(false); setError(''); }}
                                    className="text-sm text-slate-400 hover:text-white transition-colors"
                                >
                                    ← Volver a Iniciar Sesión
                                </button>
                            </div>
                        )}

                        {/* Opciones cuando está en la vista inicial limpia (login normal) */}
                        {!showPasswordField && !isResetting && !isSignUp && !resetSent && !signUpSuccess && (
                            <div className="space-y-4 pt-1">
                                <div className="relative flex py-1 items-center">
                                    <div className="flex-grow border-t border-white/10"></div>
                                    <span className="flex-shrink mx-3 text-xs text-slate-500 font-medium">o</span>
                                    <div className="flex-grow border-t border-white/10"></div>
                                </div>

                                <div className="w-full flex flex-col items-center justify-center">
                                    <div
                                        ref={googleBtnContainerRef}
                                        className={`w-full flex justify-center items-center min-h-[44px] ${gisLoaded ? '' : 'hidden'}`}
                                    />
                                    {!gisLoaded && (
                                        <button
                                            type="button"
                                            onClick={handleGoogleLogin}
                                            disabled={loading || lockoutRemaining > 0}
                                            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
                                        >
                                            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                            </svg>
                                            <span>Continuar con Google</span>
                                        </button>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPasswordField(true);
                                        setTimeout(() => passwordInputRef.current?.focus(), 80);
                                    }}
                                    className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-medium text-sm flex items-center justify-center transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                                >
                                    Ingresar con contraseña
                                </button>
                            </div>
                        )}

                        {/* Opción de volver si está en el paso de contraseña (login normal) */}
                        {showPasswordField && !isResetting && !isSignUp && !resetSent && (
                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPasswordField(false);
                                        setPassword('');
                                    }}
                                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                                >
                                    ← Ingresar con otro método
                                </button>
                            </div>
                        )}

                        {/* Footer: Opciones de navegación */}
                        {isSignUp ? (
                            <div className="pt-4 border-t border-white/5 text-center text-xs text-slate-400">
                                ¿Ya activaste tu cuenta anteriormente?{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsSignUp(false);
                                        setError('');
                                    }}
                                    className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                                >
                                    Inicia sesión aquí
                                </button>
                            </div>
                        ) : (
                            <div className="pt-4 border-t border-white/5 space-y-2.5 text-center text-xs text-slate-400">
                                <div>
                                    ¿Eres colaborador o del equipo?{' '}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsSignUp(true);
                                            setShowPasswordField(true);
                                            setError('');
                                        }}
                                        className="text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                                    >
                                        Activa tu cuenta
                                    </button>
                                </div>
                                <div>
                                    ¿No tienes cuenta?{' '}
                                    <Link to="/register" className="text-amber-400 hover:text-amber-300 font-bold underline transition-colors">
                                        Regístrate
                                    </Link>
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                {/* Subfooter */}
                <div className="mt-8 text-center space-y-2">
                    <a href="/" className="text-slate-500 hover:text-white text-sm transition-colors duration-200 block">
                        ← Volver al sitio
                    </a>
                    <button
                        onClick={async () => {
                            try {
                                await supabase.auth.signOut();
                            } catch (_) {}
                            localStorage.clear();
                            sessionStorage.clear();
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
