
import { useState, useEffect } from 'react';
import { useStore, DAY_NAMES, DAY_KEYS } from '../../lib/store';
import ColorThief from 'colorthief';
import { Save, Plus, Trash2, Clock, Calendar, Megaphone, Lock, Shield, MapPin, Phone, Globe, Upload, ImageIcon } from 'lucide-react';

// Helper: RGB to Hue (0-360) algorithm
function rgbToHue(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;

    if (max !== min) {
        const d = max - min;
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return Math.round(h * 360).toString();
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
                if (palette && palette.length >= 2) {
                    const primary = rgbToHue(palette[0][0], palette[0][1], palette[0][2]);
                    const accent = rgbToHue(palette[1][0], palette[1][1], palette[1][2]);
                    console.log(`[getBrandColors] Extracted: Primary=${primary}, Accent=${accent}`);
                    resolve({ primary, accent });
                } else if (palette && palette.length === 1) {
                    const h = rgbToHue(palette[0][0], palette[0][1], palette[0][2]);
                    console.log(`[getBrandColors] Extracted single: ${h}`);
                    resolve({ primary: h, accent: h });
                } else {
                    console.warn('[getBrandColors] No palette found');
                    resolve({ primary: '', accent: '' });
                }
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
    const {
        businessConfig, schedule, announcements, blockedSlots,
        updateBusinessConfig, saveSchedule, addAnnouncement, removeAnnouncement, addBlockedSlot, removeBlockedSlot,
        uploadLogo
    } = useStore();

    const [infoForm, setInfoForm] = useState(businessConfig);
    const [scheduleForm, setScheduleForm] = useState(schedule);
    const [newAnnouncement, setNewAnnouncement] = useState('');
    const [uploadingLogo, setUploadingLogo] = useState(false);

    // Blocked slots form
    const [blockDate, setBlockDate] = useState('');
    const [blockStart, setBlockStart] = useState('');
    const [blockEnd, setBlockEnd] = useState('');
    const [blockReason, setBlockReason] = useState('');

    useEffect(() => {
        setInfoForm(businessConfig);
    }, [businessConfig]);

    useEffect(() => {
        setScheduleForm(schedule);
    }, [schedule]);

    const handleInfoSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateBusinessConfig(infoForm);
        alert('Información del negocio actualizada');
    };

    const handleScheduleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await saveSchedule(scheduleForm);
        alert('Horarios actualizados correctamente');
    };

    const handleAddAnnouncement = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAnnouncement.trim()) return;
        addAnnouncement(newAnnouncement, 'info'); // Default to info
        setNewAnnouncement('');
    };

    const handleAddBlockedSlot = (e: React.FormEvent) => {
        e.preventDefault();
        if (!blockDate || !blockStart || !blockEnd) return;
        addBlockedSlot({ date: blockDate, startTime: blockStart, endTime: blockEnd, reason: blockReason });
        setBlockDate('');
        setBlockStart('');
        setBlockEnd('');
        setBlockReason('');
        setBlockReason('');
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
                alert('Logo y colores actualizados.');
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

                {/* ── Business Info ── */}
                <section className="glass-panel p-6 rounded-xl space-y-6">
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
                                                alert('Logo eliminado. Se han restaurado los colores por defecto.');
                                            }}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
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

                        <button type="submit" className="w-full btn bg-accent hover:bg-accent/90 text-slate-900 font-bold py-3 mt-2 flex justify-center items-center gap-2">
                            <Save size={18} /> Guardar Cambios
                        </button>
                    </form>
                </section>



                {/* ── Schedule ── */}
                <section className="glass-panel p-6 rounded-xl space-y-6">
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
                                <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                    <div className="w-32 font-medium capitalize text-white flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${hours.open ? 'bg-green-500' : 'bg-red-500'}`}></span>
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

                                    {hours.open && (
                                        <div className="flex flex-col gap-2 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted w-12">Horario:</span>
                                                <input
                                                    type="time"
                                                    className="glass-card bg-transparent border border-white/10 rounded px-3 py-1 text-white text-sm focus:border-accent focus:outline-none"
                                                    value={hours.start}
                                                    onChange={e => setScheduleForm({
                                                        ...scheduleForm,
                                                        [day]: { ...hours, start: e.target.value }
                                                    })}
                                                />
                                                <span className="text-muted text-sm">-</span>
                                                <input
                                                    type="time"
                                                    className="glass-card bg-transparent border border-white/10 rounded px-3 py-1 text-white text-sm focus:border-accent focus:outline-none"
                                                    value={hours.end}
                                                    onChange={e => setScheduleForm({
                                                        ...scheduleForm,
                                                        [day]: { ...hours, end: e.target.value }
                                                    })}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted w-12">Comida:</span>
                                                <input
                                                    type="time"
                                                    className="glass-card bg-transparent border border-white/10 rounded px-3 py-1 text-white text-sm focus:border-accent focus:outline-none opacity-80"
                                                    value={hours.breakStart || ''}
                                                    onChange={e => setScheduleForm({
                                                        ...scheduleForm,
                                                        [day]: { ...hours, breakStart: e.target.value }
                                                    })}
                                                />
                                                <span className="text-muted text-sm">-</span>
                                                <input
                                                    type="time"
                                                    className="glass-card bg-transparent border border-white/10 rounded px-3 py-1 text-white text-sm focus:border-accent focus:outline-none opacity-80"
                                                    value={hours.breakEnd || ''}
                                                    onChange={e => setScheduleForm({
                                                        ...scheduleForm,
                                                        [day]: { ...hours, breakEnd: e.target.value }
                                                    })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {!hours.open && <span className="text-sm text-muted italic flex-1">Cerrado</span>}
                                </div>
                            );
                        })}
                        <button type="submit" className="w-full btn bg-white/10 hover:bg-white/20 text-white font-bold py-3 mt-4 flex justify-center items-center gap-2 border border-white/10">
                            <Save size={18} /> Actualizar Horarios
                        </button>
                    </form>
                </section>

                {/* ── Announcements ── */}
                <section className="glass-panel p-6 rounded-xl space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                        <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500">
                            <Megaphone size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white">Anuncios</h3>
                    </div>

                    <form onSubmit={handleAddAnnouncement} className="flex gap-2">
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
                    </form>

                    <div className="space-y-3">
                        {announcements.length === 0 ? (
                            <p className="text-muted text-center py-4">No hay anuncios activos.</p>
                        ) : (
                            announcements.map(ann => (
                                <div key={ann.id} className="flex justify-between items-center p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border-l-4 border-accent">
                                    <span className="text-white font-medium">{ann.message}</span>
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

                {/* ── Blocked Slots ── */}
                <section className="glass-panel p-6 rounded-xl space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                        <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                            <Lock size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white">Bloquear Horarios</h3>
                    </div>

                    <form onSubmit={handleAddBlockedSlot} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-muted mb-1">Fecha</label>
                                <input
                                    type="date"
                                    className="w-full glass-card bg-transparent border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-accent transition-all dark:[color-scheme:dark]"
                                    value={blockDate}
                                    onChange={e => setBlockDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm text-muted mb-1">De</label>
                                    <input
                                        type="time"
                                        className="w-full glass-card bg-transparent border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-accent transition-all dark:[color-scheme:dark]"
                                        value={blockStart}
                                        onChange={e => setBlockStart(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-muted mb-1">A</label>
                                    <input
                                        type="time"
                                        className="w-full glass-card bg-transparent border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-accent transition-all dark:[color-scheme:dark]"
                                        value={blockEnd}
                                        onChange={e => setBlockEnd(e.target.value)}
                                        required
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
                                            <Clock size={14} className="text-accent ml-2" /> {slot.startTime} - {slot.endTime}
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

            </div>
        </div>
    );
}
