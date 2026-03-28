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
                createdAt: a.created_at,
            })) as Announcement[];
        },
        enabled: !!tenantId,
    });

    const addMutation = useMutation({
        mutationFn: async ({ message, type }: { message: string; type: Announcement['type'] }) => {
            if (!tenantId) throw new Error('Sin tenant');
            const { error } = await supabase.from('announcements').insert([{
                tenant_id: tenantId,
                message,
                type,
                active: true,
            }]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Anuncio publicado', 'success');
        },
        onError: (err: any) => showToast(`Error: ${err.message}`, 'error')
    });

    const removeMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error('Sin tenant');
            const { error } = await supabase.from('announcements')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Anuncio eliminado', 'success');
        },
        onError: (err: any) => showToast(`Error: ${err.message}`, 'error')
    });

    const toggleMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error('Sin tenant');
            const ann = query.data?.find(a => a.id === id);
            if (!ann) throw new Error('Anuncio no encontrado');
            const { error } = await supabase.from('announcements')
                .update({ active: !ann.active })
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey }),
        onError: (err: any) => showToast(`Error: ${err.message}`, 'error')
    });

    const announcements = query.data || [];

    return {
        ...query,
        announcements,
        getActiveAnnouncements: () => announcements.filter(a => a.active),
        addAnnouncement: addMutation.mutateAsync,
        removeAnnouncement: removeMutation.mutateAsync,
        toggleAnnouncement: toggleMutation.mutateAsync,
    };
};
