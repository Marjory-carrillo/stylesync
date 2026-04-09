import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2,
    Scissors,
    Camera,
    Clock,
    Sparkles,
    Building2,
    ImageIcon,
    X,
    Rocket,
    ArrowRight,
} from 'lucide-react';

interface OnboardingChecklistProps {
    tenantId: string;
    stylists: any[];
    services: any[];
    tenantConfig: any;
    schedule: any;
}

interface Task {
    id: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    description: string;
    route: string;
    done: boolean;
    color: string;
    glow: string;
}

export function OnboardingChecklist({
    tenantId,
    stylists,
    services,
    tenantConfig,
    schedule,
}: OnboardingChecklistProps) {
    const navigate = useNavigate();
    const dismissKey = `citalink_onboarding_dismissed_${tenantId}`;
    const [dismissed, setDismissed] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setDismissed(!!localStorage.getItem(dismissKey));
        const t = setTimeout(() => setMounted(true), 80);
        return () => clearTimeout(t);
    }, [dismissKey]);

    const tasks: Task[] = useMemo(() => {
        // Compare against the known default schedule to detect if admin actually customized it
        const DEFAULT_SCHEDULE = {
            monday:    { open: true,  start: '09:00', end: '18:00' },
            tuesday:   { open: true,  start: '09:00', end: '18:00' },
            wednesday: { open: true,  start: '09:00', end: '18:00' },
            thursday:  { open: true,  start: '09:00', end: '18:00' },
            friday:    { open: true,  start: '09:00', end: '18:00' },
            saturday:  { open: true,  start: '09:00', end: '14:00' },
            sunday:    { open: false, start: '09:00', end: '14:00' },
        };
        const hasScheduleCustomized = schedule
            ? Object.entries(DEFAULT_SCHEDULE).some(([day, def]) => {
                const actual = (schedule as any)[day];
                if (!actual) return false;
                return actual.open !== def.open || actual.start !== def.start || actual.end !== def.end;
            })
            : false;

        // Detect if items were manually created (not auto-seeded on tenant creation)
        // Auto-seeded items are created within the first 3 minutes of the tenant
        const tenantCreatedAt = tenantConfig?.createdAt ? new Date(tenantConfig.createdAt).getTime() : 0;
        const AUTO_SEED_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

        const hasRealStylist = stylists.some((s) => {
            if (!s.created_at) return true; // no timestamp = treat as real
            const diff = new Date(s.created_at).getTime() - tenantCreatedAt;
            return diff > AUTO_SEED_WINDOW_MS;
        });

        const hasRealService = services.some((s) => {
            if (!s.created_at) return true;
            const diff = new Date(s.created_at).getTime() - tenantCreatedAt;
            return diff > AUTO_SEED_WINDOW_MS;
        });

        const hasStylistPhoto = stylists.some((s) => !!s.photo_url);

        return [
            {
                id: 'stylist',
                icon: Scissors,
                label: 'Agrega tu primer profesional',
                description: 'Crea al menos un miembro del equipo.',
                route: '/admin/staff',
                done: hasRealStylist,
                color: 'from-violet-500 to-purple-600',
                glow: 'shadow-violet-500/25',
            },
            {
                id: 'photo',
                icon: Camera,
                label: 'Sube la foto del profesional',
                description: 'Genera confianza con una foto de perfil.',
                route: '/admin/staff',
                done: hasStylistPhoto,
                color: 'from-pink-500 to-rose-600',
                glow: 'shadow-pink-500/25',
            },
            {
                id: 'schedule',
                icon: Clock,
                label: 'Personaliza tu horario',
                description: 'Define días y horas disponibles.',
                route: '/admin/settings',
                done: hasScheduleCustomized,
                color: 'from-amber-400 to-orange-500',
                glow: 'shadow-amber-500/25',
            },
            {
                id: 'services',
                icon: Sparkles,
                label: 'Configura tus servicios',
                description: 'Agrega servicios y precios.',
                route: '/admin/services',
                done: hasRealService,
                color: 'from-cyan-400 to-blue-500',
                glow: 'shadow-cyan-500/25',
            },
            {
                id: 'info',
                icon: Building2,
                label: 'Info del negocio',
                description: 'Dirección y teléfono de contacto.',
                route: '/admin/settings',
                done: !!(tenantConfig?.address && tenantConfig?.phone),
                color: 'from-emerald-400 to-teal-500',
                glow: 'shadow-emerald-500/25',
            },
            {
                id: 'logo',
                icon: ImageIcon,
                label: 'Sube el logo',
                description: 'Tu logo en la app de clientes.',
                route: '/admin/settings',
                done: !!tenantConfig?.logoUrl,
                color: 'from-indigo-400 to-violet-500',
                glow: 'shadow-indigo-500/25',
            },
        ];
    }, [stylists, services, tenantConfig, schedule]);

    const completedCount = tasks.filter((t) => t.done).length;
    const totalCount = tasks.length;
    const progressPct = Math.round((completedCount / totalCount) * 100);
    const allDone = completedCount === totalCount;

    useEffect(() => {
        if (allDone && !dismissed) {
            const t = setTimeout(() => handleDismiss(), 2500);
            return () => clearTimeout(t);
        }
    }, [allDone, dismissed]);

    const handleDismiss = () => {
        setLeaving(true);
        setTimeout(() => {
            localStorage.setItem(dismissKey, '1');
            setDismissed(true);
        }, 500);
    };

    if (dismissed) return null;

    return (
        <div
            className={`relative mb-8 transition-all duration-500 ease-out
                ${mounted && !leaving ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}
                ${leaving ? 'opacity-0 scale-95 pointer-events-none' : ''}`}
        >
            {/* Main card */}
            <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0c1428]">

                {/* Gradient header strip */}
                <div className="relative h-2 w-full overflow-hidden bg-white/5">
                    <div
                        className="h-full bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400 transition-all duration-1000 ease-out"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>

                {/* Ambient blobs */}
                <div className="absolute top-4 right-8 w-56 h-56 rounded-full bg-violet-600/8 blur-[80px] pointer-events-none" />
                <div className="absolute bottom-0 left-16 w-40 h-40 rounded-full bg-cyan-500/6 blur-[60px] pointer-events-none" />

                <div className="relative z-10 p-6 md:p-8">

                    {/* ── Header ── */}
                    <div className="flex items-start justify-between gap-4 mb-7">
                        <div className="flex items-center gap-4">
                            {/* Animated rocket icon */}
                            <div className="relative w-12 h-12 shrink-0">
                                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 blur-md" />
                                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-600/10 border border-violet-500/20 flex items-center justify-center">
                                    <Rocket size={22} className={`text-violet-400 ${allDone ? '' : 'animate-bounce'}`} />
                                </div>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white tracking-tight">
                                    {allDone ? '🎉 ¡Todo configurado!' : 'Configura tu negocio'}
                                </h2>
                                <p className="text-sm text-slate-400 mt-0.5">
                                    {allDone
                                        ? 'Tu negocio está listo para recibir citas.'
                                        : `${completedCount} de ${totalCount} pasos •`}
                                    {!allDone && (
                                        <span className="ml-1 font-bold text-violet-400">{progressPct}% completado</span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="p-2 rounded-xl text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] transition-all duration-200 shrink-0 mt-0.5"
                            title="Descartar"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* ── Tasks grid ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {tasks.map((task, idx) => {
                            const Icon = task.icon;
                            return (
                                <button
                                    key={task.id}
                                    onClick={() => !task.done && navigate(task.route)}
                                    disabled={task.done}
                                    className={`group relative text-left rounded-2xl border overflow-hidden transition-all duration-300 w-full
                                        ${task.done
                                            ? 'bg-emerald-500/[0.06] border-emerald-500/20 cursor-default'
                                            : 'bg-white/[0.03] border-white/[0.07] hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.98] cursor-pointer hover:shadow-lg hover:shadow-black/20'
                                        }`}
                                >
                                    {/* Subtle top-left glow when pending */}
                                    {!task.done && (
                                        <div className={`absolute -top-4 -left-4 w-16 h-16 rounded-full bg-gradient-to-br ${task.color} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity`} />
                                    )}

                                    <div className="relative p-4">
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            {/* Step number + icon */}
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300
                                                ${task.done
                                                    ? 'bg-emerald-500/15 border border-emerald-500/20'
                                                    : `bg-gradient-to-br ${task.color} opacity-90 shadow-lg ${task.glow}`
                                                }`}
                                            >
                                                {task.done
                                                    ? <CheckCircle2 size={18} className="text-emerald-400" />
                                                    : <Icon size={16} className="text-white" />
                                                }
                                            </div>

                                            {/* Step counter badge */}
                                            <span className={`text-[10px] font-black tabular-nums px-2 py-0.5 rounded-full border transition-colors
                                                ${task.done
                                                    ? 'text-emerald-500/60 border-emerald-500/10 bg-emerald-500/5'
                                                    : 'text-slate-600 border-white/[0.06] bg-white/[0.03]'
                                                }`}>
                                                {String(idx + 1).padStart(2, '0')}
                                            </span>
                                        </div>

                                        <div className={`text-sm font-bold leading-tight mb-1 transition-colors
                                            ${task.done ? 'text-slate-500' : 'text-slate-200 group-hover:text-white'}`}>
                                            {task.label}
                                        </div>
                                        <div className={`text-[11px] leading-relaxed transition-colors
                                            ${task.done ? 'text-slate-700' : 'text-slate-500 group-hover:text-slate-400'}`}>
                                            {task.description}
                                        </div>

                                        {/* Action hint */}
                                        {!task.done && (
                                            <div className="flex items-center gap-1 mt-3 text-[10px] font-bold text-slate-600 group-hover:text-violet-400 transition-colors">
                                                <span>Configurar</span>
                                                <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Footer progress ── */}
                    {!allDone && (
                        <div className="mt-6 pt-5 border-t border-white/[0.05] flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 flex-wrap">
                                {tasks.map((t) => (
                                    <div
                                        key={t.id}
                                        className={`h-1.5 rounded-full transition-all duration-500 ${
                                            t.done
                                                ? 'w-6 bg-gradient-to-r from-emerald-400 to-teal-400'
                                                : 'w-4 bg-white/10'
                                        }`}
                                    />
                                ))}
                            </div>
                            <button
                                onClick={handleDismiss}
                                className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors whitespace-nowrap font-medium"
                            >
                                Descartar guía
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
