import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { Client } from '../../types/store.types';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

export const useClients = () => {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['clients', tenantId];

    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<Client[]> => {
            if (!tenantId) return [];
            // Leer desde la vista client_summaries que incluye
            // total_visits, total_spent, last_visit y main_service calculados en tiempo real
            const { data, error } = await supabase
                .from('client_summaries')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });
            if (error) {
                // Fallback a la tabla clients si la vista no existe aún
                console.warn('client_summaries view not available, falling back to clients table:', error.message);
                const { data: fallback, error: fallbackError } = await supabase
                    .from('clients')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false });
                if (fallbackError) throw fallbackError;
                return (fallback || []).map((c: any) => ({
                    ...c,
                    tenantId: c.tenant_id,
                    createdAt: c.created_at,
                    totalVisits: 0,
                    totalSpent: 0,
                    lastVisit: null,
                    mainService: null,
                })) as Client[];
            }
            return (data || []).map((c: any) => ({
                ...c,
                tenantId: c.tenant_id,
                createdAt: c.created_at,
                totalVisits: Number(c.total_visits) || 0,
                totalSpent: Number(c.total_spent) || 0,
                lastVisit: c.last_visit || null,
                mainService: c.main_service || null,
            })) as Client[];
        },
        enabled: !!tenantId,
        staleTime: 1000 * 60 * 2, // 2 minutos de caché (los stats no cambian tan seguido)
    });


    const updateNotesMutation = useMutation({
        mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
            if (!tenantId) throw new Error('Sin tenant');
            const { error } = await supabase.from('clients')
                .update({ notes })
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Notas guardadas', 'success');
        },
        onError: (err: any) => showToast(`Error al guardar notas: ${err.message}`, 'error')
    });

    const updateTagsMutation = useMutation({
        mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
            if (!tenantId) throw new Error('Sin tenant');
            const { error } = await supabase.from('clients')
                .update({ tags })
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Etiquetas guardadas', 'success');
        },
        onError: (err: any) => showToast(`Error al guardar etiquetas: ${err.message}`, 'error')
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error('Sin tenant');
            const { error } = await supabase.from('clients')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Cliente eliminado', 'success');
        },
        onError: (err: any) => showToast(`Error al eliminar: ${err.message}`, 'error')
    });

    return {
        ...query,
        clients: query.data || [],
        updateClientNotes: updateNotesMutation.mutateAsync,
        updateClientTags: updateTagsMutation.mutateAsync,
        deleteClient: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,
    };
};
