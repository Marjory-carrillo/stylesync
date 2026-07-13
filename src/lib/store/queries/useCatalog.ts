import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { CatalogItem } from '../../types/store.types';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

export const MAX_CATALOG_IMAGES_PER_SERVICE = 20;

const mapRow = (row: any): CatalogItem => ({
    id: row.id,
    tenantId: row.tenant_id,
    serviceId: row.service_id ?? null,
    stylistId: row.stylist_id ?? null,
    title: row.title ?? '',
    description: row.description ?? '',
    imageUrl: row.image_url,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
});

// ── Hook for the BUSINESS catalog (by service_id) ──────────────────────────
export const useCatalog = (serviceId?: number | null) => {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['catalog', tenantId, serviceId ?? 'all'];

    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<CatalogItem[]> => {
            if (!tenantId) return [];
            let q = supabase
                .from('catalog_items')
                .select('*')
                .eq('tenant_id', tenantId)
                .is('stylist_id', null)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false });

            if (serviceId !== undefined && serviceId !== null) {
                q = q.eq('service_id', serviceId);
            }
            const { data, error } = await q;
            if (error) throw error;
            return (data ?? []).map(mapRow);
        },
        enabled: !!tenantId,
    });

    // ADD item
    const addMutation = useMutation({
        mutationFn: async (item: {
            imageUrl: string;
            title?: string;
            description?: string;
            serviceId?: number | null;
        }) => {
            if (!tenantId) throw new Error('No tenant');
            const { data, error } = await supabase
                .from('catalog_items')
                .insert([{
                    tenant_id: tenantId,
                    image_url: item.imageUrl,
                    title: item.title ?? null,
                    description: item.description ?? null,
                    service_id: item.serviceId ?? null,
                    stylist_id: null,
                }])
                .select()
                .single();
            if (error) throw error;
            return mapRow(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['catalog', tenantId] });
            showToast('Foto añadida al catálogo', 'success');
        },
        onError: (err: any) => showToast(`Error al subir foto: ${err.message}`, 'error'),
    });

    // UPDATE item
    const updateMutation = useMutation({
        mutationFn: async ({ id, title, description }: { id: string; title?: string; description?: string }) => {
            if (!tenantId) throw new Error('No tenant');
            const { error } = await supabase
                .from('catalog_items')
                .update({ title: title ?? null, description: description ?? null })
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['catalog', tenantId] });
            showToast('Foto actualizada', 'success');
        },
        onError: (err: any) => showToast(`Error al actualizar: ${err.message}`, 'error'),
    });

    // REMOVE item
    const removeMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error('No tenant');
            const { error } = await supabase
                .from('catalog_items')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['catalog', tenantId] });
            showToast('Foto eliminada del catálogo', 'success');
        },
        onError: (err: any) => showToast(`Error al eliminar: ${err.message}`, 'error'),
    });

    return {
        ...query,
        items: query.data ?? [],
        addItem: addMutation.mutateAsync,
        updateItem: updateMutation.mutateAsync,
        removeItem: removeMutation.mutateAsync,
        isAdding: addMutation.isPending,
        isRemoving: removeMutation.isPending,
    };
};

// ── Hook for loading ALL catalog items for a tenant (used in booking app) ──
export const useAllCatalog = (tenantId: string | null) => {
    return useQuery({
        queryKey: ['catalog', tenantId, 'all-public'],
        queryFn: async (): Promise<CatalogItem[]> => {
            if (!tenantId) return [];
            const { data, error } = await supabase
                .from('catalog_items')
                .select('*')
                .eq('tenant_id', tenantId)
                .is('stylist_id', null)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data ?? []).map(mapRow);
        },
        enabled: !!tenantId,
        staleTime: 1000 * 60 * 5, // 5 min cache
    });
};
