import { useEffect } from 'react';

export const FIXED_ZOOM = 85;

export const applyZoom = (zoomLevel: number = FIXED_ZOOM) => {
    if (typeof document === 'undefined') return;

    // iOS Safari: detectar PRIMERO, nunca aplicar CSS zoom no estándar
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
        document.documentElement.style.setProperty('--app-zoom-scale', '1');
        document.documentElement.style.minHeight = '100vh';
        document.body.style.minHeight = '100vh';
        return; // Sale sin tocar zoom en absoluto — evita doble reflow
    }

    // Solo para navegadores de escritorio (Chrome, Edge, Firefox)
    const scale = zoomLevel / 100;
    if (document.documentElement) {
        (document.documentElement.style as any).zoom = `${scale}`;
        document.documentElement.style.minHeight = '100vh';
        document.documentElement.style.setProperty('--app-zoom-scale', `${scale}`);
    }
    if (document.body) {
        (document.body.style as any).zoom = 'normal';
        document.body.style.minHeight = '100vh';
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
