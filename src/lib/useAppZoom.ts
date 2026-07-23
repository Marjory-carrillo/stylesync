import { useState, useEffect } from 'react';

export const MIN_ZOOM = 75;
export const MAX_ZOOM = 135;
export const STEP_ZOOM = 5;
export const DEFAULT_ZOOM = 100;

export const applyZoom = (zoomLevel: number) => {
    const scale = zoomLevel / 100;
    const minHeightVh = (100 / scale).toFixed(3);

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
    const [zoom, setZoom] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('citalink_app_zoom');
            return saved ? parseInt(saved, 10) : DEFAULT_ZOOM;
        } catch {
            return DEFAULT_ZOOM;
        }
    });

    useEffect(() => {
        applyZoom(zoom);
        try {
            localStorage.setItem('citalink_app_zoom', zoom.toString());
        } catch (e) {
            console.error('Error saving zoom to localStorage:', e);
        }
    }, [zoom]);

    const zoomIn = () => setZoom(prev => Math.min(MAX_ZOOM, prev + STEP_ZOOM));
    const zoomOut = () => setZoom(prev => Math.max(MIN_ZOOM, prev - STEP_ZOOM));
    const resetZoom = () => setZoom(DEFAULT_ZOOM);

    return { zoom, setZoom, zoomIn, zoomOut, resetZoom };
}
