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

    // GET Clients
    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<Client[]> => {
            console.log('[DEBUG useClients] tenantId:', tenantId);
            if (!tenantId) return [];
            const { data, error } = await supabase
                .from('client_summaries')
                .select('*')
                .eq('tenant_id', tenantId);
            console.log('[DEBUG useClients] Response:', { data, error, count: data?.length });
            if (error) throw error;

            return data.map((c: any) => ({
                ...c,
                tenantId: c.tenant_id,
                createdAt: c.created_at,
                // Mapeo seguro de campos con fallback para null/undefined
                totalVisits: Number(c.total_visits) || 0,
                totalSpent: Number(c.total_spent) || 0,
                lastVisit: c.last_visit || null,
                mainService: c.main_service || null
            })) as Client[];
        },
        enabled: !!tenantId,
    });

    // UPDATE Tags
    const updateTagsMutation = useMutation({
        mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
            if (!tenantId) throw new Error("No tenant info");
            const { error } = await supabase
                .from('clients')
                .update({ tags })
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Etiquetas actualizadas', 'success');
        },
        onError: (err: any) => showToast(`Error al actualizar etiquetas: ${err.message}`, 'error')
    });

    // UPDATE Notes
    const updateNotesMutation = useMutation({
        mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
            if (!tenantId) throw new Error("No tenant info");
            const { error } = await supabase
                .from('clients')
                .update({ notes })
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Notas del cliente guardadas', 'success');
        },
        onError: (err: any) => showToast(`Error al guardar notas: ${err.message}`, 'error')
    });

    // DELETE Client
    const deleteClientMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error("No tenant info");
            const { error } = await supabase
                .from('clients')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Cliente eliminado correctamente', 'success');
        },
        onError: (err: any) => showToast(`Error al eliminar cliente: ${err.message}`, 'error')
    });

    return {
        ...query,
        clients: query.data || [],
        updateClientTags: updateTagsMutation.mutateAsync,
        updateClientNotes: updateNotesMutation.mutateAsync,
        deleteClient: deleteClientMutation.mutateAsync,
        isUpdatingTags: updateTagsMutation.isPending,
        isUpdatingNotes: updateNotesMutation.isPending,
        isDeleting: deleteClientMutation.isPending
    };
};
