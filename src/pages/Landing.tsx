import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../lib/store/authStore';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { CustomSelect } from '../components/CustomSelect';
import {
    CalendarDays, MessageCircle, Users, TrendingUp, ArrowRight,
    CheckCircle2, X, Sparkles, Scissors, Flower2, Stethoscope,
    Infinity as InfinityIcon, Star, Shield, Zap, Clock,
    BarChart2, Smartphone, ChevronDown, Instagram, Facebook
} from 'lucide-react';

/* ── Helpers ─────────────────────────────────────────────────── */
const businessTypeOptions = [
    { value: 'barbershop', label: 'Barbería' },
    { value: 'salon', label: 'Salón de Belleza' },
    { value: 'spa', label: 'Spa / Multiestética' },
    { value: 'clinic', label: 'Clínica / Consultorio' },
    { value: 'other', label: 'Otro' },
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

/* ── Main Landing Component ───────────────────────────────────── */
export default function Landing() {
    const { user, isSuperAdmin } = useAuthStore();
    const dashboardPath = isSuperAdmin ? '/super-admin' : '/admin';

    // Lead Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [leadSuccess, setLeadSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        businessName: '', businessType: '', employeeCount: '',
        contactName: '', email: '', phone: ''
    });

    // Navbar scroll
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', fn);
        return () => window.removeEventListener('scroll', fn);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMsg(null);
        try {
            const { error } = await supabase.from('leads').insert([{
                business_name: formData.businessName, business_type: formData.businessType,
                employee_count: formData.employeeCount, contact_name: formData.contactName,
                email: formData.email, phone: formData.phone
            }]);
            if (error) throw error;
            setLeadSuccess(true);
            setTimeout(() => { setIsModalOpen(false); setLeadSuccess(false); setFormData({ businessName: '', businessType: '', employeeCount: '', contactName: '', email: '', phone: '' }); }, 5000);
        } catch (err: any) {
            setErrorMsg(err.message || 'Error al procesar. Intenta de nuevo.');
        } finally { setSubmitting(false); }
    };

    /* ── Section visibility hooks ──── */
    const s1 = useInView(); const s2 = useInView(); const s3 = useInView();
    const s4 = useInView(); const s5 = useInView(); const s6 = useInView();

    /* ── DATA ──────────────────────── */
    const features = [
        { icon: <CalendarDays className="w-6 h-6" />, color: 'from-violet-500 to-indigo-500', title: 'Agenda Inteligente', desc: 'Clientes reservan solos, 24/7. Sin llamadas, sin papelería.' },
        { icon: <MessageCircle className="w-6 h-6" />, color: 'from-emerald-500 to-teal-500', title: 'Recordatorios WhatsApp', desc: 'Reduce inasistencias hasta un 60% con mensajes automáticos.' },
        { icon: <Users className="w-6 h-6" />, color: 'from-blue-500 to-cyan-500', title: 'Control de Equipo', desc: 'Horarios, comisiones y accesos por rol para cada empleado.' },
        { icon: <BarChart2 className="w-6 h-6" />, color: 'from-orange-500 to-amber-500', title: 'Reportes en Tiempo Real', desc: 'Analíticas de ingresos, citas y tendencias actualizado al instante.' },
        { icon: <Shield className="w-6 h-6" />, color: 'from-rose-500 to-pink-500', title: 'Branding Propio', desc: 'Página personalizada con tu logo, colores y dominio.' },
        { icon: <Smartphone className="w-6 h-6" />, color: 'from-purple-500 to-violet-500', title: 'App Instalable (PWA)', desc: 'Tus clientes guardan la app en su celular con un solo clic.' },
    ];

    const industries = [
        { icon: <Scissors className="w-7 h-7" />, label: 'Barberías', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' },
        { icon: <Sparkles className="w-7 h-7" />, label: 'Salones', color: 'text-pink-400', bg: 'bg-pink-400/10 border-pink-400/20' },
        { icon: <Flower2 className="w-7 h-7" />, label: 'Spas', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
        { icon: <Stethoscope className="w-7 h-7" />, label: 'Clínicas', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
    ];

    const testimonials = [
        { name: 'Sofía R.', biz: 'Salón Sofía — CDMX', text: 'Antes perdía 5 citas por semana por WhatsApp mal anotado. Ahora todo llega solo al calendario. ¡Increíble!', stars: 5 },
        { name: 'Rodrigo M.', biz: 'Barbería Bros — MTY', text: 'Mis clientes agendan desde las 11pm. Llegué a la barbería y ya tenía 8 citas agendadas mientras dormía.', stars: 5 },
        { name: 'Valentina L.', biz: 'Spa Zen — GDL', text: 'La vista de calendario para mis 3 terapeutas es perfecta. Antes usaba una agenda compartida en Google Sheets.', stars: 5 },
    ];

    const steps = [
        { num: '01', icon: <Zap className="w-5 h-5" />, title: 'Crea tu cuenta', desc: 'Regístrate en 2 minutos. Carga tu logo y configuramos tus servicios y horarios.' },
        { num: '02', icon: <Smartphone className="w-5 h-5" />, title: 'Comparte tu link', desc: 'Envía tu URL personalizada a tus clientes por WhatsApp, Instagram o en tu bio.' },
        { num: '03', icon: <CalendarDays className="w-5 h-5" />, title: 'Las citas llegan solas', desc: 'Tu agenda se llena automáticamente mientras tú te enfocas en dar el mejor servicio.' },
    ];

    return (
        <div className="min-h-screen bg-[#020817] text-slate-50 font-sans overflow-x-hidden selection:bg-violet-500/30">

            {/* ═══════════ NAVBAR ═══════════ */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#020817]/95 backdrop-blur-lg border-b border-white/5 shadow-xl' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 lg:h-20">
                        <div className="flex items-center gap-2 group cursor-pointer">
                            <div className="relative">
                                <div className="absolute inset-0 bg-violet-500 blur-md opacity-30 group-hover:opacity-70 transition-opacity rounded-full" />
                                <InfinityIcon className="w-7 h-7 text-violet-400 relative z-10" strokeWidth={2.5} />
                            </div>
                            <span className="text-xl font-black tracking-tight">Cita<span className="text-violet-400">Link</span></span>
                        </div>
                        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
                            <a href="#features" className="hover:text-white transition-colors">Funciones</a>
                            <a href="#how" className="hover:text-white transition-colors">¿Cómo funciona?</a>
                            <a href="#testimonials" className="hover:text-white transition-colors">Testimonios</a>
                        </div>
                        <div className="flex items-center gap-3">
                            {user ? (
                                <Link to={dashboardPath} className="px-5 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all flex items-center gap-2 shadow-lg shadow-violet-500/20">
                                    Mi Panel <ArrowRight className="w-4 h-4" />
                                </Link>
                            ) : (
                                <>
                                    <Link to="/login" className="hidden sm:block text-sm font-medium text-slate-400 hover:text-white transition-colors">Iniciar Sesión</Link>
                                    <button onClick={() => setIsModalOpen(true)} className="px-5 py-2.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/20">
                                        Prueba Gratis
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* ═══════════ HERO ═══════════ */}
            <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 pb-16 overflow-hidden">
                {/* Background glows */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-violet-700/25 blur-[130px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-indigo-700/15 blur-[100px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-blue-700/15 blur-[100px] rounded-full pointer-events-none" />
                {/* Grid lines */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

                <div className="relative z-10 text-center max-w-5xl mx-auto px-4">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium mb-8">
                        <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                        La plataforma #1 para reservas en México
                        <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                    </div>

                    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 leading-[0.9]">
                        Llena tu agenda<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 animate-gradient-x">
                            mientras duermes.
                        </span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 mb-10 leading-relaxed">
                        Reservas automáticas, recordatorios que evitan inasistencias y control total de tu equipo — todo en una plataforma diseñada para <strong className="text-white">salones, spas, barberías y clínicas.</strong>
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                        {user ? (
                            <Link to={dashboardPath} className="group w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-lg hover:from-violet-500 hover:to-indigo-500 transition-all shadow-[0_0_40px_-5px_rgba(124,58,237,0.5)] flex items-center justify-center gap-3">
                                Ir a mi Panel <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        ) : (
                            <>
                                <button onClick={() => setIsModalOpen(true)} className="group w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-lg hover:from-violet-500 hover:to-indigo-500 transition-all shadow-[0_0_40px_-5px_rgba(124,58,237,0.5)] flex items-center justify-center gap-3">
                                    Solicitar Prueba Gratis
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <Link to="/login" className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-semibold text-lg hover:bg-white/10 transition-all">
                                    Iniciar Sesión
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Social proof */}
                    <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400 mb-16">
                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-2">
                                {['bg-violet-500', 'bg-pink-500', 'bg-indigo-500', 'bg-emerald-500'].map((c, i) => (
                                    <div key={i} className={`w-7 h-7 rounded-full ${c} border-2 border-[#020817] flex items-center justify-center text-[10px] font-bold text-white`}>{['S','R','V','M'][i]}</div>
                                ))}
                            </div>
                            <span>+500 negocios activos</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                            <span className="ml-1">4.9/5 en reseñas</span>
                        </div>
                        <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sin comisiones por reserva</div>
                    </div>

                    {/* Real App Preview */}
                    <div className="relative mx-auto max-w-5xl mt-16">
                        <div className="absolute -inset-4 bg-gradient-to-r from-violet-600/20 via-transparent to-indigo-600/20 blur-2xl rounded-3xl" />
                        <div className="relative bg-[#0d1526] border border-white/8 rounded-2xl overflow-hidden shadow-[0_0_80px_-20px_rgba(124,58,237,0.35)]">
                            {/* ── Browser chrome ── */}
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#080e1c] border-b border-white/5">
                                <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500/80"/><div className="w-3 h-3 rounded-full bg-amber-500/80"/><div className="w-3 h-3 rounded-full bg-emerald-500/80"/></div>
                                <div className="flex-1 mx-4 bg-white/5 rounded-md px-3 py-1 text-xs text-slate-500 flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50 flex-shrink-0"/>citalink.app/admin
                                </div>
                            </div>
                            {/* ── App layout ── */}
                            <div className="flex" style={{height: '460px'}}>
                                {/* Sidebar */}
                                <div className="w-52 flex-shrink-0 bg-[#060c1a] border-r border-white/5 flex flex-col py-4 px-3 gap-1">
                                    {/* Logo */}
                                    <div className="flex items-center gap-2 px-3 pb-4 mb-2 border-b border-white/5">
                                        <div className="w-7 h-7 rounded-lg bg-violet-600/30 border border-violet-500/30 flex items-center justify-center">
                                            <InfinityIcon className="w-4 h-4 text-violet-400" strokeWidth={2.5}/>
                                        </div>
                                        <span className="text-sm font-black text-white">Cita<span className="text-violet-400">Link</span></span>
                                    </div>
                                    {/* Nav items */}
                                    {[
                                        { label: 'Dashboard', active: true, dot: 'bg-violet-500' },
                                        { label: 'Citas', active: false, dot: 'bg-blue-500' },
                                        { label: 'Clientes', active: false, dot: 'bg-emerald-500' },
                                        { label: 'Servicios', active: false, dot: 'bg-amber-500' },
                                        { label: 'Equipo', active: false, dot: 'bg-pink-500' },
                                        { label: 'Configuración', active: false, dot: 'bg-slate-500' },
                                    ].map((item) => (
                                        <div key={item.label} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${item.active ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20' : 'text-slate-500 hover:text-slate-300'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${item.dot} ${item.active ? 'opacity-100' : 'opacity-30'}`}/>
                                            {item.label}
                                        </div>
                                    ))}
                                    {/* User */}
                                    <div className="mt-auto flex items-center gap-2 px-3 pt-3 border-t border-white/5">
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-[10px] font-black text-white">MA</div>
                                        <div><p className="text-[10px] font-bold text-white">María A.</p><p className="text-[9px] text-slate-500">Super Admin</p></div>
                                    </div>
                                </div>
                                {/* Main content */}
                                <div className="flex-1 overflow-hidden bg-[#080d1c] p-5 flex flex-col gap-4">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-sm font-black text-white">Dashboard</h2>
                                            <p className="text-[10px] text-slate-500">Sábado, 28 de Marzo 2026</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 text-[10px] font-bold flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"/>EN VIVO
                                            </div>
                                        </div>
                                    </div>
                                    {/* Stats row */}
                                    <div className="grid grid-cols-4 gap-3">
                                        {[
                                            { label: 'Citas Hoy', val: '12', icon: <CalendarDays className="w-3.5 h-3.5"/>, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', change: '+3 vs ayer' },
                                            { label: 'Ingresos', val: '$3,240', icon: <TrendingUp className="w-3.5 h-3.5"/>, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', change: '+18%' },
                                            { label: 'Clientes', val: '847', icon: <Users className="w-3.5 h-3.5"/>, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', change: '+12 nuevos' },
                                            { label: 'Completadas', val: '94%', icon: <BarChart2 className="w-3.5 h-3.5"/>, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', change: 'Este mes' },
                                        ].map((s) => (
                                            <div key={s.label} className={`relative overflow-hidden rounded-xl border ${s.bg} p-3`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{s.label}</p>
                                                    <div className={`${s.color}`}>{s.icon}</div>
                                                </div>
                                                <p className={`text-lg font-black ${s.color}`}>{s.val}</p>
                                                <p className="text-[9px] text-slate-500 mt-0.5">{s.change}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Appointments + Chart */}
                                    <div className="grid grid-cols-5 gap-3 flex-1 min-h-0">
                                        {/* Appointment list */}
                                        <div className="col-span-3 bg-[#0f172a]/60 border border-white/5 rounded-xl p-3 overflow-hidden">
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-[10px] text-white font-bold uppercase tracking-widest">Hoy — Próximas citas</p>
                                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">12 citas</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                {[
                                                    { time: '09:00', name: 'Carlos M.', svc: 'Corte Clásico', stylist: 'Ana G.', status: 'completada' },
                                                    { time: '09:45', name: 'Romina P.', svc: 'Manicure Gel', stylist: 'Luis M.', status: 'completada' },
                                                    { time: '10:30', name: 'Diego H.', svc: 'Masaje Relajante', stylist: 'Ana G.', status: 'confirmada' },
                                                    { time: '11:15', name: 'Laura V.', svc: 'Corte + Tinte', stylist: 'Karen P.', status: 'confirmada' },
                                                    { time: '12:00', name: 'Miguel T.', svc: 'Corte + Barba', stylist: 'Luis M.', status: 'confirmada' },
                                                ].map((apt) => (
                                                    <div key={apt.time} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-transparent hover:border-white/5 transition-all">
                                                        <span className="text-violet-400 font-mono text-[10px] w-10 shrink-0 font-bold">{apt.time}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-white text-[10px] font-bold truncate">{apt.name}</p>
                                                            <p className="text-slate-500 text-[9px] truncate">{apt.svc} · {apt.stylist}</p>
                                                        </div>
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${apt.status === 'completada' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                                                            {apt.status === 'completada' ? '✓ Lista' : '◷ Pendiente'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Mini activity panel */}
                                        <div className="col-span-2 flex flex-col gap-3">
                                            <div className="bg-[#0f172a]/60 border border-white/5 rounded-xl p-3 flex-1">
                                                <p className="text-[10px] text-white font-bold uppercase tracking-widest mb-3">Ingresos — Esta semana</p>
                                                {/* Mini bar chart */}
                                                <div className="flex items-end gap-1 h-20">
                                                    {[40, 65, 55, 80, 70, 90, 75].map((h, i) => (
                                                        <div key={i} className="flex-1 flex flex-col gap-0.5 items-center">
                                                            <div className="w-full rounded-sm" style={{height: `${h}%`, background: i === 5 ? 'linear-gradient(to top, #7c3aed, #6366f1)' : 'rgba(124,58,237,0.2)'}}/>
                                                            <span className="text-[7px] text-slate-600">{['L','M','X','J','V','S','D'][i]}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <MessageCircle className="w-3 h-3 text-emerald-400"/>
                                                    <p className="text-[10px] text-emerald-400 font-bold">8 recordatorios enviados</p>
                                                </div>
                                                <p className="text-[9px] text-slate-500">WhatsApp automático para citas de mañana</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
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
                    <p className="text-center text-slate-500 text-sm font-semibold uppercase tracking-widest mb-8">Perfecta para tu sector</p>
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

            {/* ═══════════ HOW IT WORKS ═══════════ */}
            <section id="how" className="py-28 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-[#020817] via-[#080d1a] to-[#020817] pointer-events-none" />
                <div ref={s2.ref} className={`relative max-w-6xl mx-auto px-4 transition-all duration-700 ${s2.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="text-center mb-20">
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

            {/* ═══════════ FEATURES ═══════════ */}
            <section id="features" className="py-28 bg-[#050d1a]/60 border-t border-white/5">
                <div ref={s3.ref} className={`max-w-6xl mx-auto px-4 transition-all duration-700 ${s3.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="text-center mb-20">
                        <span className="text-violet-400 text-sm font-bold uppercase tracking-widest">Todo incluido</span>
                        <h2 className="text-4xl md:text-5xl font-black mt-3 mb-4">Herramientas que multiplican tus resultados</h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">Olvídate de WhatsApp, Excel y agendas de papel. CitaLink centraliza todo en un solo lugar.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((f, i) => (
                            <div key={i} className="group relative overflow-hidden bg-white/[0.02] border border-white/5 rounded-3xl p-8 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-500 cursor-default">
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle at 50% 0%, ${i % 2 === 0 ? 'rgba(124,58,237,0.08)' : 'rgba(99,102,241,0.08)'}, transparent 70%)` }} />
                                <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${f.color} mb-5 shadow-lg`}>
                                    <div className="text-white">{f.icon}</div>
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════ DEMO SECTION ═══════════ */}
            <section className="py-28 border-t border-white/5 relative overflow-hidden">
                <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[500px] h-[500px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
                <div ref={s4.ref} className={`max-w-6xl mx-auto px-4 transition-all duration-700 ${s4.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <span className="text-violet-400 text-sm font-bold uppercase tracking-widest">Vista del cliente</span>
                            <h2 className="text-4xl md:text-5xl font-black mt-3 mb-6">Tu cliente reserva en 30 segundos</h2>
                            <p className="text-slate-400 text-lg leading-relaxed mb-8">
                                Tus clientes entran a <em className="text-violet-300">citalink.app/tu-negocio</em>, ven tus servicios, eligen al profesional y la hora disponible. Sin registro, sin complicaciones.
                            </p>
                            <ul className="space-y-4">
                                {['Selección de servicio con foto y precio', 'Elige su empleado favorito', 'Calendario de horarios disponibles en tiempo real', 'Google Calendar y recordatorio vía WhatsApp'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                        <span className="text-slate-300">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {/* Phone mockup */}
                        <div className="relative flex justify-center">
                            <div className="relative w-72">
                                <div className="absolute inset-0 bg-violet-500/20 blur-3xl rounded-full" />
                                <div className="relative bg-[#0f172a] border-4 border-slate-700 rounded-[2.5rem] overflow-hidden shadow-2xl">
                                    {/* Phone notch */}
                                    <div className="h-6 bg-[#0f172a] flex items-center justify-center"><div className="w-20 h-4 rounded-full bg-slate-800" /></div>
                                    {/* App content */}
                                    <div className="p-4 space-y-3 min-h-[480px] bg-gradient-to-b from-[#0f172a] to-[#080d1a]">
                                        <div className="text-center py-4 border-b border-white/5">
                                            <div className="w-12 h-12 rounded-full bg-violet-500/20 border border-violet-500/30 mx-auto mb-2 flex items-center justify-center"><Scissors className="w-6 h-6 text-violet-400" /></div>
                                            <p className="text-white font-bold text-sm">Barbería Royal</p>
                                            <p className="text-slate-500 text-xs">📍 Monterrey, NL</p>
                                        </div>
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Servicios</p>
                                        {[
                                            { name: 'Corte Clásico', time: '30 min', price: '$150' },
                                            { name: 'Corte + Barba', time: '50 min', price: '$220' },
                                            { name: 'Afeitado Royal', time: '40 min', price: '$180' },
                                        ].map((svc, i) => (
                                            <div key={i} className={`flex justify-between items-center p-3 rounded-xl border ${i === 0 ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/5 bg-white/[0.02]'}`}>
                                                <div>
                                                    <p className={`text-sm font-bold ${i === 0 ? 'text-violet-300' : 'text-white'}`}>{svc.name}</p>
                                                    <p className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />{svc.time}</p>
                                                </div>
                                                <p className={`font-black text-sm ${i === 0 ? 'text-violet-400' : 'text-slate-300'}`}>{svc.price}</p>
                                            </div>
                                        ))}
                                        <button className="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm shadow-lg">
                                            Reservar Ahora →
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════ TESTIMONIALS ═══════════ */}
            <section id="testimonials" className="py-28 bg-[#050d1a]/60 border-t border-white/5">
                <div ref={s5.ref} className={`max-w-6xl mx-auto px-4 transition-all duration-700 ${s5.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="text-center mb-20">
                        <span className="text-violet-400 text-sm font-bold uppercase tracking-widest">Historias reales</span>
                        <h2 className="text-4xl md:text-5xl font-black mt-3 mb-4">Negocios que ya transformaron su agenda</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                        {testimonials.map((t, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 hover:border-violet-500/20 transition-all duration-300 group">
                                <div className="flex gap-1 mb-4">
                                    {[...Array(t.stars)].map((_, j) => <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                                </div>
                                <p className="text-slate-300 leading-relaxed mb-6 text-sm italic">"{t.text}"</p>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">{t.name[0]}</div>
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

            {/* ═══════════ CTA FINAL ═══════════ */}
            <section className="py-28 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-900/30 via-[#020817] to-indigo-900/20" />
                <div ref={s6.ref} className={`relative max-w-4xl mx-auto px-4 text-center transition-all duration-700 ${s6.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-medium mb-8">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        14 días gratis — Sin tarjeta de crédito
                    </div>
                    <h2 className="text-5xl md:text-6xl font-black mb-6">
                        ¿Listo para llenar<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">tu agenda?</span>
                    </h2>
                    <p className="text-slate-400 text-xl mb-10 max-w-xl mx-auto">
                        Únete a más de 500 negocios que ya automatizaron sus reservas y aumentaron sus ingresos con CitaLink.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                        {user ? (
                            <Link to={dashboardPath} className="group px-10 py-5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xl hover:from-violet-500 hover:to-indigo-500 transition-all shadow-[0_0_60px_-10px_rgba(124,58,237,0.6)] flex items-center gap-3">
                                Ir a mi Panel <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        ) : (
                            <button onClick={() => setIsModalOpen(true)} className="group px-10 py-5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xl hover:from-violet-500 hover:to-indigo-500 transition-all shadow-[0_0_60px_-10px_rgba(124,58,237,0.6)] flex items-center gap-3">
                                Empezar Gratis Ahora <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                            </button>
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
                            <a href="https://instagram.com/citalink.app" target="_blank" rel="noopener noreferrer"
                               className="group w-10 h-10 rounded-full bg-white/5 hover:bg-gradient-to-br hover:from-pink-500 hover:to-purple-600 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all duration-300">
                                <Instagram className="w-4 h-4" />
                            </a>
                            <a href="https://facebook.com/citalinkapp" target="_blank" rel="noopener noreferrer"
                               className="group w-10 h-10 rounded-full bg-white/5 hover:bg-blue-600 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all duration-300">
                                <Facebook className="w-4 h-4" />
                            </a>
                            <a href="https://wa.me/5218100000000?text=Hola%2C%20quiero%20saber%20más%20sobre%20CitaLink"
                               target="_blank" rel="noopener noreferrer"
                               className="group w-10 h-10 rounded-full bg-white/5 hover:bg-emerald-600 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all duration-300">
                                <MessageCircle className="w-4 h-4" />
                            </a>
                        </div>
                        {/* Correo */}
                        <a href="mailto:hola@citalink.app" className="flex items-center gap-2 text-sm text-slate-400 hover:text-violet-400 transition-colors group">
                            <span className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">✉</span>
                            hola@citalink.app
                        </a>
                    </div>
                    <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-600">
                        <p>© {new Date().getFullYear()} CitaLink. Todos los derechos reservados.</p>
                        <div className="flex gap-6">
                            <a href="#" className="hover:text-slate-400 transition-colors">Términos</a>
                            <a href="#" className="hover:text-slate-400 transition-colors">Privacidad</a>
                            <a href="mailto:hola@citalink.app" className="hover:text-slate-400 transition-colors">Contacto</a>
                        </div>
                    </div>
                </div>
            </footer>


            {/* ═══════════ LEAD MODAL ═══════════ */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => !submitting && setIsModalOpen(false)} />
                    <div className="relative z-10 bg-[#0b1221] border border-slate-700/50 rounded-[2rem] p-8 w-full max-w-lg shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">
                            <X className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 bg-violet-500/10 rounded-xl border border-violet-500/20"><Sparkles className="w-5 h-5 text-violet-400" /></div>
                            <h2 className="text-2xl font-black text-white">Prueba Gratis 14 Días</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-8">Sin tarjeta de crédito. Te enviamos tus accesos en menos de 24 horas.</p>

                        {leadSuccess ? (
                            <div className="py-12 text-center">
                                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                                </div>
                                <h3 className="text-2xl font-black text-white mb-3">¡Ya casi!</h3>
                                <p className="text-slate-400">Recibimos tu solicitud. Te contactaremos en las próximas horas con tus accesos personalizados.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {errorMsg && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{errorMsg}</div>}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Tu Nombre</label>
                                        <input required type="text" placeholder="Juan Pérez" className="w-full bg-[#060e1c] border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 transition-all" value={formData.contactName} onChange={e => setFormData({ ...formData, contactName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Nombre del Negocio</label>
                                        <input required type="text" placeholder="Mi Negocio" className="w-full bg-[#060e1c] border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 transition-all" value={formData.businessName} onChange={e => setFormData({ ...formData, businessName: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Tipo de Negocio</label>
                                        <CustomSelect required value={formData.businessType} onChange={val => setFormData({ ...formData, businessType: val })} options={businessTypeOptions} placeholder="Selecciona..." />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Tamaño del Equipo</label>
                                        <CustomSelect required value={formData.employeeCount} onChange={val => setFormData({ ...formData, employeeCount: val })} options={employeeCountOptions} placeholder="Selecciona..." />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Correo Electrónico</label>
                                    <input required type="email" placeholder="correo@ejemplo.com" className="w-full bg-[#060e1c] border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 transition-all" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-400 mb-1.5 block">WhatsApp de Contacto</label>
                                    <input required type="tel" placeholder="+52 81 0000 0000" className="w-full bg-[#060e1c] border border-slate-700/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 transition-all" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                </div>
                                <button disabled={submitting} type="submit" className="w-full mt-2 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold tracking-wide transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {submitting ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</>) : 'Solicitar Acceso Ahora →'}
                                </button>
                                <p className="text-center text-xs text-slate-600">Al enviar aceptas nuestros Términos de Servicio y Aviso de Privacidad.</p>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
