import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ArrowRight, Loader2, Lock, Infinity as InfinityIcon } from 'lucide-react';

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Verificar si hay un evento de recuperación de contraseña (recovery)
        // en la URL (Supabase inserta el access_token en el hash)
        supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                // Todo bien, el usuario está listo para cambiar la contraseña
            }
        });
    }, []);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== passwordConfirm) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            setSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 3000);

        } catch (err: any) {
            console.error('Reset error:', err);
            setError(err.message || 'Error al actualizar la contraseña.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-bg)] text-white flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background Effects */}
            <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-[var(--color-accent)]/20 rounded-full blur-[128px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-[var(--color-primary)]/10 rounded-full blur-[128px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10 animate-fade-in">
                <div className="text-center mb-8">
                    <div className="mx-auto mb-6 flex items-center justify-center">
                        <div className="relative flex items-center justify-center w-16 h-16 group">
                            <div className="absolute inset-0 bg-violet-500 blur-xl opacity-40 rounded-full"></div>
                            <InfinityIcon className="w-16 h-16 text-violet-400 relative z-10" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2">
                        Nueva Contraseña
                    </h1>
                    <p className="text-slate-400 text-sm">Crea una nueva contraseña para tu cuenta</p>
                </div>

                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                    {success ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 mx-auto rounded-full flex items-center justify-center mb-4">
                                <Lock size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">¡Contraseña Actualizada!</h2>
                            <p className="text-sm text-slate-400">Podrás entrar con tu nueva clave.</p>
                            <p className="text-xs text-slate-500 mt-4 animate-pulse">Redirigiendo al login...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Nueva Contraseña</label>
                                <div className="relative group/input">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-amber-400 transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                                        placeholder="••••••••"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300 ml-1">Confirmar Contraseña</label>
                                <div className="relative group/input">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-amber-400 transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        value={passwordConfirm}
                                        onChange={(e) => setPasswordConfirm(e.target.value)}
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 animate-shake">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${loading
                                    ? 'bg-slate-700 cursor-not-allowed opacity-70'
                                    : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 hover:scale-[1.02] shadow-orange-500/20'
                                    }`}
                            >
                                {loading ? (
                                    <><Loader2 className="animate-spin" size={18} /> Guardando...</>
                                ) : (
                                    <>Guardar Contraseña <ArrowRight size={18} /></>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
