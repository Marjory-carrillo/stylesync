import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    Sparkles, Eye, EyeOff, AlertCircle, ArrowRight,
    Building2, Mail, Lock, Phone, MapPin, User,
    Scissors, Flower2, Eye as EyeIcon, Store, CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import {
    createSelfServeTenant,
    generateSlug,
    checkSlugAvailability
} from '../lib/services/tenantOnboarding';
import { setupGoogleIdentity } from '../lib/services/googleIdentity';

const CATEGORIES = [
    { id: 'nail_bar', name: 'Salón de Uñas', icon: Sparkles, color: 'from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400' },
    { id: 'barbershop', name: 'Barbería', icon: Scissors, color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400' },
    { id: 'beauty_salon', name: 'Salón de Belleza', icon: Sparkles, color: 'from-purple-500/20 to-violet-500/20 border-purple-500/30 text-purple-400' },
    { id: 'lashes', name: 'Pestañas & Cejas', icon: EyeIcon, color: 'from-fuchsia-500/20 to-pink-500/20 border-fuchsia-500/30 text-fuchsia-400' },
    { id: 'spa', name: 'Spa & Estética', icon: Flower2, color: 'from-teal-500/20 to-emerald-500/20 border-teal-500/30 text-teal-400' },
    { id: 'other', name: 'Otro Negocio', icon: Store, color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-400' },
];

export default function Register() {
    const [businessName, setBusinessName] = useState('');
    const [category, setCategory] = useState('');
    const [slug, setSlug] = useState('');
    const [isSlugManual, setIsSlugManual] = useState(false);
    const [isSlugAvailable, setIsSlugAvailable] = useState<boolean | null>(null);
    const [checkingSlug, setCheckingSlug] = useState(false);

    const [contactName, setContactName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');

    const [oauthUser, setOauthUser] = useState<any>(null);
    const [gisLoaded, setGisLoaded] = useState(false);
    const googleBtnContainerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Auto-generar slug de forma inteligente y reactiva
    const handleBusinessNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setBusinessName(val);
        if (!isSlugManual || !slug || slug === generateSlug(businessName)) {
            setSlug(generateSlug(val));
        }
    };

    const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (!raw) {
            setSlug('');
            setIsSlugManual(false);
            return;
        }
        setIsSlugManual(true);
        const cleaned = raw
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-');
        setSlug(cleaned);
    };

    // Verificar disponibilidad del slug con debounce
    useEffect(() => {
        if (!slug || slug.trim().length < 2) {
            setIsSlugAvailable(null);
            return;
        }

        const timer = setTimeout(async () => {
            setCheckingSlug(true);
            const available = await checkSlugAvailability(slug);
            setIsSlugAvailable(available);
            setCheckingSlug(false);
        }, 400);

        return () => clearTimeout(timer);
    }, [slug]);

    // Restaurar borrador de registro si viene de redirección OAuth de Google
    useEffect(() => {
        try {
            const rawDraft = sessionStorage.getItem('citalink_onboarding_draft');
            if (rawDraft) {
                const draft = JSON.parse(rawDraft);
                if (draft.businessName) setBusinessName(draft.businessName);
                if (draft.category) setCategory(draft.category);
                if (draft.slug) {
                    setSlug(draft.slug);
                    setIsSlugManual(true);
                }
                if (draft.contactName) setContactName(draft.contactName);
                if (draft.phone) setPhone(draft.phone);
                if (draft.address) setAddress(draft.address);
            }
        } catch (_) {}

        // Verificar si el usuario ya está autenticado con Google
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user && user.email) {
                setOauthUser(user);
                setEmail(user.email);
                const fullName = user.user_metadata?.full_name || user.user_metadata?.name;
                if (fullName) {
                    setContactName((prev: string) => prev || fullName);
                }
            }
        });
    }, []);

    // Inicializar Google Identity Services nativo en citalink.app
    useEffect(() => {
        let isMounted = true;
        if (!oauthUser) {
            setupGoogleIdentity({
                container: googleBtnContainerRef.current,
                buttonText: 'continue_with',
                buttonTheme: 'outline',
                buttonShape: 'pill',
                buttonWidth: 360,
                enableOneTap: false,
                onSuccess: ({ user: googleUser }) => {
                    if (!isMounted) return;
                    setOauthUser(googleUser);
                    if (googleUser.email) setEmail(googleUser.email);
                    const fullName = googleUser.user_metadata?.full_name || googleUser.user_metadata?.name;
                    if (fullName) {
                        setContactName((prev: string) => prev || fullName);
                    }
                },
                onError: (err) => {
                    if (!isMounted) return;
                    setErrorMsg(err);
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
    }, [oauthUser]);

    const handleGoogleSignUp = async () => {
        setErrorMsg(null);
        try {
            const draft = {
                businessName,
                category,
                slug,
                contactName,
                phone,
                address,
            };
            sessionStorage.setItem('citalink_onboarding_draft', JSON.stringify(draft));

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/register`,
                },
            });
            if (error) throw error;
        } catch (err: any) {
            console.error('Error Google OAuth:', err);
            if (err?.message?.includes('provider') || err?.message?.includes('Unsupported')) {
                setErrorMsg('El registro con Google requiere habilitar el proveedor en Supabase. Puedes registrarte abajo con tu correo y contraseña.');
            } else {
                setErrorMsg(err?.message || 'Error al conectar con Google.');
            }
        }
    };

    const phoneDigits = phone.replace(/\D/g, '');
    const isPhoneValid = phoneDigits.length >= 10 && phoneDigits.length <= 12;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        // Validaciones
        if (!category) {
            setErrorMsg('Por favor selecciona el giro de tu negocio.');
            return;
        }
        if (!businessName.trim()) {
            setErrorMsg('Por favor ingresa el nombre de tu negocio.');
            return;
        }
        if (!isPhoneValid) {
            setErrorMsg(`El WhatsApp debe tener entre 10 y 12 dígitos (ingresaste ${phoneDigits.length}).`);
            return;
        }
        if (!oauthUser && password.length < 6) {
            setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (isSlugAvailable === false) {
            setErrorMsg('El link público ya está en uso. Por favor elige otro.');
            return;
        }

        setLoading(true);
        try {
            const res = await createSelfServeTenant({
                businessName,
                category,
                slug,
                contactName,
                email,
                password: oauthUser ? undefined : password,
                isOAuth: !!oauthUser,
                phone,
                address,
                countryCode: 'MX',
                currency: 'MXN',
                currencySymbol: '$',
                defaultPhonePrefix: '+52'
            });

            if (!res.success) {
                setErrorMsg(res.error || 'Error al registrar tu cuenta.');
                setLoading(false);
                return;
            }

            // Limpiar borrador temporal tras creación exitosa
            try {
                sessionStorage.removeItem('citalink_onboarding_draft');
            } catch (_) {}

            // Redirigir al panel de administración con el flag de bienvenida y recarga limpia
            window.location.href = '/admin?welcome=true';
        } catch (err: any) {
            console.error('Error al registrar:', err);
            setErrorMsg(err?.message || 'Error inesperado al crear tu cuenta.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#040814] text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-violet-600/15 via-pink-600/10 to-transparent blur-[140px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent/5 blur-[160px] pointer-events-none" />

            <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10 px-4">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-2.5 group">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-600/30 group-hover:scale-105 transition-transform">
                            <Sparkles size={22} className="text-white" />
                        </div>
                        <span className="text-2xl font-black tracking-tight text-white">
                            Cita<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-pink-400">Link</span>
                        </span>
                    </Link>

                    <h1 className="mt-4 text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
                        Crea tu Cuenta en 1 Minuto
                    </h1>
                    <p className="mt-2 text-xs sm:text-sm text-slate-400">
                        Prueba <strong className="text-white">CitaLink Pro gratis por 30 días</strong> sin tarjeta de crédito.
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-[#0b101d]/90 border border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
                    {errorMsg && (
                        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold flex items-center gap-3 animate-fade-in">
                            <AlertCircle size={18} className="shrink-0 text-rose-400" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Botón de Google OAuth */}
                    {!oauthUser ? (
                        <div className="mb-6 space-y-4">
                            <div className="w-full flex flex-col items-center justify-center">
                                <div
                                    ref={googleBtnContainerRef}
                                    className={`w-full flex justify-center items-center min-h-[44px] ${gisLoaded ? '' : 'hidden'}`}
                                />
                                {!gisLoaded && (
                                    <button
                                        type="button"
                                        onClick={handleGoogleSignUp}
                                        disabled={loading}
                                        className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-black text-sm flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
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
                            <div className="relative flex py-1 items-center">
                                <div className="flex-grow border-t border-white/10"></div>
                                <span className="flex-shrink mx-4 text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                                    o con correo y contraseña manual
                                </span>
                                <div className="flex-grow border-t border-white/10"></div>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center justify-between animate-fade-in">
                            <div className="flex items-center gap-2.5">
                                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                                <span>Conectado con Google: <strong>{oauthUser.email}</strong></span>
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    await supabase.auth.signOut();
                                    setOauthUser(null);
                                    setEmail('');
                                }}
                                className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                            >
                                Cambiar cuenta
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        
                        {/* 1. Selección de Categoría */}
                        <div>
                            <label className="text-xs font-bold text-slate-300 mb-2 block uppercase tracking-wider">
                                1. Selecciona el Giro de tu Negocio
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                {CATEGORIES.map(cat => {
                                    const Icon = cat.icon;
                                    const isSelected = category === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setCategory(cat.id)}
                                            className={`p-3 rounded-2xl border text-left transition-all flex flex-col items-center justify-center text-center gap-2 ${
                                                isSelected
                                                    ? `bg-white/10 border-white text-white shadow-lg ring-2 ring-violet-500/50`
                                                    : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5'
                                            }`}
                                        >
                                            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center`}>
                                                <Icon size={16} />
                                            </div>
                                            <span className="text-xs font-bold">{cat.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. Datos del Negocio */}
                        <div className="pt-2 border-t border-white/5 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-300 mb-1.5 block" htmlFor="reg2-business">Nombre del Negocio</label>
                                <div className="relative">
                                    <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        required
                                        id="reg2-business"
                                        name="organization"
                                        autoComplete="organization"
                                        type="text"
                                        placeholder="Ej: Estudio Glamour o Barbería Imperial"
                                        className="w-full bg-[#040814]/90 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                        value={businessName}
                                        onChange={handleBusinessNameChange}
                                    />
                                </div>
                            </div>

                            {/* Link Público / Slug */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold text-slate-300 block" htmlFor="reg2-slug">Tu Link Exclusivo</label>
                                    <div className="flex items-center gap-2">
                                        {isSlugManual && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsSlugManual(false);
                                                    setSlug(generateSlug(businessName));
                                                }}
                                                className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold underline"
                                            >
                                                ↺ Auto-generar
                                            </button>
                                        )}
                                        {slug.length > 1 && (
                                            <span className={`text-[10px] font-bold ${
                                                checkingSlug
                                                    ? 'text-slate-400'
                                                    : isSlugAvailable
                                                        ? 'text-emerald-400'
                                                        : 'text-rose-400'
                                            }`}>
                                                {checkingSlug && 'Verificando...'}
                                                {!checkingSlug && isSlugAvailable && '✓ Link Disponible'}
                                                {!checkingSlug && isSlugAvailable === false && '✕ Link en uso'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center bg-[#040814]/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20">
                                    <span className="text-xs text-slate-500 font-mono shrink-0">citalink.app/</span>
                                    <input
                                        required
                                        id="reg2-slug"
                                        type="text"
                                        className="bg-transparent border-none text-xs sm:text-sm font-mono text-violet-300 focus:outline-none w-full pl-1"
                                        value={slug}
                                        onChange={handleSlugChange}
                                        placeholder="mi-negocio"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="text-xs font-bold text-slate-300 mb-1.5 block" htmlFor="reg2-name">Nombre del Dueño / Admin</label>
                                    <div className="relative">
                                        <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input
                                            required
                                            id="reg2-name"
                                            name="name"
                                            autoComplete="name"
                                            type="text"
                                            placeholder="Tu nombre completo"
                                            className="w-full bg-[#040814]/90 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                            value={contactName}
                                            onChange={e => setContactName(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-bold text-slate-300 block" htmlFor="reg2-phone">WhatsApp de Contacto</label>
                                        {phone.trim().length > 0 && (
                                            <span className={`text-[10px] font-bold ${
                                                phoneDigits.length < 10 
                                                    ? 'text-amber-400' 
                                                    : phoneDigits.length > 12 
                                                        ? 'text-rose-400' 
                                                        : 'text-emerald-400'
                                            }`}>
                                                {phoneDigits.length < 10 && `⚠️ Mín 10 (${phoneDigits.length}/10)`}
                                                {phoneDigits.length > 12 && `⚠️ Máx 12 (${phoneDigits.length}/12)`}
                                                {phoneDigits.length >= 10 && phoneDigits.length <= 12 && `✓ Válido`}
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                        <input
                                            required
                                            id="reg2-phone"
                                            name="tel"
                                            autoComplete="tel"
                                            inputMode="tel"
                                            type="tel"
                                            placeholder="+52 81 0000 0000"
                                            className={`w-full bg-[#040814]/90 border rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                                                phone.trim().length > 0 && (!isPhoneValid)
                                                    ? 'border-amber-500/80 focus:border-amber-500 focus:ring-amber-500/20'
                                                    : 'border-white/10 focus:border-violet-500 focus:ring-violet-500/20'
                                            }`}
                                            value={phone}
                                            onChange={e => setPhone(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-300 mb-1.5 block" htmlFor="reg2-address">Dirección / Ubicación</label>
                                <div className="relative">
                                    <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        required
                                        id="reg2-address"
                                        name="street-address"
                                        autoComplete="street-address"
                                        type="text"
                                        placeholder="Ej: Av. Constitución 450, Centro, Monterrey"
                                        className="w-full bg-[#040814]/90 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                        value={address}
                                        onChange={e => setAddress(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. Acceso */}
                        <div className="pt-2 border-t border-white/5 space-y-4">
                            {oauthUser ? (
                                <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-600/15 via-fuchsia-600/10 to-emerald-500/15 border border-violet-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                            <CheckCircle2 size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-white">Cuenta de Google Verificada</span>
                                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">Activa</span>
                                            </div>
                                            <p className="text-xs text-slate-300 font-mono mt-0.5">{oauthUser.email}</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] text-violet-300 font-semibold italic bg-violet-500/10 px-3 py-1.5 rounded-lg border border-violet-500/20">
                                        ✓ Protegido con Google (Sin contraseña manual)
                                    </span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 mb-1.5 block" htmlFor="reg2-email">Correo Electrónico</label>
                                        <div className="relative">
                                            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                            <input
                                                required
                                                id="reg2-email"
                                                name="email"
                                                autoComplete="email"
                                                inputMode="email"
                                                type="email"
                                                placeholder="tu@correo.com"
                                                className="w-full bg-[#040814]/90 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-300 mb-1.5 block" htmlFor="reg2-password">Contraseña</label>
                                        <div className="relative">
                                            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                            <input
                                                required
                                                id="reg2-password"
                                                name="new-password"
                                                autoComplete="new-password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="Mínimo 6 caracteres"
                                                className="w-full bg-[#040814]/90 border border-white/10 rounded-xl pl-11 pr-11 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            disabled={loading}
                            type="submit"
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-pink-600 hover:brightness-110 active:scale-[0.98] text-white font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-violet-600/30 disabled:opacity-50 flex items-center justify-center gap-2 mt-4 cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Creando tu negocio y agenda...</span>
                                </>
                            ) : (
                                <>
                                    <span>{oauthUser ? 'Crear mi Negocio con Google (30 Días Gratis)' : 'Crear mi Cuenta Gratis (30 Días)'}</span>
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>

                        {/* Legal Terms & Privacy */}
                        <p className="text-[11px] text-slate-400 text-center leading-relaxed px-2 pt-1">
                            Al crear tu cuenta, aceptas nuestros{' '}
                            <Link to="/terms" target="_blank" className="text-violet-400 hover:text-violet-300 font-semibold underline underline-offset-2">
                                Términos de Servicio
                            </Link>{' '}
                            y nuestro{' '}
                            <Link to="/privacy" target="_blank" className="text-violet-400 hover:text-violet-300 font-semibold underline underline-offset-2">
                                Aviso de Privacidad
                            </Link>.
                        </p>

                        <div className="text-center pt-2">
                            <p className="text-xs text-slate-400">
                                ¿Ya tienes una cuenta registrada?{' '}
                                <Link to="/login" className="text-violet-400 hover:text-violet-300 font-bold underline">
                                    Inicia Sesión aquí
                                </Link>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
