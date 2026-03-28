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
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data.map((c: any) => ({
                ...c,
                tenantId: c.tenant_id,
                createdAt: c.created_at,
            })) as Client[];
        },
        enabled: !!tenantId,
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
