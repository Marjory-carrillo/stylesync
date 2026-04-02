import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { Service } from '../../types/store.types';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

export const useServices = () => {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['services', tenantId];

    // GET Services
    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<Service[]> => {
            if (!tenantId) return [];
            const { data, error } = await supabase
                .from('services')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('id');
            if (error) throw error;
            return (data as any[]).map(d => ({
                ...d,
                isAddon: d.is_addon
            })) as Service[];
        },
        enabled: !!tenantId,
    });

    // ADD Service
    const addMutation = useMutation({
        mutationFn: async (service: Omit<Service, 'id'>) => {
            if (!tenantId) throw new Error("No tenant info");
            const { isAddon, ...rest } = service as any;
            const dbData = { ...rest, is_addon: isAddon ?? false, tenant_id: tenantId };
            const { data, error } = await supabase
                .from('services')
                .insert([dbData])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Servicio agregado', 'success');
        },
        onError: (err: any) => showToast(`Error al agregar servicio: ${err.message}`, 'error')
    });

    // UPDATE Service
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: Partial<Service> }) => {
            if (!tenantId) throw new Error("No tenant info");
            const { isAddon, ...rest } = data as any;
            const dbData = { ...rest };
            if (isAddon !== undefined) dbData.is_addon = isAddon;

            const { error } = await supabase
                .from('services')
                .update(dbData)
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Servicio actualizado', 'success');
        },
        onError: (err: any) => showToast(`Error al actualizar: ${err.message}`, 'error')
    });

    // DELETE Service
    const removeMutation = useMutation({
        mutationFn: async (id: number) => {
            if (!tenantId) throw new Error("No tenant info");
            const { error } = await supabase
                .from('services')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Servicio eliminado', 'success');
        },
        onError: (err: any) => showToast(`Error al eliminar: ${err.message}`, 'error')
    });

    return {
        ...query,
        services: query.data || [],
        addService: addMutation.mutateAsync,
        updateService: updateMutation.mutateAsync,
        removeService: removeMutation.mutateAsync,
        isAdding: addMutation.isPending,
        isUpdating: updateMutation.isPending,
        isRemoving: removeMutation.isPending
    };
};
