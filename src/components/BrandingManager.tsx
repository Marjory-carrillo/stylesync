import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTenantData } from '../lib/store/queries/useTenantData';

const THEMES: Record<string, { primary: string; accent: string }> = {
    barbershop: { primary: '200', accent: '190' }, // Cyan colors
    beauty_salon: { primary: '330', accent: '310' },
    nail_bar: { primary: '270', accent: '290' },
    spa: { primary: '150', accent: '140' },
    pet_grooming: { primary: '200', accent: '25' },
    consulting: { primary: '215', accent: '185' },
    default: { primary: '200', accent: '190' } // CitaLink Cyan/Blue theme
};

function hexToHue(hex: string): number {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return 200;
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    if (max === min) h = 0;
    else if (max === r) h = (60 * ((g - b) / (max - min)) + 360) % 360;
    else if (max === g) h = (60 * ((b - r) / (max - min)) + 120) % 360;
    else if (max === b) h = (60 * ((r - g) / (max - min)) + 240) % 360;
    return Math.round(h);
}

export default function BrandingManager() {
    const { data: tenantConfig } = useTenantData();
    const location = useLocation();

    useEffect(() => {
        const isLandingPage = location.pathname === '/' || location.pathname === '/login';
        const businessConfig = isLandingPage ? null : tenantConfig;

        // Reset to CitaLink defaults if on landing or no config
        if (!businessConfig) {
            document.documentElement.style.setProperty('--hue-primary', THEMES.default.primary);
            document.documentElement.style.setProperty('--hue-accent', THEMES.default.accent);
            document.documentElement.style.setProperty('--hue-secondary', '260');
            document.documentElement.style.setProperty('--color-bg', '#090e17');
            document.documentElement.style.setProperty('--color-bg-secondary', '#0f1726');
            document.documentElement.style.setProperty('--color-primary', '#06b6d4');
            document.documentElement.style.setProperty('--color-accent', '#06b6d4');

            const defaultTitle = "CitaLink - Gestión de Citas";
            document.title = defaultTitle;
            const titleTag = document.getElementById('app-title');
            if (titleTag) titleTag.innerText = defaultTitle;

            return;
        }

        // 1. Dynamic CSS Theme Colors
        const baseTheme = THEMES[businessConfig.category] || THEMES.default;
        const rawPrimary = businessConfig.primaryColor && businessConfig.primaryColor.trim() !== '' ? businessConfig.primaryColor : '';
        const isHex = rawPrimary.startsWith('#');
        const primaryHue = isHex ? String(hexToHue(rawPrimary)) : (rawPrimary || baseTheme.primary);
        const accentColor = isHex ? rawPrimary : `hsl(${primaryHue}, 100%, 50%)`;

        document.documentElement.style.setProperty('--hue-primary', primaryHue);
        document.documentElement.style.setProperty('--hue-accent', primaryHue);
        document.documentElement.style.setProperty('--hue-secondary', '260');

        // Always keep dark background solid and sleek
        document.documentElement.style.setProperty('--color-bg', '#090e17');
        document.documentElement.style.setProperty('--color-bg-secondary', '#0f1726');
        document.documentElement.style.setProperty('--color-bg-tertiary', '#172236');
        document.documentElement.style.setProperty('--color-primary', accentColor);
        document.documentElement.style.setProperty('--color-accent', accentColor);
        document.documentElement.style.setProperty('--color-accent-glow', `${accentColor}66`);

        // 2. Dynamic Document Title
        const platformName = "CitaLink";
        const newTitle = businessConfig.name && businessConfig.name !== platformName
            ? `${businessConfig.name} - ${platformName}`
            : `${platformName} - Gestión de Citas`;

        const titleTag = document.getElementById('app-title');
        if (titleTag) titleTag.innerText = newTitle;
        else document.title = newTitle;

    }, [location.pathname, tenantConfig]);

    return null;
}
