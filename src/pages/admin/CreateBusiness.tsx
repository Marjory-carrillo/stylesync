
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store as StoreIcon, ArrowRight, Check, Scissors, Sparkles, Flower2, Dog, Briefcase, Globe, MapPin, Building2, Loader2 } from 'lucide-react';
import { useStore } from '../../lib/store';

export default function CreateBusiness() {
    const { createTenant, user } = useStore();
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [address, setAddress] = useState('');
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const CATEGORIES = [
        { id: 'barbershop', label: 'Barbería', icon: Scissors, desc: 'Cortes, barba y estilo masculino.' },
        { id: 'beauty_salon', label: 'Salón de Belleza', icon: Sparkles, desc: 'Cabello, uñas, maquillaje.' },
        { id: 'spa', label: 'Spa & Wellness', icon: Flower2, desc: 'Masajes, relax y tratamientos.' },
        { id: 'pet_grooming', label: 'Peluquería Canina', icon: Dog, desc: 'Estética y cuidado de mascotas.' },
        { id: 'consulting', label: 'Consultorio', icon: Briefcase, desc: 'Citas médicas, legales o coaching.' },
        { id: 'other', label: 'Otro Negocio', icon: StoreIcon, desc: 'Cualquier otro servicio con citas.' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        setError('');

        if (!slug.match(/^[a-z0-9-]+$/)) {
            setError('El Link solo puede contener letras minúsculas, números y guiones.');
            setLoading(false);
            return;
        }

        if (!category) {
            setError('Por favor selecciona el tipo de negocio.');
            setLoading(false);
            return;
        }

        const res = await createTenant(name, slug, address, category);

        if (res.success) {
            // Optional: Add a small delay for "success" animation
            setTimeout(() => navigate('/admin'), 1000);
        } else {
            setError(res.error || 'Error al crear el negocio.');
            setLoading(false);
        }
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setName(val);
        const autoSlug = val.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
        setSlug(autoSlug);
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                <Loader2 className="animate-spin mr-2" /> Cargando usuario...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-white flex items-center justify-center p-4 md:p-8 relative overflow-hidden">

            {/* Ambient Background Effects */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[128px] pointer-events-none" />

            <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center relative z-10 animate-fade-in">

                {/* Left Side: Welcome & Value Prop */}
                <div className="hidden md:block space-y-6 pr-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-8">
                        <StoreIcon size={32} className="text-white" />
                    </div>

                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        Lanza tu negocio al siguiente nivel.
                    </h1>

                    <p className="text-lg text-slate-400 leading-relaxed">
                        Crea tu espacio digital en segundos. Agenda, clientes y recordatorios automáticos en una sola plataforma diseñada para crecer contigo.
                    </p>

                    <div className="space-y-4 pt-4">
                        <div className="flex items-center gap-3 text-slate-300">
                            <div className="p-2 rounded-full bg-white/5 border border-white/10"><Globe size={18} className="text-blue-400" /></div>
                            <span>Tu propia página web de reservas</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-300">
                            <div className="p-2 rounded-full bg-white/5 border border-white/10"><Check size={18} className="text-emerald-400" /></div>
                            <span>Recordatorios automáticos por WhatsApp</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-300">
                            <div className="p-2 rounded-full bg-white/5 border border-white/10"><Check size={18} className="text-purple-400" /></div>
                            <span>Gestión de equipo y comisiones</span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Form Card */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                    <div className="text-center md:text-left mb-8 md:hidden">
                        <h2 className="text-2xl font-bold text-white">Crear mi Negocio</h2>
                        <p className="text-slate-400 text-sm">Configura tu espacio en StyleSync</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Name Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300 ml-1">Nombre del Negocio</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
                                    <Building2 size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={handleNameChange}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                    placeholder="Ej. Barbería El Corte"
                                    required
                                />
                            </div>
                        </div>

                        {/* Slug Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300 ml-1">Tu Enlace Personalizado</label>
                            <div className="relative group">
                                <div className="flex items-center bg-slate-950/50 border border-white/10 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500/50 transition-all">
                                    <div className="bg-white/5 border-r border-white/10 px-3 py-3 text-slate-400 text-sm font-medium select-none">
                                        stylesync.app/
                                    </div>
                                    <input
                                        type="text"
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value)}
                                        className="w-full bg-transparent border-none py-3 px-3 text-white placeholder-slate-600 focus:ring-0"
                                        placeholder="tu-negocio"
                                        required
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 ml-1">Así te encontrarán tus clientes en internet.</p>
                        </div>

                        {/* Category Grid */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-300 ml-1">¿Cuál es tu rubro?</label>
                            <div className="grid grid-cols-2 gap-3">
                                {CATEGORIES.map((cat) => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setCategory(cat.id)}
                                        className={`p-3 rounded-xl border text-left transition-all duration-200 flex flex-col gap-2 relative overflow-hidden group ${category === cat.id
                                                ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_15px_rgba(37,99,235,0.2)]'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        <cat.icon size={20} className={category === cat.id ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'} />
                                        <span className={`text-sm font-medium ${category === cat.id ? 'text-white' : 'text-slate-300'}`}>
                                            {cat.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Address Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300 ml-1">Dirección (Opcional)</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
                                    <MapPin size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                    placeholder="Calle Principal 123, Ciudad"
                                />
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 animate-shake">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all mt-4 ${loading
                                    ? 'bg-slate-700 cursor-not-allowed opacity-70'
                                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 hover:scale-[1.02] shadow-blue-600/20'
                                }`}
                        >
                            {loading ? (
                                <><Loader2 className="animate-spin" size={20} /> Creando tu espacio...</>
                            ) : (
                                <>Crear Negocio <ArrowRight size={20} /></>
                            )}
                        </button>

                    </form>
                </div>
            </div>
        </div>
    );
}
