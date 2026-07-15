import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';
import type { Lead } from '../../types/store.types';

export function useLeads() {
    const queryClient = useQueryClient();
    const isSuperAdmin = useAuthStore(s => s.isSuperAdmin);
    const { showToast } = useUIStore();

    const queryKey = ['superadmin_leads'];

    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<Lead[]> => {
            if (!isSuperAdmin) return [];
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []) as Lead[];
        },
        enabled: !!isSuperAdmin,
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const { data, error } = await supabase
                .from('leads')
                .update({ status })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Estado del prospecto actualizado', 'success');
        },
        onError: (err: any) => {
            showToast(`Error al actualizar estado: ${err.message}`, 'error');
        }
    });

    const updateNotesMutation = useMutation({
        mutationFn: async ({ id, notes }: { id: string; notes: string | null }) => {
            const { data, error } = await supabase
                .from('leads')
                .update({ notes })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Nota interna guardada', 'success');
        },
        onError: (err: any) => {
            showToast(`Error al guardar nota: ${err.message}`, 'error');
        }
    });

    const archiveMutation = useMutation({
        mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
            const { data, error } = await supabase
                .from('leads')
                .update({ archived_at: archive ? new Date().toISOString() : null })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey });
            showToast(variables.archive ? 'Prospecto archivado' : 'Prospecto desarchivado', 'success');
        },
        onError: (err: any) => {
            showToast(`Error al archivar: ${err.message}`, 'error');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('leads')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Prospecto eliminado permanentemente', 'success');
        },
        onError: (err: any) => {
            showToast(`Error al eliminar: ${err.message}`, 'error');
        }
    });

    const convertMutation = useMutation({
        mutationFn: async ({ id, tenantId }: { id: string; tenantId: string }) => {
            const { data, error } = await supabase
                .from('leads')
                .update({
                    status: 'prueba_iniciada',
                    converted_at: new Date().toISOString(),
                    converted_tenant_id: tenantId
                })
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        },
        onError: (err: any) => {
            showToast(`Error al marcar lead como convertido: ${err.message}`, 'error');
        }
    });

    return {
        leads: query.data || [],
        isLoading: query.isLoading,
        updateLeadStatus: updateStatusMutation.mutateAsync,
        updateLeadNotes: updateNotesMutation.mutateAsync,
        archiveLead: archiveMutation.mutateAsync,
        deleteLead: deleteMutation.mutateAsync,
        markLeadAsConverted: convertMutation.mutateAsync,
        isUpdating: updateStatusMutation.isPending || updateNotesMutation.isPending || archiveMutation.isPending,
        isDeleting: deleteMutation.isPending,
    };
}
