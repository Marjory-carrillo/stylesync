import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';

export interface Review {
    id: string;
    tenantId: string;
    clientName: string;
    clientPhone?: string;
    rating: number;
    comment?: string;
    reply?: string;
    repliedAt?: string;
    verifiedClient?: boolean;
    appointmentId?: string;
    createdAt: string;
}

export function useReviews(tenantId?: string | null) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['reviews', tenantId],
        queryFn: async (): Promise<Review[]> => {
            if (!tenantId) return [];
            const { data, error } = await supabase
                .from('reviews')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('[useReviews] Error fetching reviews:', error);
                return [];
            }

            return (data || []).map((r: any) => ({
                id: r.id,
                tenantId: r.tenant_id,
                clientName: r.client_name || 'Cliente Anónimo',
                clientPhone: r.client_phone || undefined,
                rating: Number(r.rating) || 5,
                comment: r.comment || undefined,
                reply: r.reply || undefined,
                repliedAt: r.replied_at || undefined,
                verifiedClient: r.verified_client ?? true,
                appointmentId: r.appointment_id || undefined,
                createdAt: r.created_at
            }));
        },
        enabled: !!tenantId,
    });

    const reviews = query.data || [];

    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
        ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
        : 5.0;

    const addReviewMutation = useMutation({
        mutationFn: async (newReview: {
            tenantId: string;
            clientName?: string;
            clientPhone?: string;
            rating: number;
            comment?: string;
            verifiedClient?: boolean;
            appointmentId?: string;
        }) => {
            const insertPayload: any = {
                tenant_id: newReview.tenantId,
                client_name: newReview.clientName?.trim() || 'Cliente Anónimo',
                client_phone: newReview.clientPhone?.trim() || null,
                rating: newReview.rating,
                comment: newReview.comment?.trim() || null,
                verified_client: newReview.verifiedClient ?? true,
                appointment_id: newReview.appointmentId || null
            };

            const { data, error } = await supabase
                .from('reviews')
                .insert(insertPayload)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['reviews', variables.tenantId] });
        }
    });

    const replyMutation = useMutation({
        mutationFn: async ({ reviewId, reply }: { reviewId: string; reply: string }) => {
            const { data, error } = await supabase
                .from('reviews')
                .update({
                    reply: reply.trim(),
                    replied_at: new Date().toISOString()
                })
                .eq('id', reviewId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reviews', tenantId] });
        }
    });

    return {
        reviews,
        totalReviews,
        averageRating,
        isLoading: query.isLoading,
        refetch: query.refetch,
        addReview: addReviewMutation.mutateAsync,
        isAdding: addReviewMutation.isPending,
        replyReview: replyMutation.mutateAsync,
        isReplying: replyMutation.isPending
    };
}
