// Plan limits and enforcement for CitaLink subscription tiers

export type PlanType = 'free' | 'lite' | 'pro' | 'business';

export interface PlanLimits {
    name: string;
    price: number;        // MXN/mes
    maxBranches: number;
    maxEmployeesPerBranch: number;
    maxAppointmentsPerMonth: number; // -1 = unlimited
    canExpandBranches: boolean;
    canExpandEmployees: boolean;
    extraBranchPrice: number;   // MXN/mes por sucursal extra
    extraEmployeePrice: number; // MXN/mes por empleado extra
}

const PLAN_CONFIG: Record<PlanType, PlanLimits> = {
    free: {
        name: 'Free',
        price: 0,
        maxBranches: 1,
        maxEmployeesPerBranch: 2,
        maxAppointmentsPerMonth: 30,
        canExpandBranches: false,
        canExpandEmployees: false,
        extraBranchPrice: 0,
        extraEmployeePrice: 0,
    },
    lite: {
        name: 'Esencial',
        price: 349,
        maxBranches: 1,
        maxEmployeesPerBranch: 1,
        maxAppointmentsPerMonth: -1,
        canExpandBranches: false,
        canExpandEmployees: false,
        extraBranchPrice: 0,
        extraEmployeePrice: 0,
    },
    pro: {
        name: 'Pro',
        price: 649,
        maxBranches: 1,
        maxEmployeesPerBranch: 2,
        maxAppointmentsPerMonth: -1,
        canExpandBranches: false,
        canExpandEmployees: true,
        extraBranchPrice: 0,
        extraEmployeePrice: 249,
    },
    business: {
        name: 'Business',
        price: 1249,
        maxBranches: 2,
        maxEmployeesPerBranch: 2,
        maxAppointmentsPerMonth: -1,
        canExpandBranches: true,
        canExpandEmployees: true,
        extraBranchPrice: 599,
        extraEmployeePrice: 249,
    },
};

import { getCountryPreset } from './pricingConfig';

/** Get plan configuration based on plan type and country code */
export function getPlanLimits(plan: PlanType, countryCode?: string): PlanLimits {
    const base = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
    if (!countryCode) return base;

    const preset = getCountryPreset(countryCode);
    let price = base.price;
    if (plan === 'lite') price = preset.plans.lite.monthly;
    if (plan === 'pro') price = preset.plans.pro.monthly;
    if (plan === 'business') price = preset.plans.business.monthly;

    return {
        ...base,
        price,
        extraEmployeePrice: preset.extraEmployeePrice,
        extraBranchPrice: preset.extraBranchPrice,
    };
}

/** Returns true if the tenant is currently in a trial period */
export function isInTrial(trialEndsAt?: string | null): boolean {
    if (!trialEndsAt) return false;
    return new Date(trialEndsAt) > new Date();
}

/**
 * Calculate the effective max employees PER BRANCH considering paid add-ons.
 * Base = 2 per branch (included in all plans).
 * extraEmployeesPaid = individual extra professionals purchased via Stripe.
 * This is a PER-BRANCH limit — extra branches don't affect it.
 */
export function getEffectiveMaxEmployees(
    plan: PlanType,
    extraEmployeesPaid: number = 0,
): number {
    const limits = getPlanLimits(plan);
    // Per branch: base included + paid extras
    return limits.maxEmployeesPerBranch + extraEmployeesPaid;
}

/** Calculate effective max branches considering paid add-ons */
export function getEffectiveMaxBranches(plan: PlanType, extraBranchesPaid: number = 0): number {
    const limits = getPlanLimits(plan);
    return limits.maxBranches + extraBranchesPaid;
}

/** Check if an employee (stylist) can be added to THIS branch */
export function canAddEmployee(
    plan: PlanType,
    currentCount: number,
    trialEndsAt?: string | null,
    extraEmployeesPaid: number = 0,
): { allowed: boolean; message?: string; upgradeTo?: PlanType } {
    // Trial period: limit per branch according to plan (1 for Esencial/lite, 2 for free/pro/business)
    if (isInTrial(trialEndsAt)) {
        const planMax = getPlanLimits(plan).maxEmployeesPerBranch;
        const baseMax = Math.min(2, planMax);
        if (currentCount < baseMax) {
            return { allowed: true };
        }
        return {
            allowed: false,
            message: plan === 'lite'
                ? `El plan Esencial solo permite 1 profesional. Actualiza a Pro para agregar más.`
                : `Durante el trial solo puedes tener ${baseMax} profesionales por sucursal. Actualiza tu plan para agregar más.`,
            upgradeTo: 'pro',
        };
    }

    const limits = getPlanLimits(plan);
    const effectiveMax = getEffectiveMaxEmployees(plan, extraEmployeesPaid);

    if (currentCount < effectiveMax) {
        return { allowed: true };
    }

    if (limits.canExpandEmployees) {
        // Pro/Business: at limit, need to buy extra via Stripe portal
        return { allowed: false, message: `Has alcanzado tu límite de ${effectiveMax} profesionales. Agrega un Profesional Extra ($${limits.extraEmployeePrice}/mes) desde el portal de facturación.` };
    }

    // Free plan — hard cap
    if (plan === 'free') {
        return {
            allowed: false,
            message: `El plan Free solo permite ${limits.maxEmployeesPerBranch} profesionales. Actualiza a Pro para agregar más.`,
            upgradeTo: 'pro',
        };
    }

    // Lite plan — hard cap
    if (plan === 'lite') {
        return {
            allowed: false,
            message: `El plan Esencial solo permite ${limits.maxEmployeesPerBranch} profesional. Actualiza a Pro para agregar más.`,
            upgradeTo: 'pro',
        };
    }

    return { allowed: false, message: 'Límite de profesionales alcanzado.' };
}

/** Check if a stylist can be added (same logic as employee) */
export function canAddStylist(
    plan: PlanType,
    currentStylistCount: number,
    trialEndsAt?: string | null,
    extraEmployeesPaid: number = 0,
): { allowed: boolean; message?: string; upgradeTo?: PlanType } {
    return canAddEmployee(plan, currentStylistCount, trialEndsAt, extraEmployeesPaid);
}

/** Check if a new branch/tenant can be created for this owner */
export function canAddBranch(
    plan: PlanType,
    currentBranchCount: number,
    extraBranchesPaid: number = 0,
): { allowed: boolean; message?: string; upgradeTo?: PlanType } {
    const limits = getPlanLimits(plan);
    const effectiveMax = getEffectiveMaxBranches(plan, extraBranchesPaid);

    if (currentBranchCount < effectiveMax) {
        return { allowed: true };
    }

    if (limits.canExpandBranches) {
        return { allowed: true, message: `Sucursal adicional: +$${limits.extraBranchPrice}/mes (incluye 2 profesionales)` };
    }

    // Can't expand
    if (plan === 'free') {
        return {
            allowed: false,
            message: 'El plan Free solo permite 1 sucursal. Actualiza a Business para tener múltiples sucursales.',
            upgradeTo: 'business',
        };
    }

    if (plan === 'lite') {
        return {
            allowed: false,
            message: 'El plan Esencial solo permite 1 sucursal. Actualiza a Business para tener múltiples sucursales.',
            upgradeTo: 'business',
        };
    }

    if (plan === 'pro') {
        return {
            allowed: false,
            message: 'El plan Pro solo permite 1 sucursal. Actualiza a Business para tener múltiples sucursales.',
            upgradeTo: 'business',
        };
    }

    return { allowed: false, message: 'Límite de sucursales alcanzado.' };
}

/** Plan badge colors for UI */
export function getPlanBadgeStyles(plan: PlanType): { bg: string; text: string; border: string; glow: string } {
    switch (plan) {
        case 'lite':
            return { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20', glow: 'shadow-teal-500/10' };
        case 'pro':
            return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', glow: 'shadow-amber-500/10' };
        case 'business':
            return { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', glow: 'shadow-violet-500/10' };
        default:
            return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', glow: '' };
    }
}

/**
 * Checks if the account is currently active based on subscription type and payment status.
 */
export function isAccountActive(
    subscriptionType: 'stripe' | 'manual' = 'manual',
    paymentStatus: 'active' | 'grace_period' | 'suspended' = 'active',
    gracePeriodEndsAt?: string | null
): { active: boolean; warning?: string; blocked: boolean } {
    if (subscriptionType === 'manual') {
        return { active: true, blocked: false };
    }
    if (paymentStatus === 'active') {
        return { active: true, blocked: false };
    }
    if (paymentStatus === 'grace_period') {
        if (gracePeriodEndsAt && new Date(gracePeriodEndsAt) < new Date()) {
            return { active: false, blocked: true, warning: 'Tu período de gracia ha expirado. Tu cuenta ha sido suspendida.' };
        }
        return {
            active: true,
            blocked: false,
            warning: 'Problema de pago detectado. Por favor, actualiza tu tarjeta para evitar la suspensión del servicio.'
        };
    }
    return { active: false, blocked: true, warning: 'Tu cuenta ha sido suspendida por falta de pago.' };
}

/**
 * Checks if the nail calculator feature is enabled for a business.
 */
export function isNailCalculatorEnabled(config?: { category?: string; enableNailCalculator?: boolean } | null): boolean {
    if (!config) return false;
    const isSupportedCategory = (['nail_bar', 'beauty_salon'] as string[]).includes(config.category || '');
    if (!isSupportedCategory) return false;
    return config.enableNailCalculator ?? true;
}

/**
 * Checks if an appointment is active (not cancelled, not completed, and date/time has not passed).
 */
export function isAppointmentActive(a: { status: string; date: string; time: string }, serviceDuration: number = 30): boolean {
    if (a.status === 'cancelada' || a.status === 'completada') return false;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (a.date > todayStr) return true;
    if (a.date === todayStr) {
        const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const [hours, minutes] = a.time.split(':').map(Number);
        const endMinutes = hours * 60 + minutes + serviceDuration;
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        const endTimeStr = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
        return currentTimeStr < endTimeStr;
    }
    return false;
}
