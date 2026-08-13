import { type BusinessConfig } from './types/store.types';

/**
 * Formatea un monto numérico con el símbolo y código de divisa del negocio.
 * Ejemplos:
 *  - 250 (MXN) -> "$250 MXN" o "$250"
 *  - 25 (USD) -> "$25 USD"
 *  - 1000 (VES) -> "Bs. 1,000 VES"
 *  - 25 (EUR) -> "25 € EUR"
 */
export const formatPrice = (
    amount: number | null | undefined,
    tenantConfig?: Partial<BusinessConfig> | null,
    showCode = true
): string => {
    if (amount === null || amount === undefined || isNaN(amount)) return '$0';

    const symbol = tenantConfig?.currencySymbol || '$';
    const currency = tenantConfig?.currency || 'MXN';

    const formattedNum = new Intl.NumberFormat('es-MX', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);

    if (currency === 'EUR') {
        return `${formattedNum} ${symbol}${showCode ? ' EUR' : ''}`;
    }
    if (currency === 'VES') {
        return `${symbol} ${formattedNum}${showCode ? ' VES' : ''}`;
    }

    // Para USD, MXN, COP, etc.
    const suffix = showCode && currency !== 'MXN' ? ` ${currency}` : '';
    return `${symbol}${formattedNum}${suffix}`;
};
