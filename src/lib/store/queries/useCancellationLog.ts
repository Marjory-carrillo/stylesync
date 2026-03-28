import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { CancellationLog } from '../../types/store.types';
import { useAuthStore } from '../authStore';

export const useCancellationLog = () => {
    const { tenantId } = useAuthStore();
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

    const cancellationLog = query.data || [];

    // Devuelve cuántas cancelaciones ha hecho un teléfono en la semana actual
    const getWeeklyCancellations = (phone: string): number => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(now.setDate(diff)).toISOString().split('T')[0];
        return cancellationLog.filter(c => c.clientPhone === phone && c.cancelledAt >= weekStart).length;
    };

    return {
        ...query,
        cancellationLog,
        getWeeklyCancellations,
    };
};
