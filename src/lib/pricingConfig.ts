export interface CountryPreset {
    code: string;
    name: string;
    flag: string;
    currency: string;
    currencySymbol: string;
    phonePrefix: string;
    timezone: string;
    plans: {
        lite: { monthly: number; annualMonthly: number };
        pro: { monthly: number; annualMonthly: number };
        business: { monthly: number; annualMonthly: number };
    };
    extraEmployeePrice: number;
    extraBranchPrice: number;
}

export const COUNTRY_PRESETS: Record<string, CountryPreset> = {
    MX: {
        code: 'MX',
        name: 'México',
        flag: '🇲🇽',
        currency: 'MXN',
        currencySymbol: '$',
        phonePrefix: '+52',
        timezone: 'America/Mexico_City',
        plans: {
            lite: { monthly: 349, annualMonthly: 299 },
            pro: { monthly: 649, annualMonthly: 549 },
            business: { monthly: 1249, annualMonthly: 1049 },
        },
        extraEmployeePrice: 249,
        extraBranchPrice: 599,
    },
    US: {
        code: 'US',
        name: 'Estados Unidos',
        flag: '🇺🇸',
        currency: 'USD',
        currencySymbol: '$ USD',
        phonePrefix: '+1',
        timezone: 'America/New_York',
        plans: {
            lite: { monthly: 29, annualMonthly: 24 },
            pro: { monthly: 59, annualMonthly: 49 },
            business: { monthly: 99, annualMonthly: 84 },
        },
        extraEmployeePrice: 19,
        extraBranchPrice: 49,
    },
    CA: {
        code: 'CA',
        name: 'Canadá',
        flag: '🇨🇦',
        currency: 'CAD',
        currencySymbol: '$ CAD',
        phonePrefix: '+1',
        timezone: 'America/Toronto',
        plans: {
            lite: { monthly: 29, annualMonthly: 24 },
            pro: { monthly: 59, annualMonthly: 49 },
            business: { monthly: 99, annualMonthly: 84 },
        },
        extraEmployeePrice: 19,
        extraBranchPrice: 49,
    },
    ES: {
        code: 'ES',
        name: 'España',
        flag: '🇪🇸',
        currency: 'EUR',
        currencySymbol: '€',
        phonePrefix: '+34',
        timezone: 'Europe/Madrid',
        plans: {
            lite: { monthly: 25, annualMonthly: 20 },
            pro: { monthly: 49, annualMonthly: 40 },
            business: { monthly: 89, annualMonthly: 75 },
        },
        extraEmployeePrice: 15,
        extraBranchPrice: 39,
    },
    VE: {
        code: 'VE',
        name: 'Venezuela',
        flag: '🇻🇪',
        currency: 'USD',
        currencySymbol: '$ USD',
        phonePrefix: '+58',
        timezone: 'America/Caracas',
        plans: {
            lite: { monthly: 19, annualMonthly: 15 },
            pro: { monthly: 39, annualMonthly: 32 },
            business: { monthly: 69, annualMonthly: 58 },
        },
        extraEmployeePrice: 15,
        extraBranchPrice: 35,
    },
    CO: {
        code: 'CO',
        name: 'Colombia',
        flag: '🇨🇴',
        currency: 'COP',
        currencySymbol: '$ COP',
        phonePrefix: '+57',
        timezone: 'America/Bogota',
        plans: {
            lite: { monthly: 79000, annualMonthly: 65000 },
            pro: { monthly: 159000, annualMonthly: 135000 },
            business: { monthly: 279000, annualMonthly: 235000 },
        },
        extraEmployeePrice: 59000,
        extraBranchPrice: 139000,
    },
    EC: {
        code: 'EC',
        name: 'Ecuador',
        flag: '🇪🇨',
        currency: 'USD',
        currencySymbol: '$ USD',
        phonePrefix: '+593',
        timezone: 'America/Guayaquil',
        plans: {
            lite: { monthly: 19, annualMonthly: 15 },
            pro: { monthly: 39, annualMonthly: 32 },
            business: { monthly: 69, annualMonthly: 58 },
        },
        extraEmployeePrice: 15,
        extraBranchPrice: 35,
    },
};

export const DEFAULT_COUNTRY = COUNTRY_PRESETS.MX;

export const getCountryPreset = (code?: string): CountryPreset => {
    if (!code) return DEFAULT_COUNTRY;
    return COUNTRY_PRESETS[code.toUpperCase()] || DEFAULT_COUNTRY;
};
