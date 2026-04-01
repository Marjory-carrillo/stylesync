import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { WaitingClient } from '../../types/store.types';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

export const useWaitingList = () => {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['waitingList', tenantId];

    // GET Waiting List
    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<WaitingClient[]> => {
            if (!tenantId) return [];
            const { data, error } = await supabase
                .from('waiting_list')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('date', { ascending: true })
                .order('created_at', { ascending: true });
            if (error) throw error;

            return data.map((w: any) => ({
                ...w,
                serviceId: w.service_id,
                createdAt: w.created_at
            })) as WaitingClient[];
        },
        enabled: !!tenantId,
    });

    // ADD to Waiting List
    const addMutation = useMutation({
        mutationFn: async (clientData: Omit<WaitingClient, 'id' | 'createdAt'>) => {
            if (!tenantId) throw new Error("No tenant info");

            // Optimistic duplicate check
            const currentList = queryClient.getQueryData<WaitingClient[]>(queryKey) || [];
            if (currentList.some(c => c.phone === clientData.phone && c.date === clientData.date)) {
                throw new Error('Ya existe una solicitud para este cliente en la misma fecha.');
            }

            const { error } = await supabase.from('waiting_list').insert([{
                tenant_id: tenantId,
                name: clientData.name,
                phone: clientData.phone,
                date: clientData.date,
                service_id: clientData.serviceId
            }]);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            // Toast manejado por el componente que invoca normalmente, o aquí.
            // showToast('Agregado a lista de espera', 'success');
        },
        onError: (err: any) => showToast(err.message || 'Error al agregar a la lista de espera', 'error')
    });

    // REMOVE from Waiting List
    const removeMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error("No tenant info");
            const { error } = await supabase
                .from('waiting_list')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        },
        onError: (err: any) => showToast(`Error al remover: ${err.message}`, 'error')
    });

    return {
        ...query,
        waitingList: query.data || [],
        addToWaitingList: addMutation.mutateAsync,
        removeFromWaitingList: removeMutation.mutateAsync,
        isAdding: addMutation.isPending,
        isRemoving: removeMutation.isPending
    };
};
