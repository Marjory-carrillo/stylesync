import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { Quote } from '../../types/store.types';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

const mapQuoteRow = (row: any): Quote => ({
    id: row.id,
    tenantId: row.tenant_id,
    serviceId: row.service_id ?? null,
    stylistId: row.stylist_id ?? null,
    clientName: row.client_name ?? null,
    clientPhone: row.client_phone ?? null,
    sizeId: row.size_id ?? null,
    sizeName: row.size_name ?? null,
    styles: Array.isArray(row.styles) ? row.styles : [],
    extras: Array.isArray(row.extras) ? row.extras : [],
    referenceImageUrl: row.reference_image_url ?? null,
    totalPrice: Number(row.total_price ?? 0),
    totalDuration: Number(row.total_duration ?? 0),
    status: row.status ?? 'pendiente',
    appointmentId: row.appointment_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});

/**
 * Hook para la administración del historial de cotizaciones del tenant
 */
export const useQuotes = () => {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['quotes', tenantId];

    // Live realtime sync for quotes
    useEffect(() => {
        if (!tenantId) return;
        const channelName = `quotes-live-${tenantId}-${Math.random().toString(36).substring(2, 7)}`;
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'quotes',
            }, (payload) => {
                const rec = (payload.new || payload.old) as any;
                if (!rec || !rec.tenant_id || rec.tenant_id === tenantId) {
                    queryClient.invalidateQueries({ queryKey: ['quotes', tenantId] });
                    queryClient.refetchQueries({ queryKey: ['quotes', tenantId] });
                }
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'appointments',
            }, (payload) => {
                const rec = (payload.new || payload.old) as any;
                if (!rec || !rec.tenant_id || rec.tenant_id === tenantId) {
                    queryClient.invalidateQueries({ queryKey: ['quotes', tenantId] });
                    queryClient.refetchQueries({ queryKey: ['quotes', tenantId] });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenantId, queryClient]);

    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<Quote[]> => {
            if (!tenantId) return [];
            const { data, error } = await supabase
                .from('quotes')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (error) {
                // Si la tabla aún no existe o hay error, no romper la UI
                console.warn('Error fetching quotes:', error.message);
                return [];
            }
            return (data ?? []).map(mapQuoteRow);
        },
        enabled: !!tenantId,
        staleTime: 1000 * 10, // 10s cache
    });

    // Guardar / Crear nueva cotización
    const createMutation = useMutation({
        mutationFn: async (quoteData: {
            serviceId?: number | null;
            stylistId?: number | null;
            clientName?: string | null;
            clientPhone?: string | null;
            sizeId?: string | null;
            sizeName?: string | null;
            styles?: any[];
            extras?: any[];
            referenceImageUrl?: string | null;
            totalPrice: number;
            totalDuration: number;
        }): Promise<Quote> => {
            if (!tenantId) throw new Error('No tenant');
            const { data, error } = await supabase
                .from('quotes')
                .insert([{
                    tenant_id: tenantId,
                    service_id: quoteData.serviceId ?? null,
                    stylist_id: quoteData.stylistId ?? null,
                    client_name: quoteData.clientName ?? null,
                    client_phone: quoteData.clientPhone ?? null,
                    size_id: quoteData.sizeId ?? null,
                    size_name: quoteData.sizeName ?? null,
                    styles: quoteData.styles ?? [],
                    extras: quoteData.extras ?? [],
                    reference_image_url: quoteData.referenceImageUrl ?? null,
                    total_price: quoteData.totalPrice,
                    total_duration: quoteData.totalDuration,
                    status: 'pendiente',
                }])
                .select()
                .single();

            if (error) throw error;
            return mapQuoteRow(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quotes', tenantId] });
        },
        onError: (err: any) => {
            console.error('Error al guardar cotización:', err);
            showToast(`Error al guardar cotización: ${err.message}`, 'error');
        },
    });

    // Eliminar cotización (invalida el enlace)
    const deleteMutation = useMutation({
        mutationFn: async (quoteId: string) => {
            if (!tenantId) throw new Error('No tenant');
            const { error } = await supabase
                .from('quotes')
                .delete()
                .eq('id', quoteId)
                .eq('tenant_id', tenantId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quotes', tenantId] });
            showToast('Cotización eliminada. El enlace ha sido invalidado.', 'success');
        },
        onError: (err: any) => showToast(`Error al eliminar: ${err.message}`, 'error'),
    });

    return {
        ...query,
        quotes: query.data ?? [],
        createQuote: createMutation.mutateAsync,
        deleteQuote: deleteMutation.mutateAsync,
        isCreating: createMutation.isPending,
        isDeleting: deleteMutation.isPending,
    };
};

/**
 * Hook para consultar una cotización específica de forma pública (para el flujo de Booking de la clienta)
 */
export const usePublicQuote = (quoteId: string | null) => {
    return useQuery({
        queryKey: ['public-quote', quoteId],
        queryFn: async (): Promise<Quote | null> => {
            if (!quoteId) return null;
            const { data, error } = await supabase
                .from('quotes')
                .select('*')
                .eq('id', quoteId)
                .single();

            if (error || !data) {
                console.warn('Cotización no encontrada o expirada:', error?.message);
                return null;
            }
            return mapQuoteRow(data);
        },
        enabled: !!quoteId,
        staleTime: 1000 * 60, // 1 min cache
    });
};

/**
 * Función auxiliar para marcar una cotización como agendada desde el cliente o admin
 */
export const markQuoteAsBooked = async (quoteId: string, appointmentId: string) => {
    try {
        await supabase
            .from('quotes')
            .update({
                status: 'agendada',
                appointment_id: appointmentId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', quoteId);
    } catch (err) {
        console.warn('No se pudo actualizar el estado de la cotización:', err);
    }
};
