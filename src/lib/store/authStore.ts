import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

export type UserRole = 'owner' | 'admin' | 'employee' | 'no_tenant' | null;

interface AuthState {
    user: User | null;
    session: Session | null;
    tenantId: string | null;
    userRole: UserRole;
    userStylistId: number | null;
    loadingAuth: boolean;
    isSuperAdmin: boolean;

    // Acciones básicas que solo mutan el store.
    // La lógica pesada de Supabase quedará fuera o en actions específicos de inicialización.
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

    setAuth: ({ user, session, loadingAuth }) => set({
        user, session, loadingAuth,
        isSuperAdmin: user?.user_metadata?.is_super_admin === true
    }),
    setTenantData: ({ tenantId, userRole, userStylistId }) => set({ tenantId, userRole, userStylistId }),
    setLoadingAuth: (loadingAuth) => set({ loadingAuth })
}));
