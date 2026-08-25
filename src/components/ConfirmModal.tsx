import { useState } from 'react';
import { X, AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => Promise<void> | void;
    onCancel: () => void;
    danger?: boolean;
    isLoading?: boolean;
}

export default function ConfirmModal({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    onConfirm,
    onCancel,
    danger = false,
    isLoading: externalLoading = false
}: ConfirmModalProps) {
    const [internalLoading, setInternalLoading] = useState(false);
    const isBusy = internalLoading || externalLoading;

    if (!isOpen) return null;

    const handleConfirmClick = async () => {
        if (isBusy) return;
        setInternalLoading(true);
        try {
            await onConfirm();
        } finally {
            setInternalLoading(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in"
            onClick={() => {
                if (!isBusy) onCancel();
            }}
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
                        disabled={isBusy}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        onClick={() => {
                            if (!isBusy) onCancel();
                        }}
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
                        disabled={isBusy}
                        className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white font-bold text-xs sm:text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={() => {
                            if (!isBusy) onCancel();
                        }}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        disabled={isBusy}
                        className={`flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                            danger 
                                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20' 
                                : 'bg-accent hover:bg-accent/90 text-[#0a0f1a] shadow-accent/20'
                        }`}
                        onClick={handleConfirmClick}
                    >
                        {isBusy && <Loader2 size={16} className="animate-spin" />}
                        {isBusy ? 'Procesando...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
