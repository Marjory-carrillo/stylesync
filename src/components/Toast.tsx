
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useStore } from '../lib/store';

export default function ToastContainer() {
    const { toasts, removeToast } = useStore();

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onRemove }: { toast: any, onRemove: () => void }) {
    const icons = {
        success: <CheckCircle className="text-emerald-400" size={20} />,
        error: <AlertCircle className="text-red-400" size={20} />,
        info: <Info className="text-blue-400" size={20} />
    };

    const colors = {
        success: 'border-emerald-500/20 bg-emerald-500/10',
        error: 'border-red-500/20 bg-red-500/10',
        info: 'border-blue-500/20 bg-blue-500/10'
    };

    return (
        <div className={`
            pointer-events-auto
            flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl
            animate-slide-in-right transition-all duration-300
            ${colors[toast.type as keyof typeof colors]}
        `}>
            <div className="flex-shrink-0">
                {icons[toast.type as keyof typeof icons]}
            </div>
            <p className="text-sm font-medium text-white pr-2 whitespace-nowrap">
                {toast.message}
            </p>
            <button
                onClick={onRemove}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
                <X size={16} />
            </button>
        </div>
    );
}
