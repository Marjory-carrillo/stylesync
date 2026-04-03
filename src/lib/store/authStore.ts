import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

export type UserRole = 'owner' | 'admin' | 'employee' | 'no_tenant' | null;

export interface TenantSummary {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
    category?: string;
}

interface AuthState {
    user: User | null;
    session: Session | null;
    tenantId: string | null;
    userRole: UserRole;
    userStylistId: number | null;
    loadingAuth: boolean;
    isSuperAdmin: boolean;

    /** All tenants this owner has access to (only populated for owners with 2+) */
    userTenants: TenantSummary[];

    setAuth: (payload: {
        user: User | null;
        session: Session | null;
        loadingAuth: boolean;
    }) => void;

    setTenantData: (payload: {
        tenantId: string | null;
        userRole: UserRole;
        userStylistId: number | null;
    }) => void;

    setUserTenants: (tenants: TenantSummary[]) => void;

    /** Switch the active tenant (for multi-business owners) */
    switchActiveTenant: (tenantId: string) => void;

    setLoadingAuth: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    tenantId: null,
    userRole: null,
    userStylistId: null,
    loadingAuth: true,
    isSuperAdmin: false,
    userTenants: [],

    setAuth: ({ user, session, loadingAuth }) => set({
        user, session, loadingAuth,
        isSuperAdmin: user?.user_metadata?.is_super_admin === true
    }),
    setTenantData: ({ tenantId, userRole, userStylistId }) => set({ tenantId, userRole, userStylistId }),
    setUserTenants: (tenants) => set({ userTenants: tenants }),
    switchActiveTenant: (tenantId) => {
        localStorage.setItem('citalink_tenant_id', tenantId);
        set({ tenantId });
    },
    setLoadingAuth: (loadingAuth) => set({ loadingAuth })
}));
