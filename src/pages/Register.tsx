import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Sparkles, Eye, EyeOff, AlertCircle, ArrowRight,
    Building2, Mail, Lock, Phone, MapPin, User,
    Scissors, Flower2, Eye as EyeIcon, Store
} from 'lucide-react';
import {
    createSelfServeTenant,
    generateSlug,
    checkSlugAvailability
} from '../lib/services/tenantOnboarding';

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
        if (password.length < 6) {
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
                password,
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

                        {/* 3. Acceso (Email y Contraseña) */}
                        <div className="pt-2 border-t border-white/5 space-y-4">
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
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            disabled={loading}
                            type="submit"
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-pink-600 hover:brightness-110 active:scale-[0.98] text-white font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-violet-600/30 disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Creando tu cuenta y agenda...</span>
                                </>
                            ) : (
                                <>
                                    <span>Crear mi Cuenta Gratis (30 Días)</span>
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
