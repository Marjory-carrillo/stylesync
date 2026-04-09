import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2,
    Circle,
    ChevronRight,
    Scissors,
    Camera,
    Clock,
    Sparkles,
    Building2,
    ImageIcon,
    X,
    Rocket,
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
    icon: React.ReactNode;
    label: string;
    description: string;
    route: string;
    done: boolean;
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
        // mount animation
        const t = setTimeout(() => setMounted(true), 50);
        return () => clearTimeout(t);
    }, [dismissKey]);

    const tasks: Task[] = useMemo(() => {
        const hasScheduleCustomized = schedule
            ? Object.values(schedule as Record<string, { open: boolean }>).some((d) => d.open)
            : false;

        return [
            {
                id: 'stylist',
                icon: <Scissors size={16} />,
                label: 'Agrega tu primer estilista',
                description: 'Crea al menos un miembro del equipo para que los clientes puedan agendar.',
                route: '/admin/team',
                done: stylists.length > 0,
            },
            {
                id: 'photo',
                icon: <Camera size={16} />,
                label: 'Sube la foto del estilista',
                description: 'Una foto genera más confianza en tus clientes al reservar.',
                route: '/admin/team',
                done: stylists.some((s) => !!s.photo_url),
            },
            {
                id: 'schedule',
                icon: <Clock size={16} />,
                label: 'Personaliza tu horario',
                description: 'Define los días y horas en que aceptas citas.',
                route: '/admin/settings',
                done: hasScheduleCustomized,
            },
            {
                id: 'services',
                icon: <Sparkles size={16} />,
                label: 'Configura tus servicios',
                description: 'Agrega los servicios y precios que ofreces.',
                route: '/admin/services',
                done: services.length > 0,
            },
            {
                id: 'info',
                icon: <Building2 size={16} />,
                label: 'Completa la información del negocio',
                description: 'Dirección y teléfono para que tus clientes te encuentren.',
                route: '/admin/settings',
                done: !!(tenantConfig?.address && tenantConfig?.phone),
            },
            {
                id: 'logo',
                icon: <ImageIcon size={16} />,
                label: 'Sube el logo de tu negocio',
                description: 'Tu logo aparece en la app de reservas que ven tus clientes.',
                route: '/admin/branding',
                done: !!tenantConfig?.logoUrl,
            },
        ];
    }, [stylists, services, tenantConfig, schedule]);

    const completedCount = tasks.filter((t) => t.done).length;
    const totalCount = tasks.length;
    const progressPct = Math.round((completedCount / totalCount) * 100);
    const allDone = completedCount === totalCount;

    // Auto-dismiss when all tasks complete
    useEffect(() => {
        if (allDone && !dismissed) {
            const t = setTimeout(() => handleDismiss(), 2000);
            return () => clearTimeout(t);
        }
    }, [allDone, dismissed]);

    const handleDismiss = () => {
        setLeaving(true);
        setTimeout(() => {
            localStorage.setItem(dismissKey, '1');
            setDismissed(true);
        }, 400);
    };

    if (dismissed) return null;

    return (
        <div
            className={`relative overflow-hidden rounded-[2rem] border border-white/10 p-6 md:p-8 mb-8 shadow-2xl transition-all duration-500 ease-in-out
                ${mounted && !leaving ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
                ${leaving ? 'opacity-0 scale-95 pointer-events-none' : ''}
                bg-gradient-to-br from-violet-600/10 via-[#0f172a] to-cyan-600/5`}
        >
            {/* Ambient glow */}
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-violet-600/10 blur-[80px] pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 flex items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                        <Rocket size={20} className="text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white tracking-tight">
                            {allDone ? '🎉 ¡Todo listo!' : 'Configura tu negocio'}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {allDone
                                ? 'Tu negocio está listo para recibir citas.'
                                : `${completedCount} de ${totalCount} pasos completados`}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all shrink-0"
                    title="Descartar"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Progress bar */}
            <div className="relative z-10 mb-6">
                <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">Progreso</span>
                    <span className="text-[11px] font-black text-violet-400">{progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden border border-white/5">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-700 ease-out"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            </div>

            {/* Tasks grid */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {tasks.map((task) => (
                    <button
                        key={task.id}
                        onClick={() => !task.done && navigate(task.route)}
                        disabled={task.done}
                        className={`group flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 w-full
                            ${task.done
                                ? 'bg-emerald-500/5 border-emerald-500/15 cursor-default'
                                : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.07] hover:border-violet-500/30 active:scale-[0.98] cursor-pointer'
                            }`}
                    >
                        {/* Check icon */}
                        <div className={`shrink-0 transition-all duration-300 ${task.done ? 'text-emerald-400 scale-110' : 'text-slate-600'}`}>
                            {task.done
                                ? <CheckCircle2 size={20} />
                                : <Circle size={20} />
                            }
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className={`text-sm font-semibold leading-tight transition-colors duration-200 truncate
                                ${task.done ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-200 group-hover:text-white'}`}>
                                {task.label}
                            </div>
                            {!task.done && (
                                <div className="text-[11px] text-slate-500 mt-0.5 truncate">{task.description}</div>
                            )}
                        </div>

                        {/* Arrow */}
                        {!task.done && (
                            <ChevronRight size={14} className="shrink-0 text-slate-600 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all duration-200" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
