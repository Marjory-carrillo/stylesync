import { useEffect } from 'react';

export const FIXED_ZOOM = 85;

export const applyZoom = (zoomLevel: number = FIXED_ZOOM) => {
    if (typeof document === 'undefined') return;

    const scale = zoomLevel / 100; // 0.85

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
