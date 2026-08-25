import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../lib/store/authStore';
import { useTenantData } from '../lib/store/queries/useTenantData';
import { useServices } from '../lib/store/queries/useServices';
import { useStylists } from '../lib/store/queries/useStylists';
import { useImageUpload } from '../lib/store/queries/useImageUpload';
import { useNailCalculator, DEFAULT_NAIL_CONFIG } from '../lib/store/queries/useNailCalculator';
import type { QuotingCategory } from '../lib/types/store.types';
import { useUIStore } from '../lib/store/uiStore';
import {
    Sparkles, Check, ArrowRight, ArrowLeft,
    Calendar, Clock, Users, Copy, MessageCircle, ExternalLink,
    Bot, CheckCircle2, Palette, Trash2, Plus, Upload,
    Info, AlertTriangle, UserCheck, MapPin
} from 'lucide-react';

interface OnboardingWizardProps {
    isOpen: boolean;
    onClose: () => void;
}

const PRESET_COLORS = [
    { name: 'Dorado Luxury', hex: '#d4af37' },
    { name: 'Rosa Pastel', hex: '#f472b6' },
    { name: 'Violeta Neón', hex: '#a855f7' },
    { name: 'Cyan Moderno', hex: '#06b6d4' },
    { name: 'Esmeralda', hex: '#10b981' },
    { name: 'Ámbar Cálido', hex: '#f59e0b' },
    { name: 'Negro & Plata', hex: '#94a3b8' },
];

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_NAMES: Record<string, string> = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo'
};

const DEFAULT_SCHEDULE: Record<string, { open: boolean; start: string; end: string }> = {
    monday: { open: true, start: '09:00', end: '18:00' },
    tuesday: { open: true, start: '09:00', end: '18:00' },
    wednesday: { open: true, start: '09:00', end: '18:00' },
    thursday: { open: true, start: '09:00', end: '18:00' },
    friday: { open: true, start: '09:00', end: '18:00' },
    saturday: { open: true, start: '10:00', end: '15:00' },
    sunday: { open: false, start: '10:00', end: '15:00' },
};

function stepTime(currentTime: string, deltaMinutes: number): string {
    const [hStr, mStr] = (currentTime || '09:00').split(':');
    let totalMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10) + deltaMinutes;
    if (totalMinutes < 360) totalMinutes = 360; // 06:00 AM min
    if (totalMinutes > 1380) totalMinutes = 1380; // 11:00 PM max
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTime12h(timeStr: string): string {
    if (!timeStr || !timeStr.includes(':')) return '09:00 AM';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Determina si el texto sobre un fondo hex debe ser blanco o negro para contraste óptimo */
function getContrastColor(hex: string): string {
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length !== 6) return '#ffffff';
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 140 ? '#0a0e17' : '#ffffff';
}

export default function OnboardingWizard({ isOpen, onClose }: OnboardingWizardProps) {
    const { data: tenant, updateTenantData } = useTenantData();
    const storeTenantId = useAuthStore((state) => state.tenantId);
    const { services, updateService, addService, removeService } = useServices();
    const { stylists, updateStylist, addStylist } = useStylists();
    const { uploadLogo } = useImageUpload();
    const { showToast } = useUIStore();

    const isNailsCategory = tenant?.category === 'nail_bar' || tenant?.category === 'nails';
    const totalSteps = isNailsCategory ? 5 : 4;
    const [currentStep, setCurrentStep] = useState(1);

    // ── Paso 1: Marca & Logo ──
    const [selectedColor, setSelectedColor] = useState(tenant?.primaryColor || '#d4af37');
    const [logoPreview, setLogoPreview] = useState(tenant?.logoUrl || '');
    const [uploadingLogo, setUploadingLogo] = useState(false);

    // ── Paso 2: Servicios ──
    const [servicesList, setServicesList] = useState<any[]>([]);
    const [showAddServiceForm, setShowAddServiceForm] = useState(false);
    const [newServiceData, setNewServiceData] = useState<{ name: string; duration: string | number; price: string | number; isAddon: boolean }>({ name: '', duration: 30, price: 150, isAddon: false });

    // ── Paso 3 (Uñas): Cotizador & Calculadora ──
    const { config: nailConfig, saveConfig: saveNailConfig } = useNailCalculator();
    const [localNailConfig, setLocalNailConfig] = useState<QuotingCategory[]>(DEFAULT_NAIL_CONFIG);
    const [selectedNailTab, setSelectedNailTab] = useState<'sizes' | 'base_services' | 'extras'>('sizes');

    // ── Paso 3 / 4: Horarios & Equipo ──
    const [primarySpecialistName, setPrimarySpecialistName] = useState('');
    const [weeklySchedule, setWeeklySchedule] = useState<Record<string, { open: boolean; start: string; end: string }>>(DEFAULT_SCHEDULE);
    const [showAddStylistForm, setShowAddStylistForm] = useState(false);
    const [newStylistData, setNewStylistData] = useState({ name: '', phone: '' });
    const [showLimitBanner, setShowLimitBanner] = useState(false);

    // ── Paso Final: Enlace & Ubicación ──
    const [businessAddress, setBusinessAddress] = useState(tenant?.address || '');
    const [businessMapsUrl, setBusinessMapsUrl] = useState(tenant?.googleMapsUrl || '');
    const [copiedLink, setCopiedLink] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);

    // Sincronizar estado cuando se cargan datos
    useEffect(() => {
        if (nailConfig && nailConfig.length > 0) {
            setLocalNailConfig(JSON.parse(JSON.stringify(nailConfig)));
        }
    }, [nailConfig]);

    useEffect(() => {
        if (tenant?.primaryColor) setSelectedColor(tenant.primaryColor);
        if (tenant?.logoUrl) setLogoPreview(tenant.logoUrl);
        if (tenant?.address) setBusinessAddress(tenant.address);
        if (tenant?.googleMapsUrl) setBusinessMapsUrl(tenant.googleMapsUrl);
    }, [tenant]);

    useEffect(() => {
        if (services && services.length > 0) {
            setServicesList(services.map(s => ({ ...s })));
        }
    }, [services]);

    useEffect(() => {
        if (stylists && stylists.length > 0) {
            setPrimarySpecialistName(stylists[0].name || 'Especialista Principal');
        }
    }, [stylists]);

    // Cargar horario de Supabase si ya existe
    useEffect(() => {
        if (!storeTenantId) return;
        const fetchSchedule = async () => {
            try {
                const { data } = await supabase
                    .from('schedule_config')
                    .select('schedule')
                    .eq('tenant_id', storeTenantId)
                    .maybeSingle();

                if (data?.schedule) {
                    setWeeklySchedule(data.schedule);
                }
            } catch (err) {
                console.error('Error fetching schedule_config:', err);
            }
        };
        fetchSchedule();
    }, [storeTenantId]);

    if (!isOpen || !tenant) return null;

    // Enlace oficial de reservas con formato /reserva/:slug
    const officialBookingUrl = `https://www.citalink.app/reserva/${tenant.slug}`;

    const handleNext = () => {
        if (currentStep < totalSteps) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
        }
    };

    // ── Handlers Paso 1: Color & Logo ──
    const handleColorSelect = (hex: string) => {
        setSelectedColor(hex);
        updateTenantData({ primaryColor: hex });
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingLogo(true);
        try {
            const url = await uploadLogo(file);
            if (url) {
                setLogoPreview(url);
                await updateTenantData({ logoUrl: url });
                showToast('¡Logo actualizado con éxito!', 'success');
            }
        } catch (err) {
            console.error('Error subiendo logo:', err);
            showToast('Error al subir el logo', 'error');
        } finally {
            setUploadingLogo(false);
        }
    };

    // ── Handlers Paso 2: Servicios ──
    const handleServicePriceChange = (id: number, val: string) => {
        setServicesList(prev => prev.map(s => s.id === id ? { ...s, price: val } : s));
    };

    const handleSaveServicePrice = (id: number, val: string | number) => {
        const parsed = parseFloat(String(val)) || 0;
        setServicesList(prev => prev.map(s => s.id === id ? { ...s, price: parsed } : s));
        updateService({ id, data: { price: parsed } });
    };

    const handleServiceDurationChange = (id: number, val: string) => {
        setServicesList(prev => prev.map(s => s.id === id ? { ...s, duration: val } : s));
    };

    const handleSaveServiceDuration = (id: number, val: string | number) => {
        const parsed = parseInt(String(val), 10) || 15;
        setServicesList(prev => prev.map(s => s.id === id ? { ...s, duration: parsed } : s));
        updateService({ id, data: { duration: parsed } });
    };

    const handleDeleteService = async (id: number) => {
        setServicesList(prev => prev.filter(s => s.id !== id));
        try {
            await removeService(id);
            showToast('Servicio eliminado', 'info');
        } catch (err) {
            console.error('Error eliminando servicio:', err);
        }
    };

    const handleCreateNewService = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newServiceData.name.trim()) return;

        try {
            await addService({
                name: newServiceData.name.trim(),
                duration: Number(newServiceData.duration) || 30,
                price: Number(newServiceData.price) || 0,
                isAddon: newServiceData.isAddon,
                enableQuoter: false,
                image: '',
            } as any);

            setNewServiceData({ name: '', duration: 30, price: 150, isAddon: false });
            setShowAddServiceForm(false);
            showToast('¡Servicio agregado!', 'success');
        } catch (err) {
            console.error('Error creando servicio:', err);
            showToast('Error al agregar servicio', 'error');
        }
    };

    // ── Handlers Paso 3 (Uñas): Cotizador & Calculadora ──
    const handleNailItemPriceChange = (catId: string, itemId: string, val: string) => {
        setLocalNailConfig(prev => prev.map((cat: any) => {
            if (cat.id !== catId) return cat;
            return {
                ...cat,
                items: cat.items.map((item: any) => item.id === itemId ? { ...item, price: val } : item)
            };
        }));
    };

    const handleSaveNailItemPrice = (catId: string, itemId: string, val: string | number) => {
        const parsed = parseFloat(String(val)) || 0;
        const updated = localNailConfig.map((cat: any) => {
            if (cat.id !== catId) return cat;
            return {
                ...cat,
                items: cat.items.map((item: any) => item.id === itemId ? { ...item, price: parsed } : item)
            };
        });
        setLocalNailConfig(updated);
        saveNailConfig(updated);
    };

    const handleNailItemDurationChange = (catId: string, itemId: string, val: string) => {
        setLocalNailConfig(prev => prev.map((cat: any) => {
            if (cat.id !== catId) return cat;
            return {
                ...cat,
                items: cat.items.map((item: any) => item.id === itemId ? { ...item, duration: val } : item)
            };
        }));
    };

    const handleSaveNailItemDuration = (catId: string, itemId: string, val: string | number) => {
        const parsed = parseInt(String(val), 10) || 15;
        const updated = localNailConfig.map((cat: any) => {
            if (cat.id !== catId) return cat;
            return {
                ...cat,
                items: cat.items.map((item: any) => item.id === itemId ? { ...item, duration: parsed } : item)
            };
        });
        setLocalNailConfig(updated);
        saveNailConfig(updated);
    };

    // ── Handlers Paso 3 / 4: Horarios & Equipo ──
    const handleSavePrimarySpecialistName = async () => {
        if (!primarySpecialistName.trim() || !stylists || stylists.length === 0) return;
        try {
            await updateStylist({
                id: stylists[0].id,
                data: { name: primarySpecialistName.trim() }
            });
            showToast('Nombre actualizado', 'success');
        } catch (err) {
            console.error('Error actualizando estilista:', err);
        }
    };

    const handleToggleDayState = async (dayKey: string, isOpen: boolean) => {
        const currentVal = weeklySchedule[dayKey] || { open: false, start: '09:00', end: '18:00' };
        const updated = {
            ...weeklySchedule,
            [dayKey]: {
                ...currentVal,
                open: isOpen,
            }
        };
        setWeeklySchedule(updated);

        if (storeTenantId) {
            await supabase
                .from('schedule_config')
                .update({ schedule: updated })
                .eq('tenant_id', storeTenantId);
        }
    };

    const handleUpdateDayHours = async (dayKey: string, start: string, end: string) => {
        const currentVal = weeklySchedule[dayKey] || { open: true, start: '09:00', end: '18:00' };
        const updated = {
            ...weeklySchedule,
            [dayKey]: {
                ...currentVal,
                start,
                end,
            }
        };
        setWeeklySchedule(updated);

        if (storeTenantId) {
            await supabase
                .from('schedule_config')
                .update({ schedule: updated })
                .eq('tenant_id', storeTenantId);
        }
    };

    const handleAddCollaborator = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStylistData.name.trim()) return;

        // Límite de 2 profesionales en período de prueba
        if (stylists && stylists.length >= 2) {
            setShowLimitBanner(true);
            return;
        }

        try {
            await addStylist({
                name: newStylistData.name.trim(),
                phone: newStylistData.phone.trim(),
                role: isNailsCategory ? 'Nail Artist' : 'Especialista',
                active: true,
            } as any);

            setNewStylistData({ name: '', phone: '' });
            setShowAddStylistForm(false);
            showToast('¡Colaborador agregado!', 'success');
        } catch (err) {
            console.error('Error agregando colaborador:', err);
            showToast('Error al agregar colaborador', 'error');
        }
    };

    // ── Handlers Paso Final: Ubicación & Enlace con Auto-Detección ──
    const handleSaveLocation = async (addressVal?: string, mapsVal?: string) => {
        let addr = addressVal !== undefined ? addressVal : businessAddress;
        let maps = mapsVal !== undefined ? mapsVal : businessMapsUrl;
        const trimmedMaps = maps.trim();

        // 1. Auto-conversión y Geocodificación Inversa de Coordenadas (ej: 19.4326, -99.1332)
        const coordRegex = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
        if (trimmedMaps && coordRegex.test(trimmedMaps)) {
            maps = `https://www.google.com/maps/search/?api=1&query=${trimmedMaps.replace(/\s/g, '')}`;
            setBusinessMapsUrl(maps);

            if (!addr.trim()) {
                const [lat, lng] = trimmedMaps.split(',').map(s => s.trim());
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
                        headers: { 'Accept-Language': 'es' }
                    });
                    if (res.ok) {
                        const geo = await res.json();
                        if (geo?.display_name) {
                            const a = geo.address || {};
                            const road = a.road || a.pedestrian || a.street || '';
                            const houseNumber = a.house_number || '';
                            const neighbourhood = a.neighbourhood || a.suburb || a.quarter || '';
                            const city = a.city || a.town || a.village || a.county || '';

                            const built = [
                                road ? `${road} ${houseNumber}`.trim() : '',
                                neighbourhood,
                                city
                            ].filter(Boolean).join(', ');

                            const finalAddr = built || geo.display_name;
                            addr = finalAddr;
                            setBusinessAddress(finalAddr);
                            showToast('¡Dirección autodetectada de las coordenadas!', 'success');
                        }
                    }
                } catch (e) {
                    console.warn('Geocoding lookup error:', e);
                }
            }
        }

        // 2. Extraer nombre y dirección si es un link completo de Google Maps (place/...)
        if (trimmedMaps.includes('google.com/maps/place/')) {
            try {
                const match = trimmedMaps.match(/maps\/place\/([^/@?]+)/);
                if (match && match[1]) {
                    const decoded = decodeURIComponent(match[1].replace(/\+/g, ' '));
                    if (!addr.trim()) {
                        addr = decoded;
                        setBusinessAddress(decoded);
                        showToast('¡Dirección detectada del enlace de Maps!', 'success');
                    }
                }
            } catch (e) {
                console.warn('Maps place parsing error:', e);
            }
        }

        updateTenantData({
            address: addr.trim(),
            googleMapsUrl: maps.trim()
        });
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(officialBookingUrl);
        setCopiedLink(true);
        showToast('¡Link copiado al portapapeles!', 'success');
        setTimeout(() => setCopiedLink(false), 3000);
    };

    const handleComplete = async () => {
        setIsFinishing(true);
        try {
            let maps = businessMapsUrl.trim();
            const coordRegex = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
            if (maps && coordRegex.test(maps)) {
                maps = `https://www.google.com/maps/search/?api=1&query=${maps.replace(/\s/g, '')}`;
            }

            if (storeTenantId) {
                await supabase
                    .from('tenants')
                    .update({
                        onboarding_completed: true,
                        primary_color: selectedColor,
                        address: businessAddress.trim(),
                        google_maps_url: maps || null,
                    })
                    .eq('id', storeTenantId);
            }
            
            showToast('¡Configuración inicial completada!', 'success');
            onClose();
        } catch (err: any) {
            console.error('Error al finalizar onboarding:', err);
            onClose();
        } finally {
            setIsFinishing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-2xl bg-[#0d131f] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Header con Barra de Progreso */}
                <div className="p-6 pb-4 border-b border-white/5 bg-[#0a0e17] shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-accent to-amber-500 flex items-center justify-center text-slate-950 font-black">
                                <Sparkles size={16} />
                            </div>
                            <div>
                                <h2 className="text-white font-black text-base uppercase tracking-tight flex items-center gap-2">
                                    Bienvenido a CitaLink
                                    <span className="text-[10px] bg-accent/20 text-accent font-bold px-2 py-0.5 rounded-full">
                                        Paso {currentStep} de {totalSteps}
                                    </span>
                                </h2>
                                <p className="text-xs text-slate-400">Asistente de Configuración Rápida en 2 Minutos</p>
                            </div>
                        </div>
                        <button
                            onClick={handleComplete}
                            className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            Saltar
                        </button>
                    </div>

                    {/* Progress indicator */}
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden flex">
                        {Array.from({ length: totalSteps }).map((_, idx) => (
                            <div
                                key={idx}
                                className={`flex-1 h-full transition-all duration-300 ${
                                    idx + 1 <= currentStep
                                        ? 'bg-gradient-to-r from-accent to-emerald-400'
                                        : 'bg-white/5'
                                } ${idx < totalSteps - 1 ? 'border-r border-slate-950' : ''}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Step Body Content */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">

                    {/* ── PASO 1: Identidad & Color de Marca & Logo ── */}
                    {currentStep === 1 && (
                        <div className="space-y-6 animate-scale-up">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <Palette className="text-accent" size={20} />
                                    1. Personaliza el Color y Logo de tu Negocio
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Elige el color distintivo y sube el logotipo que verán tus clientes al agendar citas.
                                </p>
                            </div>

                            {/* Logo Upload Section */}
                            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center relative group shrink-0">
                                        {logoPreview ? (
                                            <img
                                                src={logoPreview}
                                                alt="Logo"
                                                className="w-full h-full object-cover"
                                                decoding="async"
                                            />
                                        ) : (
                                            <Sparkles size={20} className="text-slate-600" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-white">Logotipo del Negocio</div>
                                        <div className="text-[10px] text-slate-400">PNG, JPG o WebP (opcional)</div>
                                    </div>
                                </div>

                                <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs flex items-center gap-2 transition-all shrink-0">
                                    <Upload size={14} className="text-accent" />
                                    <span>{uploadingLogo ? 'Subiendo...' : logoPreview ? 'Cambiar Logo' : 'Subir Logo'}</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoUpload}
                                        className="hidden"
                                        disabled={uploadingLogo}
                                    />
                                </label>
                            </div>

                            {/* Color Selector Grid */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-300 block uppercase tracking-wider">
                                    Colores de Marca
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    {PRESET_COLORS.map(color => (
                                        <button
                                            key={color.hex}
                                            type="button"
                                            onClick={() => handleColorSelect(color.hex)}
                                            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                                                selectedColor.toLowerCase() === color.hex.toLowerCase()
                                                    ? 'bg-white/10 border-white text-white shadow-lg ring-2 ring-accent/30'
                                                    : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5'
                                            }`}
                                        >
                                            <div
                                                className="w-6 h-6 rounded-xl shrink-0 shadow-sm border border-white/20"
                                                style={{ backgroundColor: color.hex }}
                                            />
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-white truncate">{color.name}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Live Preview Card */}
                            <div className="p-5 rounded-3xl bg-black/40 border border-white/5 space-y-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Vista Previa de tu Botón Público</span>
                                <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                                    <div className="flex items-center gap-3">
                                        {logoPreview && (
                                            <img
                                                src={logoPreview}
                                                alt="Logo preview"
                                                className="w-10 h-10 rounded-xl object-cover border border-white/10"
                                                decoding="async"
                                            />
                                        )}
                                        <div>
                                            <div className="text-sm font-black text-white">{tenant.name}</div>
                                            <div className="text-xs text-slate-400">{tenant.address || 'Tu dirección comercial'}</div>
                                        </div>
                                    </div>
                                    <button
                                        style={{
                                            backgroundColor: selectedColor,
                                            color: getContrastColor(selectedColor)
                                        }}
                                        className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-md shrink-0"
                                    >
                                        Agendar Cita
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── PASO 2: Catálogo de Servicios Pre-Cargados ── */}
                    {currentStep === 2 && (
                        <div className="space-y-5 animate-scale-up">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                        <Sparkles className="text-accent" size={20} />
                                        2. Revisa tus Servicios Pre-Cargados
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Ajusta precios y duraciones con un clic, o añade más servicios según tu catálogo.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAddServiceForm(!showAddServiceForm)}
                                    className="px-3 py-1.5 rounded-xl bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent font-bold text-xs flex items-center gap-1.5 transition-all shrink-0"
                                >
                                    <Plus size={14} />
                                    <span>Agregar Servicio</span>
                                </button>
                            </div>

                            {/* Formulario rápido para añadir servicio */}
                            {showAddServiceForm && (
                                <form onSubmit={handleCreateNewService} className="p-4 rounded-2xl bg-black/60 border border-accent/30 space-y-3 animate-fade-in">
                                    <div className="text-xs font-black text-white uppercase">Nuevo Servicio Rápido</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <input
                                            required
                                            type="text"
                                            placeholder="Nombre del servicio"
                                            className="w-full bg-[#040814] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-accent"
                                            value={newServiceData.name}
                                            onChange={e => setNewServiceData({ ...newServiceData, name: e.target.value })}
                                        />
                                        <div className="flex items-center gap-1 bg-[#040814] border border-slate-700 rounded-xl px-2 py-1">
                                            <Clock size={12} className="text-slate-500" />
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="Minutos"
                                                className="w-full bg-transparent text-white text-xs focus:outline-none"
                                                value={newServiceData.duration}
                                                onChange={e => setNewServiceData({ ...newServiceData, duration: e.target.value })}
                                            />
                                            <span className="text-[10px] text-slate-500">min</span>
                                        </div>
                                        <div className="flex items-center gap-1 bg-[#040814] border border-slate-700 rounded-xl px-2 py-1">
                                            <span className="text-xs font-bold text-accent">{tenant.currencySymbol || '$'}</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="Precio"
                                                className="w-full bg-transparent text-white text-xs focus:outline-none"
                                                value={newServiceData.price}
                                                onChange={e => setNewServiceData({ ...newServiceData, price: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-400">
                                            <input
                                                type="checkbox"
                                                checked={newServiceData.isAddon}
                                                onChange={e => setNewServiceData({ ...newServiceData, isAddon: e.target.checked })}
                                                className="rounded border-slate-700 bg-black/40 text-accent focus:ring-0"
                                            />
                                            <span>Es un servicio adicional / extra</span>
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowAddServiceForm(false)}
                                                className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit"
                                                className="px-4 py-1.5 rounded-xl bg-accent text-slate-950 font-black text-xs uppercase shadow"
                                            >
                                                Guardar
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {/* Lista de Servicios */}
                            <div className="space-y-2.5">
                                {servicesList.map(srv => (
                                    <div
                                        key={srv.id}
                                        className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors flex items-center justify-between gap-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-white uppercase truncate">{srv.name}</span>
                                                {srv.isAddon && (
                                                    <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded font-black shrink-0">
                                                        Adicional
                                                    </span>
                                                )}
                                                {srv.enableQuoter && (
                                                    <span className="text-[9px] bg-pink-500/10 text-pink-400 border border-pink-500/20 px-1.5 py-0.5 rounded font-black shrink-0">
                                                        Cotizador Activo
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                                {srv.description && <span>{srv.description}</span>}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Selector de Duración Rápida */}
                                            <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl px-2 py-1">
                                                <Clock size={11} className="text-slate-400" />
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    className="w-10 bg-transparent text-[11px] font-bold text-slate-200 focus:outline-none text-right"
                                                    value={srv.duration ?? ''}
                                                    onChange={(e) => handleServiceDurationChange(srv.id, e.target.value)}
                                                    onBlur={(e) => handleSaveServiceDuration(srv.id, e.target.value)}
                                                />
                                                <span className="text-[10px] text-slate-500">m</span>
                                            </div>

                                            {/* Input de Precio Rápido */}
                                            <div className="flex items-center gap-1 bg-black/50 border border-white/10 rounded-xl px-2.5 py-1">
                                                <span className="text-xs font-bold text-accent">{tenant.currencySymbol || '$'}</span>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    className="w-14 bg-transparent text-xs font-black text-white focus:outline-none text-right"
                                                    value={srv.price ?? ''}
                                                    onChange={(e) => handleServicePriceChange(srv.id, e.target.value)}
                                                    onBlur={(e) => handleSaveServicePrice(srv.id, e.target.value)}
                                                />
                                            </div>

                                            {/* Botón de Eliminar */}
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteService(srv.id)}
                                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                                title="Eliminar este servicio"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Banner Informativo del Paso 2 */}
                            <div className="p-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-start gap-2.5">
                                <Info size={16} className="text-violet-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    En el módulo de <strong className="text-white">Servicios</strong> podrás subir fotos de cada trabajo y definir si cada profesional tiene sus propios precios y duraciones personalizadas.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── PASO 3 (SOLO UÑAS): Cotizador de Uñas Inteligente de Mar del Rey ── */}
                    {currentStep === 3 && isNailsCategory && (
                        <div className="space-y-5 animate-scale-up">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <Bot className="text-pink-400" size={20} />
                                    3. Calculadora y Cotizador de Uñas
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Ajusta los precios y duraciones de tu cotizador de uñas según tu lista de precios.
                                </p>
                            </div>

                            {/* Pestañas de Categoría */}
                            <div className="flex items-center gap-1.5 p-1 bg-black/40 border border-white/10 rounded-2xl">
                                <button
                                    type="button"
                                    onClick={() => setSelectedNailTab('sizes')}
                                    className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black transition-all truncate ${
                                        selectedNailTab === 'sizes'
                                            ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/25'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    📏 Largos (#1-#8)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedNailTab('base_services')}
                                    className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black transition-all truncate ${
                                        selectedNailTab === 'base_services'
                                            ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/25'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    💅 Técnicas Base
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedNailTab('extras')}
                                    className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-black transition-all truncate ${
                                        selectedNailTab === 'extras'
                                            ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/25'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    ✨ Retiros y Extras
                                </button>
                            </div>

                            {/* Lista de Items Editables según la Pestaña */}
                            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                                {localNailConfig
                                    .find(cat => cat.id === selectedNailTab)
                                    ?.items.map((item: any) => (
                                        <div
                                            key={item.id}
                                            className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <span className="text-xs font-bold text-white block truncate">{item.name}</span>
                                                {item.unit && (
                                                    <span className="text-[10px] text-pink-400 font-medium">{item.unit}</span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                {/* Si el item tiene duración (ej: Retiros/Extras) */}
                                                {(item.duration !== undefined || selectedNailTab === 'extras') && (
                                                    <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl px-2 py-1">
                                                        <Clock size={11} className="text-slate-400" />
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            className="w-10 bg-transparent text-[11px] font-bold text-slate-200 focus:outline-none text-right"
                                                            value={item.duration ?? ''}
                                                            onChange={(e) => handleNailItemDurationChange(selectedNailTab, item.id, e.target.value)}
                                                            onBlur={(e) => handleSaveNailItemDuration(selectedNailTab, item.id, e.target.value)}
                                                        />
                                                        <span className="text-[10px] text-slate-500">m</span>
                                                    </div>
                                                )}

                                                {/* Input de Precio Rápido */}
                                                <div className="flex items-center gap-1 bg-black/50 border border-white/10 rounded-xl px-2.5 py-1">
                                                    <span className="text-xs font-bold text-pink-400">{tenant.currencySymbol || '$'}</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        className="w-14 bg-transparent text-xs font-black text-white focus:outline-none text-right"
                                                        value={item.price ?? ''}
                                                        onChange={(e) => handleNailItemPriceChange(selectedNailTab, item.id, e.target.value)}
                                                        onBlur={(e) => handleSaveNailItemPrice(selectedNailTab, item.id, e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>

                            {/* Nota Informativa Destacada */}
                            <div className="p-3.5 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-start gap-2.5">
                                <Info size={16} className="text-pink-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    En el módulo de <strong className="text-white">Servicios</strong> deberás asignarle la calculadora de uñas al servicio que lo necesite (activando la casilla <span className="text-pink-400 font-bold">"Activar Cotizador de Uñas"</span>).
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── PASO 4 (o 3 si no es Uñas): Horarios & Equipo ── */}
                    {((currentStep === 4 && isNailsCategory) || (currentStep === 3 && !isNailsCategory)) && (
                        <div className="space-y-5 animate-scale-up">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <Calendar className="text-accent" size={20} />
                                    {isNailsCategory ? '4.' : '3.'} Horarios de Atención y Equipo
                                </h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Ajusta tu nombre profesional y los horarios de atención por cada día.
                                </p>
                            </div>

                            {/* Especialista Principal Editable */}
                            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Especialista Principal</span>
                                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                        <UserCheck size={11} /> Citas Activas
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent/20 to-purple-500/20 border border-white/10 flex items-center justify-center font-bold text-white shrink-0">
                                        <Users size={18} className="text-accent" />
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            placeholder="Tu Nombre Comercial"
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-accent"
                                            value={primarySpecialistName}
                                            onChange={e => setPrimarySpecialistName(e.target.value)}
                                            onBlur={handleSavePrimarySpecialistName}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Horarios de Atención por Día (Formato Clásico de Configuración de Negocio) */}
                            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                        Horarios de Atención por Día
                                    </span>
                                    <span className="text-[10px] text-accent font-bold">
                                        {Object.values(weeklySchedule).filter((d: any) => d?.open).length} días abiertos
                                    </span>
                                </div>

                                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                    {DAY_KEYS.map(day => {
                                        const hours = weeklySchedule[day] || { open: false, start: '09:00', end: '18:00' };
                                        return (
                                            <div
                                                key={day}
                                                className={`p-3 rounded-xl border transition-all ${
                                                    hours.open
                                                        ? 'bg-white/[0.02] border-white/10 hover:border-white/20'
                                                        : 'bg-white/[0.01] border-white/5 opacity-60'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="font-bold text-xs text-white flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full shrink-0 ${hours.open ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-rose-500'}`} />
                                                        <span>{DAY_NAMES[day]}</span>
                                                    </div>

                                                    {/* Switch On / Off */}
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={hours.open}
                                                            onChange={e => handleToggleDayState(day, e.target.checked)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
                                                </div>

                                                {hours.open ? (
                                                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5">
                                                        {/* Apertura Stepper */}
                                                        <div className="p-1.5 px-2 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                                                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Abre</span>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateDayHours(day, stepTime(hours.start, -30), hours.end || '18:00')}
                                                                    className="w-5 h-5 rounded-md bg-white/5 hover:bg-white/20 text-slate-300 font-bold text-xs flex items-center justify-center transition-colors"
                                                                >
                                                                    −
                                                                </button>
                                                                <span className="font-mono font-bold text-[11px] text-white px-1">
                                                                    {formatTime12h(hours.start || '09:00')}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateDayHours(day, stepTime(hours.start, 30), hours.end || '18:00')}
                                                                    className="w-5 h-5 rounded-md bg-white/5 hover:bg-white/20 text-slate-300 font-bold text-xs flex items-center justify-center transition-colors"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Cierre Stepper */}
                                                        <div className="p-1.5 px-2 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                                                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Cierra</span>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateDayHours(day, hours.start || '09:00', stepTime(hours.end || '18:00', -30))}
                                                                    className="w-5 h-5 rounded-md bg-white/5 hover:bg-white/20 text-slate-300 font-bold text-xs flex items-center justify-center transition-colors"
                                                                >
                                                                    −
                                                                </button>
                                                                <span className="font-mono font-bold text-[11px] text-white px-1">
                                                                    {formatTime12h(hours.end || '18:00')}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateDayHours(day, hours.start || '09:00', stepTime(hours.end || '18:00', 30))}
                                                                    className="w-5 h-5 rounded-md bg-white/5 hover:bg-white/20 text-slate-300 font-bold text-xs flex items-center justify-center transition-colors"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-[11px] text-slate-500 italic mt-1 pl-4">
                                                        Cerrado (Descanso)
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Sección de Colaboradores Adicionales */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                        Equipo de Trabajo ({stylists?.length || 1}/2 en prueba)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (stylists && stylists.length >= 2) {
                                                setShowLimitBanner(true);
                                            } else {
                                                setShowAddStylistForm(!showAddStylistForm);
                                            }
                                        }}
                                        className="text-xs text-accent hover:underline font-bold flex items-center gap-1"
                                    >
                                        <Plus size={13} />
                                        <span>Agregar Colaborador</span>
                                    </button>
                                </div>

                                {/* Formulario para agregar colaborador */}
                                {showAddStylistForm && (
                                    <form onSubmit={handleAddCollaborator} className="p-4 rounded-2xl bg-black/60 border border-accent/30 space-y-3 animate-fade-in">
                                        <div className="text-xs font-black text-white uppercase">Registrar Nuevo Colaborador</div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <input
                                                required
                                                type="text"
                                                placeholder="Nombre del colaborador"
                                                className="w-full bg-[#040814] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-accent"
                                                value={newStylistData.name}
                                                onChange={e => setNewStylistData({ ...newStylistData, name: e.target.value })}
                                            />
                                            <input
                                                type="tel"
                                                placeholder="WhatsApp (opcional)"
                                                className="w-full bg-[#040814] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-accent"
                                                value={newStylistData.phone}
                                                onChange={e => setNewStylistData({ ...newStylistData, phone: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => setShowAddStylistForm(false)}
                                                className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit"
                                                className="px-4 py-1.5 rounded-xl bg-accent text-slate-950 font-black text-xs uppercase shadow"
                                            >
                                                Agregar
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* Banner de Límite de Prueba */}
                                {showLimitBanner && (
                                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 animate-fade-in">
                                        <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-200 leading-relaxed">
                                            El periodo de prueba incluye hasta 2 profesionales activos. Al activar tu Plan Pro podrás añadir todos los que necesites por solo <strong>$249MXN / mes</strong> por profesional extra.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Banner Informativo del Paso 3 */}
                            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5">
                                <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    En el módulo de profesionales, presionando el botón <strong className="text-white">Editar Profesional</strong>, podrás configurar comisiones, turnos individuales y descansos de comida.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── PASO FINAL: ¡Lanzamiento & Enlace Oficial Listo! ── */}
                    {((currentStep === 5 && isNailsCategory) || (currentStep === 4 && !isNailsCategory)) && (
                        <div className="space-y-6 text-center animate-scale-up py-4">
                            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                                <CheckCircle2 size={32} />
                            </div>

                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                                    ¡Tu Agenda de CitaLink está Lista!
                                </h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                                    Comparte tu link con tus clientes en WhatsApp o ponlo en la biografía de tu perfil de Instagram para empezar a recibir reservas 24/7.
                                </p>
                            </div>

                            {/* Sección de Ubicación y Coordenadas del Negocio */}
                            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3 text-left max-w-lg mx-auto">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                        <MapPin size={14} className="text-accent" /> Ubicación del Negocio
                                    </span>
                                    {businessMapsUrl && (
                                        <a
                                            href={businessMapsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] text-accent hover:underline font-bold flex items-center gap-1"
                                        >
                                            <ExternalLink size={11} /> Probar Maps
                                        </a>
                                    )}
                                </div>

                                <div className="space-y-2.5">
                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                                            Dirección Escrita
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ej. Av. Juárez 450, Col. Centro"
                                            className="w-full bg-[#040814] border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-accent"
                                            value={businessAddress}
                                            onChange={e => setBusinessAddress(e.target.value)}
                                            onBlur={e => handleSaveLocation(e.target.value, undefined)}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                                            Enlace de Google Maps
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="https://maps.app.goo.gl/... o Coordenadas"
                                            className="w-full bg-[#040814] border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-accent font-mono text-[11px]"
                                            value={businessMapsUrl}
                                            onChange={e => setBusinessMapsUrl(e.target.value)}
                                            onBlur={e => handleSaveLocation(undefined, e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Instrucciones Paso a Paso de Google Maps */}
                                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-slate-300 space-y-2 text-[11px] leading-relaxed">
                                    <p className="font-bold text-blue-300 flex items-center gap-1">
                                        <Info size={13} /> ¿Cómo obtener el enlace exacto de tu negocio?
                                    </p>
                                    <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[10px] pl-0.5">
                                        <li>Abre <strong>Google Maps</strong> en tu celular o PC.</li>
                                        <li>Presiona sobre la <strong>ubicación exacta o nombre de tu negocio</strong>.</li>
                                        <li>Toca el botón <strong className="text-white">Compartir</strong> y luego selecciona <strong className="text-white">Copiar vínculo</strong>.</li>
                                        <li>Pega el enlace en el campo de arriba y listo. Tus clientes tendrán el botón GPS directo para llegar sin perderse.</li>
                                    </ol>
                                </div>
                            </div>

                            {/* Official Booking Link Box */}
                            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-left max-w-lg mx-auto">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tu Link Exclusivo</span>
                                    <span className="text-xs font-mono font-bold text-accent truncate block">{officialBookingUrl}</span>
                                </div>
                                <button
                                    onClick={handleCopyLink}
                                    className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 ${
                                        copiedLink
                                            ? 'bg-emerald-500 text-slate-950'
                                            : 'bg-white/10 hover:bg-white/20 text-white'
                                    }`}
                                >
                                    <Copy size={14} />
                                    {copiedLink ? '¡Copiado!' : 'Copiar'}
                                </button>
                            </div>

                            {/* Social Share Buttons */}
                            <div className="flex items-center justify-center gap-3 pt-2">
                                <a
                                    href={`https://wa.me/?text=${encodeURIComponent(`¡Hola! Ya puedes agendar tu cita en línea en ${tenant.name} aquí: ${officialBookingUrl}`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-2 transition-all"
                                >
                                    <MessageCircle size={15} />
                                    <span>Compartir en WhatsApp</span>
                                </a>
                                <a
                                    href={officialBookingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold text-xs flex items-center gap-2 transition-all"
                                >
                                    <ExternalLink size={14} />
                                    <span>Ver mi Link Público</span>
                                </a>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Controls */}
                <div className="p-4 px-6 border-t border-white/5 bg-[#0a0e17] shrink-0 flex items-center justify-between gap-3">
                    {currentStep > 1 ? (
                        <button
                            type="button"
                            onClick={handlePrev}
                            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
                        >
                            <ArrowLeft size={14} /> Anterior
                        </button>
                    ) : <div />}

                    <button
                        type="button"
                        onClick={handleNext}
                        disabled={isFinishing}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-accent to-emerald-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-accent/20 transition-all hover:scale-105"
                    >
                        {currentStep === totalSteps ? (
                            <>
                                <span>Entrar a mi Panel</span>
                                <Check size={14} />
                            </>
                        ) : (
                            <>
                                <span>Siguiente</span>
                                <ArrowRight size={14} />
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
