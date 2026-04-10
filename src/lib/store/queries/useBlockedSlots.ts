import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { BlockedSlot } from '../../types/store.types';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

export const useBlockedSlots = () => {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['blocked_slots', tenantId];

    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<BlockedSlot[]> => {
            if (!tenantId) return [];
            const { data, error } = await supabase
                .from('blocked_slots')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('date', { ascending: true });
            if (error) throw error;
            return data.map((b: any) => ({
                ...b,
                startTime: b.start_time,
                endTime: b.end_time,
            })) as BlockedSlot[];
        },
        enabled: !!tenantId,
    });

    // ── Single insert ─────────────────────────────────────────────────────────
    const addMutation = useMutation({
        mutationFn: async (slot: Omit<BlockedSlot, 'id'>) => {
            if (!tenantId) throw new Error('Sin tenant');
            const { error } = await supabase.from('blocked_slots').insert([{
                tenant_id: tenantId,
                date: slot.date,
                start_time: slot.startTime,
                end_time: slot.endTime,
                reason: slot.reason,
            }]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Bloque de horario agregado', 'success');
        },
        onError: (err: any) => showToast(`Error: ${err.message}`, 'error'),
    });

    // ── Batch insert for recurring blocks ─────────────────────────────────────
    const addBatchMutation = useMutation({
        mutationFn: async (slots: Omit<BlockedSlot, 'id'>[]) => {
            if (!tenantId) throw new Error('Sin tenant');
            if (slots.length === 0) return 0;
            const rows = slots.map(slot => ({
                tenant_id: tenantId,
                date: slot.date,
                start_time: slot.startTime,
                end_time: slot.endTime,
                reason: slot.reason,
            }));
            const { error } = await supabase.from('blocked_slots').insert(rows);
            if (error) throw error;
            return slots.length;
        },
        onSuccess: (count) => {
            queryClient.invalidateQueries({ queryKey });
            showToast(
                `${count} bloque${count !== 1 ? 's' : ''} de horario cread${count !== 1 ? 'os' : 'o'} ✅`,
                'success'
            );
        },
        onError: (err: any) => showToast(`Error: ${err.message}`, 'error'),
    });

    // ── Delete ────────────────────────────────────────────────────────────────
    const removeMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error('Sin tenant');
            const { error } = await supabase
                .from('blocked_slots')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Bloque eliminado', 'success');
        },
        onError: (err: any) => showToast(`Error: ${err.message}`, 'error'),
    });

    const blockedSlots = query.data || [];

    return {
        ...query,
        blockedSlots,
        getBlockedSlotsForDate: (date: string) => blockedSlots.filter(b => b.date === date),
        addBlockedSlot: addMutation.mutateAsync,
        addBlockedSlots: addBatchMutation.mutateAsync,
        isAddingBatch: addBatchMutation.isPending,
        removeBlockedSlot: removeMutation.mutateAsync,
    };
};
