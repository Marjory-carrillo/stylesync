// Plan limits and enforcement for CitaLink subscription tiers

export type PlanType = 'free' | 'pro' | 'business';

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
    pro: {
        name: 'Pro',
        price: 899,
        maxBranches: 1,
        maxEmployeesPerBranch: 2,
        maxAppointmentsPerMonth: -1,
        canExpandBranches: false,
        canExpandEmployees: true,
        extraBranchPrice: 0,
        extraEmployeePrice: 349,
    },
    business: {
        name: 'Business',
        price: 1649,
        maxBranches: 2,
        maxEmployeesPerBranch: 2,
        maxAppointmentsPerMonth: -1,
        canExpandBranches: true,
        canExpandEmployees: true,
        extraBranchPrice: 749,
        extraEmployeePrice: 349,
    },
};

/** Get plan configuration */
export function getPlanLimits(plan: PlanType): PlanLimits {
    return PLAN_CONFIG[plan] || PLAN_CONFIG.free;
}

/** Returns true if the tenant is currently in a trial period */
export function isInTrial(trialEndsAt?: string | null): boolean {
    if (!trialEndsAt) return false;
    return new Date(trialEndsAt) > new Date();
}

/**
 * Calculate the effective max employees considering paid add-ons.
 * Each extra branch includes 2 professionals.
 * extraEmployeesPaid = individual extra professionals purchased.
 * extraBranchesPaid = extra branches purchased (each adds 2 professionals to total pool).
 */
export function getEffectiveMaxEmployees(
    plan: PlanType,
    extraEmployeesPaid: number = 0,
    extraBranchesPaid: number = 0,
): number {
    const limits = getPlanLimits(plan);
    const totalBranches = limits.maxBranches + extraBranchesPaid;
    // Base employees = 2 per branch (included) + individual extras
    return (limits.maxEmployeesPerBranch * totalBranches) + extraEmployeesPaid;
}

/** Calculate effective max branches considering paid add-ons */
export function getEffectiveMaxBranches(plan: PlanType, extraBranchesPaid: number = 0): number {
    const limits = getPlanLimits(plan);
    return limits.maxBranches + extraBranchesPaid;
}

/** Check if an employee (stylist) can be added */
export function canAddEmployee(
    plan: PlanType,
    currentCount: number,
    trialEndsAt?: string | null,
    extraEmployeesPaid: number = 0,
    extraBranchesPaid: number = 0,
): { allowed: boolean; message?: string; upgradeTo?: PlanType } {
    // Trial period: no limits, behave as Pro
    if (isInTrial(trialEndsAt)) {
        return { allowed: true };
    }

    const limits = getPlanLimits(plan);
    const effectiveMax = getEffectiveMaxEmployees(plan, extraEmployeesPaid, extraBranchesPaid);

    if (currentCount < effectiveMax) {
        return { allowed: true };
    }

    if (limits.canExpandEmployees) {
        // Pro/Business can add more but at extra cost
        return { allowed: true, message: `Empleado adicional: +$${limits.extraEmployeePrice}/mes` };
    }

    // Free plan — hard cap
    if (plan === 'free') {
        return {
            allowed: false,
            message: `El plan Free solo permite ${limits.maxEmployeesPerBranch} empleados. Actualiza a Pro para agregar más.`,
            upgradeTo: 'pro',
        };
    }

    return { allowed: false, message: 'Límite de empleados alcanzado.' };
}

/** Check if a stylist can be added (same logic as employee) */
export function canAddStylist(
    plan: PlanType,
    currentStylistCount: number,
    trialEndsAt?: string | null,
    extraEmployeesPaid: number = 0,
    extraBranchesPaid: number = 0,
): { allowed: boolean; message?: string; upgradeTo?: PlanType } {
    return canAddEmployee(plan, currentStylistCount, trialEndsAt, extraEmployeesPaid, extraBranchesPaid);
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
        case 'pro':
            return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', glow: 'shadow-amber-500/10' };
        case 'business':
            return { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20', glow: 'shadow-violet-500/10' };
        default:
            return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20', glow: '' };
    }
}
