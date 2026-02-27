import { useState } from 'react';
import { useStore } from '../lib/store';
import { Link } from 'react-router-dom';
import { CalendarDays, MessageCircle, Users, TrendingUp, ArrowRight, CheckCircle2, Facebook, Instagram, Twitter, X, Sparkles, Scissors, Flower2, Stethoscope, Infinity as InfinityIcon } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function Landing() {
    const { user, isSuperAdmin } = useStore();
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [leadSuccess, setLeadSuccess] = useState(false);
    const [formData, setFormData] = useState({
        businessName: '',
        businessType: '',
        employeeCount: '',
        contactName: '',
        email: '',
        phone: ''
    });

    const handleLeadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { error } = await supabase.from('leads').insert([{
                business_name: formData.businessName,
                business_type: formData.businessType,
                employee_count: formData.employeeCount,
                contact_name: formData.contactName,
                email: formData.email,
                phone: formData.phone
            }]);

            if (error) throw error;
            setLeadSuccess(true);
            setTimeout(() => {
                setIsLeadModalOpen(false);
                setLeadSuccess(false);
                setFormData({ businessName: '', businessType: '', employeeCount: '', contactName: '', email: '', phone: '' });
            }, 3000);
        } catch (error) {
            console.error("Error submitting lead:", error);
            alert("Hubo un error al enviar tu solicitud. Intenta de nuevo.");
        } finally {
            setSubmitting(false);
        }
    };

    // Determine where the user should go if they are already logged in
    const dashboardPath = isSuperAdmin ? '/super-admin' : '/admin';

    const features = [
        {
            icon: <CalendarDays className="h-6 w-6 text-violet-400" />,
            title: "Reservas 24/7",
            description: "Tus clientes agendan cuando quieran, tú te enfocas en dar el mejor servicio."
        },
        {
            icon: <MessageCircle className="h-6 w-6 text-emerald-400" />,
            title: "Recordatorios WhatsApp",
            description: "Reduce inasistencias drásticamente con recordatorios automatizados."
        },
        {
            icon: <Users className="h-6 w-6 text-blue-400" />,
            title: "Gestión de Equipo",
            description: "Controla horarios, servicios y accesos para todo tu staff fácilmente."
        },
        {
            icon: <TrendingUp className="h-6 w-6 text-orange-400" />,
            title: "Analíticas Simples",
            description: "Mide tus ingresos, citas completadas y crecimiento en tiempo real."
        }
    ];

    const benefits = [
        "Tu propia página web personalizada",
        "Sincronización en la nube al instante",
        "Soporte técnico prioritario",
        "Sin comisiones por reserva"
    ];

    return (
        <div className="min-h-screen bg-[#020817] text-slate-50 selection:bg-violet-500/30 font-sans overflow-x-hidden">

            {/* ─── NAV BAR ─── */}
            <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#020817]/80 backdrop-blur-md">
                <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        {/* Logo */}
                        <div className="flex items-center gap-2 group cursor-pointer">
                            <div className="relative flex items-center justify-center w-8 h-8">
                                <div className="absolute inset-0 bg-violet-500 blur-md opacity-20 group-hover:opacity-60 transition-opacity rounded-full"></div>
                                <InfinityIcon className="w-8 h-8 text-violet-500 relative z-10" strokeWidth={2.5} />
                            </div>
                            <span className="text-2xl font-black tracking-tighter text-white">
                                Cita<span className="text-violet-500">Link</span>
                            </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-4">
                            {user ? (
                                <Link
                                    to={dashboardPath}
                                    className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 font-medium transition-all flex items-center gap-2"
                                >
                                    Ir al Dashboard <ArrowRight className="w-4 h-4" />
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block"
                                    >
                                        Iniciar Sesión
                                    </Link>
                                    <button
                                        onClick={() => setIsLeadModalOpen(true)}
                                        className="px-5 py-2.5 text-sm rounded-full bg-violet-600 hover:bg-violet-500 text-white font-medium shadow-lg shadow-violet-500/25 transition-all"
                                    >
                                        Prueba Gratis (14 Días)
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* ─── HERO SECTION ─── */}
            <main className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-violet-600/20 mix-blend-screen blur-[120px] rounded-full pointer-events-none" />

                <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium mb-8 animate-fade-in">
                        <span className="flex h-2 w-2 rounded-full bg-violet-500 animate-pulse"></span>
                        La plataforma definitiva para gestionar tu servicio
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
                        Revoluciona la gestión de <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
                            tu negocio hoy.
                        </span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 mb-12 leading-relaxed">
                        Agenda automática, recordatorios que evitan inasistencias y control total de tu equipo. Diseñado para salones, spas, clínicas y más.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        {user ? (
                            <Link
                                to={dashboardPath}
                                className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-slate-900 font-bold text-lg hover:bg-slate-200 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2"
                            >
                                Entrar a mi panel
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                        ) : (
                            <button
                                onClick={() => setIsLeadModalOpen(true)}
                                className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-slate-900 font-bold text-lg hover:bg-slate-200 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2"
                            >
                                Solicitar Prueba Gratis
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* Real Dashboard Mockup Image */}
                    <div className="mt-20 mx-auto max-w-5xl rounded-2xl md:rounded-[2.5rem] bg-[#0f172a] border border-white/10 shadow-2xl p-2 md:p-4 rotate-1 hover:rotate-0 transition-transform duration-500 overflow-hidden relative">
                        <img
                            src="/assets/mockup-dashboard.png"
                            alt="CitaLink Dashboard Preview"
                            className="w-full h-auto rounded-xl md:rounded-2xl border border-white/5 object-cover object-top"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#020817] via-transparent to-transparent pointer-events-none rounded-[2.5rem]"></div>
                    </div>
                </div>
            </main>

            {/* ─── HOW IT WORKS / DUAL SECTION ─── */}
            <section className="py-24 relative z-20 border-t border-white/5 bg-[#020817]">
                <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">¿Cómo funciona CitaLink?</h2>
                        <p className="text-slate-400 text-lg">
                            Un sistema integral compuesto por dos herramientas interconectadas para potenciar al máximo tus ganancias.
                        </p>
                    </div>

                    <div className="space-y-24">
                        {/* Block 1: Client App */}
                        <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
                            <div className="flex-1 md:order-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium mb-6">
                                    Paso 1: Tus clientes
                                </div>
                                <h3 className="text-3xl md:text-4xl font-bold mb-4">Experiencia de reserva perfecta</h3>
                                <p className="text-slate-400 text-lg leading-relaxed mb-6">
                                    Tus clientes visitan tu página única (Ej: <em>citalink.app/reserva/tunegocio</em>). Ven tus servicios, las fechas disponibles de tus empleados, y pueden agendar solitos, 24 horas al día, desde su celular.
                                </p>
                                <ul className="space-y-3">
                                    <li className="flex items-center gap-3 text-slate-300"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Citas auto-gestionables todo el día.</li>
                                    <li className="flex items-center gap-3 text-slate-300"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Selección de empleado favorito.</li>
                                    <li className="flex items-center gap-3 text-slate-300"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Diseño atractivo con tu propio Branding.</li>
                                </ul>
                            </div>
                            <div className="flex-1 md:order-1 relative">
                                <div className="absolute inset-0 bg-violet-600/20 blur-[100px] rounded-full"></div>
                                <img
                                    src="/assets/mockup-booking.png"
                                    alt="Client Booking App"
                                    className="relative z-10 w-full max-w-[320px] mx-auto rounded-[2.5rem] border-4 border-slate-800 shadow-2xl skew-y-3 hover:skew-y-0 transition-transform duration-500"
                                />
                            </div>
                        </div>

                        {/* Block 2: Admin Dashboard */}
                        <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
                            <div className="flex-1">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium mb-6">
                                    Paso 2: Tu control
                                </div>
                                <h3 className="text-3xl md:text-4xl font-bold mb-4">Control total de tu negocio</h3>
                                <p className="text-slate-400 text-lg leading-relaxed mb-6">
                                    Toda la magia se cristaliza en tu Dashboard Privado. Aquí entras tú y tu equipo para ver los calendarios llenarse, enviar recordatorios y registrar cuánto has ganado.
                                </p>
                                <ul className="space-y-3">
                                    <li className="flex items-center gap-3 text-slate-300"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Analíticas de ingresos automáticas.</li>
                                    <li className="flex items-center gap-3 text-slate-300"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Agenda centralizada en modo calendario.</li>
                                    <li className="flex items-center gap-3 text-slate-300"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Asignación de roles al cajero, gerente y staff.</li>
                                </ul>
                            </div>
                            <div className="flex-1 relative perspective-1000">
                                <div className="absolute inset-0 bg-blue-600/20 blur-[100px] rounded-full"></div>
                                <img
                                    src="/assets/mockup-dashboard.png"
                                    alt="Admin Dashboard"
                                    className="relative z-10 w-full rounded-2xl border border-white/10 shadow-2xl -rotate-2 hover:rotate-0 transition-transform duration-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── INDUSTRY SECTION ─── */}
            <section className="py-24 bg-[#0a0f1c] relative z-20 border-t border-white/5">
                <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">Diseñado para tu rubro</h2>
                        <p className="text-slate-400 text-lg">
                            Adaptamos las funciones del sistema para atender las necesidades precisas de los principales sectores del bienestar y el cuidado personal.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {[
                            { icon: <Scissors className="w-8 h-8 text-amber-400" />, title: 'Barberías', bg: 'bg-amber-400/10' },
                            { icon: <Sparkles className="w-8 h-8 text-pink-400" />, title: 'Salón de Uñas', bg: 'bg-pink-400/10' },
                            { icon: <Flower2 className="w-8 h-8 text-emerald-400" />, title: 'Spas', bg: 'bg-emerald-400/10' },
                            { icon: <Stethoscope className="w-8 h-8 text-blue-400" />, title: 'Clínicas', bg: 'bg-blue-400/10' }
                        ].map((item, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center hover:bg-white/[0.05] transition-colors group cursor-pointer">
                                <div className={`w-16 h-16 mx-auto rounded-full ${item.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                    {item.icon}
                                </div>
                                <h3 className="font-bold text-lg text-white">{item.title}</h3>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── FEATURES SECTION ─── */}
            <section className="py-24 bg-[#0a0f1c] relative z-20 border-t border-white/5">
                <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">Todo lo que necesitas para crecer</h2>
                        <p className="text-slate-400 text-lg">
                            Olvídate del papel y lápiz. Centraliza la operación de tu local en una herramienta bonita, rápida y segura.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((ft, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 hover:bg-white/[0.04] transition-colors group">
                                <div className="w-14 h-14 bg-[#0f172a] rounded-2xl border border-white/10 flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform">
                                    {ft.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{ft.title}</h3>
                                <p className="text-slate-400 leading-relaxed text-sm">
                                    {ft.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CTA SECTION ─── */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-violet-900/10"></div>
                <div className="container mx-auto max-w-5xl px-4 relative z-10">
                    <div className="bg-gradient-to-br from-[#1e1b4b] to-[#0f172a] rounded-3xl p-8 md:p-16 border border-violet-500/20 flex flex-col md:flex-row items-center justify-between gap-12 shadow-2xl">
                        <div className="flex-1">
                            <h2 className="text-3xl md:text-4xl font-bold mb-4">¿Listo para dar el salto?</h2>
                            <p className="text-violet-200 mb-8 max-w-md">
                                Únete a cientos de negocios que ya modernizaron sus reservas y aumentaron sus ingresos.
                            </p>
                            <ul className="space-y-3 mb-8">
                                {benefits.map((b, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-300">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                        {b}
                                    </li>
                                ))}
                            </ul>
                            {user ? (
                                <Link
                                    to={dashboardPath}
                                    className="px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-all shadow-[0_0_30px_-5px_rgba(124,58,237,0.4)] inline-flex items-center gap-2"
                                >
                                    Volver al Sistema
                                    <ArrowRight className="w-5 h-5" />
                                </Link>
                            ) : (
                                <button
                                    onClick={() => setIsLeadModalOpen(true)}
                                    className="px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-all shadow-[0_0_30px_-5px_rgba(124,58,237,0.4)] inline-flex items-center gap-2"
                                >
                                    Obtener 14 Días Gratis
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                        <div className="hidden md:block w-72 shrink-0">
                            {/* Conceptual Illustration */}
                            <div className="w-full aspect-square rounded-full border-4 border-violet-500/20 border-dashed animate-[spin_20s_linear_infinite] relative">
                                <div className="absolute top-0 right-0 p-3 bg-[#0f172a] rounded-full border border-white/10 -mt-4 -mr-4">
                                    <CalendarDays className="w-8 h-8 text-violet-400" />
                                </div>
                                <div className="absolute bottom-0 left-0 p-3 bg-[#0f172a] rounded-full border border-white/10 -mb-4 -ml-4">
                                    <TrendingUp className="w-8 h-8 text-emerald-400" />
                                </div>
                                <div className="absolute inset-4 rounded-full border border-violet-500/10 flex items-center justify-center bg-violet-500/5">
                                    <div className="w-24 h-24 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-full blur-xl opacity-50"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="border-t border-white/10 bg-[#020817] py-16">
                <div className="container mx-auto max-w-7xl px-4 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex flex-col items-center md:items-start gap-4">
                        <div className="flex items-center gap-2 group">
                            <InfinityIcon className="h-7 w-7 text-violet-500" strokeWidth={2.5} />
                            <span className="text-2xl font-black tracking-tighter text-white">
                                Cita<span className="text-violet-500">Link</span>
                            </span>
                        </div>
                        <p className="text-slate-500 text-sm max-w-xs text-center md:text-left">
                            La plataforma que simplifica la administración de salones y clínicas, automatizando lo aburrido.
                        </p>
                    </div>

                    <div className="flex gap-6">
                        <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all">
                            <Facebook className="w-5 h-5" />
                        </a>
                        <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all">
                            <Instagram className="w-5 h-5" />
                        </a>
                        <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all">
                            <Twitter className="w-5 h-5" />
                        </a>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-2 text-sm text-slate-500">
                        <div className="flex gap-4 mb-2">
                            <a href="#" className="hover:text-white transition-colors">Términos del Servicio</a>
                            <span>&bull;</span>
                            <a href="#" className="hover:text-white transition-colors">Aviso de Privacidad</a>
                        </div>
                        <p>© {new Date().getFullYear()} CitaLink App. Todos los derechos reservados.</p>
                    </div>
                </div>
            </footer>

            {/* ─── LEAD CAPTURE MODAL ─── */}
            {isLeadModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !submitting && setIsLeadModalOpen(false)}></div>
                    <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 w-full max-w-lg relative z-10 animate-fade-in shadow-2xl max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setIsLeadModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/5 p-2 rounded-full"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-violet-500/10 rounded-lg">
                                <Sparkles className="w-6 h-6 text-violet-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Inicia tu Prueba Gratis</h2>
                        </div>
                        <p className="text-slate-400 mb-6">Disfruta la plataforma sin costo por 2 semanas. Te contactaremos pronto con tus accesos VIP.</p>

                        {leadSuccess ? (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center animate-fade-in">
                                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">¡Solicitud Enviada!</h3>
                                <p className="text-emerald-200">Nuestro equipo está preparando tu entorno. Recibirás un correo muy pronto.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleLeadSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Tu Nombre</label>
                                        <input required type="text" className="w-full bg-[#020817] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all" placeholder="Juan Pérez" value={formData.contactName} onChange={e => setFormData({ ...formData, contactName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Nombre del Negocio</label>
                                        <input required type="text" className="w-full bg-[#020817] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all" placeholder="Ej. Barbería Central" value={formData.businessName} onChange={e => setFormData({ ...formData, businessName: e.target.value })} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de Negocio</label>
                                        <select required className="w-full bg-[#020817] border border-white/10 rounded-xl px-4 py-2.5 text-slate-300 focus:outline-none focus:border-violet-500 transition-all" value={formData.businessType} onChange={e => setFormData({ ...formData, businessType: e.target.value })}>
                                            <option value="" disabled>Selecciona...</option>
                                            <option value="barbershop">Barbería</option>
                                            <option value="salon">Salón de Belleza</option>
                                            <option value="spa">Spa / Multiestética</option>
                                            <option value="clinic">Clínica / Consultorio</option>
                                            <option value="other">Otro</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Tamaño del Equipo</label>
                                        <select required className="w-full bg-[#020817] border border-white/10 rounded-xl px-4 py-2.5 text-slate-300 focus:outline-none focus:border-violet-500 transition-all" value={formData.employeeCount} onChange={e => setFormData({ ...formData, employeeCount: e.target.value })}>
                                            <option value="" disabled>Selecciona...</option>
                                            <option value="1">Solo yo (1)</option>
                                            <option value="2-4">2 a 4 empleados</option>
                                            <option value="5-10">5 a 10 empleados</option>
                                            <option value="10+">Más de 10 empleados</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Correo Electrónico</label>
                                    <input required type="email" className="w-full bg-[#020817] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all" placeholder="correo@ejemplo.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">WhatsApp de Contacto</label>
                                    <input required type="tel" className="w-full bg-[#020817] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all" placeholder="+52 81 0000 0000" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                </div>

                                <button
                                    disabled={submitting}
                                    type="submit"
                                    className="w-full mt-4 bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-violet-500/20 disabled:opacity-50"
                                >
                                    {submitting ? 'Enviando...' : 'Solicitar Acceso Ahora'}
                                </button>
                                <p className="text-center text-xs text-slate-500">Al enviar aceptas nuestros Términos de Servicio y Aviso de Privacidad.</p>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
