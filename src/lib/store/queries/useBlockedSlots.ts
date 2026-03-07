import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { BlockedSlot } from '../../types/store.types';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

export const useBlockedSlots = () => {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['blockedSlots', tenantId];

    // GET Blocked Slots
    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<BlockedSlot[]> => {
            if (!tenantId) return [];
            const { data, error } = await supabase
                .from('blocked_slots')
                .select('*')
                .eq('tenant_id', tenantId);
            if (error) throw error;

            return data.map((b: any) => ({
                ...b,
                startTime: b.start_time,
                endTime: b.end_time
            })) as BlockedSlot[];
        },
        enabled: !!tenantId,
    });

    // ADD Blocked Slot
    const addMutation = useMutation({
        mutationFn: async (slot: Omit<BlockedSlot, 'id'>) => {
            if (!tenantId) throw new Error("No tenant info");
            const { error } = await supabase.from('blocked_slots').insert([{
                tenant_id: tenantId,
                date: slot.date,
                start_time: slot.startTime,
                end_time: slot.endTime,
                reason: slot.reason
            }]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Horario bloqueado exitosamente', 'success');
        },
        onError: (err: any) => showToast(`Error al bloquear horario: ${err.message}`, 'error')
    });

    // REMOVE Blocked Slot
    const removeMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error("No tenant info");
            const { error } = await supabase
                .from('blocked_slots')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Bloqueo removido', 'success');
        },
        onError: (err: any) => showToast(`Error al remover bloqueo: ${err.message}`, 'error')
    });

    return {
        ...query,
        blockedSlots: query.data || [],
        addBlockedSlot: addMutation.mutateAsync,
        removeBlockedSlot: removeMutation.mutateAsync,
        isAdding: addMutation.isPending,
        isRemoving: removeMutation.isPending
    };
};
