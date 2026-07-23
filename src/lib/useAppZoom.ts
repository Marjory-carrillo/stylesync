import { useEffect } from 'react';

export const FIXED_ZOOM = 85;

export const applyZoom = (zoomLevel: number = FIXED_ZOOM) => {
    const scale = zoomLevel / 100; // 0.85
    const minHeightVh = (100 / scale).toFixed(3); // 117.647vh

    if (document.body) {
        (document.body.style as any).zoom = `${scale}`;
        document.body.style.minHeight = `${minHeightVh}vh`;
    }
    if (document.documentElement) {
        document.documentElement.style.minHeight = `${minHeightVh}vh`;
        document.documentElement.style.backgroundColor = '#0c101d';
        document.documentElement.style.setProperty('--app-zoom-scale', `${scale}`);
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
