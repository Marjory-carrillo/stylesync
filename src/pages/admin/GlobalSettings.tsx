import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Activity, ShieldCheck, Database, Sliders, Save, RefreshCw, AlertCircle, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import { useStore } from '../../lib/store';

interface GlobalConfig {
    id: string;
    basic_plan_price: number;
    premium_plan_price: number;
    trial_days: number;
    maintenance_mode: boolean;
    system_email: string;
}

export default function GlobalSettings() {
    const { showToast } = useStore();
    const [config, setConfig] = useState<GlobalConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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
                // If it doesn't exist yet, we could insert it or just show an error.
                if (error.code === 'PGRST116') {
                    // Not found, likely needs the script
                    console.warn("Global config not found. Creating default...");
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

                    if (insertError) throw insertError;
                    setConfig(newData);
                } else {
                    throw error;
                }
            } else {
                setConfig(data);
            }
        } catch (error: any) {
            console.error('Error fetching global config:', error);
            showToast('Error al cargar configuración: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!config) return;

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
            showToast('Configuración global guardada exitosamente.', 'success');
        } catch (error: any) {
            console.error('Error saving global config:', error);
            showToast('Error al guardar: ' + error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="animate-fade-in flex flex-col gap-8 h-full pb-10">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl -z-10 animate-pulse-soft"></div>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl glass-card text-blue-400">
                        <Sliders size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">Ajustes Globales</h1>
                        <p className="text-sm text-slate-400 mt-1 font-medium tracking-wide">Configuración maestra del sistema CitaLink</p>
                    </div>
                </div>
                <button
                    onClick={fetchConfig}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition-all border border-white/5 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Recargar
                </button>
            </header>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            ) : !config ? (
                <div className="glass-panel p-8 text-center border-dashed border-2 border-white/10 rounded-2xl">
                    <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Error de Configuración</h3>
                    <p className="text-slate-400">No se pudo cargar la configuración de la tabla global_configs.</p>
                </div>
            ) : (
                <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Subscription & Plans */}
                    <div className="glass-panel p-8 rounded-3xl border border-white/10 flex flex-col gap-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full"></div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            <Activity className="text-emerald-400" size={24} />
                            Suscripciones y Pruebas
                        </h2>

                        <div className="space-y-5 relative z-10">
                            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
                                <label className="block text-sm font-semibold text-slate-300 mb-2">Precio Plan Básico (MXN)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:border-blue-500 font-medium"
                                        value={config.basic_plan_price}
                                        onChange={(e) => setConfig({ ...config, basic_plan_price: parseFloat(e.target.value) })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
                                <label className="block text-sm font-semibold text-slate-300 mb-2">Precio Plan Premium (MXN)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-black/20 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:border-blue-500 font-medium"
                                        value={config.premium_plan_price}
                                        onChange={(e) => setConfig({ ...config, premium_plan_price: parseFloat(e.target.value) })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
                                <label className="block text-sm font-semibold text-slate-300 mb-2">Días de Prueba Gratis (Trial)</label>
                                <input
                                    type="number"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 font-medium"
                                    value={config.trial_days}
                                    onChange={(e) => setConfig({ ...config, trial_days: parseInt(e.target.value) })}
                                    required
                                />
                                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 group">
                                    <Info size={12} /> Cambiar esto no afecta los trials actuales, solo los futuros.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - System Status & Communication */}
                    <div className="flex flex-col gap-8">
                        {/* Maintenance Mode */}
                        <div className="glass-panel p-8 rounded-3xl border border-white/10 relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-32 h-32 ${config.maintenance_mode ? 'bg-red-500/20' : 'bg-blue-500/10'} blur-3xl rounded-full transition-colors`}></div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-3 mb-6 relative z-10">
                                <ShieldCheck className={config.maintenance_mode ? 'text-red-400' : 'text-blue-400'} size={24} />
                                Estado del Sistema
                            </h2>

                            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 flex items-center justify-between relative z-10">
                                <div>
                                    <h4 className="font-bold text-white">Modo Mantenimiento</h4>
                                    <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Si se activa, los inquilinos no podrán agendar o modificar datos temporalmente.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setConfig({ ...config, maintenance_mode: !config.maintenance_mode })}
                                    className="focus:outline-none transition-transform hover:scale-105"
                                >
                                    {config.maintenance_mode ? (
                                        <ToggleRight className="w-12 h-12 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                    ) : (
                                        <ToggleLeft className="w-12 h-12 text-slate-600" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Communication */}
                        <div className="glass-panel p-8 rounded-3xl border border-white/10 relative overflow-hidden flex-1">
                            <h2 className="text-xl font-bold text-white flex items-center gap-3 mb-6 relative z-10">
                                <Database className="text-violet-400" size={24} />
                                Comunicación y Envío
                            </h2>

                            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 relative z-10">
                                <label className="block text-sm font-semibold text-slate-300 mb-2">Correo Transaccional (Sistema)</label>
                                <input
                                    type="email"
                                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 font-medium lowercase"
                                    value={config.system_email}
                                    onChange={(e) => setConfig({ ...config, system_email: e.target.value })}
                                    required
                                    placeholder="ejemplo@citalink.app"
                                />
                                <p className="text-xs text-slate-500 mt-2">Este correo aparecerá como remitente de las notificaciones oficiales.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full mt-8 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_30px_-5px_rgba(37,99,235,0.4)] disabled:opacity-50 relative z-10"
                            >
                                {saving ? (
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Save className="w-5 h-5" />
                                )}
                                Confirmar Todos los Ajustes
                            </button>
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
}
