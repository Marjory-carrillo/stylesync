import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Paintbrush, Save, AlertCircle, RefreshCw } from 'lucide-react';
import { useStore } from '../../lib/store';

interface BrandingTheme {
    id: string;
    category: string;
    primary_hue: string;
    accent_hue: string;
    secondary_hue: string;
    display_name: string;
}

export default function Branding() {
    const { showToast } = useStore();
    const [themes, setThemes] = useState<BrandingTheme[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        fetchThemes();
    }, []);

    const fetchThemes = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('branding_themes')
                .select('*')
                .order('category', { ascending: true });

            if (error) throw error;
            setThemes(data || []);
        } catch (error: any) {
            console.error('Error fetching themes:', error);
            showToast('Error al cargar temas: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (theme: BrandingTheme) => {
        try {
            setSaving(theme.id);
            const { error } = await supabase
                .from('branding_themes')
                .update({
                    primary_hue: theme.primary_hue,
                    accent_hue: theme.accent_hue,
                    secondary_hue: theme.secondary_hue,
                    display_name: theme.display_name
                })
                .eq('id', theme.id);

            if (error) throw error;
            showToast(`Tema "${theme.display_name}" guardado exitosamente.`, 'success');
        } catch (error: any) {
            console.error('Error saving theme:', error);
            showToast('Error al guardar: ' + error.message, 'error');
        } finally {
            setSaving(null);
        }
    };

    const handleChange = (id: string, field: keyof BrandingTheme, value: string) => {
        setThemes(themes.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    return (
        <div className="animate-fade-in flex flex-col gap-8 h-full pb-10">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl -z-10 animate-pulse-soft"></div>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl glass-card text-violet-400">
                        <Paintbrush size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">Gestor de Branding</h1>
                        <p className="text-sm text-slate-400 mt-1 font-medium tracking-wide">Configura los colores base por rubro de negocio.</p>
                    </div>
                </div>
                <button
                    onClick={fetchThemes}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition-all border border-white/5 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Recargar
                </button>
            </header>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
                </div>
            ) : themes.length === 0 ? (
                <div className="glass-panel p-8 text-center border-dashed border-2 border-white/10 rounded-2xl">
                    <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No hay temas configurados</h3>
                    <p className="text-slate-400">No se encontraron registros en la tabla branding_themes.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {themes.map(theme => (
                        <div key={theme.id} className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col gap-5">
                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-white">{theme.display_name}</h3>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider">{theme.category}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: `hsl(${theme.primary_hue}, 80%, 50%)` }} title="Primario"></div>
                                    <div className="w-6 h-6 rounded-full border border-white/20" style={{ backgroundColor: `hsl(${theme.accent_hue}, 100%, 50%)` }} title="Acento"></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-400">Nombre Display</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-violet-500"
                                        value={theme.display_name}
                                        onChange={(e) => handleChange(theme.id, 'display_name', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-400">Hue Primario (0-360)</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0" max="360"
                                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-violet-500"
                                            value={theme.primary_hue}
                                            onChange={(e) => handleChange(theme.id, 'primary_hue', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-400">Hue Acento (0-360)</label>
                                    <input
                                        type="number"
                                        min="0" max="360"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-violet-500"
                                        value={theme.accent_hue}
                                        onChange={(e) => handleChange(theme.id, 'accent_hue', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-400">Hue Secundario (0-360)</label>
                                    <input
                                        type="number"
                                        min="0" max="360"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-violet-500"
                                        value={theme.secondary_hue}
                                        onChange={(e) => handleChange(theme.id, 'secondary_hue', e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => handleSave(theme)}
                                disabled={saving === theme.id}
                                className="mt-2 w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
                            >
                                {saving === theme.id ? (
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Save className="w-5 h-5" />
                                )}
                                Guardar Cambios
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
