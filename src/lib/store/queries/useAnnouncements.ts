import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { Announcement } from '../../types/store.types';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

export const useAnnouncements = () => {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['announcements', tenantId];

    // GET Announcements
    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<Announcement[]> => {
            if (!tenantId) return [];
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });
            if (error) throw error;

            return data.map((a: any) => ({
                ...a,
                createdAt: a.created_at
            })) as Announcement[];
        },
        enabled: !!tenantId,
    });

    // ADD Announcement
    const addMutation = useMutation({
        mutationFn: async ({ message, type }: { message: string, type: Announcement['type'] }) => {
            if (!tenantId) throw new Error("No tenant info");
            const { error } = await supabase.from('announcements').insert([{
                tenant_id: tenantId,
                message,
                type,
                active: true
            }]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Aviso creado', 'success');
        },
        onError: (err: any) => showToast(`Error al crear aviso: ${err.message}`, 'error')
    });

    // TOGGLE Active Status
    const toggleMutation = useMutation({
        mutationFn: async ({ id, active }: { id: string, active: boolean }) => {
            if (!tenantId) throw new Error("No tenant info");
            const { error } = await supabase
                .from('announcements')
                .update({ active: !active })
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        },
        onError: (err: any) => showToast(`Error al alternar aviso: ${err.message}`, 'error')
    });

    // REMOVE Announcement
    const removeMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error("No tenant info");
            const { error } = await supabase
                .from('announcements')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Aviso eliminado', 'success');
        },
        onError: (err: any) => showToast(`Error al eliminar: ${err.message}`, 'error')
    });

    return {
        ...query,
        announcements: query.data || [],
        addAnnouncement: addMutation.mutateAsync,
        toggleAnnouncement: toggleMutation.mutateAsync,
        removeAnnouncement: removeMutation.mutateAsync,
        isAdding: addMutation.isPending,
    };
};
