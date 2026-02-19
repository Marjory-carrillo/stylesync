
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Mail, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

import { useStore } from '../lib/store';

export default function Login() {
    const { user } = useStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/admin');
        }
    }, [user, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (error) throw error;
            // Navigation will be handled by useEffect observing 'user' state
        } catch (err: any) {
            console.error('Login error:', err);
            setError('Credenciales incorrectas o error de conexión.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-white flex items-center justify-center p-4 relative overflow-hidden">

            {/* Ambient Background Effects */}
            <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-600/20 rounded-full blur-[128px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-purple-600/10 rounded-full blur-[128px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10 animate-fade-in">

                {/* Logo / Brand Area */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 mx-auto mb-6 transform rotate-3 hover:rotate-6 transition-transform duration-300">
                        <Lock size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent mb-2">
                        Admin Login
                    </h1>
                    <p className="text-slate-400">CitaLink Gestión</p>
                </div>

                {/* Login Card */}
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">

                    {/* Subtle border gradient on hover */}
                    <div className="absolute inset-0 rounded-3xl border border-white/0 group-hover:border-white/10 transition-colors pointer-events-none" />

                    <form onSubmit={handleLogin} className="space-y-6 relative z-10">

                        {/* Email Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300 ml-1">Email</label>
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-amber-400 transition-colors">
                                    <Mail size={18} />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                                    placeholder="tu@email.com"
                                    autoFocus
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300 ml-1">Contraseña</label>
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-amber-400 transition-colors">
                                    <Lock size={18} />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                                    placeholder="••••••••"
                                    required
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
                            className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all group/btn ${loading
                                ? 'bg-slate-700 cursor-not-allowed opacity-70'
                                : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 hover:scale-[1.02] shadow-orange-500/20'
                                }`}
                        >
                            {loading ? (
                                <><Loader2 className="animate-spin" size={18} /> Entrando...</>
                            ) : (
                                <>Entrar <ArrowRight size={18} className="group-hover/btn:translate-x-1 transition-transform" /></>
                            )}
                        </button>

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
