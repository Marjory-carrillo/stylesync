import { X, AlertTriangle, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    danger?: boolean;
}

export default function ConfirmModal({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    onConfirm,
    onCancel,
    danger = false
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in"
            onClick={onCancel}
        >
            <div
                className={`w-full max-w-md p-6 sm:p-7 rounded-[2rem] bg-[#0c101d]/95 border shadow-2xl relative overflow-hidden transition-all duration-300 ${
                    danger 
                        ? 'border-red-500/25 shadow-red-500/10' 
                        : 'border-accent/25 shadow-accent/10'
                }`}
                onClick={e => e.stopPropagation()}
            >
                {/* Glow Background */}
                <div 
                    className={`absolute -top-12 -left-12 w-40 h-40 rounded-full blur-3xl pointer-events-none ${
                        danger ? 'bg-red-500/15' : 'bg-accent/15'
                    }`} 
                />

                <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className={`p-3.5 rounded-2xl border ${
                        danger 
                            ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                            : 'bg-accent/10 text-accent border-accent/20'
                    }`}>
                        {danger ? <AlertTriangle size={24} /> : <HelpCircle size={24} />}
                    </div>
                    <button
                        type="button"
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        onClick={onCancel}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="relative z-10 mb-6">
                    <h3 className="text-lg sm:text-xl font-black text-white tracking-tight mb-2">{title}</h3>
                    <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    <button
                        type="button"
                        className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-bold text-xs sm:text-sm transition-all"
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all shadow-lg ${
                            danger 
                                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20' 
                                : 'bg-accent hover:bg-accent/90 text-[#0a0f1a] shadow-accent/20'
                        }`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
