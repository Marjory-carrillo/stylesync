import { supabase } from '../supabaseClient';

export const GOOGLE_CLIENT_ID = '237507778840-8mvjjv6btn2fsiboenf5ggmttl5ro8j2.apps.googleusercontent.com';

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: any) => void;
                    renderButton: (parent: HTMLElement, options: any) => void;
                    prompt: (momentListener?: (notification: any) => void) => void;
                    cancel: () => void;
                };
            };
        };
    }
}

/**
 * Espera a que el SDK de Google Identity Services esté cargado en window.google
 */
export function waitForGoogleGIS(timeoutMs: number = 4000): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof window !== 'undefined' && window.google?.accounts?.id) {
            resolve(true);
            return;
        }

        const start = Date.now();
        const interval = setInterval(() => {
            if (typeof window !== 'undefined' && window.google?.accounts?.id) {
                clearInterval(interval);
                resolve(true);
            } else if (Date.now() - start > timeoutMs) {
                clearInterval(interval);
                resolve(false);
            }
        }, 100);
    });
}

/**
 * Inicializa Google Identity Services y renderiza el botón oficial en el contenedor
 */
export async function setupGoogleIdentity({
    container,
    onSuccess,
    onError,
    buttonText = 'continue_with',
    buttonTheme = 'outline',
    buttonShape = 'pill',
    buttonWidth = 360,
    enableOneTap = false,
    isCancelled,
}: {
    container: HTMLElement | null;
    onSuccess: (sessionData: { user: any; session: any }) => void;
    onError: (errorMessage: string) => void;
    buttonText?: 'signin_with' | 'signup_with' | 'continue_with';
    buttonTheme?: 'outline' | 'filled_black' | 'filled_blue';
    buttonShape?: 'rectangular' | 'pill' | 'circle';
    buttonWidth?: number;
    enableOneTap?: boolean;
    /** Devuelve true si el efecto que lo invocó ya fue desmontado/cancelado */
    isCancelled?: () => boolean;
}): Promise<boolean> {
    const isReady = await waitForGoogleGIS();
    if (!isReady || !window.google?.accounts?.id) {
        console.warn('Google Identity Services SDK no disponible en este navegador');
        return false;
    }

    // El SDK es async: si el componente cambió de vista mientras esperábamos, no dibujar
    // el botón en un nodo que React pudo haber reutilizado para otro elemento.
    if (isCancelled?.() || !container || !container.isConnected) {
        return false;
    }

    try {
        window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: async (response: { credential: string }) => {
                try {
                    if (!response?.credential) {
                        onError('No se recibió la credencial de Google.');
                        return;
                    }

                    // Autenticar en Supabase usando el ID Token emitido directamente para citalink.app
                    const { data, error } = await supabase.auth.signInWithIdToken({
                        provider: 'google',
                        token: response.credential,
                    });

                    if (error) {
                        console.error('Error supabase.auth.signInWithIdToken:', error);
                        onError(error.message || 'Error al validar cuenta de Google en CitaLink.');
                        return;
                    }

                    if (data?.session && data?.user) {
                        onSuccess({ user: data.user, session: data.session });
                    } else {
                        onError('No se pudo establecer la sesión con Google.');
                    }
                } catch (err: any) {
                    console.error('Excepción en callback de Google GIS:', err);
                    onError(err?.message || 'Error inesperado al procesar inicio de sesión con Google.');
                }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
        });

        if (container) {
            container.innerHTML = ''; // Limpiar render previos
            window.google.accounts.id.renderButton(container, {
                type: 'standard',
                theme: buttonTheme,
                size: 'large',
                text: buttonText,
                shape: buttonShape,
                logo_alignment: 'left',
                width: buttonWidth,
                locale: 'es',
            });
        }

        if (enableOneTap) {
            window.google.accounts.id.prompt();
        }

        return true;
    } catch (err: any) {
        console.error('Error inicializando Google Identity:', err);
        return false;
    }
}
