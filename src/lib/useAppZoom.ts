import { useEffect } from 'react';

export const FIXED_ZOOM = 85;

export const applyZoom = (zoomLevel: number = FIXED_ZOOM) => {
    const scale = zoomLevel / 100; // 0.85

    if (typeof document !== 'undefined') {
        if (document.documentElement) {
            (document.documentElement.style as any).zoom = `${scale}`;
            document.documentElement.style.minHeight = '100vh';
            document.documentElement.style.setProperty('--app-zoom-scale', `${scale}`);
        }
        if (document.body) {
            // Eliminar zoom de body para evitar duplicación y usar minHeight limpio
            (document.body.style as any).zoom = 'normal';
            document.body.style.minHeight = '100vh';
        }

        // iOS Safari: aplicar CSS zoom 0.85 directamente en documentElement
        // esto escala el layout completo al 85% sin franjas vacias ni lentitud
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isIOS) {
            (document.documentElement.style as any).zoom = '0.85';
            (document.body.style as any).zoom = '0.85';
        }
    }
};

export function useAppZoom() {
    useEffect(() => {
        applyZoom(FIXED_ZOOM);
        try {
            localStorage.setItem('citalink_app_zoom', '85');
        } catch {}
    }, []);

    return { zoom: FIXED_ZOOM, applyZoom };
}
