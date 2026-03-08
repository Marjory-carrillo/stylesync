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

            const defaultTitle = "CitaLink - Gestión de Citas";
            document.title = defaultTitle;
            const titleTag = document.getElementById('app-title');
            if (titleTag) titleTag.innerText = defaultTitle;

            return;
        }

        // 1. Dynamic CSS Theme Colors
        const baseTheme = THEMES[businessConfig.category] || THEMES.default;
        const theme = {
            primary: businessConfig.primaryColor && businessConfig.primaryColor.trim() !== '' ? businessConfig.primaryColor : baseTheme.primary,
            accent: businessConfig.accentColor && businessConfig.accentColor.trim() !== '' ? businessConfig.accentColor : baseTheme.accent,
            secondary: '260'
        };

        document.documentElement.style.setProperty('--hue-primary', theme.primary);
        document.documentElement.style.setProperty('--hue-accent', theme.accent);
        document.documentElement.style.setProperty('--hue-secondary', theme.secondary);

        // Ensure dependent colors are re-evaluated
        document.documentElement.style.setProperty('--color-bg', `hsl(${theme.primary}, 35%, 7%)`);
        document.documentElement.style.setProperty('--color-bg-secondary', `hsl(${theme.primary}, 30%, 10%)`);
        document.documentElement.style.setProperty('--color-primary', `hsl(${theme.primary}, 80%, 50%)`);
        document.documentElement.style.setProperty('--color-accent', `hsl(${theme.accent}, 100%, 50%)`);

        // 2. Dynamic Document Title
        const platformName = "CitaLink";
        const newTitle = businessConfig.name && businessConfig.name !== platformName
            ? `${businessConfig.name} - ${platformName}`
            : `${platformName} - Gestión de Citas`;

        const titleTag = document.getElementById('app-title');
        if (titleTag) titleTag.innerText = newTitle;
        else document.title = newTitle;

        // 3. Dynamic PWA Manifest (Conceptual - usually handled by index.html or build time)
        // Note: Dynamically updating manifest via Blob URL can be heavy, but we keep it for now
        // if it was working before.

    }, [location.pathname, tenantConfig]);

    return null;
}
