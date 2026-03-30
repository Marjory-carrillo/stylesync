import { useState, useRef, useEffect } from 'react';
import { Bell, X, Calendar, RotateCcw, XCircle, CheckCircle, Trash2, BellOff } from 'lucide-react';
import type { AdminNotification, NotifType } from '../lib/store/useRealtimeNotifications';

interface Props {
    notifications: AdminNotification[];
    unreadCount: number;
    onMarkAllRead: () => void;
    onDismiss: (id: string) => void;
    onClearAll: () => void;
}

const TYPE_CONFIG: Record<NotifType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
    new:       { icon: Calendar,    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Nueva cita'       },
    reschedule:{ icon: RotateCcw,   color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',       label: 'Reprogramada'     },
    cancel:    { icon: XCircle,     color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',         label: 'Cancelada'        },
    complete:  { icon: CheckCircle, color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20',   label: 'Completada'       },
};

function timeAgo(date: Date): string {
    const secs = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secs < 60)  return 'ahora';
    if (secs < 3600) return `hace ${Math.floor(secs/60)} min`;
    if (secs < 86400) return `hace ${Math.floor(secs/3600)}h`;
    return `hace ${Math.floor(secs/86400)}d`;
}

function formatDate(date: string, time: string): string {
    const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const d = new Date(`${date}T${time}`);
    return `${days[d.getDay()]} ${d.getDate()} · ${time.slice(0,5)}`;
}

export default function NotificationBell({ notifications, unreadCount, onMarkAllRead, onDismiss, onClearAll }: Props) {
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Auto-mark as read when panel opens
    useEffect(() => {
        if (open && unreadCount > 0) {
            const timer = setTimeout(onMarkAllRead, 1500);
            return () => clearTimeout(timer);
        }
    }, [open, unreadCount, onMarkAllRead]);

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell Button */}
            <button
                id="notification-bell-btn"
                onClick={() => setOpen(prev => !prev)}
                className="relative p-2.5 rounded-xl transition-all duration-200
                    bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white
                    border border-white/10 hover:border-white/20 active:scale-90"
                aria-label="Notificaciones"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-white
                        text-[10px] font-bold flex items-center justify-center shadow-lg shadow-accent/50
                        animate-bounce-subtle">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent/40 animate-ping" />
                )}
            </button>

            {/* Panel */}
            {open && (
                <div
                    className="absolute right-0 top-full mt-3 w-80 sm:w-96 z-[300]
                        bg-[#0d1829] border border-white/10 rounded-2xl shadow-2xl shadow-black/50
                        overflow-hidden animate-slide-down"
                    style={{ maxHeight: '520px' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3
                        border-b border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-2">
                            <Bell size={15} className="text-accent" />
                            <span className="text-sm font-bold text-white">Notificaciones</span>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-bold">
                                    {unreadCount} nuevas
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {notifications.length > 0 && (
                                <button
                                    onClick={onClearAll}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-red-400 transition-colors"
                                    title="Borrar todas"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto" style={{ maxHeight: '420px' }}>
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                                    <BellOff size={20} className="text-slate-600" />
                                </div>
                                <p className="text-sm text-slate-500">Sin notificaciones</p>
                                <p className="text-xs text-slate-600 mt-1">Las nuevas citas aparecerán aquí</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-white/5">
                                {notifications.map((notif) => {
                                    const cfg = TYPE_CONFIG[notif.type];
                                    const Icon = cfg.icon;
                                    return (
                                        <li
                                            key={notif.id}
                                            className={`flex items-start gap-3 px-4 py-3 transition-colors
                                                hover:bg-white/[0.03] group relative
                                                ${!notif.read ? 'bg-white/[0.02]' : ''}`}
                                        >
                                            {/* Unread dot */}
                                            {!notif.read && (
                                                <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent" />
                                            )}

                                            {/* Icon */}
                                            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${cfg.bg}`}>
                                                <Icon size={16} className={cfg.color} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>
                                                        {cfg.label}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-semibold text-white truncate mt-0.5">
                                                    {notif.clientName}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    📆 {formatDate(notif.date, notif.time)}
                                                </p>
                                                <p className="text-[10px] text-slate-600 mt-1">
                                                    {timeAgo(new Date(notif.createdAt))}
                                                </p>
                                            </div>

                                            {/* Dismiss */}
                                            <button
                                                onClick={() => onDismiss(notif.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg
                                                    hover:bg-white/10 text-slate-600 hover:text-white
                                                    transition-all shrink-0 mt-0.5"
                                            >
                                                <X size={12} />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
