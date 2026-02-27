import { useEffect } from 'react';
import { useStore } from '../lib/store';

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
    const { businessConfig } = useStore();

    useEffect(() => {
        if (!businessConfig) return;

        // 1. Dynamic CSS Theme Colors
        // Attempt to find category theme or default
        let baseTheme = THEMES[businessConfig.category] || THEMES.default;
        let theme = { ...baseTheme, secondary: '260' };

        // Only override if the user explicitly set a valid number in config
        if (businessConfig.primaryColor && businessConfig.primaryColor.trim() !== '') {
            theme.primary = businessConfig.primaryColor;
        }
        if (businessConfig.accentColor && businessConfig.accentColor.trim() !== '') {
            theme.accent = businessConfig.accentColor;
        }

        document.documentElement.style.setProperty('--hue-primary', theme.primary);
        document.documentElement.style.setProperty('--hue-accent', theme.accent);
        document.documentElement.style.setProperty('--hue-secondary', theme.secondary);

        // Ensure dependent colors are re-evaluated by setting them explicitly if needed
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

        // 3. Dynamic PWA Manifest
        const manifestData = {
            name: businessConfig.name || platformName,
            short_name: businessConfig.name || platformName,
            description: businessConfig.description || "Gestión inteligente de citas",
            start_url: window.location.pathname.startsWith('/reserva/') ? window.location.pathname : "/",
            display: "standalone",
            background_color: "#0f172a",
            theme_color: "#0f172a",
            icons: [
                {
                    src: businessConfig.logoUrl || "https://raw.githubusercontent.com/lucide-react/lucide-react/master/icons/calendar.svg",
                    sizes: "192x192",
                    type: businessConfig.logoUrl ? "image/png" : "image/svg+xml",
                    purpose: "any maskable"
                },
                {
                    src: businessConfig.logoUrl || "https://raw.githubusercontent.com/lucide-react/lucide-react/master/icons/calendar.svg",
                    sizes: "512x512",
                    type: businessConfig.logoUrl ? "image/png" : "image/svg+xml",
                    purpose: "any maskable"
                }
            ]
        };

        const stringManifest = JSON.stringify(manifestData);
        const blob = new Blob([stringManifest], { type: 'application/json' });
        const manifestURL = URL.createObjectURL(blob);

        const manifestTag = document.getElementById('pwa-manifest') as HTMLLinkElement;
        if (manifestTag) {
            manifestTag.href = manifestURL;
        }

        // 4. Update Apple Touch Icon
        const appleIcon = document.getElementById('apple-icon') as HTMLLinkElement;
        if (appleIcon && businessConfig.logoUrl) {
            appleIcon.href = businessConfig.logoUrl;
        }

    }, [businessConfig]);

    return null;
}
