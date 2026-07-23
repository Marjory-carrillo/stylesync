import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { CancellationLog } from '../../types/store.types';
import { useAuthStore } from '../authStore';

export const useCancellationLog = () => {
    const { tenantId } = useAuthStore();
    const queryClient = useQueryClient();
    const queryKey = ['cancellation_log', tenantId];

    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<CancellationLog[]> => {
            if (!tenantId) return [];
            const { data, error } = await supabase
                .from('cancellation_log')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('cancelled_at', { ascending: false });
            if (error) throw error;
            return data.map((c: any) => ({
                ...c,
                appointmentId: c.appointment_id,
                clientName: c.client_name,
                clientPhone: c.client_phone,
                serviceName: c.service_name,
                cancelledAt: c.cancelled_at,
            })) as CancellationLog[];
        },
        enabled: !!tenantId,
    });

    // Eliminar un registro individual de cancelaciones
    const deleteLogMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error('No tenant info');
            
            const { error: directErr } = await supabase
                .from('cancellation_log')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);

            if (directErr) {
                const { error: rpcErr } = await supabase.rpc('delete_cancellation_log_item', { p_id: id });
                if (rpcErr) throw rpcErr;
            }
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        },
    });

    // Vaciar todo el historial de cancelaciones
    const clearAllLogsMutation = useMutation({
        mutationFn: async () => {
            if (!tenantId) throw new Error('No tenant info');

            const { error: directErr } = await supabase
                .from('cancellation_log')
                .delete()
                .eq('tenant_id', tenantId);

            if (directErr) {
                const { error: rpcErr } = await supabase.rpc('clear_cancellation_log_for_tenant', { p_tenant_id: tenantId });
                if (rpcErr) throw rpcErr;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        },
    });

    const cancellationLog = query.data || [];

    // Devuelve cuántas cancelaciones ha hecho un teléfono en la semana actual
    const getWeeklyCancellations = (phone: string): number => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(now.setDate(diff)).toISOString().split('T')[0];
        return cancellationLog.filter(c => c.clientPhone === phone && c.cancelledAt >= weekStart).length;
    };

    // Devuelve cuántas cancelaciones ha hecho un teléfono en el mes actual
    const getMonthlyCancellations = (phone: string): number => {
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        return cancellationLog.filter(c => c.clientPhone === phone && c.cancelledAt >= monthStart).length;
    };

    return {
        ...query,
        cancellationLog,
        getWeeklyCancellations,
        getMonthlyCancellations,
        deleteCancellationLog: deleteLogMutation.mutateAsync,
        clearAllCancellationLog: clearAllLogsMutation.mutateAsync,
        isDeletingLog: deleteLogMutation.isPending,
        isClearingLogs: clearAllLogsMutation.isPending,
    };
};
