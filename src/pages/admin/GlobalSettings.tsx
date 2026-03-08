import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Activity, ShieldCheck, Database, Sliders, Save, RefreshCw, AlertCircle, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import { useUIStore } from '../../lib/store/uiStore';
import { z } from 'zod';

// Esquema de validación con Zod
const globalConfigSchema = z.object({
    basic_plan_price: z.number().min(0, 'El precio no puede ser negativo').max(100000, 'El precio parece excesivo'),
    premium_plan_price: z.number().min(0, 'El precio no puede ser negativo').max(100000, 'El precio parece excesivo'),
    trial_days: z.number().int().min(0, 'Los días de prueba no pueden ser negativos').max(365, 'El período de prueba no puede exceder 1 año'),
    maintenance_mode: z.boolean(),
    system_email: z.string().email('Debe ser un correo electrónico válido').min(1, 'El correo es requerido'),
});

type GlobalConfigValidation = z.infer<typeof globalConfigSchema>;

interface GlobalConfig extends GlobalConfigValidation {
    id: string;
}

interface ValidationErrors {
    basic_plan_price?: string;
    premium_plan_price?: string;
    trial_days?: string;
    system_email?: string;
}

export default function GlobalSettings() {
    const { showToast } = useUIStore();
    const [config, setConfig] = useState<GlobalConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('global_configs')
                .select('*')
                .eq('id', 'main')
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    const defaultConf = {
                        id: 'main',
                        basic_plan_price: 499.00,
                        premium_plan_price: 999.00,
                        trial_days: 14,
                        maintenance_mode: false,
                        system_email: 'soporte@citalink.app'
                    };
                    const { data: newData, error: insertError } = await supabase
                        .from('global_configs')
                        .upsert([defaultConf])
                        .select()
                        .single();

                    if (insertError) {
                        showToast('Error al inicializar configuración', 'error');
                        return;
                    }
                    setConfig(newData);
                } else {
                    throw error;
                }
            } else {
                setConfig(data);
            }
        } catch (error: any) {
            showToast('Error al cargar configuración', 'error');
        } finally {
            setLoading(false);
        }
    };

    const validateConfig = (configToValidate: GlobalConfig): ValidationErrors => {
        const result = globalConfigSchema.safeParse(configToValidate);
        if (!result.success) {
            const formattedErrors: ValidationErrors = {};
            result.error.issues.forEach((issue) => {
                const path = issue.path[0] as keyof ValidationErrors;
                formattedErrors[path] = issue.message;
            });
            return formattedErrors;
        }
        return {};
    };

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!config) return;

        const validationErrors = validateConfig(config);
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            showToast('Revisa los campos marcados', 'error');
            return;
        }

        try {
            setSaving(true);
            const { error } = await supabase
                .from('global_configs')
                .update({
                    basic_plan_price: config.basic_plan_price,
                    premium_plan_price: config.premium_plan_price,
                    trial_days: config.trial_days,
                    maintenance_mode: config.maintenance_mode,
                    system_email: config.system_email,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 'main');

            if (error) throw error;
            showToast('Configuración actualizada exitosamente', 'success');
        } catch (error: any) {
            showToast('Error al guardar cambios', 'error');
        } finally {
            setSaving(false);
            setShowConfirmModal(false);
        }
    };

    const handleToggleMaintenance = () => {
        if (!config) return;

        const newValue = !config.maintenance_mode;

        if (newValue) {
            setShowConfirmModal(true);
        } else {
            setConfig({ ...config, maintenance_mode: false });
        }
    };

    return (
        <div className="animate-fade-in flex flex-col gap-8 h-full pb-10">
            {/* Maintenance Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in" onClick={() => setShowConfirmModal(false)}></div>
                    <div className="relative w-full max-w-md bg-[#161b22] border border-white/10 rounded-[2rem] p-8 shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)] animate-scale-up overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-amber-500 to-red-500"></div>
                        <div className="flex flex-col items-center text-center">
                            <div className="w-20 h-20 mb-6 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                                <AlertCircle size={40} className="animate-pulse" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">¿ESTÁS SEGURO?</h3>
                            <p className="text-slate-400 leading-relaxed mb-8">
                                El <span className="text-red-400 font-bold italic">Modo Mantenimiento</span> impedirá que <span className="text-white font-semibold">TODOS</span> los usuarios accedan a la plataforma. Solo los Super Admins podrán entrar.
                            </p>

                            <div className="grid grid-cols-2 gap-4 w-full">
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="py-4 px-6 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold transition-all"
                                >
                                    CANCELAR
                                </button>
                                <button
                                    onClick={() => {
                                        setConfig(prev => prev ? { ...prev, maintenance_mode: true } : null);
                                        setShowConfirmModal(false);
                                    }}
                                    className="py-4 px-6 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow-lg shadow-red-900/40"
                                >
                                    ACTIVAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative">
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] -z-10"></div>
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-white/10 rounded-[1.5rem] glass-card text-blue-400 shadow-[0_8px_32px_rgba(37,99,235,0.15)] group hover:scale-105 transition-transform duration-500">
                        <Sliders size={32} className="group-hover:rotate-12 transition-transform" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Ajustes Globales</h1>
                        <p className="text-sm text-slate-400 mt-1 font-bold tracking-[0.2em] uppercase opacity-60">Control Maestro CitaLink HQ</p>
                    </div>
                </div>
                <button
                    onClick={fetchConfig}
                    disabled={loading}
                    className="group flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl transition-all border border-white/5 hover:border-white/20 disabled:opacity-50 font-bold tracking-wider"
                >
                    <RefreshCw className={`w-5 h-5 transition-transform duration-700 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                    SINCRONIZAR
                </button>
            </header>

            {loading ? (
                <div className="flex flex-col justify-center items-center h-[50vh] gap-4">
                    <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-black tracking-widest animate-pulse">CARGANDO NÚCLEO...</p>
                </div>
            ) : !config ? (
                <div className="glass-panel p-12 text-center border-dashed border-2 border-white/10 rounded-[2.5rem] bg-red-500/5">
                    <AlertCircle className="w-16 h-16 text-red-500/50 mx-auto mb-6" />
                    <h3 className="text-2xl font-black text-white mb-2 uppercase italic">Fallo Crítico de Conexión</h3>
                    <p className="text-slate-400 max-w-md mx-auto">No se pudo establecer comunicación con el motor de configuración global. Verifica los permisos de Supabase.</p>
                </div>
            ) : (
                <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Left Column - Pricing */}
                    <div className="group relative glass-panel p-10 rounded-[2.5rem] border border-white/10 hover:border-emerald-500/30 transition-all duration-500 flex flex-col gap-8 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/10 blur-[80px] rounded-full group-hover:bg-emerald-600/20 transition-colors duration-700"></div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-4 relative z-10 italic">
                            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                                <Activity size={24} />
                            </div>
                            ESTRUCTURA DE PRECIOS
                        </h2>

                        <div className="space-y-6 relative z-10">
                            <div className="group/input space-y-3">
                                <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest ml-1">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                    Plan Básico (Mensual)
                                </label>
                                <div className="relative group/field">
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-500 font-black text-xl group-focus-within/field:text-emerald-400 transition-colors">
                                        <span className="mt-0.5">$</span>
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={`w-full bg-white/5 border rounded-2xl pl-10 pr-6 py-5 text-2xl text-white font-black focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-700 ${errors.basic_plan_price ? 'border-red-500/50 ring-red-500/5' : 'border-white/10 group-hover/field:border-white/20 focus:border-emerald-500/40'}`}
                                        value={config.basic_plan_price}
                                        onChange={(e) => setConfig({ ...config, basic_plan_price: parseFloat(e.target.value) })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="group/input space-y-3">
                                <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest ml-1">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                    Plan Premium (Mensual)
                                </label>
                                <div className="relative group/field">
                                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-500 font-black text-xl group-focus-within/field:text-emerald-400 transition-colors">
                                        <span className="mt-0.5">$</span>
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={`w-full bg-white/5 border rounded-2xl pl-10 pr-6 py-5 text-2xl text-white font-black focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all ${errors.premium_plan_price ? 'border-red-500/50 ring-red-500/5' : 'border-white/10 group-hover/field:border-white/20 focus:border-emerald-500/40'}`}
                                        value={config.premium_plan_price}
                                        onChange={(e) => setConfig({ ...config, premium_plan_price: parseFloat(e.target.value) })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="group/input space-y-3">
                                <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest ml-1">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                    Período de Prueba Gratis
                                </label>
                                <div className="relative group/field flex items-center">
                                    <input
                                        type="number"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-xl text-white font-black focus:outline-none focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                                        value={config.trial_days}
                                        onChange={(e) => setConfig({ ...config, trial_days: parseInt(e.target.value) })}
                                        required
                                    />
                                    <div className="absolute right-5 text-xs font-black text-emerald-500 tracking-[0.2em] uppercase">DÍAS</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Status & Comm */}
                    <div className="flex flex-col gap-8">
                        {/* Maintenance Mode Card */}
                        <div className={`group relative glass-panel p-10 rounded-[2.5rem] border transition-all duration-700 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] ${config.maintenance_mode ? 'border-red-500/40' : 'border-white/10 hover:border-blue-500/30'}`}>
                            <div className={`absolute top-0 right-0 w-64 h-64 blur-[80px] rounded-full transition-colors duration-700 ${config.maintenance_mode ? 'bg-red-600/20' : 'bg-blue-600/10 group-hover:bg-blue-600/20'}`}></div>

                            <div className="relative z-10 flex items-center justify-between gap-6">
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-black text-white flex items-center gap-4 italic uppercase tracking-tighter">
                                        <div className={`p-2 rounded-xl border transition-colors ${config.maintenance_mode ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                                            <ShieldCheck size={24} />
                                        </div>
                                        Modo Operativo
                                    </h2>
                                    <p className="text-slate-400 font-medium leading-relaxed max-w-[280px] text-sm italic">
                                        Activa el bloqueo maestro para realizar tareas críticas. Úsalo con cautela.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleToggleMaintenance}
                                    className="focus:outline-none group/toggle active:scale-95 transition-transform"
                                >
                                    {config.maintenance_mode ? (
                                        <ToggleRight size={64} className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)] animate-pulse" />
                                    ) : (
                                        <ToggleLeft size={64} className="text-slate-700 hover:text-slate-600 opacity-60 hover:opacity-100 transition-all" />
                                    )}
                                </button>
                            </div>

                            {config.maintenance_mode && (
                                <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl relative z-10 animate-bounce-slow">
                                    <p className="text-red-400 text-xs font-black uppercase text-center tracking-[0.2em]">⚠️ MANTENIMIENTO ACTIVO ⚠️</p>
                                </div>
                            )}
                        </div>

                        {/* System Communication */}
                        <div className="group relative glass-panel p-10 rounded-[2.5rem] border border-white/10 hover:border-violet-500/30 transition-all duration-500 flex flex-col gap-6 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[80px] rounded-full group-hover:bg-violet-600/20 transition-colors duration-700"></div>

                            <h2 className="text-xl font-black text-white flex items-center gap-4 relative z-10 italic">
                                <div className="p-2 bg-violet-500/10 rounded-xl border border-violet-500/20 text-violet-400">
                                    <Database size={24} />
                                </div>
                                COMUNICACIÓN MAESTRA
                            </h2>

                            <div className="space-y-3 relative z-10">
                                <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest ml-1">
                                    Correo Oficial del Sistema
                                </label>
                                <input
                                    type="email"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-violet-500/40 transition-all placeholder:opacity-20"
                                    value={config.system_email}
                                    onChange={(e) => setConfig({ ...config, system_email: e.target.value.toLowerCase() })}
                                    required
                                    placeholder="ej. noreply@citalink.app"
                                />
                                <div className="flex items-start gap-2 p-4 bg-white/5 rounded-2xl border border-white/5 mt-4">
                                    <Info size={16} className="text-violet-400 shrink-0 mt-0.5" />
                                    <p className="text-[10px] uppercase font-black tracking-widest leading-relaxed text-slate-500">
                                        Este dirección es el núcleo de las notificaciones automáticas y recuperación de cuentas.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full mt-4 group/save flex items-center justify-center gap-3 bg-gradient-to-r from-blue-700 to-violet-700 hover:from-blue-600 hover:to-violet-600 text-white font-black py-5 rounded-2xl transition-all shadow-2xl shadow-blue-900/40 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 relative z-10 tracking-[0.2em] text-sm"
                            >
                                {saving ? (
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        GUARDAR NÚCLEO
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
}
