import { useStore } from '../lib/store';
import { Link } from 'react-router-dom';
import { CalendarDays, MessageCircle, Users, TrendingUp, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Landing() {
    const { user, isSuperAdmin } = useStore();

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
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
                                <CalendarDays className="text-white h-5 w-5" />
                            </div>
                            <span className="text-xl font-bold tracking-tight text-white">
                                CitaLink<span className="text-violet-500">.</span>
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
                                    <Link
                                        to="/login"
                                        className="px-5 py-2.5 text-sm rounded-full bg-violet-600 hover:bg-violet-500 text-white font-medium shadow-lg shadow-violet-500/25 transition-all"
                                    >
                                        Comienza Gratis
                                    </Link>
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
                        <Link
                            to={user ? dashboardPath : "/login"}
                            className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-slate-900 font-bold text-lg hover:bg-slate-200 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2"
                        >
                            {user ? 'Entrar a mi panel' : 'Crear cuenta gratis'}
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    </div>

                    {/* Dashboard Preview Mockup */}
                    <div className="mt-20 mx-auto max-w-5xl rounded-2xl md:rounded-[2.5rem] bg-[#0f172a] border border-white/10 shadow-2xl p-2 md:p-4 rotate-1 hover:rotate-0 transition-transform duration-500">
                        <div className="w-full aspect-video rounded-xl md:rounded-2xl bg-[#020817] border border-white/5 overflow-hidden flex flex-col">
                            {/* Fake Browser Header */}
                            <div className="h-10 bg-white/5 border-b border-white/5 flex items-center px-4 gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                                <div className="w-3 h-3 rounded-full bg-amber-400/80"></div>
                                <div className="w-3 h-3 rounded-full bg-emerald-400/80"></div>
                                <div className="mx-auto px-4 py-1 text-xs text-slate-500 bg-white/5 rounded-md hidden md:block">
                                    citalink.app/admin
                                </div>
                            </div>
                            {/* Fake Dashboard Content */}
                            <div className="flex-1 p-4 md:p-8 flex gap-6 opacity-80 pointer-events-none">
                                <div className="w-48 hidden md:flex flex-col gap-4">
                                    <div className="h-8 bg-white/10 rounded-md w-full"></div>
                                    <div className="h-4 bg-white/5 rounded-md w-3/4 mt-4"></div>
                                    <div className="h-4 bg-white/5 rounded-md w-5/6"></div>
                                    <div className="h-4 bg-white/5 rounded-md w-4/5"></div>
                                </div>
                                <div className="flex-1 flex flex-col gap-6">
                                    <div className="flex justify-between">
                                        <div className="h-8 bg-white/10 rounded-md w-48"></div>
                                        <div className="h-8 bg-violet-500/20 rounded-md w-32 border border-violet-500/30"></div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="h-24 bg-white/5 rounded-xl border border-white/10 p-4 flex flex-col justify-between">
                                                <div className="w-8 h-8 rounded-full bg-white/10"></div>
                                                <div className="h-4 bg-white/20 rounded w-1/2"></div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex-1 bg-white/5 border border-white/10 rounded-xl"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

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
                            <Link
                                to={user ? dashboardPath : "/login"}
                                className="px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-all shadow-[0_0_30px_-5px_rgba(124,58,237,0.4)] inline-flex items-center gap-2"
                            >
                                {user ? 'Volver al Sistema' : 'Comenzar a usar CitaLink'}
                                <ArrowRight className="w-5 h-5" />
                            </Link>
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

            {/* ─── FOOTER ─── */}
            <footer className="border-t border-white/10 bg-[#020817] py-12">
                <div className="container mx-auto max-w-7xl px-4 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2 opacity-80 text-white">
                        <CalendarDays className="h-5 w-5" />
                        <span className="font-bold tracking-tight">CitaLink.</span>
                    </div>
                    <p className="text-slate-500 text-sm">
                        © {new Date().getFullYear()} CitaLink App. Todos los derechos reservados.
                    </p>
                    <div className="flex gap-4 text-sm text-slate-500">
                        <a href="#" className="hover:text-white transition-colors">Términos</a>
                        <a href="#" className="hover:text-white transition-colors">Privacidad</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
