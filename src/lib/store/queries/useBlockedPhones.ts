import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

export const useBlockedPhones = () => {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['blocked_phones', tenantId];

    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<string[]> => {
            if (!tenantId) return [];
            const { data, error } = await supabase
                .from('blocked_phones')
                .select('phone')
                .eq('tenant_id', tenantId);
            if (error) throw error;
            return data.map((p: any) => p.phone);
        },
        enabled: !!tenantId,
    });

    const blockMutation = useMutation({
        mutationFn: async ({ phone, reason }: { phone: string; reason?: string }) => {
            if (!tenantId) throw new Error('Sin tenant');
            const { error } = await supabase.from('blocked_phones').upsert([{
                phone,
                reason: reason || 'Bloqueo manual',
                tenant_id: tenantId
            }]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Teléfono bloqueado', 'success');
        },
        onError: (err: any) => showToast(`Error al bloquear: ${err.message}`, 'error')
    });

    const unblockMutation = useMutation({
        mutationFn: async (phone: string) => {
            if (!tenantId) throw new Error('Sin tenant');
            const { error } = await supabase.from('blocked_phones')
                .delete()
                .eq('phone', phone)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Teléfono desbloqueado', 'success');
        },
        onError: (err: any) => showToast(`Error al desbloquear: ${err.message}`, 'error')
    });

    const blockedPhones = query.data || [];

    return {
        ...query,
        blockedPhones,
        isPhoneBlocked: (phone: string) => blockedPhones.includes(phone),
        blockPhone: blockMutation.mutateAsync,
        unblockPhone: unblockMutation.mutateAsync,
    };
};
