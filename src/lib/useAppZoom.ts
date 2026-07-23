import { useState, useEffect } from 'react';

export const MIN_ZOOM = 75;
export const MAX_ZOOM = 135;
export const STEP_ZOOM = 5;
export const DEFAULT_ZOOM = 100;

export const applyZoom = (zoomLevel: number) => {
    const scale = zoomLevel / 100;
    // Applying zoom to body keeps the html background full-screen without empty gaps or broken card proportions!
    if (document.body) {
        (document.body.style as any).zoom = `${scale}`;
    }
    (document.documentElement.style as any).zoom = '1';
    document.documentElement.style.setProperty('--app-zoom-scale', `${scale}`);
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
