import { useState, useEffect } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';
import { Infinity as InfinityIcon } from 'lucide-react';

export default function PWAInstallBanner() {
    const [show, setShow] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Don't show if already installed as PWA
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;
        if (isStandalone) return;

        // Don't show if previously dismissed this session
        if (sessionStorage.getItem('pwa_banner_dismissed')) return;

        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(ios);

        if (ios) {
            // iOS doesn't fire beforeinstallprompt — show manual instructions
            const timer = setTimeout(() => setShow(true), 3000);
            return () => clearTimeout(timer);
        }

        // Android / Chrome — wait for the browser's install event
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShow(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') setShow(false);
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setShow(false);
        setDismissed(true);
        sessionStorage.setItem('pwa_banner_dismissed', '1');
    };

    if (!show || dismissed) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] p-3 sm:p-4 animate-slide-up">
            <div className="max-w-lg mx-auto bg-[#0f1420] border border-violet-500/30 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
                {/* Purple accent line */}
                <div className="h-0.5 w-full bg-gradient-to-r from-violet-500 via-accent to-transparent" />

                <div className="p-4 flex items-start gap-3">
                    {/* App icon */}
                    <div className="relative shrink-0 w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                        <div className="absolute inset-0 bg-violet-500 blur-lg opacity-20 rounded-xl" />
                        <InfinityIcon className="w-7 h-7 text-violet-400 relative z-10" strokeWidth={2.5} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="font-black text-white text-sm leading-tight">
                            Instala <span className="text-violet-400">CitaLink</span> en tu teléfono
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                            {isIOS
                                ? 'Toca el ícono compartir y luego "Agregar a inicio"'
                                : 'Accede más rápido desde tu pantalla de inicio'}
                        </p>

                        {isIOS ? (
                            // iOS manual instructions
                            <div className="mt-2.5 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                                <Share size={14} className="text-violet-400 shrink-0" />
                                <span className="text-xs text-slate-300 font-medium">Compartir</span>
                                <span className="text-slate-600 text-xs">→</span>
                                <Plus size={14} className="text-emerald-400 shrink-0" />
                                <span className="text-xs text-slate-300 font-medium">Agregar a inicio</span>
                            </div>
                        ) : (
                            <button
                                onClick={handleInstall}
                                className="mt-2.5 flex items-center gap-2 bg-violet-500 hover:bg-violet-600 active:scale-95 text-white text-xs font-black px-4 py-2 rounded-xl transition-all shadow-lg shadow-violet-500/20"
                            >
                                <Download size={13} />
                                Instalar app
                            </button>
                        )}
                    </div>

                    <button
                        onClick={handleDismiss}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors shrink-0"
                        aria-label="Cerrar"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
