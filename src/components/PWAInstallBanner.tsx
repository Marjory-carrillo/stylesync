import { useState, useEffect } from 'react';
import { X, Share, Plus, Copy, CheckCircle, Smartphone } from 'lucide-react';

interface PWAInstallBannerProps {
    businessName?: string;
    /** URL limpia sin parámetros de tracking. Si se pasa, el banner explica usar ESTE link. */
    cleanUrl?: string;
}

export default function PWAInstallBanner({ businessName, cleanUrl }: PWAInstallBannerProps) {
    const [show, setShow] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [dismissed, setDismissed] = useState(false);
    const [copied, setCopied] = useState(false);
    // true cuando Chrome no dispara beforeinstallprompt → PWA ya instalada
    const [alreadyInstalled, setAlreadyInstalled] = useState(false);

    const isMarketplaceMode = !!cleanUrl;

    useEffect(() => {
        const isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;
        if (isStandalone) return;

        const dismissKey = isMarketplaceMode ? 'pwa_mkt_banner_dismissed' : 'pwa_banner_dismissed';
        if (sessionStorage.getItem(dismissKey)) return;

        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(ios);

        if (ios) {
            // iOS: siempre mostrar instrucciones manuales
            const timer = setTimeout(() => setShow(true), 3000);
            return () => clearTimeout(timer);
        }

        // Android: escuchar beforeinstallprompt
        // Si no llega en 4s → Chrome ya tiene la PWA instalada → mostrar banner alternativo
        let promptFired = false;

        const handler = (e: Event) => {
            e.preventDefault();
            promptFired = true;
            clearTimeout(fallbackTimer);
            setDeferredPrompt(e);
            setShow(true);
        };

        const fallbackTimer = setTimeout(() => {
            if (!promptFired) {
                // beforeinstallprompt nunca llegó → PWA ya instalada
                setAlreadyInstalled(true);
                setShow(true);
            }
        }, 4000);

        window.addEventListener('beforeinstallprompt', handler);
        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            clearTimeout(fallbackTimer);
        };
    }, [isMarketplaceMode]);

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') setShow(false);
            setDeferredPrompt(null);
        }
    };

    const handleCopyLink = async () => {
        if (!cleanUrl) return;
        try {
            await navigator.clipboard.writeText(cleanUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch {
            // fallback si clipboard API no disponible
        }
    };

    const handleDismiss = () => {
        setShow(false);
        setDismissed(true);
        const dismissKey = isMarketplaceMode ? 'pwa_mkt_banner_dismissed' : 'pwa_banner_dismissed';
        sessionStorage.setItem(dismissKey, '1');
    };

    if (!show || dismissed) return null;

    // ── Banner alternativo: PWA ya instalada ──
    if (alreadyInstalled && !isIOS) {
        return (
            <div className="fixed bottom-0 left-0 right-0 z-[9999] p-3 sm:p-4 animate-slide-up">
                <div className="max-w-lg mx-auto bg-[#0a1225] border border-sky-500/30 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden">
                    <div className="h-0.5 w-full bg-gradient-to-r from-sky-500 via-blue-400 to-transparent" />
                    <div className="p-4 flex items-start gap-3">
                        <div className="relative shrink-0 w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                            <div className="absolute inset-0 bg-sky-500 blur-lg opacity-20 rounded-xl" />
                            <CheckCircle className="w-6 h-6 text-sky-400 relative z-10" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-black text-white text-[13px] sm:text-sm leading-tight">
                                Ya tienes CitaLink instalado 📲
                            </p>
                            <p className="text-xs text-slate-400 mt-1 leading-snug">
                                Puedes agendar con{' '}
                                <span className="text-sky-400 font-bold">{businessName || 'este negocio'}</span>{' '}
                                directamente desde tu acceso directo en pantalla de inicio.
                            </p>
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

    // ── Banner normal / marketplace ──
    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] p-3 sm:p-4 animate-slide-up">
            <div className="max-w-lg mx-auto bg-[#0a1225] border border-emerald-500/30 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden">
                <div className={`h-0.5 w-full bg-gradient-to-r ${isMarketplaceMode ? 'from-emerald-500 via-teal-400 to-transparent' : 'from-violet-500 via-accent to-transparent'}`} />

                <div className="p-4 flex items-start gap-3">
                    <div className={`relative shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${isMarketplaceMode ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-violet-500/10 border border-violet-500/20'}`}>
                        <div className={`absolute inset-0 blur-lg opacity-20 rounded-xl ${isMarketplaceMode ? 'bg-emerald-500' : 'bg-violet-500'}`} />
                        <Smartphone className={`w-6 h-6 relative z-10 ${isMarketplaceMode ? 'text-emerald-400' : 'text-violet-400'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="font-black text-white text-[13px] sm:text-sm leading-tight">
                            {businessName
                                ? <>Agrega <span className={isMarketplaceMode ? 'text-emerald-400' : 'text-violet-400'}>{businessName}</span> a tu pantalla de inicio</>
                                : <>Agrega <span className="text-violet-400">CitaLink</span> a tu pantalla de inicio</>}
                        </p>

                        {isMarketplaceMode ? (
                            <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                                Guarda el acceso directo para próximas citas sin pasar por el Marketplace.
                            </p>
                        ) : (
                            <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                                {isIOS
                                    ? 'Toca compartir y luego "Agregar a inicio"'
                                    : 'Toca el menú de opciones (⋮) y elige "Agregar a la pantalla de inicio"'}
                            </p>
                        )}

                        {/* ── Acciones según dispositivo y modo ── */}
                        {isMarketplaceMode ? (
                            <div className="mt-2.5 space-y-2">
                                {isIOS ? (
                                    /* iOS: link limpio + instrucciones manuales */
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10 overflow-hidden">
                                            <span className="truncate text-emerald-300 text-[11px] font-mono">{cleanUrl}</span>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                                            <Share size={14} className="text-emerald-400 shrink-0" />
                                            <span className="text-xs text-slate-300 font-medium">Copia el link → ábrelo en Safari</span>
                                            <span className="text-slate-600 text-xs">→</span>
                                            <Plus size={14} className="text-emerald-400 shrink-0" />
                                            <span className="text-xs text-slate-300 font-medium">Agregar a inicio</span>
                                        </div>
                                        <button
                                            onClick={handleCopyLink}
                                            className={`w-full flex items-center justify-center gap-2 text-xs font-black px-4 py-2 rounded-xl transition-all shadow-lg ${copied ? 'bg-emerald-600 text-white' : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'}`}
                                        >
                                            {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
                                            {copied ? '¡Link copiado!' : 'Copiar link directo'}
                                        </button>
                                    </div>
                                ) : (
                                    /* Android Marketplace: prompt nativo */
                                    <button
                                        onClick={handleInstall}
                                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-black text-xs font-black px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                                    >
                                        <Plus size={13} />
                                        Agregar a pantalla de inicio
                                    </button>
                                )}
                            </div>
                        ) : isIOS ? (
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
                                <Plus size={13} />
                                Crear Acceso Directo
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
