
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useUIStore } from '../lib/store/uiStore';

export default function ToastContainer() {
    const { toasts, removeToast } = useUIStore();

    return (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none sm:max-w-md">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onRemove }: { toast: any, onRemove: () => void }) {
    const icons = {
        success: <CheckCircle className="text-emerald-400 shrink-0" size={18} />,
        error: <AlertCircle className="text-red-400 shrink-0" size={18} />,
        info: <Info className="text-blue-400 shrink-0" size={18} />
    };

    const colors = {
        success: 'border-emerald-500/30 bg-emerald-950/90 text-emerald-200 shadow-[0_4px_20px_rgba(16,185,129,0.2)]',
        error: 'border-red-500/30 bg-red-950/90 text-red-200 shadow-[0_4px_20px_rgba(239,68,68,0.2)]',
        info: 'border-blue-500/30 bg-blue-950/90 text-blue-200 shadow-[0_4px_20px_rgba(59,130,246,0.2)]'
    };

    return (
        <div className={`
            pointer-events-auto
            flex items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-2xl border backdrop-blur-2xl
            animate-slide-in-right transition-all duration-300 w-full
            ${colors[toast.type as keyof typeof colors]}
        `}>
            <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                {icons[toast.type as keyof typeof icons]}
                <p className="text-xs sm:text-sm font-semibold text-white break-words leading-relaxed">
                    {toast.message}
                </p>
            </div>
            <button
                onClick={onRemove}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white shrink-0 -mr-1"
                aria-label="Cerrar notificación"
            >
                <X size={15} />
            </button>
        </div>
    );
}
