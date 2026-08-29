/**
 * Motor de Sonido y Notificaciones Web para CitaLink Admin
 * Utiliza Web Audio API nativo (cero dependencias de archivos MP3 externos)
 * y la Notification API del navegador para alertas en segundo plano.
 */

// Singleton AudioContext para reutilización eficiente
let audioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

/** Desbloquea el AudioContext en el primer toque o clic del usuario */
export function unlockAudioOnUserGesture() {
    if (isAudioUnlocked || typeof window === 'undefined') return;

    const unlock = () => {
        const ctx = getAudioContext();
        if (ctx) {
            if (ctx.state === 'suspended') {
                ctx.resume().then(() => {
                    isAudioUnlocked = true;
                }).catch(() => {});
            } else {
                isAudioUnlocked = true;
            }
        }
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('click', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
}

// Inicializar listener de desbloqueo si estamos en el cliente
if (typeof window !== 'undefined') {
    unlockAudioOnUserGesture();
}

/** Verifica si el sonido está habilitado en la configuración local */
export function isSoundEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('citalink_sound_enabled');
    return stored === null ? true : stored === 'true';
}

/** Guarda la preferencia de sonido */
export function setSoundEnabled(enabled: boolean) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('citalink_sound_enabled', String(enabled));
}

/**
 * Sintetiza un sonido de campana / chime elegante de alta fidelidad
 * @param type Tipo de notificación ('new' | 'cancel' | 'reschedule' | 'complete' | 'waiting_list' | 'test')
 */
export function playChimeSound(type: string = 'new') {
    if (!isSoundEnabled()) return;

    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        if (type === 'new' || type === 'test') {
            // 🔔 Chime Doble Tono Alegre (D5 587Hz -> A5 880Hz) - Estilo Apple / WhatsApp
            
            // Tono 1 (D5)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(587.33, now);
            gain1.gain.setValueAtTime(0.28, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.4);

            // Tono 2 (A5) - Entrada armónica brillante
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, now + 0.12);
            gain2.gain.setValueAtTime(0.32, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.12);
            osc2.stop(now + 0.7);

            // Tono 3 (F#6 armónico suave)
            const osc3 = ctx.createOscillator();
            const gain3 = ctx.createGain();
            osc3.type = 'triangle';
            osc3.frequency.setValueAtTime(1479.98, now + 0.14);
            gain3.gain.setValueAtTime(0.08, now + 0.14);
            gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
            osc3.connect(gain3);
            gain3.connect(ctx.destination);
            osc3.start(now + 0.14);
            osc3.stop(now + 0.6);
        } else if (type === 'cancel') {
            // ⚠️ Alerta Suave Descendente para Cancelación (G4 392Hz -> E4 329Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(392, now);
            gain1.gain.setValueAtTime(0.25, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.3);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(329.63, now + 0.15);
            gain2.gain.setValueAtTime(0.25, now + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.15);
            osc2.stop(now + 0.5);
        } else {
            // 🔄 Reprogramación (Tono Neutro Informativo)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(659.25, now); // E5
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.5);
        }

        // Vibración háptica en dispositivos móviles compatibles
        triggerVibration();
    } catch (err) {
        console.warn('[soundNotification] Error reproduciendo audio:', err);
    }
}

/** Ejecuta vibración física en Android y navegadores compatibles */
export function triggerVibration(pattern: number[] = [120, 60, 180]) {
    try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    } catch (e) {
        // Ignorar si el dispositivo no soporta vibración
    }
}

/** Solicita permiso para notificaciones nativas del sistema */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'denied';
    }
    try {
        const permission = await Notification.requestPermission();
        return permission;
    } catch (e) {
        return 'denied';
    }
}

/** Retorna el estado actual de permisos de notificación */
export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'unsupported';
    }
    return Notification.permission;
}

/** Dispara una notificación de escritorio / móvil del sistema */
export function showDesktopNotification(
    title: string,
    body: string,
    onClick?: () => void
) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
        const notif = new Notification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: `citalink-${Date.now()}`,
        });

        if (onClick) {
            notif.onclick = () => {
                window.focus();
                onClick();
                notif.close();
            };
        } else {
            notif.onclick = () => {
                window.focus();
                notif.close();
            };
        }
    } catch (err) {
        console.warn('[soundNotification] Error lanzando notificación push nativa:', err);
    }
}
