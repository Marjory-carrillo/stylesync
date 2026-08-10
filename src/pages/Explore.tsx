import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePublicTenants, type PublicTenant } from '../lib/store/queries/usePublicTenants';
import { supabase } from '../lib/supabaseClient';
import {
    Search, Store, MapPin, ArrowRight, Instagram, Facebook,
    X, ChevronLeft, Sparkles, Zap, ShieldCheck, Clock, ChevronDown,
    Compass, CheckCircle2, SlidersHorizontal, Star, Navigation
} from 'lucide-react';

function BusinessScheduleAccordion({ schedule }: { schedule?: any }) {
    const [isOpen, setIsOpen] = useState(false);

    const daysOrder = [
        { key: 'monday', label: 'lunes' },
        { key: 'tuesday', label: 'martes' },
        { key: 'wednesday', label: 'miércoles' },
        { key: 'thursday', label: 'jueves' },
        { key: 'friday', label: 'viernes' },
        { key: 'saturday', label: 'sábado' },
        { key: 'sunday', label: 'domingo' },
    ];

    const defaultSchedule = {
        monday: { open: true, start: '10:00', end: '20:00' },
        tuesday: { open: true, start: '10:00', end: '20:00' },
        wednesday: { open: true, start: '10:00', end: '20:00' },
        thursday: { open: true, start: '10:00', end: '20:00' },
        friday: { open: true, start: '10:00', end: '20:00' },
        saturday: { open: true, start: '10:00', end: '18:00' },
        sunday: { open: false, start: '10:00', end: '18:00' },
    };

    const currentSchedule = schedule || defaultSchedule;

    const now = new Date();
    const jsDay = now.getDay();
    const dayKeysMap: Record<number, string> = {
        0: 'sunday',
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday',
    };
    const todayKey = dayKeysMap[jsDay] || 'monday';
    const todayData = currentSchedule[todayKey] || { open: false, start: '10:00', end: '20:00' };

    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const isOpenNow = todayData.open && currentHHMM >= todayData.start && currentHHMM <= todayData.end;

    return (
        <div className="bg-slate-950/70 border border-white/10 rounded-xl p-3 space-y-2 transition-all my-1">
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="w-full flex items-center justify-between text-xs font-medium text-slate-200 hover:text-white transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Clock size={15} className={isOpenNow ? 'text-emerald-400' : 'text-amber-400'} />
                    {isOpenNow ? (
                        <span>
                            <strong className="text-emerald-400 font-bold">Abierto</strong> hasta las {todayData.end}
                        </span>
                    ) : (
                        <span>
                            <strong className="text-slate-400 font-bold">Cerrado</strong>
                            {todayData.open && currentHHMM < todayData.start
                                ? ` · Abre a las ${todayData.start}`
                                : ''}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1 text-slate-400 hover:text-white">
                    <ChevronDown size={15} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isOpen && (
                <div className="pt-2 border-t border-white/10 space-y-1.5 text-xs animate-fade-in">
                    {daysOrder.map((dayItem) => {
                        const dayData = currentSchedule[dayItem.key] || { open: false, start: '10:00', end: '20:00' };
                        const isToday = dayItem.key === todayKey;

                        return (
                            <div
                                key={dayItem.key}
                                className={`flex items-center justify-between py-1 px-2 rounded-lg transition-colors ${
                                    isToday ? 'bg-white/10 font-bold text-white' : 'text-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`w-2 h-2 rounded-full ${
                                            dayData.open ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-500'
                                        }`}
                                    />
                                    <span className="capitalize">{dayItem.label}</span>
                                </div>
                                <span className={dayData.open ? 'font-mono text-slate-200 font-semibold' : 'text-slate-500 italic'}>
                                    {dayData.open ? `${dayData.start} - ${dayData.end}` : 'Cerrado'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function Explore() {
    const [directorySearch, setDirectorySearch] = useState('');
    const [directoryCategory, setDirectoryCategory] = useState('all');
    const { data: publicTenants = [], isLoading: loadingTenants } = usePublicTenants(directorySearch, directoryCategory);

    // Registrar los términos de búsqueda más frecuentes (debounced a 1.5s)
    useEffect(() => {
        const query = directorySearch.trim();
        if (query.length < 3) return;

        const timer = setTimeout(async () => {
            try {
                await supabase.from('marketplace_searches').insert({
                    search_term: query,
                });
            } catch (e) {
                // Captura silenciosa si aún no existe la tabla
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [directorySearch]);

    return (
        <div className="min-h-screen bg-[#030712] text-white selection:bg-emerald-500 selection:text-black relative overflow-hidden font-sans">
            {/* ═══════════ CYBER / FUTURISTIC AMBIENT LIGHTING ═══════════ */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-emerald-600/20 via-cyan-600/15 to-transparent blur-[160px] pointer-events-none rounded-full" />
            <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-violet-600/15 blur-[150px] pointer-events-none rounded-full" />
            <div className="absolute bottom-10 -left-40 w-[600px] h-[600px] bg-teal-500/10 blur-[180px] pointer-events-none rounded-full" />

            {/* Cyber Grid Lines */}
            <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(#10b981 1px, transparent 1px), linear-gradient(90deg, #10b981 1px, transparent 1px)',
                    backgroundSize: '48px 48px'
                }}
            />

            {/* ═══════════ HEADER ═══════════ */}
            <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#030712]/90 border-b border-white/10 px-4 py-4">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <Link
                        to="/"
                        className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 font-bold text-xs sm:text-sm transition-all group self-start sm:self-auto"
                    >
                        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span>Regresar a CitaLink</span>
                    </Link>

                    {/* Logo Center */}
                    <div className="flex items-center justify-center gap-3">
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-500 blur-md opacity-40 group-hover:opacity-100 transition-opacity rounded-full" />
                                <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400 relative z-10" />
                            </div>
                            <span className="text-xl sm:text-2xl font-black tracking-tighter text-white">
                                CITA<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">LINK</span>
                            </span>
                        </Link>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            MARKETPLACE LIVE
                        </span>
                    </div>
                </div>
            </header>

            {/* ═══════════ MAIN CONTENT ═══════════ */}
            <main className="max-w-7xl mx-auto px-4 py-8 sm:py-16 relative z-10">

                {/* Hero Title Section */}
                <div className="text-center max-w-4xl mx-auto mb-10 sm:mb-14">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/15 via-cyan-500/15 to-violet-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] sm:text-xs font-black uppercase tracking-widest mb-6 shadow-[0_0_30px_rgba(16,185,129,0.15)] backdrop-blur-md">
                        <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                        DIRECTORIO INTERACTIVO DE CITAS EN TIEMPO REAL
                    </div>

                    <h1 className="text-3xl sm:text-6xl md:text-7xl font-black text-white tracking-tighter mb-4 sm:mb-6 leading-[1.05] sm:leading-[0.95]">
                        Encuentra y agenda tu cita{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 drop-shadow-[0_0_35px_rgba(16,185,129,0.4)]">
                            en segundos.
                        </span>
                    </h1>

                    <p className="text-slate-300 text-sm sm:text-xl max-w-2xl mx-auto font-normal leading-relaxed">
                        Explora barberías, salones de uñas, spas y clínicas cerca de ti. Selecciona tu profesional y confirma sin llamadas ni esperas.
                    </p>

                    {/* Stats Ticker */}
                    <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-12 mt-8 pt-8 border-t border-white/10 text-slate-400 text-xs sm:text-sm font-semibold">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Negocios Verificados</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                            <span>Confirmación Inmediata</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Sin Cargos Ocultos</span>
                        </div>
                    </div>
                </div>

                {/* ═══════════ FUTURISTIC SEARCH & FILTERS ═══════════ */}
                <div className="max-w-4xl mx-auto mb-12 sm:mb-16 space-y-6">
                    {/* Glowing Search Box */}
                    <div className="relative group">
                        {/* Glow effect behind search */}
                        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 opacity-30 group-hover:opacity-70 blur-xl transition-all duration-500" />

                        <div className="relative flex items-center bg-[#0b1329]/90 border border-white/20 rounded-2xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
                            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400 ml-1 shrink-0">
                                <Search className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar por ciudad (ej. Palmares), servicio (ej. Corte, Uñas) o nombre..."
                                className="w-full bg-transparent px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-slate-500 focus:outline-none text-sm sm:text-base font-semibold"
                                value={directorySearch}
                                onChange={(e) => setDirectorySearch(e.target.value)}
                            />
                            {directorySearch && (
                                <button
                                    onClick={() => setDirectorySearch('')}
                                    className="p-2.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl mr-2 transition-colors shrink-0"
                                >
                                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                            <span className="flex items-center gap-1.5">
                                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                                Categorías Destacadas
                            </span>
                            <span>{publicTenants.length} Negocios</span>
                        </div>

                        <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-2.5 flex-wrap">
                            {[
                                { id: 'all', label: 'Ver Todos', icon: '✨' },
                                { id: 'barbershop', label: 'Barberías', icon: '✂️' },
                                { id: 'nail_bar', label: "Uñas & Nail's", icon: '💅' },
                                { id: 'beauty_salon', label: 'Salones de Belleza', icon: '💇‍♀️' },
                                { id: 'spa', label: 'Spas & Estética', icon: '🧘‍♀️' },
                                { id: 'clinic', label: 'Clínicas', icon: '🩺' },
                            ].map((cat) => {
                                const isActive = directoryCategory === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => setDirectoryCategory(cat.id)}
                                        className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-1.5 ${
                                            isActive
                                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-black font-black shadow-[0_0_25px_rgba(16,185,129,0.4)] scale-105'
                                                : 'bg-[#0f172a]/80 border border-white/10 text-slate-300 hover:border-emerald-500/40 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <span>{cat.icon}</span>
                                        <span>{cat.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ═══════════ FUTURISTIC BUSINESS CARDS GRID ═══════════ */}
                {loadingTenants ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                            <div key={n} className="bg-[#0b1329]/60 p-7 rounded-3xl border border-white/10 animate-pulse space-y-4">
                                <div className="flex justify-between items-center">
                                    <div className="w-16 h-16 rounded-2xl bg-white/10" />
                                    <div className="w-20 h-6 rounded-full bg-white/10" />
                                </div>
                                <div className="h-6 bg-white/10 rounded-lg w-3/4" />
                                <div className="h-4 bg-white/10 rounded-lg w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : publicTenants.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {publicTenants.map((t: PublicTenant) => (
                            <div
                                key={t.id}
                                className="group relative bg-[#0b1329] rounded-[2rem] border border-white/10 hover:border-emerald-400/60 transition-all duration-300 flex flex-col justify-between hover:-translate-y-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] hover:shadow-[0_25px_60px_-10px_rgba(16,185,129,0.3)] overflow-hidden"
                            >
                                {/* ── Top Cover Image Banner Header ── */}
                                <div className="relative h-56 w-full overflow-hidden bg-[#0b1329]">
                                    <img
                                        src={t.coverUrl}
                                        alt={t.name}
                                        className="w-full h-full object-cover brightness-100 transition-opacity duration-300"
                                    />
                                    {/* Top subtle vignette for top badges readability */}
                                    <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
                                    {/* Bottom smooth gradient transition sitting strictly at the lower edge */}
                                    <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-[#0b1329] to-transparent pointer-events-none" />

                                    {/* Top Badges */}
                                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
                                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/20 text-emerald-400 shadow-lg flex items-center gap-1">
                                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                            <span>4.9</span>
                                            <span className="text-slate-400 font-normal">(Verificado)</span>
                                        </span>

                                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                                            {t.category === 'barbershop' ? 'BARBERÍA' :
                                             t.category === 'nail_bar' ? "NAIL'S" :
                                             t.category === 'beauty_salon' ? 'SALÓN' :
                                             t.category === 'spa' ? 'SPA' : 'CLÍNICA'}
                                        </span>
                                    </div>
                                </div>

                                {/* ── Card Body with Floating Avatar ── */}
                                <div className="p-6 pt-0 space-y-4 relative z-10 -mt-14">
                                    {/* Overlapping Avatar Logo + Availability Indicator */}
                                    <div className="flex items-end justify-between gap-4">
                                        <div className="relative">
                                            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 blur-md opacity-40 group-hover:opacity-100 transition-opacity" />
                                            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-[#0b1329] border-2 border-white/20 shrink-0 flex items-center justify-center shadow-2xl">
                                                {t.logoUrl ? (
                                                    <img src={t.logoUrl} alt={t.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Store className="w-9 h-9 text-emerald-400" />
                                                )}
                                            </div>
                                        </div>

                                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30 backdrop-blur-md shadow-md mb-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                            Citas Disponibles
                                        </span>
                                    </div>

                                    {/* Name & Address */}
                                    <div className="space-y-1 pt-1">
                                        <h3 className="text-2xl font-black text-white group-hover:text-emerald-300 transition-colors tracking-tight leading-tight">
                                            {t.name}
                                        </h3>
                                        {t.address && (
                                            <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                                                <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5 min-w-0 flex-1">
                                                    <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                    <span className="truncate">{t.address}</span>
                                                </p>
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.name + ' ' + t.address)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 hover:text-white px-2.5 py-1 rounded-lg transition-all shrink-0 uppercase tracking-wider shadow-sm"
                                                    title="Abrir ubicación en Google Maps"
                                                >
                                                    <Navigation className="w-3 h-3" />
                                                    <span>Cómo llegar</span>
                                                </a>
                                            </div>
                                        )}
                                    </div>



                                    {/* Description */}
                                    {t.description ? (
                                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed font-normal bg-slate-950/60 p-3 rounded-xl border border-white/5">
                                            {t.description}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic bg-slate-950/40 p-3 rounded-xl border border-white/5">
                                            Servicios profesionales con agendamiento inmediato en línea.
                                        </p>
                                    )}

                                    {/* Collapsible Business Hours Accordion (Contraído por defecto) */}
                                    <BusinessScheduleAccordion schedule={t.schedule} />
                                </div>

                                {/* ── Footer Card: Social Links + Glowing Action Button ── */}
                                <div className="p-6 pt-4 border-t border-white/10 flex items-center justify-between gap-3 relative z-10 bg-slate-950/40">
                                    {/* Social Icons */}
                                    <div className="flex items-center gap-2">
                                        {t.instagramUrl && (
                                            <a
                                                href={t.instagramUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 rounded-xl bg-white/5 hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/30 text-slate-400 hover:text-pink-400 transition-all"
                                                title="Instagram"
                                            >
                                                <Instagram className="w-4 h-4" />
                                            </a>
                                        )}
                                        {t.facebookUrl && (
                                            <a
                                                href={t.facebookUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 rounded-xl bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30 text-slate-400 hover:text-blue-400 transition-all"
                                                title="Facebook"
                                            >
                                                <Facebook className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>

                                    {/* Glowing Action Button */}
                                    <Link
                                        to={`/reserva/${t.slug}?source=marketplace`}
                                        className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:brightness-125 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all group-hover:scale-105 shrink-0"
                                    >
                                        <span>Reservar Cita</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Futuristic Empty State */
                    <div className="text-center py-20 px-8 bg-gradient-to-b from-[#0b1329] to-[#050c1e] rounded-[2.5rem] border border-white/10 max-w-2xl mx-auto space-y-6 shadow-2xl relative overflow-hidden">
                        <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                            <Compass className="w-10 h-10 animate-spin-slow" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-white">No encontramos negocios con esos criterios</h3>
                            <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                                Intenta buscando con otra palabra clave o ciudad. Si eres dueño de un negocio, únete a CitaLink para aparecer aquí.
                            </p>
                        </div>
                        <div className="pt-2">
                            <Link
                                to="/create-business"
                                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-125 text-black font-black text-sm uppercase tracking-wider transition-all inline-flex items-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                            >
                                Registrar mi negocio <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
