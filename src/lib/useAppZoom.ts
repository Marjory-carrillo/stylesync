import { useEffect } from 'react';

export const FIXED_ZOOM = 85;

export const applyZoom = (zoomLevel: number = FIXED_ZOOM) => {
    const scale = zoomLevel / 100; // 0.85

    if (typeof document !== 'undefined') {
        if (document.body) {
            (document.body.style as any).zoom = `${scale}`;
            document.body.style.minHeight = '100vh';
        }
        if (document.documentElement) {
            document.documentElement.style.minHeight = '100vh';
            document.documentElement.style.setProperty('--app-zoom-scale', `${scale}`);
        }

        // iOS Safari fallback support for CSS zoom
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isIOS) {
            const rootEl = document.getElementById('root');
            if (rootEl) {
                (rootEl.style as any).webkitTransform = `scale(${scale})`;
                rootEl.style.transform = `scale(${scale})`;
                rootEl.style.transformOrigin = 'top left';
                rootEl.style.width = `${(100 / scale).toFixed(3)}%`;
            }
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
