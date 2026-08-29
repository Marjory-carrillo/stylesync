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
    /** true mientras se consulta el tenant del usuario; evita mostrar "Acceso Pendiente" prematuramente */
    loadingTenant: boolean;
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
    setLoadingTenant: (loading: boolean) => void;
    resetForSignOut: () => void;
}

export const isUserSuperAdmin = (user: User | null | undefined): boolean => {
    if (!user) return false;
    if (user.user_metadata?.is_super_admin === true || user.user_metadata?.is_super_admin === 'true') return true;
    const email = (user.email || '').toLowerCase().trim();
    if (email === 'infinitummisael@gmail.com') return true;
    return false;
};

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    tenantId: null,
    userRole: null,
    userStylistId: null,
    loadingAuth: true,
    loadingTenant: true,
    isSuperAdmin: false,
    userTenants: [],

    setAuth: ({ user, session, loadingAuth }) => set({
        user, session, loadingAuth,
        isSuperAdmin: isUserSuperAdmin(user)
    }),
    setTenantData: ({ tenantId, userRole, userStylistId }) => set({ tenantId, userRole, userStylistId, loadingTenant: false }),
    setUserTenants: (tenants) => set({ userTenants: tenants }),
    switchActiveTenant: (tenantId) => {
        localStorage.setItem('citalink_tenant_id', tenantId);
        set({ tenantId });
    },
    setLoadingAuth: (loadingAuth) => set({ loadingAuth }),
    setLoadingTenant: (loadingTenant) => set({ loadingTenant }),
    resetForSignOut: () => {
        localStorage.removeItem('citalink_tenant_id');
        set({
            user: null,
            session: null,
            tenantId: null,
            userRole: null,
            userStylistId: null,
            loadingAuth: false,
            loadingTenant: false,
            isSuperAdmin: false,
            userTenants: []
        });
    }
}));
