import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import { useAuthStore } from '../authStore';

export const useTenantBySlug = (slug?: string) => {
    const { setTenantData, tenantId: currentTenantId } = useAuthStore();

    const query = useQuery({
        queryKey: ['tenantIdBySlug', slug],
        queryFn: async () => {
            if (!slug) return null;
            const { data, error } = await supabase
                .from('tenants')
                .select('id')
                .eq('slug', slug)
                .single();

            if (error) {
                console.error("Error loading tenant by slug:", error);
                throw error;
            }
            return data.id;
        },
        enabled: !!slug,
        staleTime: 1000 * 60 * 60, // Cache for 1 hour to avoid redundant checks
    });

    useEffect(() => {
        if (query.data && query.data !== currentTenantId) {
            // Configure the public tenant ID in the global store
            // We set role to null/no_tenant so it doesn't grant admin permissions
            setTenantData({ tenantId: query.data, userRole: null, userStylistId: null });
            
            // Persist for smart routing if needed
            localStorage.setItem('citalink_last_slug', slug!);
        }
    }, [query.data, currentTenantId, setTenantData, slug]);

    return {
        tenantId: query.data,
        isLoading: query.isLoading,
        error: query.error
    };
};
