import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../lib/store/authStore';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { CustomSelect } from '../components/CustomSelect';
import { createSelfServeTenant, generateSlug } from '../lib/services/tenantOnboarding';

import {
    CalendarDays, MessageCircle, Users, TrendingUp, ArrowRight,
    CheckCircle2, X, Sparkles, Scissors, Flower2, Stethoscope,
    Infinity as InfinityIcon, Star, Shield, Zap, Clock,
    BarChart2, Smartphone, ChevronDown, Instagram, Facebook,
    Percent, CalendarPlus, MapPin, Menu,
    Search, Store, ShieldCheck, Ban, ScanLine, Building2,
    Check, Eye, EyeOff
} from 'lucide-react';

/* ── Helpers ─────────────────────────────────────────────────── */
const businessTypeOptions = [
    { value: 'nail_bar', label: "Salón de Uñas (Nail's) 💅" },
    { value: 'barbershop', label: 'Barbería 💈' },
    { value: 'beauty_salon', label: 'Salón de Belleza 💇‍♀️' },
    { value: 'lashes', label: 'Pestañas & Cejas ✨' },
    { value: 'spa', label: 'Spa / Multiestética 💆' },
    { value: 'clinic', label: 'Clínica / Consultorio 🩺' },
    { value: 'other', label: 'Otro Giro 🏪' },
];
const employeeCountOptions = [
    { value: '1', label: 'Solo yo (1)' },
    { value: '2-4', label: '2 a 4 empleados' },
    { value: '5-10', label: '5 a 10 empleados' },
    { value: '10+', label: 'Más de 10 empleados' },
];

/* ── Scroll Animation Hook ────────────────────────────────────── */
function useInView(threshold = 0.15) {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) { setInView(true); obs.disconnect(); }
        }, { threshold });
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [threshold]);
    return { ref, inView };
}

/* ── Animated Counter ─────────────────────────────────────────── */
function Counter({ end, suffix = '', duration = 1800 }: { end: number; suffix?: string; duration?: number }) {
    const [count, setCount] = useState(0);
    const { ref, inView } = useInView(0.3);
    useEffect(() => {
        if (!inView) return;
        let start = 0;
        const step = end / (duration / 16);
        const timer = setInterval(() => {
            start += step;
            if (start >= end) { setCount(end); clearInterval(timer); }
            else setCount(Math.floor(start));
        }, 16);
        return () => clearInterval(timer);
    }, [inView, end, duration]);
    return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ── FAQ Accordion ────────────────────────────────────────── */
function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div
            className={`border rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer ${open ? 'border-violet-500/30 bg-violet-500/5' : 'border-white/5 bg-white/[0.02] hover:border-white/10'}`}
            onClick={() => setOpen(!open)}
        >
            <div className="flex items-center justify-between px-6 py-4">
                <p className="text-sm font-semibold text-white pr-4">{q}</p>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-violet-400' : ''}`} />
            </div>
            {open && (
                <div className="px-6 pb-4">
                    <p className="text-sm text-slate-400 leading-relaxed">{a}</p>
                </div>
            )}
        </div>
    );
}

/* ── Main Landing Component ───────────────────────────────────── */
export default function Landing() {
    const { user, isSuperAdmin } = useAuthStore();
    const dashboardPath = isSuperAdmin ? '/super-admin' : '/admin';

    // Lead Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [leadSuccess, setLeadSuccess] = useState(false);
    const [createdAccount, setCreatedAccount] = useState<{
        email: string;
        password: string;
        businessName: string;
        slug: string;
    } | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        businessName: '', businessType: '', employeeCount: '1',
        contactName: '', email: '', password: '', phone: '', address: ''
    });
    const [showPassword, setShowPassword] = useState(false);

    // Interactive ROI Calculator State
    const [roiProCount, setRoiProCount] = useState(3);

    // Navbar & Mobile menu state
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', fn);
        return () => window.removeEventListener('scroll', fn);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMsg(null);

        if (!formData.businessType) {
            setErrorMsg('Por favor selecciona el giro o rubro de tu negocio.');
            setSubmitting(false);
            return;
        }

        // Validación estricta de teléfono (entre 10 y 12 dígitos)
        const rawDigits = formData.phone.replace(/\D/g, '');
        if (rawDigits.length < 10) {
            setErrorMsg(`El WhatsApp debe tener mínimo 10 dígitos (ingresaste ${rawDigits.length}). Por favor introduce un número completo.`);
            setSubmitting(false);
            return;
        }
        if (rawDigits.length > 12) {
            setErrorMsg(`El WhatsApp no debe exceder 12 dígitos (ingresaste ${rawDigits.length}). Por favor verifica el número.`);
            setSubmitting(false);
            return;
        }

        if (formData.password && formData.password.length < 6) {
            setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
            setSubmitting(false);
            return;
        }

        try {
            // 1. Guardar lead para seguimiento comercial
            await supabase.from('leads').insert([{
                business_name: formData.businessName, business_type: formData.businessType,
                employee_count: formData.employeeCount, contact_name: formData.contactName,
                email: formData.email, phone: formData.phone, address: formData.address
            }]);

            // 2. Creación autónoma del negocio y usuario
            const passwordToUse = formData.password.trim() || 'citalink123';
            const autoSlug = generateSlug(formData.businessName || 'mi-negocio');

            const createRes = await createSelfServeTenant({
                businessName: formData.businessName,
                category: formData.businessType || 'other',
                slug: autoSlug,
                contactName: formData.contactName,
                email: formData.email,
                password: passwordToUse,
                phone: formData.phone,
                address: formData.address,
                countryCode: 'MX',
                currency: 'MXN',
                currencySymbol: '$',
                defaultPhonePrefix: '+52'
            });

            if (createRes.success) {
                setCreatedAccount({
                    email: formData.email,
                    password: passwordToUse,
                    businessName: formData.businessName,
                    slug: createRes.slug || autoSlug,
                });
                setLeadSuccess(true);
                // Redirigir al panel con recarga limpia
                setTimeout(() => {
                    window.location.href = '/admin?welcome=true';
                }, 1500);
                return;
            } else {
                setErrorMsg(createRes.error || 'No se pudo crear la cuenta automáticamente.');
            }
        } catch (err: any) {
            console.error('Error al registrar cuenta:', err);
            setErrorMsg(err?.message || 'Error al procesar el registro.');
        } finally {
            setSubmitting(false);
        }
    };

    /* ── Section visibility hooks ──── */
    const s1 = useInView(); const s2 = useInView(); const s3 = useInView();
    const s4 = useInView(); const s5 = useInView(); const s6 = useInView();
    const s7 = useInView(); const sSec = useInView(); const sMulti = useInView();
    const sNails = useInView();

    // Checkout return from Stripe
    const [checkoutResult, setCheckoutResult] = useState<'success' | 'cancel' | null>(null);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const status = params.get('checkout');
        if (status === 'success' || status === 'cancel') {
            setCheckoutResult(status as 'success' | 'cancel');
            window.history.replaceState({}, '', '/');
        }
    }, []);

    const industries = [
        { icon: <Scissors className="w-7 h-7" />, label: 'Barberías', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
        { icon: <Sparkles className="w-7 h-7" />, label: 'Salones', color: 'text-pink-400', bg: 'bg-pink-400/10 border-pink-400/20' },
        { icon: <Flower2 className="w-7 h-7" />, label: 'Spas', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
        { icon: <Stethoscope className="w-7 h-7" />, label: 'Clínicas', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
    ];

    const testimonials = [
        { 
            name: 'Andrea G.', 
            biz: 'Nails Factory Studio — Monterrey, NL', 
            text: 'Antes tardaba 15 min cotizando por WhatsApp. Con el cotizador de uñas en 30 segundos envío el ticket con desglose exacto y foto de referencia. ¡Mis clientas aman la formalidad!', 
            stars: 5,
            badge: '💅 Nail Studio'
        },
        { 
            name: 'Carlos V.', 
            biz: 'The Kings Barbershop — CDMX', 
            text: 'Llego a la barbería y ya tengo 6 citas agendadas desde la madrugada. Los recordatorios por WhatsApp prácticamente eliminaron las inasistencias de mi equipo.', 
            stars: 5,
            badge: '✂️ Barbería'
        },
        { 
            name: 'Daniela M.', 
            biz: 'Estética D\'Glamour — Guadalajara, JAL', 
            text: 'Manejo 4 estilistas con horarios y comisiones distintas. El calendario por columnas y el cálculo automático de nómina en PDF me ahorran horas de administración cada semana.', 
            stars: 5,
            badge: '✨ Salón de Belleza'
        },
        { 
            name: 'Roberto S.', 
            biz: 'Barber House — Puebla, PUE', 
            text: 'La función de lista negra y verificación por WhatsApp nos salvó de citas falsas. Ahora solo agendan clientes reales que sí asisten a sus citas.', 
            stars: 5,
            badge: '🛡️ Seguridad'
        },
        { 
            name: 'Mariana P.', 
            biz: 'Luxe Nails & Spa — Querétaro, QRO', 
            text: 'Tenemos 2 sucursales. Con el portal multi-sucursal cada una tiene su equipo y horarios independientes, pero yo veo todas las métricas en un solo lugar.', 
            stars: 5,
            badge: '🏢 Multi-Sucursal'
        },
    ];

    const steps = [
        { num: '01', icon: <Zap className="w-5 h-5" />, title: 'Crea tu cuenta', desc: 'Regístrate en 2 minutos. Carga tu logo y configuramos tus servicios, equipo y horarios.' },
        { num: '02', icon: <Smartphone className="w-5 h-5" />, title: 'Comparte tu link', desc: 'Envía tu URL personalizada a tus clientes por WhatsApp, Instagram o en tu biografía.' },
        { num: '03', icon: <CalendarDays className="w-5 h-5" />, title: 'Las citas llegan solas', desc: 'Tu agenda se llena automáticamente mientras tú te enfocas en atender a tus clientes.' },
    ];

    return (
        <div className="min-h-screen bg-[#020817] text-slate-50 font-sans overflow-x-hidden selection:bg-violet-500/30">

            {/* ═══ Checkout Result Modal ═══ */}
            {checkoutResult && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCheckoutResult(null)} />
                    <div className="relative bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-md p-8 shadow-2xl text-center animate-fade-in">
                        {checkoutResult === 'success' ? (
                            <>
                                <div className="text-6xl mb-4">🎉</div>
                                <h2 className="text-2xl font-black text-white mb-2">¡Pago Exitoso!</h2>
                                <p className="text-slate-400 mb-6">Tu plan se ha actualizado. Vuelve a tu dashboard para ver los cambios.</p>
                                <button
                                    onClick={() => setCheckoutResult(null)}
                                    className="w-full py-3 rounded-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:brightness-110 transition-all shadow-lg shadow-violet-900/30"
                                >
                                    ✨ Entendido
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="text-6xl mb-4">😅</div>
                                <h2 className="text-2xl font-black text-white mb-2">Pago Cancelado</h2>
                                <p className="text-slate-400 mb-6">No te preocupes, puedes intentarlo cuando quieras desde tu dashboard.</p>
                                <button
                                    onClick={() => setCheckoutResult(null)}
                                    className="w-full py-3 rounded-2xl font-bold bg-white/10 text-white border border-white/10 hover:bg-white/15 transition-all"
                                >
                                    Cerrar
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════ NAVBAR ═══════════ */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 backdrop-blur-xl border-b ${scrolled || mobileMenuOpen ? 'bg-[#020817]/95 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]' : 'bg-[#020817]/40 border-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.2)]'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-14 sm:h-16 lg:h-20">
                        {/* Logo */}
                        <div className="flex items-center gap-2 group cursor-pointer">
                            <div className="relative">
                                <div className="absolute inset-0 bg-violet-500 blur-md opacity-30 group-hover:opacity-70 transition-opacity rounded-full" />
                                <InfinityIcon className="w-6 h-6 sm:w-7 sm:h-7 text-violet-400 relative z-10" strokeWidth={2.5} />
                            </div>
                            <span className="text-lg sm:text-xl font-black tracking-tight">Cita<span className="text-violet-400">Link</span></span>
                        </div>

                        {/* Desktop Links */}
                        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
                            <Link to="/explorar" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors flex items-center gap-1.5">
                                <Search className="w-4 h-4" /> Buscar Negocios
                            </Link>
                            <a href="#features" className="hover:text-white transition-colors">Funciones</a>
                            <a href="#seguridad" className="hover:text-white transition-colors">Seguridad</a>
                            <a href="#precios" className="hover:text-white transition-colors">Precios</a>
                            <a href="#testimonials" className="hover:text-white transition-colors">Testimonios</a>
                        </div>

                        {/* Desktop CTA / User Button */}
                        <div className="hidden md:flex items-center gap-2 sm:gap-3">
                            {user ? (
                                <Link to={dashboardPath} className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 shadow-lg shadow-violet-500/20">
                                    Mi Panel <ArrowRight className="w-4 h-4" />
                                </Link>
                            ) : (
                                <>
                                    <Link to="/login" className="text-xs sm:text-sm font-medium text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-full hover:bg-white/5">Iniciar Sesión</Link>
                                    <Link to="/register" className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs sm:text-sm transition-all shadow-lg shadow-violet-500/20">
                                        Prueba Gratis
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* Mobile Hamburger Toggle */}
                        <div className="flex md:hidden items-center gap-2">
                            <Link
                                to="/register"
                                className="px-3 py-1.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-600/20"
                            >
                                Probar Gratis
                            </Link>
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                aria-label="Abrir menú"
                                className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Dropdown Panel */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-white/10 bg-[#030816]/98 backdrop-blur-2xl px-5 py-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-1">
                            <Link
                                to="/explorar"
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm"
                            >
                                <Search className="w-4 h-4" /> Buscar Negocios
                            </Link>
                            <a
                                href="#features"
                                onClick={() => setMobileMenuOpen(false)}
                                className="block px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
                            >
                                Funciones
                            </a>
                            <a
                                href="#seguridad"
                                onClick={() => setMobileMenuOpen(false)}
                                className="block px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
                            >
                                Seguridad
                            </a>
                            <a
                                href="#precios"
                                onClick={() => setMobileMenuOpen(false)}
                                className="block px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
                            >
                                Precios
                            </a>
                            <a
                                href="#testimonials"
                                onClick={() => setMobileMenuOpen(false)}
                                className="block px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
                            >
                                Testimonios
                            </a>
                        </div>

                        <div className="pt-3 border-t border-white/10 space-y-2">
                            {user ? (
                                <Link
                                    to={dashboardPath}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30"
                                >
                                    Mi Panel <ArrowRight className="w-4 h-4" />
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to="/register"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-violet-600/30 flex items-center justify-center"
                                    >
                                        Crear Cuenta Gratis (30 días)
                                    </Link>
                                    <Link
                                        to="/login"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-medium text-sm flex items-center justify-center hover:bg-white/10 transition-colors"
                                    >
                                        Iniciar Sesión
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            {/* ═══════════ HERO ═══════════ */}
            <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-16 overflow-hidden">
                {/* Background glows */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-violet-700/25 blur-[130px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-indigo-700/15 blur-[100px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-blue-700/15 blur-[100px] rounded-full pointer-events-none" />
                {/* Grid lines */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

                <div className="relative z-10 text-center max-w-5xl mx-auto px-4">
                    {/* Badge Promocional */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-indigo-500/10 border border-violet-500/30 text-violet-300 text-xs sm:text-sm font-semibold mb-8 shadow-[0_0_25px_rgba(139,92,246,0.15)] animate-pulse">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        La plataforma #1 de agendamiento automático por WhatsApp
                        <span className="bg-violet-500/30 px-2 py-0.5 rounded-full text-[10px] font-black text-violet-200 uppercase tracking-wider">Nuevo v2.0</span>
                    </div>

                    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 leading-[0.95]">
                        Llena tu agenda<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400">
                            mientras duermes.
                        </span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-300 mb-10 leading-relaxed font-normal">
                        Reservas automáticas 24/7, recordatorios que evitan inasistencias por WhatsApp, cotizador de uñas y control total de tu equipo — para <strong className="text-white font-bold underline decoration-violet-500 decoration-2 underline-offset-4">salones, nail bars, barberías, spas y clínicas.</strong>
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
                        {user ? (
                            <Link to={dashboardPath} className="group w-full sm:w-auto px-8 py-4.5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 text-white font-bold text-lg hover:brightness-110 transition-all shadow-[0_0_50px_-5px_rgba(124,58,237,0.6)] flex items-center justify-center gap-3">
                                Ir a mi Panel <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        ) : (
                            <>
                                <Link to="/register" className="group w-full sm:w-auto px-8 py-4.5 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 text-white font-bold text-lg hover:brightness-110 transition-all shadow-[0_0_50px_-5px_rgba(124,58,237,0.6)] flex items-center justify-center gap-3">
                                    Crear mi Cuenta Gratis (30 Días)
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </Link>
                                <Link to="/login" className="w-full sm:w-auto px-8 py-4.5 rounded-2xl bg-white/5 border border-white/10 text-white font-semibold text-lg hover:bg-white/10 transition-all backdrop-blur-md">
                                    Iniciar Sesión
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Social proof */}
                    <div className="flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-slate-400 mb-14">
                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-2">
                                {['bg-violet-500', 'bg-pink-500', 'bg-indigo-500', 'bg-emerald-500'].map((c, i) => (
                                    <div key={i} className={`w-7 h-7 rounded-full ${c} border-2 border-[#020817] flex items-center justify-center text-[10px] font-bold text-white shadow-md`}>{['A','C','D','M'][i]}</div>
                                ))}
                            </div>
                            <span className="font-semibold text-white">+500 negocios activos</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                            {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                            <span className="ml-1 font-bold text-white">4.9/5 en satisfacción</span>
                        </div>
                        <div className="flex items-center gap-2 font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="w-4 h-4" /> Sin comisiones por reserva
                        </div>
                    </div>

                    {/* Real Dashboard Image in Hero */}
                    <div className="relative mx-auto max-w-5xl mt-6 group">
                        <div className="absolute -inset-4 bg-gradient-to-r from-violet-600/30 via-fuchsia-600/20 to-indigo-600/30 blur-3xl rounded-3xl opacity-75 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                        
                        {/* Desktop Mockup (Pantallas medianas y grandes) */}
                        <div className="hidden sm:block relative bg-[#0d1526] border border-white/15 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_20px_80px_-15px_rgba(124,58,237,0.4)]">
                            {/* Browser Chrome Header */}
                            <div className="flex items-center gap-2 px-4 py-3 bg-[#080e1c] border-b border-white/10">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                    <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                                </div>
                                <div className="flex-1 mx-4 bg-white/5 border border-white/5 rounded-lg px-3 py-1 text-xs text-slate-400 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                        <span className="font-mono text-[11px] text-slate-300">https://www.citalink.app/admin</span>
                                    </div>
                                    <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">Panel Oficial</span>
                                </div>
                            </div>

                            {/* Screenshot Desktop Image */}
                            <div className="relative overflow-hidden bg-[#060b18]">
                                <img
                                    src="/assets/dashboard-hero-desktop.png"
                                    alt="Panel de Control CitaLink Desktop"
                                    decoding="async"
                                    className="w-full h-auto object-cover transform transition-transform duration-700 hover:scale-[1.01]"
                                />
                            </div>
                        </div>

                        {/* Mobile Mockup (Pantallas pequeñas / Móviles) */}
                        <div className="sm:hidden relative max-w-[300px] mx-auto bg-[#0d1526] border-2 border-violet-500/30 rounded-[2.5rem] p-2 shadow-[0_15px_60px_-10px_rgba(124,58,237,0.5)] overflow-hidden">
                            <div className="relative rounded-[2rem] overflow-hidden bg-[#060b18] border border-white/10">
                                <img
                                    src="/assets/dashboard-hero-mobile.jpg"
                                    alt="Panel de Control CitaLink Móvil"
                                    decoding="async"
                                    className="w-full h-auto object-cover"
                                />
                            </div>
                        </div>
                    </div>

                </div>

                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
                    <ChevronDown className="w-6 h-6 text-slate-600" />
                </div>
            </section>

            {/* ═══════════ STATS BAR ═══════════ */}
            <section className="border-y border-white/5 bg-[#050d1a]/80 py-8">
                <div ref={s1.ref} className={`max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center transition-all duration-700 ${s1.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    {[
                        { val: 500, suffix: '+', label: 'Negocios Activos' },
                        { val: 98, suffix: '%', label: 'Satisfacción' },
                        { val: 45000, suffix: '+', label: 'Citas Gestionadas' },
                        { val: 60, suffix: '%', label: 'Menos Inasistencias' },
                    ].map((s, i) => (
                        <div key={i}>
                            <p className="text-3xl md:text-4xl font-black text-white mb-1">
                                <Counter end={s.val} suffix={s.suffix} />
                            </p>
                            <p className="text-sm text-slate-500">{s.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══════════ INDUSTRIES ═══════════ */}
            <section className="py-16 border-b border-white/5">
                <div className="max-w-6xl mx-auto px-4">
                    <p className="text-center text-slate-500 text-sm font-semibold uppercase tracking-widest mb-8">Diseñada a la medida para tu sector</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {industries.map((ind, i) => (
                            <div key={i} className={`group flex flex-col items-center gap-3 p-6 rounded-2xl border ${ind.bg} cursor-pointer hover:scale-105 transition-transform duration-300`}>
                                <div className={`${ind.color}`}>{ind.icon}</div>
                                <span className="text-white font-bold">{ind.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════ MARKETPLACE CTA BANNER ═══════════ */}
            <section className="py-16 border-b border-white/5 bg-gradient-to-r from-emerald-500/10 via-violet-500/10 to-indigo-500/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
                <div className="max-w-6xl mx-auto px-4 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                    <div className="flex flex-col md:flex-row items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-950/40">
                            <Store className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black uppercase tracking-widest mb-2">
                                🛒 Directorio CitaLink
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                                ¿Buscas cortarte el pelo, hacerte las uñas o consentirte en un spa?
                            </h3>
                            <p className="text-sm text-slate-400 mt-1 max-w-xl">
                                Explora barberías, salones de uñas, spas y clínicas cerca de ti. Compara servicios, reseñas verificadas y agenda tu cita en segundos.
                            </p>
                        </div>
                    </div>

                    <Link
                        to="/explorar"
                        className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-base transition-all shadow-xl shadow-emerald-950/50 hover:scale-105 shrink-0 flex items-center gap-3 group border border-emerald-400/30"
                    >
                        <Search className="w-5 h-5" />
                        <span>Explorar Negocios</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </section>

            {/* ═══════════ HOW IT WORKS ═══════════ */}
            <section id="how" className="py-24 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-[#020817] via-[#080d1a] to-[#020817] pointer-events-none" />
                <div ref={s2.ref} className={`relative max-w-6xl mx-auto px-4 transition-all duration-700 ${s2.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="text-center mb-16">
                        <span className="text-violet-400 text-sm font-bold uppercase tracking-widest">Empieza en minutos</span>
                        <h2 className="text-4xl md:text-5xl font-black mt-3 mb-4">Tan fácil como 1, 2, 3</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Sin complicaciones técnicas. Sin contratos. Sin costos ocultos.</p>
                    </div>

                    <div className="relative">
                        {/* Connector line */}
                        <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-violet-500/50 via-violet-500/80 to-violet-500/50" />
                        <div className="grid md:grid-cols-3 gap-12">
                            {steps.map((step, i) => (
                                <div key={i} className="flex flex-col items-center text-center">
                                    <div className="relative mb-6">
                                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/30 flex items-center justify-center">
                                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-[0_0_30px_rgba(124,58,237,0.4)]">
                                                {step.icon}
                                            </div>
                                        </div>
                                        <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#020817] border border-violet-500/30 text-violet-400 text-xs font-black flex items-center justify-center">{step.num}</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                                    <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════ FEATURES BENTO GRID (ORGANIZADO POR BLOQUES 2 EN 2 EN MÓVIL) ═══════════ */}
            <section id="features" className="py-16 sm:py-24 bg-[#050d1a]/80 border-t border-white/5 relative">
                <div ref={s3.ref} className={`max-w-6xl mx-auto px-4 sm:px-6 transition-all duration-700 ${s3.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="text-center mb-12 sm:mb-16">
                        <span className="text-violet-400 text-xs sm:text-sm font-bold uppercase tracking-widest">Ecosistema Completo</span>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mt-2 sm:mt-3 mb-3 sm:mb-4">Herramientas que multiplican tus ingresos</h2>
                        <p className="text-slate-400 text-sm sm:text-lg max-w-2xl mx-auto">Olvídate de WhatsApp desordenado y libretas de papel. CitaLink centraliza y automatiza toda tu operación.</p>
                    </div>

                    <div className="space-y-10 sm:space-y-12">
                        {/* Bloque 1: Agendamiento & Automatización */}
                        <div>
                            <div className="flex items-center gap-2 mb-4 sm:mb-6">
                                <div className="p-1.5 sm:p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
                                    <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <h3 className="text-base sm:text-xl font-bold text-white">1. Agendamiento & Automatización Inteligente</h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                                {/* Agenda 24/7 (Grande span-2 en mobile y desktop) */}
                                <div className="col-span-2 group relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-8 hover:border-violet-500/40 transition-all duration-500">
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
                                        <div className="max-w-md">
                                            <div className="inline-flex p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white mb-3 sm:mb-4 shadow-lg">
                                                <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6" />
                                            </div>
                                            <h4 className="text-lg sm:text-2xl font-bold text-white mb-1.5 sm:mb-2">Agenda Inteligente 24/7</h4>
                                            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4">
                                                Tus clientes eligen servicio, empleado y horario disponible en tiempo real en menos de 30 segundos, sin necesidad de llamarte ni esperar respuesta.
                                            </p>
                                            <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-semibold">
                                                <span className="bg-violet-500/10 text-violet-300 border border-violet-500/20 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full">✓ Smart Slots</span>
                                                <span className="bg-violet-500/10 text-violet-300 border border-violet-500/20 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full">✓ Google Calendar</span>
                                                <span className="bg-violet-500/10 text-violet-300 border border-violet-500/20 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full">✓ Autoservicio</span>
                                            </div>
                                        </div>
                                        <div className="w-full md:w-56 bg-[#030814] border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-1.5 sm:space-y-2 text-xs shadow-xl shrink-0">
                                            <div className="flex justify-between items-center text-slate-400 text-[10px] sm:text-[11px] pb-1 border-b border-white/5">
                                                <span>Cita confirmada</span>
                                                <span className="text-emerald-400 font-bold">● En vivo</span>
                                            </div>
                                            <p className="text-white font-bold text-xs sm:text-sm">Corte + Barba VIP</p>
                                            <p className="text-slate-400 text-[10px] sm:text-[11px]">Hoy · 16:30 hrs</p>
                                            <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] text-center font-bold">
                                                WhatsApp enviado
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Recordatorios WhatsApp (1 de 2 en móvil) */}
                                <div className="col-span-1 group relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-8 hover:border-emerald-500/40 transition-all duration-500 flex flex-col justify-between">
                                    <div>
                                        <div className="inline-flex p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white mb-2.5 sm:mb-4 shadow-lg">
                                            <MessageCircle className="w-4 h-4 sm:w-6 sm:h-6" />
                                        </div>
                                        <h4 className="text-xs sm:text-xl font-bold text-white mb-1 sm:mb-2 leading-tight">Recordatorios WhatsApp</h4>
                                        <p className="text-slate-400 text-[10px] sm:text-sm leading-relaxed mb-2.5 sm:mb-4">
                                            Reduce inasistencias hasta 60% con confirmaciones automáticas.
                                        </p>
                                    </div>
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg sm:rounded-2xl p-1.5 sm:p-3 text-[9px] sm:text-xs text-emerald-300 font-medium leading-tight">
                                        📲 Confirmación en 1 clic
                                    </div>
                                </div>

                                {/* Lista de Espera (2 de 2 en móvil) */}
                                <div className="col-span-1 group relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-8 hover:border-blue-500/40 transition-all duration-500 flex flex-col justify-between">
                                    <div>
                                        <div className="inline-flex p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white mb-2.5 sm:mb-4 shadow-lg">
                                            <CalendarPlus className="w-4 h-4 sm:w-6 sm:h-6" />
                                        </div>
                                        <h4 className="text-xs sm:text-xl font-bold text-white mb-1 sm:mb-2 leading-tight">Lista de Espera Activa</h4>
                                        <p className="text-slate-400 text-[10px] sm:text-sm leading-relaxed mb-2.5 sm:mb-4">
                                            Cubre cancelaciones o huecos libres de forma automática.
                                        </p>
                                    </div>
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg sm:rounded-2xl p-1.5 sm:p-3 text-[9px] sm:text-xs text-blue-300 font-medium leading-tight">
                                        ⚡ Cero huecos vacíos
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bloque 2: Gestión Financiera & Control Operativo (2 EN 2 EN MÓVIL) */}
                        <div>
                            <div className="flex items-center gap-2 mb-4 sm:mb-6">
                                <div className="p-1.5 sm:p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                    <BarChart2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <h3 className="text-base sm:text-xl font-bold text-white">2. Gestión Financiera & Control Operativo</h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                                {/* Nómina y Comisiones */}
                                <div className="col-span-1 group relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-8 hover:border-amber-500/40 transition-all duration-500 flex flex-col justify-between">
                                    <div>
                                        <div className="inline-flex p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white mb-2.5 sm:mb-4 shadow-lg">
                                            <Percent className="w-4 h-4 sm:w-6 sm:h-6" />
                                        </div>
                                        <h4 className="text-xs sm:text-xl font-bold text-white mb-1 sm:mb-2 leading-tight">Nómina y Comisiones</h4>
                                        <p className="text-slate-400 text-[10px] sm:text-sm leading-relaxed mb-2.5 sm:mb-4">
                                            Cálculo automático de ganancias por estilista listo en PDF.
                                        </p>
                                    </div>
                                    <span className="text-[9px] sm:text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full inline-block font-semibold">
                                        📄 Reporte en PDF
                                    </span>
                                </div>

                                {/* Control de Equipo */}
                                <div className="col-span-1 group relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-8 hover:border-purple-500/40 transition-all duration-500 flex flex-col justify-between">
                                    <div>
                                        <div className="inline-flex p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500 to-violet-500 text-white mb-2.5 sm:mb-4 shadow-lg">
                                            <Users className="w-4 h-4 sm:w-6 sm:h-6" />
                                        </div>
                                        <h4 className="text-xs sm:text-xl font-bold text-white mb-1 sm:mb-2 leading-tight">Control de Equipo</h4>
                                        <p className="text-slate-400 text-[10px] sm:text-sm leading-relaxed mb-2.5 sm:mb-4">
                                            Horarios, turnos y cuentas privadas para cada colaborador.
                                        </p>
                                    </div>
                                    <span className="text-[9px] sm:text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full inline-block font-semibold">
                                        👥 Roles y Permisos
                                    </span>
                                </div>

                                {/* Reportes en Tiempo Real (Span-2 en móvil para cerrar bloque de forma elegante) */}
                                <div className="col-span-2 md:col-span-1 group relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-8 hover:border-red-500/40 transition-all duration-500 flex flex-col justify-between">
                                    <div>
                                        <div className="inline-flex p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 text-white mb-2.5 sm:mb-4 shadow-lg">
                                            <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6" />
                                        </div>
                                        <h4 className="text-xs sm:text-xl font-bold text-white mb-1 sm:mb-2 leading-tight">Reportes en Tiempo Real</h4>
                                        <p className="text-slate-400 text-[10px] sm:text-sm leading-relaxed mb-2.5 sm:mb-4">
                                            Gráficas de ingresos, servicios top y retención de clientes en vivo.
                                        </p>
                                    </div>
                                    <span className="text-[9px] sm:text-xs bg-red-500/10 text-red-300 border border-red-500/20 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full inline-block font-semibold">
                                        📊 Métricas financieras
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Bloque 3: Marca, Cotizador & Fidelización (2 EN 2 EN MÓVIL) */}
                        <div>
                            <div className="flex items-center gap-2 mb-4 sm:mb-6">
                                <div className="p-1.5 sm:p-2 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400">
                                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <h3 className="text-base sm:text-xl font-bold text-white">3. Marca, PWA & Experiencia Digital</h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
                                {/* Branding & ColorThief */}
                                <div className="col-span-1 group relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-8 hover:border-indigo-500/40 transition-all duration-500 flex flex-col justify-between">
                                    <div>
                                        <div className="inline-flex p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white mb-2.5 sm:mb-4 shadow-lg">
                                            <Shield className="w-4 h-4 sm:w-6 sm:h-6" />
                                        </div>
                                        <h4 className="text-xs sm:text-xl font-bold text-white mb-1 sm:mb-2 leading-tight">Branding Propio</h4>
                                        <p className="text-slate-400 text-[10px] sm:text-sm leading-relaxed mb-2.5 sm:mb-4">
                                            Tu logo, colores automáticos (ColorThief) y URL personalizada.
                                        </p>
                                    </div>
                                    <span className="text-[9px] sm:text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full inline-block font-semibold">
                                        🎨 100% tu marca
                                    </span>
                                </div>

                                {/* App Instalable PWA */}
                                <div className="col-span-1 group relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-8 hover:border-teal-500/40 transition-all duration-500 flex flex-col justify-between">
                                    <div>
                                        <div className="inline-flex p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white mb-2.5 sm:mb-4 shadow-lg">
                                            <Smartphone className="w-4 h-4 sm:w-6 sm:h-6" />
                                        </div>
                                        <h4 className="text-xs sm:text-xl font-bold text-white mb-1 sm:mb-2 leading-tight">App Instalable (PWA)</h4>
                                        <p className="text-slate-400 text-[10px] sm:text-sm leading-relaxed mb-2.5 sm:mb-4">
                                            Instalación directa en iPhone/Android sin pasar por App Store.
                                        </p>
                                    </div>
                                    <span className="text-[9px] sm:text-xs bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full inline-block font-semibold">
                                        📲 Carga ultrarrápida
                                    </span>
                                </div>

                                {/* Seguridad y Control */}
                                <div className="col-span-2 md:col-span-1 group relative overflow-hidden bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-8 hover:border-violet-500/40 transition-all duration-500 flex flex-col justify-between">
                                    <div>
                                        <div className="inline-flex p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white mb-2.5 sm:mb-4 shadow-lg">
                                            <ShieldCheck className="w-4 h-4 sm:w-6 sm:h-6" />
                                        </div>
                                        <h4 className="text-xs sm:text-xl font-bold text-white mb-1 sm:mb-2 leading-tight">Anti-Fraude & Bloqueo</h4>
                                        <p className="text-slate-400 text-[10px] sm:text-sm leading-relaxed mb-2.5 sm:mb-4">
                                            Validación de clientes por WhatsApp y bloqueo de ausencias.
                                        </p>
                                    </div>
                                    <span className="text-[9px] sm:text-xs bg-pink-500/10 text-pink-300 border border-pink-500/20 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full inline-block font-semibold">
                                        🛡️ Citas seguras
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════ NUEVA SECCIÓN: 🔒 SEGURIDAD Y CONFIANZA (2 EN 2 EN MÓVIL) ═══════════ */}
            <section id="seguridad" className="py-16 sm:py-24 border-t border-white/5 relative bg-[#040914]">
                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-violet-600/10 blur-[130px] rounded-full pointer-events-none" />
                <div ref={sSec.ref} className={`max-w-6xl mx-auto px-4 sm:px-6 relative z-10 transition-all duration-700 ${sSec.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="text-center mb-12 sm:mb-16">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1 sm:px-4 sm:py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-2 sm:mb-3">
                            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-400" /> Protección para tu Negocio
                        </div>
                        <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
                            Citas 100% reales, sin fraudes ni ausencias
                        </h2>
                        <p className="text-slate-400 text-xs sm:text-lg max-w-2xl mx-auto mt-2 sm:mt-4">
                            Herramientas avanzadas diseñadas para proteger el tiempo de tu equipo y la reputación de tu marca.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                        {/* OTP WhatsApp */}
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 hover:border-violet-500/40 transition-all duration-300">
                            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-2.5 sm:mb-4">
                                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <h3 className="text-xs sm:text-lg font-bold text-white mb-1 sm:mb-2 leading-tight">Verificación OTP</h3>
                            <p className="text-slate-400 text-[10px] sm:text-sm leading-relaxed">
                                Código de seguridad enviado por WhatsApp para validar clientes reales.
                            </p>
                        </div>

                        {/* Reseñas Anti-Fraude */}
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 hover:border-amber-500/40 transition-all duration-300">
                            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2.5 sm:mb-4">
                                <Star className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <h3 className="text-xs sm:text-lg font-bold text-white mb-1 sm:mb-2 leading-tight">Reseñas Verificadas</h3>
                            <p className="text-slate-400 text-[10px] sm:text-sm leading-relaxed">
                                Solo clientes con citas completadas pueden calificar y opinar.
                            </p>
                        </div>

                        {/* Lista Negra */}
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 hover:border-red-500/40 transition-all duration-300">
                            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 mb-2.5 sm:mb-4">
                                <Ban className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <h3 className="text-xs sm:text-lg font-bold text-white mb-1 sm:mb-2 leading-tight">Bloqueo de Clientes</h3>
                            <p className="text-slate-400 text-[10px] sm:text-sm leading-relaxed">
                                Bloquea números de clientes que no asisten para no perder espacios.
                            </p>
                        </div>

                        {/* Depósitos IA */}
                        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 hover:border-emerald-500/40 transition-all duration-300">
                            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2.5 sm:mb-4">
                                <ScanLine className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <h3 className="text-xs sm:text-lg font-bold text-white mb-1 sm:mb-2 leading-tight">Anticipos & Depósitos</h3>
                            <p className="text-slate-400 text-[10px] sm:text-sm leading-relaxed">
                                Pide anticipos con validación de comprobantes y asegura tu agenda.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════ NUEVA SECCIÓN: 💅 COTIZADOR DE UÑAS DESTACADO ═══════════ */}
            <section id="cotizador-nails" className="py-20 sm:py-24 border-t border-white/5 relative bg-gradient-to-b from-[#020817] via-[#140618] to-[#020817] overflow-hidden">
                <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[500px] h-[500px] bg-pink-600/15 blur-[140px] rounded-full pointer-events-none" />
                <div ref={sNails.ref} className={`max-w-6xl mx-auto px-4 sm:px-6 relative z-10 transition-all duration-700 ${sNails.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                        
                        {/* Lado izquierdo: Textos y Capacidades */}
                        <div className="lg:col-span-7 space-y-6 text-center sm:text-left">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs font-bold uppercase tracking-widest">
                                <Sparkles className="w-4 h-4 text-pink-400" /> Especial para Salones de Uñas & Nail Studios
                            </div>

                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                                Cotiza diseños de uñas complejos en <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400">30 segundos.</span>
                            </h2>

                            <p className="text-slate-300 text-sm sm:text-base md:text-lg leading-relaxed">
                                Se acabaron las horas cotizando precios a mano por WhatsApp. Con el cotizador interactivo de CitaLink, calculas la base, el largo y cada detalle del arte con precisión milimétrica.
                            </p>

                            {/* Compact mobile-friendly chips grid */}
                            <div className="grid grid-cols-2 gap-2 sm:gap-2.5 pt-1 text-left">
                                {[
                                    { t: 'Bases', d: 'Gel, Acrílico, Polygel, Rubber' },
                                    { t: 'Largos', d: 'Personalizados (#1 al #7+)' },
                                    { t: 'Técnicas', d: 'Francés, Espejo, Cat Eye, 3D' },
                                    { t: 'Cristales', d: 'Por cantidad exacta de uñas' },
                                    { t: 'Fotos', d: 'Pega de WhatsApp con Ctrl+V' },
                                    { t: 'Temas', d: 'Rosa, Dark y Dorado' },
                                    { t: 'Ticket Digital', d: 'Exportable en imagen' },
                                    { t: 'WhatsApp', d: 'Envío directo al cliente' }
                                ].map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-200 bg-white/[0.04] border border-white/5 p-2.5 rounded-xl hover:border-pink-500/30 transition-colors">
                                        <Check className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-bold text-white leading-tight">{item.t}</p>
                                            <p className="text-[10px] sm:text-[11px] text-slate-400 leading-tight mt-0.5">{item.d}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-2">
                                <Link
                                    to="/register"
                                    className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-sm sm:text-base transition-all shadow-xl shadow-pink-950/50 hover:scale-105 flex items-center justify-center gap-3"
                                >
                                    <span>Pruébalo Gratis para tu Salón de Uñas</span>
                                    <ArrowRight className="w-5 h-5" />
                                </Link>
                            </div>
                        </div>

                        {/* Lado derecho: Imagen Real del Ticket de Cotización */}
                        <div className="lg:col-span-5 flex justify-center w-full">
                            <div className="relative group w-full max-w-[320px] sm:max-w-[360px]">
                                <div className="absolute -inset-3 bg-gradient-to-r from-pink-600/30 via-rose-600/30 to-fuchsia-600/30 blur-2xl rounded-[3rem] opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border-2 border-pink-400/30 bg-gradient-to-b from-pink-100 to-pink-200">
                                    <img
                                        src="/assets/quoter-ticket.png"
                                        alt="Mar Del Rey Nail's - Cotización de Uñas"
                                        decoding="async"
                                        loading="lazy"
                                        className="w-full h-auto object-contain rounded-[2.3rem] transform transition-transform duration-500 hover:scale-[1.02]"
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* ═══════════ NUEVA SECCIÓN: 🏢 MULTI-SUCURSAL ═══════════ */}
            <section className="py-20 border-t border-white/5 relative bg-[#030712] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-950/30 via-[#070e24] to-indigo-950/30 pointer-events-none" />
                <div ref={sMulti.ref} className={`max-w-6xl mx-auto px-4 relative z-10 transition-all duration-700 ${sMulti.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="bg-gradient-to-r from-white/[0.04] via-white/[0.02] to-white/[0.04] border border-white/10 rounded-3xl p-8 sm:p-12 backdrop-blur-xl">
                        <div className="grid lg:grid-cols-12 gap-8 items-center">
                            <div className="lg:col-span-7 space-y-4">
                                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-bold uppercase tracking-widest">
                                    <Building2 className="w-4 h-4 text-violet-400" /> Para Cadenas y Franquicias
                                </div>
                                <h3 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                                    ¿Manejas más de una sucursal?
                                </h3>
                                <p className="text-slate-300 text-base leading-relaxed">
                                    Centraliza el control de todas tus ubicaciones en una sola cuenta. Cada sucursal cuenta con su propio personal, horarios y catálogo independiente, permitiendo a tus clientes elegir su sucursal favorita desde un portal unificado (<code className="text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded font-mono text-xs">/sucursales/tu-marca</code>).
                                </p>
                                <div className="flex flex-wrap gap-4 pt-2">
                                    <a
                                        href="#precios"
                                        className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2"
                                    >
                                        Ver Plan Business Multi-Sucursal <ArrowRight className="w-4 h-4" />
                                    </a>
                                </div>
                            </div>

                            {/* Mockup visual de sucursales */}
                            <div className="lg:col-span-5 grid gap-3">
                                {[
                                    { name: 'Sucursal San Pedro (Matriz)', address: 'Av. Vasconcelos #450, NL', staff: '6 estilistas', active: true },
                                    { name: 'Sucursal Valle Oriente', address: 'Plaza Fiesta San Agustín, NL', staff: '4 estilistas', active: false },
                                    { name: 'Sucursal Cumbres Elite', address: 'Av. Paseo de los Leones, NL', staff: '5 estilistas', active: false },
                                ].map((branch, i) => (
                                    <div key={i} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${branch.active ? 'bg-violet-600/15 border-violet-500/40 text-white shadow-lg' : 'bg-white/[0.02] border-white/5 text-slate-400'}`}>
                                        <div>
                                            <p className="font-bold text-sm text-white">{branch.name}</p>
                                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                <MapPin className="w-3 h-3 text-slate-500" /> {branch.address}
                                            </p>
                                        </div>
                                        <span className="text-xs font-mono font-semibold bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 text-slate-300">
                                            {branch.staff}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════ DEMO INTERACTIVA Y CALCULADORA DE ROI ═══════════ */}
            <section className="py-24 border-t border-white/5 relative overflow-hidden bg-gradient-to-b from-[#020817] via-[#080f24] to-[#020817]">
                <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/15 blur-[140px] rounded-full pointer-events-none" />
                <div ref={s4.ref} className={`max-w-6xl mx-auto px-4 transition-all duration-700 ${s4.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    
                    {/* ── CALCULADORA INTERACTIVA DE RETORNO DE INVERSIÓN (ROI) ── */}
                    <div className="bg-gradient-to-r from-violet-950/40 via-[#0a1226] to-indigo-950/40 border border-violet-500/20 rounded-3xl p-8 sm:p-12 shadow-2xl backdrop-blur-xl">
                        <div className="grid md:grid-cols-12 gap-8 items-center">
                            <div className="md:col-span-6 space-y-4">
                                <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest">
                                    💰 Calculadora de Impacto
                                </span>
                                <h3 className="text-2xl md:text-3xl font-black text-white">
                                    ¿Cuánto tiempo y dinero ahorrarás?
                                </h3>
                                <p className="text-slate-400 text-sm">
                                    Desliza para seleccionar cuántos profesionales trabajan en tu negocio y calcula tus resultados estimados:
                                </p>
                                <div className="pt-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-bold text-white">Número de Profesionales:</span>
                                        <span className="text-xl font-black text-violet-400 bg-violet-500/10 px-3 py-1 rounded-xl border border-violet-500/20">{roiProCount} {roiProCount === 1 ? 'profesional' : 'profesionales'}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={roiProCount}
                                        onChange={(e) => setRoiProCount(parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-6 grid grid-cols-2 gap-4">
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-center">
                                    <Clock className="w-6 h-6 text-violet-400 mx-auto mb-2" />
                                    <p className="text-3xl font-black text-white">{roiProCount * 12} hrs</p>
                                    <p className="text-xs text-slate-400 font-medium mt-1">Ahorradas al mes respondiendo WhatsApp</p>
                                </div>
                                <div className="bg-white/[0.03] border border-emerald-500/20 rounded-2xl p-5 text-center">
                                    <TrendingUp className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                                    <p className="text-3xl font-black text-emerald-400">+${(roiProCount * 3200).toLocaleString()} MXN</p>
                                    <p className="text-xs text-slate-400 font-medium mt-1">Estimado en ventas extra por reservas 24/7</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </section>

            {/* ═══════════ TESTIMONIALS (ACTUALIZADOS Y CREÍBLES) ═══════════ */}
            <section id="testimonials" className="py-24 bg-[#050d1a]/60 border-t border-white/5">
                <div ref={s5.ref} className={`max-w-6xl mx-auto px-4 transition-all duration-700 ${s5.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="text-center mb-16">
                        <span className="text-violet-400 text-sm font-bold uppercase tracking-widest">Casos de Éxito</span>
                        <h2 className="text-4xl md:text-5xl font-black mt-3 mb-4">Negocios que transformaron su operación</h2>
                        <p className="text-slate-400 text-lg max-w-xl mx-auto">Experiencias reales de salones de uñas, barberías y estéticas en México.</p>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-6">
                        {testimonials.slice(0, 3).map((t, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 hover:border-violet-500/30 transition-all duration-300 group flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex gap-1">
                                            {[...Array(t.stars)].map((_, j) => <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                                        </div>
                                        <span className="text-[11px] font-bold bg-white/5 px-2.5 py-1 rounded-full text-slate-300 border border-white/5">
                                            {t.badge}
                                        </span>
                                    </div>
                                    <p className="text-slate-300 leading-relaxed mb-6 text-sm italic">"{t.text}"</p>
                                </div>
                                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md">
                                        {t.name[0]}
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-sm">{t.name}</p>
                                        <p className="text-slate-500 text-xs">{t.biz}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 mt-6">
                        {testimonials.slice(3, 5).map((t, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 hover:border-violet-500/30 transition-all duration-300 group flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex gap-1">
                                            {[...Array(t.stars)].map((_, j) => <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                                        </div>
                                        <span className="text-[11px] font-bold bg-white/5 px-2.5 py-1 rounded-full text-slate-300 border border-white/5">
                                            {t.badge}
                                        </span>
                                    </div>
                                    <p className="text-slate-300 leading-relaxed mb-6 text-sm italic">"{t.text}"</p>
                                </div>
                                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md">
                                        {t.name[0]}
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-sm">{t.name}</p>
                                        <p className="text-slate-500 text-xs">{t.biz}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════ PRICING (CON TODAS LAS HERRAMIENTAS INCLUIDAS) ═══════════ */}
            <section id="precios" className="py-24 border-t border-white/5 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-700/10 blur-[120px] rounded-full pointer-events-none" />
                <div ref={s7.ref} className={`relative max-w-6xl mx-auto px-4 transition-all duration-700 ${s7.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

                    {/* Header */}
                    <div className="text-center mb-16">
                        <span className="text-violet-400 text-sm font-bold uppercase tracking-widest">Precios Transparentes</span>
                        <h2 className="text-4xl md:text-5xl font-black mt-3 mb-4">Elige el plan ideal para tu negocio</h2>
                        <p className="text-slate-400 text-lg max-w-xl mx-auto">Todas las funciones incluidas en todos los planes. Sin contratos. Cancela cuando quieras.</p>
                    </div>

                    {/* Plan cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">

                        {/* ESENCIAL */}
                        <div className="relative bg-white/[0.02] border border-teal-500/20 rounded-3xl p-8 hover:border-teal-500/40 transition-all duration-300 flex flex-col justify-between">
                            <div>
                                <div className="mb-6">
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-400 mb-2">Esencial</p>
                                    <div className="flex items-end gap-1">
                                        <span className="text-5xl font-black text-white">$349</span>
                                        <span className="text-slate-400 mb-2">/mes</span>
                                        <span className="text-xs text-slate-500 line-through ml-1.5 mb-1.5">$499</span>
                                    </div>
                                    <p className="text-slate-400 text-sm mt-2">Para profesionales independientes y dueños que trabajan solos.</p>
                                </div>
                                <Link to="/register" className="w-full py-3 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-300 font-bold text-sm hover:bg-teal-500/20 transition-all mb-6 flex items-center justify-center">
                                    Empezar con Esencial
                                </Link>
                                <ul className="space-y-2.5 text-xs">
                                    {[
                                        '1 sucursal incluida',
                                        '1 profesional independiente',
                                        '✨ Citas ILIMITADAS',
                                        'Agenda online 24/7',
                                        'Recordatorios WhatsApp oficiales',
                                        'Cotizador de Uñas & Catálogo',
                                        'Anticipos y depósitos bancarios',
                                        'Lista de espera & Bloqueo de clientes',
                                        'Branding personalizado',
                                        'App instalable (PWA)',
                                        'Soporte por WhatsApp',
                                    ].map((f) => (
                                        <li key={f} className="flex items-center gap-2 text-slate-300">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />{f}
                                        </li>
                                    ))}
                                    {['Colaboradores adicionales', 'Nómina y Comisiones avanzadas'].map((f) => (
                                        <li key={f} className="flex items-center gap-2 text-slate-600 line-through">
                                            <X className="w-3.5 h-3.5 text-slate-700 shrink-0" />{f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* PRO — Highlighted */}
                        <div className="relative bg-gradient-to-b from-violet-950/70 to-[#070d1d] border-2 border-violet-500/40 rounded-3xl p-8 shadow-[0_0_60px_-15px_rgba(124,58,237,0.4)] flex flex-col justify-between">
                            {/* Popular badge */}
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-violet-500/40">
                                    ⭐ Más Popular
                                </span>
                            </div>
                            <div>
                                <div className="mb-6 mt-4">
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-400 mb-2">Pro</p>
                                    <div className="flex items-end gap-1">
                                        <span className="text-5xl font-black text-white">$649</span>
                                        <span className="text-slate-400 mb-2">/mes</span>
                                        <span className="text-xs text-slate-500 line-through ml-1.5 mb-1.5">$899</span>
                                    </div>
                                    <p className="text-slate-400 text-sm mt-2">Para salones, nail bars y barberías con equipo de trabajo.</p>
                                </div>
                                <Link to="/register" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-500/30 mb-6 flex items-center justify-center">
                                    Empezar con Pro →
                                </Link>
                                <ul className="space-y-2.5 text-xs">
                                    {[
                                        '1 sucursal incluida',
                                        '2 profesionales incluidos',
                                        'Profesional extra: +$249/mes',
                                        '✨ Citas ILIMITADAS',
                                        'Nómina y Comisiones en PDF',
                                        'Reportes analíticos avanzados',
                                        'Cotizador de Uñas & Diseños',
                                        'Anticipos & Verificación con IA',
                                        'Recordatorios WhatsApp oficiales',
                                        'Calendario por columnas de staff',
                                        'Branding personalizado & QR imprimibles',
                                        'Lista de espera & Bloqueo',
                                    ].map((f) => (
                                        <li key={f} className="flex items-center gap-2 text-slate-200">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />{f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* BUSINESS */}
                        <div className="relative bg-white/[0.02] border border-amber-500/20 rounded-3xl p-8 hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between">
                            <div>
                                <div className="mb-6">
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400 mb-2">Business</p>
                                    <div className="flex items-end gap-1">
                                        <span className="text-5xl font-black text-white">$1,249</span>
                                        <span className="text-slate-500 mb-2">/mes</span>
                                        <span className="text-xs text-slate-500 line-through ml-1.5 mb-1.5">$1,649</span>
                                    </div>
                                    <p className="text-slate-400 text-sm mt-2">Para cadenas con múltiples sucursales y franquicias.</p>
                                </div>
                                <Link to="/register" className="w-full py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-sm hover:bg-amber-500/20 transition-all mb-6 flex items-center justify-center">
                                    Empezar con Business
                                </Link>
                                <ul className="space-y-2.5 text-xs">
                                    {[
                                        '🏢 2 sucursales incluidas',
                                        'Sucursal extra: +$599/mes',
                                        '2 profesionales por sucursal',
                                        'Profesional extra: +$249/mes',
                                        '✨ Todo lo del Plan Pro incluido',
                                        'Panel Multi-Sucursal unificado',
                                        'Reportes financieros por sucursal',
                                        'Onboarding y soporte prioritario',
                                    ].map((f) => (
                                        <li key={f} className="flex items-center gap-2 text-slate-300">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />{f}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                    </div>

                    {/* Extra cost note */}
                    <p className="text-center text-xs text-slate-500 mt-8">Todos los precios en MXN. IVA no incluido. Los colaboradores adicionales se agregan directamente desde tu panel.</p>

                    {/* FAQ */}
                    <div className="mt-20 max-w-2xl mx-auto">
                        <h3 className="text-2xl font-black text-white text-center mb-8">Preguntas frecuentes</h3>
                        <div className="space-y-3">
                            {[
                                { q: '¿Puedo cambiar de plan cuando quiera?', a: 'Sí. Puedes subir o bajar de plan en cualquier momento desde tu panel. Los cambios aplican de inmediato en tu ciclo de facturación.' },
                                { q: '¿Cómo funciona la prueba gratis?', a: 'Te damos 30 días de prueba gratis con acceso completo a todas las funciones Pro para que puedas configurar tu negocio y recibir reservas reales sin costo ni tarjeta de crédito.' },
                                { q: '¿El cotizador de uñas tiene costo adicional?', a: 'No, el cotizador de uñas viene completamente integrado y disponible para activar en cualquier servicio.' },
                                { q: '¿Cómo funciona el cobro por colaborador adicional?', a: 'Los primeros 2 colaboradores van incluidos en el plan Pro y Business. Puedes agregar estilistas o barberos adicionales por solo $249/mes cada uno.' },
                            ].map((item, i) => (
                                <FAQItem key={i} q={item.q} a={item.a} />
                            ))}
                        </div>
                    </div>

                </div>
            </section>

            {/* ═══════════ CTA FINAL ═══════════ */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-900/30 via-[#020817] to-indigo-900/20" />
                <div ref={s6.ref} className={`relative max-w-4xl mx-auto px-4 text-center transition-all duration-700 ${s6.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-medium mb-8">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        30 días gratis — Sin tarjeta de crédito
                    </div>
                    <h2 className="text-5xl md:text-6xl font-black mb-6">
                        ¿Listo para llenar<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">tu agenda?</span>
                    </h2>
                    <p className="text-slate-400 text-xl mb-10 max-w-xl mx-auto">
                        Únete a los negocios que ya automatizaron sus reservas y aumentaron sus ingresos con CitaLink.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                        {user ? (
                            <Link to={dashboardPath} className="group px-10 py-5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xl hover:from-violet-500 hover:to-indigo-500 transition-all shadow-[0_0_60px_-10px_rgba(124,58,237,0.6)] flex items-center gap-3">
                                Ir a mi Panel <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        ) : (
                            <Link to="/register" className="group px-10 py-5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xl hover:from-violet-500 hover:to-indigo-500 transition-all shadow-[0_0_60px_-10px_rgba(124,58,237,0.6)] flex items-center gap-3">
                                Empezar Gratis Ahora <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        )}
                    </div>
                    <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
                        {['Sin tarjeta requerida', 'Configuración en 5 min', 'Soporte incluido', 'Sin comisiones'].map((item) => (
                            <span key={item} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" />{item}</span>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════ FOOTER ═══════════ */}
            <footer className="border-t border-white/5 bg-[#020817] py-12">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8">
                        <div className="flex items-center gap-2">
                            <InfinityIcon className="w-7 h-7 text-violet-400" strokeWidth={2.5} />
                            <span className="text-xl font-black">Cita<span className="text-violet-400">Link</span></span>
                        </div>
                        {/* Redes sociales */}
                        <div className="flex gap-3">
                            <a href="https://www.tiktok.com/@citalink.soporte" target="_blank" rel="noopener noreferrer"
                               className="group w-10 h-10 rounded-full bg-white/5 hover:bg-black border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all duration-300">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.78 1.52V6.76a4.83 4.83 0 01-1.01-.07z"/></svg>
                            </a>
                            <a href="https://www.instagram.com/citalink_" target="_blank" rel="noopener noreferrer"
                               className="group w-10 h-10 rounded-full bg-white/5 hover:bg-gradient-to-br hover:from-pink-500 hover:to-purple-600 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all duration-300">
                                <Instagram className="w-4 h-4" />
                            </a>
                            <a href="https://www.facebook.com/share/1CA8fs3Upo/" target="_blank" rel="noopener noreferrer"
                               className="group w-10 h-10 rounded-full bg-white/5 hover:bg-blue-600 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all duration-300">
                                <Facebook className="w-4 h-4" />
                            </a>
                            <a href="https://wa.me/528681239154?text=Hola%2C%20quiero%20saber%20más%20sobre%20CitaLink"
                               target="_blank" rel="noopener noreferrer"
                               className="group w-10 h-10 rounded-full bg-white/5 hover:bg-emerald-600 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all duration-300">
                                <MessageCircle className="w-4 h-4" />
                            </a>
                        </div>
                        {/* Correo */}
                        <a href="mailto:citalink.soporte@gmail.com" className="flex items-center gap-2 text-sm text-slate-400 hover:text-violet-400 transition-colors group">
                            <span className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">✉</span>
                            citalink.soporte@gmail.com
                        </a>
                    </div>
                    <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-600">
                        <p>© {new Date().getFullYear()} CitaLink. Todos los derechos reservados.</p>
                        <div className="flex gap-6">
                            <Link to="/terms" className="hover:text-slate-400 transition-colors">Términos</Link>
                            <Link to="/privacy" className="hover:text-slate-400 transition-colors">Privacidad</Link>
                            <a href="mailto:citalink.soporte@gmail.com" className="hover:text-slate-400 transition-colors">Contacto</a>
                        </div>
                    </div>
                </div>
            </footer>

            {/* ═══════════ LEAD MODAL (REDESIGN ULTRA-PREMIUM) ═══════════ */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                    {/* Backdrop con blur */}
                    <div className="fixed inset-0 bg-[#020612]/80 backdrop-blur-xl animate-fade-in transition-all" onClick={() => !submitting && setIsModalOpen(false)} />
                    
                    {/* Tarjeta Modal Glassmorphism */}
                    <div className="relative z-10 bg-gradient-to-b from-[#0c142b] via-[#080e20] to-[#040814] border border-violet-500/25 rounded-[2.5rem] p-6 sm:p-9 w-full max-w-lg shadow-[0_0_80px_rgba(124,58,237,0.25)] animate-fade-in max-h-[92vh] overflow-y-auto custom-scrollbar">
                        
                        {/* Brillo decorativo superior */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-violet-400 to-transparent rounded-full" />
                        
                        {/* Botón cerrar */}
                        <button
                            onClick={() => setIsModalOpen(false)}
                            aria-label="Cerrar modal"
                            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-sm"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Encabezado */}
                        <div className="flex items-start gap-4 mb-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-fuchsia-600 p-0.5 shrink-0 shadow-lg shadow-violet-500/30">
                                <div className="w-full h-full bg-[#070e22] rounded-[14px] flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-violet-300" />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight">Prueba Gratis 30 Días</h2>
                                <p className="text-slate-400 text-xs mt-0.5 leading-snug">Sin tarjeta de crédito. Acceso total a todas las funciones Pro.</p>
                            </div>
                        </div>

                        {/* Badges de Confianza */}
                        <div className="flex flex-wrap items-center gap-2 mb-6 pt-1">
                            <span className="text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" /> Sin tarjeta
                            </span>
                            <span className="text-[11px] font-bold bg-violet-500/10 text-violet-300 border border-violet-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                                <Zap className="w-3 h-3" /> Activación rápida
                            </span>
                            <span className="text-[11px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Soporte incluido
                            </span>
                        </div>

                        {leadSuccess ? (
                            /* Pantalla de Éxito y Acceso Directo */
                            <div className="py-8 text-center space-y-4">
                                <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-bounce">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                                </div>
                                <div className="space-y-1.5">
                                    <h3 className="text-2xl font-black text-white">¡Negocio Creado con Éxito!</h3>
                                    <p className="text-slate-300 text-sm max-w-sm mx-auto">
                                        Tu cuenta y agenda para <strong className="text-emerald-400">{createdAccount?.businessName || formData.businessName}</strong> ya están listas.
                                    </p>
                                </div>

                                {createdAccount && (
                                    <div className="p-4 rounded-2xl bg-black/60 border border-white/10 text-left max-w-sm mx-auto space-y-2 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Usuario:</span>
                                            <span className="font-bold text-white">{createdAccount.email}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Contraseña:</span>
                                            <span className="font-mono font-bold text-violet-300">{createdAccount.password}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Tu Link:</span>
                                            <span className="font-mono text-emerald-400 font-bold">citalink.app/{createdAccount.slug}</span>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => { window.location.href = '/admin?welcome=true'; }}
                                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 active:scale-[0.98] text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2"
                                >
                                    <span>Entrar a mi Panel de Control Ahora →</span>
                                </button>
                            </div>
                        ) : (
                            /* Formulario */
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {errorMsg && (
                                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                                        {errorMsg}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 mb-1.5 block" htmlFor="reg-contact-name">Tu Nombre</label>
                                        <input
                                            required
                                            id="reg-contact-name"
                                            name="name"
                                            autoComplete="name"
                                            type="text"
                                            placeholder="Juan Pérez"
                                            className="w-full bg-[#040814]/90 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                            value={formData.contactName}
                                            onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-bold text-slate-300 block" htmlFor="reg-business-name">Nombre del Negocio</label>
                                            {formData.businessName.trim().length > 0 && (
                                                <span className="text-[10px] font-mono text-emerald-400 truncate max-w-[140px]">
                                                    ✓ citalink.app/{generateSlug(formData.businessName)}
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            required
                                            id="reg-business-name"
                                            name="organization"
                                            autoComplete="organization"
                                            type="text"
                                            placeholder="Ej: Estudio Glow / Barbershop"
                                            className="w-full bg-[#040814]/90 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                            value={formData.businessName}
                                            onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                                        />
                                        {formData.businessName.trim().length > 0 && (
                                            <span className="text-[10px] text-slate-400 mt-1 block">
                                                🔗 Link público: <strong className="text-violet-300 font-mono">citalink.app/{generateSlug(formData.businessName)}</strong>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 mb-1.5 block">Giro o Rubro</label>
                                        <CustomSelect
                                            required
                                            value={formData.businessType}
                                            onChange={val => setFormData({ ...formData, businessType: val })}
                                            options={businessTypeOptions}
                                            placeholder="Selecciona el giro de tu negocio..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 mb-1.5 block">Colaboradores</label>
                                        <CustomSelect
                                            required
                                            value={formData.employeeCount}
                                            onChange={val => setFormData({ ...formData, employeeCount: val })}
                                            options={employeeCountOptions}
                                            placeholder="Selecciona..."
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-300 mb-1.5 block" htmlFor="reg-email">Correo Electrónico</label>
                                    <input
                                        required
                                        id="reg-email"
                                        name="email"
                                        autoComplete="email"
                                        inputMode="email"
                                        type="email"
                                        placeholder="correo@ejemplo.com"
                                        className="w-full bg-[#040814]/90 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-xs font-bold text-slate-300 block" htmlFor="reg-phone">WhatsApp de Contacto</label>
                                            {formData.phone.trim().length > 0 && (
                                                <span className={`text-[10px] font-bold ${
                                                    formData.phone.replace(/\D/g, '').length < 10 
                                                        ? 'text-amber-400' 
                                                        : formData.phone.replace(/\D/g, '').length > 12 
                                                            ? 'text-rose-400' 
                                                            : 'text-emerald-400'
                                                }`}>
                                                    {formData.phone.replace(/\D/g, '').length < 10 && `⚠️ Mín 10 (${formData.phone.replace(/\D/g, '').length}/10)`}
                                                    {formData.phone.replace(/\D/g, '').length > 12 && `⚠️ Máx 12 (${formData.phone.replace(/\D/g, '').length}/12)`}
                                                    {formData.phone.replace(/\D/g, '').length >= 10 && formData.phone.replace(/\D/g, '').length <= 12 && `✓ Válido (${formData.phone.replace(/\D/g, '').length} dígitos)`}
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            required
                                            id="reg-phone"
                                            name="tel"
                                            autoComplete="tel"
                                            inputMode="tel"
                                            type="tel"
                                            placeholder="+52 81 0000 0000"
                                            className={`w-full bg-[#040814]/90 border rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                                                formData.phone.trim().length > 0 && (formData.phone.replace(/\D/g, '').length < 10 || formData.phone.replace(/\D/g, '').length > 12)
                                                    ? 'border-amber-500/80 focus:border-amber-500 focus:ring-amber-500/20'
                                                    : 'border-slate-700/60 focus:border-violet-500 focus:ring-violet-500/20'
                                            }`}
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                        <span className="text-[10px] text-slate-500 mt-1 block">
                                            Entre 10 y 12 dígitos (ej: 81 1234 5678)
                                        </span>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-300 mb-1.5 block" htmlFor="reg-address">Dirección / Ciudad</label>
                                        <input
                                            required
                                            id="reg-address"
                                            name="street-address"
                                            autoComplete="street-address"
                                            type="text"
                                            placeholder="Ej: Av. Juárez 123, Mty"
                                            className="w-full bg-[#040814]/90 border border-slate-700/60 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                            value={formData.address}
                                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        />
                                        <span className="text-[10px] text-slate-500 mt-1 block">
                                            Ciudad o calle de tu sucursal
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-300 mb-1.5 block" htmlFor="reg-password">Crea una Contraseña</label>
                                    <div className="relative">
                                        <input
                                            required
                                            id="reg-password"
                                            name="new-password"
                                            autoComplete="new-password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Mínimo 6 caracteres"
                                            className="w-full bg-[#040814]/90 border border-slate-700/60 rounded-xl pl-4 pr-11 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <span className="text-[10px] text-slate-500 mt-1 block">
                                        Para entrar a administrar tu agenda inmediatamente
                                    </span>
                                </div>

                                <button
                                    disabled={submitting}
                                    type="submit"
                                    className="w-full mt-2 py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 hover:brightness-110 active:scale-[0.98] text-white font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-violet-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Activando tu cuenta de prueba...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 text-amber-400" />
                                            <span>Comenzar Mis 30 Días Gratis →</span>
                                        </>
                                    )}
                                </button>

                                <div className="text-center pt-1">
                                    <Link
                                        to="/register"
                                        onClick={() => setIsModalOpen(false)}
                                        className="text-xs text-violet-400 hover:text-violet-300 font-bold underline"
                                    >
                                        O usa el formulario de registro completo en pantalla completa →
                                    </Link>
                                </div>

                                <p className="text-center text-[11px] text-slate-500 pt-1">
                                    Al enviar aceptas nuestros{' '}
                                    <Link to="/terms" className="text-slate-400 underline hover:text-white">
                                        Términos de Servicio
                                    </Link>{' '}
                                    y{' '}
                                    <Link to="/privacy" className="text-slate-400 underline hover:text-white">
                                        Aviso de Privacidad
                                    </Link>
                                    .
                                </p>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
