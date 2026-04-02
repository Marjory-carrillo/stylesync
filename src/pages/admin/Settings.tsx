
import { useState, useEffect, useRef } from 'react';
import { useImageUpload } from '../../lib/store/queries/useImageUpload';
import { useAuthStore } from '../../lib/store/authStore';
import { useUIStore } from '../../lib/store/uiStore';
import { DAY_NAMES, DAY_KEYS } from '../../lib/constants';
import { useTenantData } from '../../lib/store/queries/useTenantData';
import { useSchedule } from '../../lib/store/queries/useSchedule';
import { useAnnouncements } from '../../lib/store/queries/useAnnouncements';
import { useBlockedSlots } from '../../lib/store/queries/useBlockedSlots';
import { useStylists } from '../../lib/store/queries/useStylists';
import ColorThief from 'colorthief';
import { Save, Plus, PlusCircle, Trash2, Clock, Calendar, Megaphone, Lock, Shield, MapPin, Phone, Globe, Upload, ImageIcon, MessageSquare, Percent, BarChart2 } from 'lucide-react';
import { businessConfigSchema } from '../../lib/schemas';
import { CustomSelect } from '../../components/CustomSelect';
import TimePickerInput from '../../components/TimePickerInput';
import DatePickerInput from '../../components/DatePickerInput';

// Helper: RGB to HSL extraction. Returns [hue, saturation, lightness]
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// Helper to decide if a color is "vibrant" enough to be a brand color
// Rejects blacks, whites, and very low saturation grays
function isValidBrandColor(hsl: [number, number, number]) {
    const [, s, l] = hsl;
    // Reject if too dark (black), too light (white), or too gray (low saturation)
    if (l < 15 || l > 85 || s < 15) return false;
    return true;
}

const getBrandColors = (imgUrl: string): Promise<{ primary: string; accent: string }> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = imgUrl;
        img.onload = () => {
            try {
                const colorThief = new ColorThief();
                const palette = colorThief.getPalette(img, 3);

                let finalPrimary = '';
                let finalAccent = '';

                if (palette && palette.length > 0) {
                    // Find first valid vibrant color for primary
                    for (const color of palette) {
                        const hsl = rgbToHsl(color[0], color[1], color[2]);
                        if (isValidBrandColor(hsl)) {
                            finalPrimary = hsl[0].toString();
                            break;
                        }
                    }

                    // Find second valid vibrant color for accent
                    let foundAccent = false;
                    for (const color of palette) {
                        const hsl = rgbToHsl(color[0], color[1], color[2]);
                        if (isValidBrandColor(hsl) && hsl[0].toString() !== finalPrimary) {
                            finalAccent = hsl[0].toString();
                            foundAccent = true;
                            break;
                        }
                    }

                    if (finalPrimary && !foundAccent) finalAccent = finalPrimary;
                }

                resolve({ primary: finalPrimary, accent: finalAccent });

            } catch (e) {
                console.error('[getBrandColors] Error:', e);
                resolve({ primary: '', accent: '' });
            }
        };
        img.onerror = (err) => {
            console.error('[getBrandColors] Image load error (CORS?):', err);
            resolve({ primary: '', accent: '' });
        };
    });
};


export default function Settings() {
    const { uploadLogo } = useImageUpload();
    const { userRole } = useAuthStore();
    const { showToast } = useUIStore();

    const { data: tenantConfig, updateTenantData: updateBusinessConfig } = useTenantData();
    const businessConfig = tenantConfig || {} as any;

    const { schedule, saveSchedule } = useSchedule();

    const { announcements, addAnnouncement, removeAnnouncement } = useAnnouncements();
    const { blockedSlots, addBlockedSlot, removeBlockedSlot } = useBlockedSlots();
    const { stylists, updateStylist } = useStylists();
    const confirmationRef = useRef<HTMLTextAreaElement>(null);
    const reminderRef = useRef<HTMLTextAreaElement>(null);

    const updateStylistCommissionRate = async (id: number, rate: number) => {
        await updateStylist({ id, data: { commissionRate: rate } });
    };

    const [infoForm, setInfoForm] = useState(businessConfig);
    const [scheduleForm, setScheduleForm] = useState(schedule);
    const [newAnnouncement, setNewAnnouncement] = useState('');
    const [newAnnouncementType, setNewAnnouncementType] = useState<'info' | 'warning' | 'closed'>('info');
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [lastFocusedField, setLastFocusedField] = useState<'confirmationTemplate' | 'reminderTemplate' | null>(null);

    // Blocked slots form
    const [blockDate, setBlockDate] = useState('');
    const [blockStart, setBlockStart] = useState('');
    const [blockEnd, setBlockEnd] = useState('');
    const [blockReason, setBlockReason] = useState('');
    const [isAllDay, setIsAllDay] = useState(false);
    const [infoError, setInfoError] = useState('');

    // Formatter for 12h time
    const format12h = (timeStr: string) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        let hh = parseInt(h);
        const ampm = hh >= 12 ? 'pm' : 'am';
        hh = hh % 12;
        hh = hh ? hh : 12;
        return `${hh}:${m}${ampm}`;
    };

    useEffect(() => {
        setInfoForm(businessConfig);
    }, [businessConfig]);

    useEffect(() => {
        setScheduleForm(schedule);
    }, [schedule]);

    const handleInfoSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setInfoError('');

        const validation = businessConfigSchema.safeParse(infoForm);
        if (!validation.success) {
            setInfoError(validation.error.issues[0].message);
            return;
        }

        updateBusinessConfig(infoForm);
        showToast('Información del negocio actualizada', 'success');
    };

    const insertVariable = (variable: string) => {
        if (!lastFocusedField) {
            showToast('Selecciona primero dónde quieres insertar la variable', 'info');
            return;
        }
        
        const ref = lastFocusedField === 'confirmationTemplate' ? confirmationRef : reminderRef;
        const textarea = ref.current;
        const currentVal = infoForm[lastFocusedField] || '';

        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newVal = currentVal.substring(0, start) + variable + currentVal.substring(end);
            
            setInfoForm({
                ...infoForm,
                [lastFocusedField]: newVal
            });

            // Re-focus and set cursor after the inserted variable
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + variable.length, start + variable.length);
            }, 0);
        } else {
            setInfoForm({
                ...infoForm,
                [lastFocusedField]: currentVal + variable
            });
        }
    };

    const handleScheduleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await saveSchedule(scheduleForm);
        showToast('Horarios actualizados correctamente', 'success');
    };

    const handleAddAnnouncement = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAnnouncement.trim()) return;
        addAnnouncement({ message: newAnnouncement, type: newAnnouncementType } as any);
        setNewAnnouncement('');
        setNewAnnouncementType('info');
    };

    const handleAddBlockedSlot = (e: React.FormEvent) => {
        e.preventDefault();
        const start = isAllDay ? '00:00' : blockStart;
        const end = isAllDay ? '23:59' : blockEnd;

        if (!blockDate || !start || !end) return;
        addBlockedSlot({ date: blockDate, startTime: start, endTime: end, reason: blockReason });

        setBlockDate('');
        setBlockStart('');
        setBlockEnd('');
        setBlockReason('');
        setIsAllDay(false);
    };

    const onLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploadingLogo(true);
        try {
            // 1. Extract Colors locally for speed & avoid CORS issues
            let extractedColors = { primary: '', accent: '' };
            try {
                const objectUrl = URL.createObjectURL(file);
                extractedColors = await getBrandColors(objectUrl);
                URL.revokeObjectURL(objectUrl);
            } catch (err) {
                console.warn('Could not extract colors:', err);
            }

            // 2. Upload Logo
            const url = await uploadLogo(file);

            if (url) {
                const newConfig = {
                    ...infoForm,
                    logoUrl: url,
                    // Only update colors if we successfully extracted them
                    ...(extractedColors.primary ? { primaryColor: extractedColors.primary } : {}),
                    ...(extractedColors.accent ? { accentColor: extractedColors.accent } : {})
                };

                setInfoForm(newConfig);

                // Auto-save the new configuration (Logo + Colors)
                await updateBusinessConfig({
                    logoUrl: url,
                    primaryColor: extractedColors.primary || infoForm.primaryColor,
                    accentColor: extractedColors.accent || infoForm.accentColor
                });
                showToast('Logo y colores actualizados', 'success');
            }
        } catch (error) {
            console.error('Error uploading logo:', error);
        } finally {
            setUploadingLogo(false);
        }
    };


    return (
        <div className="animate-fade-in space-y-8 pb-10">
            <div>
                <h2 className="text-2xl font-bold text-white">Configuración</h2>
                <p className="text-sm text-muted">Administra la información de tu negocio y preferencias.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* ── Business Info (Section 1) ── */}
                <section className="glass-panel p-6 rounded-xl space-y-6 relative z-[60]">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                            <Shield size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white">Información del Negocio</h3>
                    </div>

                    <form onSubmit={handleInfoSubmit} className="space-y-4">
                        {/* Logo Upload */}
                        <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/5">
                            <div className="w-16 h-16 rounded-lg bg-black/20 flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
                                {infoForm.logoUrl ? (
                                    <img src={infoForm.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="text-muted" size={24} />
                                )}
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-white mb-1">Logo del Negocio</label>
                                <div className="flex gap-2">
                                    <label className="btn btn-secondary py-2 text-sm cursor-pointer flex items-center gap-2">
                                        <Upload size={16} />
                                        {uploadingLogo ? 'Subiendo...' : 'Subir Imagen'}
                                        <input type="file" className="hidden" accept="image/*" onChange={onLogoFileChange} disabled={uploadingLogo} />
                                    </label>
                                    {infoForm.logoUrl && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost hover:bg-red-500/10 hover:text-red-500 p-2"
                                            onClick={async () => {
                                                const newConfig = { ...infoForm, logoUrl: '', primaryColor: '', accentColor: '' };
                                                setInfoForm(newConfig);
                                                await updateBusinessConfig({ logoUrl: '', primaryColor: '', accentColor: '' });
                                                showToast('Logo eliminado. Se han restaurado los colores por defecto', 'info');
                                            }}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Theme Color Indicator & Reset */}
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                            <div>
                                <label className="block text-sm font-medium text-white mb-1">Color del Tema</label>
                                <p className="text-xs text-muted">Extraído del logo. Si no te gusta, puedes restaurarlo.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {infoForm.primaryColor ? (
                                    <>
                                        <div
                                            className="w-8 h-8 rounded-full border border-white/20 shadow-lg"
                                            style={{ backgroundColor: `hsl(${infoForm.primaryColor}, 80%, 50%)` }}
                                            title="Color actual"
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-ghost hover:bg-red-500/10 hover:text-red-500 text-xs px-3 py-1.5"
                                            onClick={async () => {
                                                const newConfig = { ...infoForm, primaryColor: '', accentColor: '' };
                                                setInfoForm(newConfig);
                                                await updateBusinessConfig({ primaryColor: '', accentColor: '' });
                                                showToast('Colores restaurados por defecto', 'success');
                                            }}
                                        >
                                            Restaurar Azul
                                        </button>
                                    </>
                                ) : (
                                    <span className="text-xs text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">Por defecto</span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-muted mb-1">Nombre del Negocio</label>
                            <input
                                type="text"
                                className="w-full glass-card bg-transparent border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                value={infoForm.name}
                                onChange={e => setInfoForm({ ...infoForm, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-muted mb-1">Descripción corta (PWA)</label>
                            <textarea
                                className="w-full glass-card bg-transparent border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none"
                                rows={2}
                                value={infoForm.description || ''}
                                onChange={e => setInfoForm({ ...infoForm, description: e.target.value })}
                                placeholder="Breve descripción para cuando los clientes instalen la app"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-muted mb-1 flex items-center gap-1"><MapPin size={14} /> Dirección</label>
                            <input
                                type="text"
                                className="w-full glass-card bg-transparent border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                value={infoForm.address}
                                onChange={e => setInfoForm({ ...infoForm, address: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-muted mb-1 flex items-center gap-1"><Phone size={14} /> Teléfono</label>
                            <input
                                type="text"
                                className="w-full glass-card bg-transparent border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                value={infoForm.phone}
                                onChange={e => setInfoForm({ ...infoForm, phone: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-muted mb-1 flex items-center gap-1"><Globe size={14} /> Enlace de Ubicación (Maps)</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="https://maps.app.goo.gl/... o Coordenadas"
                                    className="w-full glass-card bg-transparent border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                                    value={infoForm.googleMapsUrl || ''}
                                    onChange={e => {
                                        let val = e.target.value;
                                        setInfoForm({ ...infoForm, googleMapsUrl: val });
                                    }}
                                    onBlur={e => {
                                        let val = e.target.value.trim();
                                        // Auto-convert coordinates to URL
                                        const coordRegex = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
                                        if (coordRegex.test(val)) {
                                            val = `https://www.google.com/maps/search/?api=1&query=${val.replace(/\s/g, '')}`;
                                            setInfoForm({ ...infoForm, googleMapsUrl: val });
                                        }
                                    }}
                                />
                                {infoForm.googleMapsUrl && (
                                    <a
                                        href={infoForm.googleMapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn bg-white/5 hover:bg-white/10 p-3 rounded-lg border border-white/10 text-accent"
                                        title="Probar enlace"
                                    >
                                        <Globe size={20} />
                                    </a>
                                )}
                            </div>
                            <p className="text-xs text-muted mt-1">
                                Tip: Ve a Google Maps &gt; Compartir &gt; Copiar vínculo. O pega tus coordenadas (ej: <code>19.4326, -99.1332</code>).
                            </p>
                        </div>

                        {/* Booking Horizon */}
                        <div className="relative z-50">
                            <label className="block text-sm text-muted mb-1 flex items-center gap-1"><Calendar size={14} /> Días de anticipación para reservas</label>
                            <CustomSelect
                                value={String(infoForm.bookingDaysAhead || 14)}
                                onChange={(val: string) => setInfoForm({ ...infoForm, bookingDaysAhead: parseInt(val) })}
                                options={[
                                    { value: '7', label: '7 días (1 semana)' },
                                    { value: '14', label: '14 días (2 semanas)' },
                                    { value: '30', label: '30 días (1 mes)' },
                                    { value: '60', label: '60 días (2 meses)' },
                                ]}
                                buttonClassName="w-full glass-card bg-[#0f172a] border border-white/10 rounded-2xl p-3 text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer flex items-center justify-between text-sm"
                                dropdownClassName="absolute z-50 w-full mt-1 bg-[#1e293b] border border-slate-700/50 rounded-2xl shadow-2xl py-1 animate-fade-in overflow-hidden"
                            />
                        </div>

                        {/* Break Between Appointments */}
                        <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-white font-medium flex items-center gap-2">
                                        <Clock size={16} className="text-accent" />
                                        Descanso entre citas
                                    </h4>
                                    <p className="text-sm text-muted mt-0.5">Buffer de tiempo entre citas para que el profesional prepare el espacio.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={(infoForm.breakBetweenAppointments ?? 0) > 0}
                                        onChange={async (e) => {
                                            const val = e.target.checked ? 10 : 0;
                                            setInfoForm({ ...infoForm, breakBetweenAppointments: val });
                                            await updateBusinessConfig({ breakBetweenAppointments: val });
                                            showToast(val > 0 ? `Descanso activado: ${val} min` : 'Descanso desactivado', 'success');
                                        }}
                                    />
                                    <div className="w-11 h-6 bg-slate-700/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                                </label>
                            </div>
                            {/* Duration selector — only when enabled */}
                            {(infoForm.breakBetweenAppointments ?? 0) > 0 && (
                                <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                                    <span className="text-sm text-muted shrink-0">Duración:</span>
                                    <div className="flex gap-2 flex-wrap">
                                        {[5, 10, 15, 20, 30].map(mins => (
                                            <button
                                                key={mins}
                                                type="button"
                                                onClick={async () => {
                                                    setInfoForm({ ...infoForm, breakBetweenAppointments: mins });
                                                    await updateBusinessConfig({ breakBetweenAppointments: mins });
                                                    showToast(`Descanso: ${mins} min`, 'success');
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all ${
                                                    infoForm.breakBetweenAppointments === mins
                                                        ? 'bg-accent border-accent/50 text-white shadow-lg shadow-accent/20'
                                                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-accent/30 hover:text-white'
                                                }`}
                                            >
                                                {mins} min
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Dashboard Metrics Toggle */}
                        <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-white font-medium flex items-center gap-2">
                                        <BarChart2 size={16} className="text-accent" />
                                        Métricas en Dashboard
                                    </h4>
                                    <p className="text-sm text-muted mt-0.5">Muestra estadísticas de ingresos y citas recientes en la pantalla principal.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={infoForm.showDashboardMetrics ?? true}
                                        onChange={async (e) => {
                                            const val = e.target.checked;
                                            setInfoForm({ ...infoForm, showDashboardMetrics: val });
                                            await updateBusinessConfig({ showDashboardMetrics: val });
                                            showToast(val ? 'Métricas activadas' : 'Métricas desactivadas', 'success');
                                        }}
                                    />
                                    <div className="w-11 h-6 bg-slate-700/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                                </label>
                            </div>
                        </div>

                        {/* Addons Toggle */}
                        <div className="p-4 bg-white/5 rounded-lg border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-white font-medium flex items-center gap-2">
                                        <PlusCircle size={16} className="text-accent" />
                                        Servicios Adicionales (Add-ons)
                                    </h4>
                                    <p className="text-sm text-muted mt-0.5">Permite a los clientes seleccionar servicios extras al reservar (ej. lavar cabello + mascarilla).</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={infoForm.enableAddons ?? false}
                                        onChange={async (e) => {
                                            const val = e.target.checked;
                                            setInfoForm({ ...infoForm, enableAddons: val });
                                            await updateBusinessConfig({ enableAddons: val });
                                            showToast(val ? 'Servicios adicionales activados' : 'Servicios adicionales desactivados', 'success');
                                        }}
                                    />
                                    <div className="w-11 h-6 bg-slate-700/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                                </label>
                            </div>
                        </div>

                        {infoError && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2 animate-shake">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                {infoError}
                            </div>
                        )}

                        <button type="submit" className="w-full btn bg-accent hover:bg-accent/90 text-slate-900 font-bold py-3 mt-4 flex justify-center items-center gap-2">
                            <Save size={18} /> Guardar Cambios
                        </button>
                    </form>
                </section>

                {/* ── Schedule (Section 3) ── */}
                <section className="glass-panel p-6 rounded-xl space-y-6 relative z-[40]">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                        <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                            <Clock size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white">Horarios de Atención</h3>
                    </div>

                    <form onSubmit={handleScheduleSubmit} className="space-y-4">
                        {DAY_KEYS.map(day => {
                            const hours = scheduleForm[day] || { open: false, start: '09:00', end: '18:00' };
                            return (
                                <div key={day} className="flex flex-col p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5 gap-3">
                                    {/* Day header: name + toggle */}
                                    <div className="flex items-center justify-between">
                                        <div className="font-medium capitalize text-white flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${hours.open ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            {DAY_NAMES[day]}
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={hours.open}
                                                onChange={e => setScheduleForm({
                                                    ...scheduleForm,
                                                    [day]: { ...hours, open: e.target.checked }
                                                })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-700/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                                        </label>
                                    </div>

                                    {hours.open && (
                                        <div className="flex flex-col gap-2 pl-4">
                                            {/* Agenda row */}
                                            <div className="grid grid-cols-[3rem_1fr_auto_1fr] items-center gap-1.5">
                                                <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Agenda</span>
                                                <TimePickerInput
                                                    value={hours.start}
                                                    onChange={val => setScheduleForm({ ...scheduleForm, [day]: { ...hours, start: val } })}
                                                />
                                                <span className="text-slate-600 text-xs text-center">—</span>
                                                <TimePickerInput
                                                    value={hours.end}
                                                    onChange={val => setScheduleForm({ ...scheduleForm, [day]: { ...hours, end: val } })}
                                                />
                                            </div>
                                            {/* Comida row */}
                                            <div className="grid grid-cols-[3rem_1fr_auto_1fr] items-center gap-1.5">
                                                <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Comida</span>
                                                <TimePickerInput
                                                    value={hours.breakStart || ''}
                                                    onChange={val => setScheduleForm({ ...scheduleForm, [day]: { ...hours, breakStart: val } })}
                                                    placeholder="--:-- ---"
                                                />
                                                <span className="text-slate-600 text-xs text-center">—</span>
                                                <TimePickerInput
                                                    value={hours.breakEnd || ''}
                                                    onChange={val => setScheduleForm({ ...scheduleForm, [day]: { ...hours, breakEnd: val } })}
                                                    placeholder="--:-- ---"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {!hours.open && <span className="text-sm text-muted italic pl-4">Cerrado</span>}
                                </div>
                            );
                        })}
                        <button type="submit" className="w-full btn bg-white/10 hover:bg-white/20 text-white font-bold py-3 mt-4 flex justify-center items-center gap-2 border border-white/10">
                            <Save size={18} /> Actualizar Horarios
                        </button>
                    </form>
                </section>

                {/* ── Announcements (Section 4) ── */}
                <section className="glass-panel p-6 rounded-xl space-y-6 relative z-[30]">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                        <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500">
                            <Megaphone size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white">Anuncios</h3>
                    </div>

                    <form onSubmit={handleAddAnnouncement} className="space-y-4">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Nuevo anuncio (ej: Descuentos de Primavera)"
                                className="flex-1 glass-card bg-transparent border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-accent transition-all"
                                value={newAnnouncement}
                                onChange={e => setNewAnnouncement(e.target.value)}
                            />
                            <button type="submit" className="btn bg-accent text-slate-900 hover:bg-accent/90 p-3 rounded-lg">
                                <Plus size={24} />
                            </button>
                        </div>

                        <div className="flex gap-2">
                            {[
                                { id: 'info', label: 'Info', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
                                { id: 'warning', label: 'Advertencia', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
                                { id: 'closed', label: 'Cierre', color: 'bg-red-500/20 text-red-400 border-red-500/30' }
                            ].map(t => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setNewAnnouncementType(t.id as any)}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${newAnnouncementType === t.id ? t.color : 'bg-white/5 text-muted border-transparent hover:bg-white/10'}`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </form>

                    <div className="space-y-3">
                        {announcements.length === 0 ? (
                            <p className="text-muted text-center py-4">No hay anuncios activos.</p>
                        ) : (
                            announcements.map(ann => (
                                <div
                                    key={ann.id}
                                    className={`flex justify-between items-center p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border-l-4 ${ann.type === 'warning' ? 'border-amber-500' :
                                        ann.type === 'closed' ? 'border-red-500' :
                                            'border-blue-500'
                                        }`}
                                >
                                    <div className="flex flex-col">
                                        <span className="text-white font-medium">{ann.message}</span>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${ann.type === 'warning' ? 'text-amber-400' :
                                            ann.type === 'closed' ? 'text-red-400' :
                                                'text-blue-400'
                                            }`}>
                                            {ann.type}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => removeAnnouncement(ann.id)}
                                        className="text-muted hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-500/10"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* ── Blocked Slots (Section 5) ── */}
                <section className="glass-panel p-6 rounded-xl space-y-6 relative z-[20]">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                        <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                            <Lock size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white">Bloquear Horarios</h3>
                    </div>

                    <form onSubmit={handleAddBlockedSlot} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-3">
                                <div>
                                    <label className="block text-[10px] uppercase font-black text-slate-500 mb-1.5 tracking-widest">Fecha</label>
                                    <DatePickerInput
                                        value={blockDate}
                                        onChange={val => setBlockDate(val)}
                                    />
                                </div>
                                {/* Todo el día — pill toggle */}
                                <button
                                    type="button"
                                    onClick={() => setIsAllDay(v => !v)}
                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all w-fit ${
                                        isAllDay
                                            ? 'bg-accent/15 border-accent/40 text-white'
                                            : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                                    }`}
                                >
                                    {/* mini toggle pill */}
                                    <div className={`w-8 h-4 rounded-full transition-all relative ${
                                        isAllDay ? 'bg-accent' : 'bg-slate-700'
                                    }`}>
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${
                                            isAllDay ? 'left-4.5' : 'left-0.5'
                                        }`} />
                                    </div>
                                    <span className="text-sm font-bold">Todo el día</span>
                                </button>
                            </div>

                            <div className={`flex flex-wrap items-center gap-4 transition-opacity ${isAllDay ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                                <div className="flex-1 min-w-[130px]">
                                    <label className="block text-[10px] uppercase font-black text-slate-500 mb-1.5 tracking-widest">Desde</label>
                                    <TimePickerInput
                                        value={isAllDay ? '00:00' : blockStart}
                                        onChange={val => setBlockStart(val)}
                                        disabled={isAllDay}
                                    />
                                </div>
                                <div className="pt-6 hidden sm:block">
                                    <span className="text-slate-600">—</span>
                                </div>
                                <div className="flex-1 min-w-[130px]">
                                    <label className="block text-[10px] uppercase font-black text-slate-500 mb-1.5 tracking-widest">Hasta</label>
                                    <TimePickerInput
                                        value={isAllDay ? '23:59' : blockEnd}
                                        onChange={val => setBlockEnd(val)}
                                        disabled={isAllDay}
                                    />
                                </div>
                            </div>
                        </div>

                        <input
                            type="text"
                            placeholder="Razón (Opcional)"
                            className="w-full glass-card bg-transparent border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-accent transition-all"
                            value={blockReason}
                            onChange={e => setBlockReason(e.target.value)}
                        />
                        <button type="submit" className="w-full btn bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold py-3 border border-red-500/20 flex justify-center items-center gap-2">
                            <Lock size={18} /> Bloquear Horario
                        </button>
                    </form>

                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {blockedSlots.length === 0 ? (
                            <p className="text-muted text-center py-4">No hay horarios bloqueados.</p>
                        ) : (
                            blockedSlots.map(slot => (
                                <div key={slot.id} className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5">
                                    <div>
                                        <div className="flex items-center gap-2 text-white font-medium">
                                            <Calendar size={14} className="text-accent" /> {slot.date}
                                            <Clock size={14} className="text-accent ml-2" /> {format12h(slot.startTime)} - {format12h(slot.endTime)}
                                        </div>
                                        {slot.reason && <p className="text-sm text-muted mt-1">{slot.reason}</p>}
                                    </div>
                                    <button
                                        onClick={() => removeBlockedSlot(slot.id)}
                                        className="text-muted hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-500/10"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                {/* ── Commissions Module (Section 6) ── */}
                {userRole === 'owner' && (
                    <section className="glass-panel p-6 rounded-xl space-y-6 lg:col-span-2 relative z-[10]">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                            <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500">
                                <Percent size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white">Nómina y Comisiones</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                                <div>
                                    <h4 className="text-white font-medium">Activar Sistema de Nómina</h4>
                                    <p className="text-sm text-muted">Habilita el cálculo automático de comisiones por cita completada y muestra el panel de Nómina a tu cuenta.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={infoForm.commissionsEnabled || false}
                                        onChange={async (e) => {
                                            const val = e.target.checked;
                                            setInfoForm({ ...infoForm, commissionsEnabled: val });
                                            await updateBusinessConfig({ commissionsEnabled: val });
                                            showToast(val ? 'Módulo de Nómina activado' : 'Módulo de Nómina desactivado', 'success');
                                        }}
                                    />
                                    <div className="w-11 h-6 bg-slate-700/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                                </label>
                            </div>

                            {infoForm.commissionsEnabled && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5 mb-6">
                                        <div>
                                            <h4 className="text-white font-medium">Día de Inicio de Semana</h4>
                                            <p className="text-sm text-muted">Afecta el rango de fechas en "Esta Semana" dentro de la Nómina.</p>
                                        </div>
                                        <div className="relative w-40 sm:w-48 z-10">
                                            <CustomSelect
                                                value={String(infoForm.weekStartsOn ?? 1)}
                                                onChange={async (val: string) => {
                                                    const numericVal = parseInt(val) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
                                                    setInfoForm({ ...infoForm, weekStartsOn: numericVal });
                                                    await updateBusinessConfig({ weekStartsOn: numericVal });
                                                    showToast('Día de corte actualizado', 'success');
                                                }}
                                                options={[
                                                    { value: '1', label: 'Lunes' },
                                                    { value: '0', label: 'Domingo' },
                                                    { value: '2', label: 'Martes' },
                                                    { value: '3', label: 'Miércoles' },
                                                    { value: '4', label: 'Jueves' },
                                                    { value: '5', label: 'Viernes' },
                                                    { value: '6', label: 'Sábado' },
                                                ]}
                                                buttonClassName="w-full glass-card bg-[#0f172a] border border-white/10 rounded-2xl p-2 text-white focus:outline-none focus:border-accent border-accent/30 transition-all cursor-pointer flex items-center justify-between text-sm"
                                                dropdownClassName="absolute right-0 z-50 w-full mt-1 bg-[#1e293b] border border-slate-700/50 rounded-2xl shadow-2xl py-1 animate-fade-in overflow-hidden"
                                            />
                                        </div>
                                    </div>

                                    <h4 className="text-sm font-medium text-white mb-2">Porcentajes de Comisión por Profesional</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {stylists.map(stylist => (
                                            <div key={stylist.id} className="flex flex-col gap-2 p-4 bg-[#0f172a]/50 border border-white/5 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs shrink-0">
                                                        {stylist.name.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-white font-medium truncate">{stylist.name}</p>
                                                        <p className="text-xs text-muted truncate">{stylist.role}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        className="w-20 bg-transparent border-b border-white/20 text-white text-center text-sm py-1 focus:border-accent focus:outline-none focus:bg-white/5 rounded"
                                                        value={stylist.commissionRate || 0}
                                                        onChange={(e) => {
                                                            const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                                            updateStylistCommissionRate(stylist.id, val);
                                                        }}
                                                    />
                                                    <span className="text-muted text-sm">%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted">
                                        Los cambios de porcentaje se guardan automáticamente y afectan el cálculo global histórico. Cambiar para periodos de prueba.
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
