import { useEffect } from 'react';
import { useStore } from '../lib/store';

const THEMES: Record<string, { primary: string; accent: string }> = {
    barbershop: { primary: '225', accent: '38' },
    beauty_salon: { primary: '330', accent: '310' },
    nail_bar: { primary: '270', accent: '290' },
    spa: { primary: '150', accent: '140' },
    pet_grooming: { primary: '200', accent: '25' },
    consulting: { primary: '210', accent: '190' },
    default: { primary: '225', accent: '38' }
};

export default function BrandingManager() {
    const { businessConfig } = useStore();

    useEffect(() => {
        if (!businessConfig) return;

        // 1. Dynamic CSS Theme Colors
        let theme = THEMES[businessConfig.category as keyof typeof THEMES] || THEMES.default;
        if (businessConfig.primaryColor) theme = { ...theme, primary: businessConfig.primaryColor };
        if (businessConfig.accentColor) theme = { ...theme, accent: businessConfig.accentColor };

        document.documentElement.style.setProperty('--hue-primary', theme.primary);
        document.documentElement.style.setProperty('--hue-accent', theme.accent);

        // 2. Dynamic Document Title
        const platformName = "CitaLink";
        const newTitle = businessConfig.name && businessConfig.name !== "StyleSync Barbería"
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
                    src: businessConfig.logoUrl || "https://raw.githubusercontent.com/lucide-react/lucide-react/master/icons/scissors.svg",
                    sizes: "192x192",
                    type: businessConfig.logoUrl ? "image/png" : "image/svg+xml",
                    purpose: "any maskable"
                },
                {
                    src: businessConfig.logoUrl || "https://raw.githubusercontent.com/lucide-react/lucide-react/master/icons/scissors.svg",
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
