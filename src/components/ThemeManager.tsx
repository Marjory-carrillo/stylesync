
import { useEffect } from 'react';
import { useStore } from '../lib/store';

// Define theme colors for each category
const THEMES: Record<string, { primary: string; accent: string }> = {
    barbershop: {
        primary: '225', // Deep Slate (Premium Dark)
        accent: '38',   // Gold
    },
    beauty_salon: {
        primary: '330', // Dark Rose
        accent: '310',  // Hot Pink
    },
    nail_bar: {
        primary: '270', // Deep Purple
        accent: '290',  // Neon Purple
    },
    spa: {
        primary: '150', // Dark Forest Green
        accent: '140',  // Sage Green / Jade
    },
    pet_grooming: {
        primary: '200', // Ocean Blue
        accent: '25',   // Bright Orange
    },
    consulting: {
        primary: '210', // Classic Navy
        accent: '190',  // Cyan/Teal
    },
    // Fallback
    default: {
        primary: '225',
        accent: '38',
    }
};

export default function ThemeManager() {
    const { businessConfig } = useStore();

    useEffect(() => {
        if (!businessConfig?.category) return;

        let theme = THEMES[businessConfig.category] || THEMES.default;

        // Override with custom branding if available
        if (businessConfig.primaryColor) {
            theme = { ...theme, primary: businessConfig.primaryColor };
        }
        if (businessConfig.accentColor) {
            theme = { ...theme, accent: businessConfig.accentColor };
        }

        // Update CSS variables on the root element
        document.documentElement.style.setProperty('--hue-primary', theme.primary);
        document.documentElement.style.setProperty('--hue-accent', theme.accent);

        // Optional: Update meta theme-color for mobile browsers
        // (This would require more complex logic to convert HSLA to Hex, skipping for now)

    }, [businessConfig.category, businessConfig.primaryColor, businessConfig.accentColor]);

    return null; // This component renders nothing visually
}
