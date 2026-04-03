import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { BusinessConfig } from '../../types/store.types';
import { useAuthStore } from '../authStore';

import { useUIStore } from '../uiStore';

export const useTenantData = (overrideTenantId?: string) => {
    const storeTenantId = useAuthStore((state) => state.tenantId);
    const tenantId = overrideTenantId || storeTenantId;
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['tenant', tenantId];

    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<BusinessConfig | null> => {
            if (!tenantId) return null;
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', tenantId)
                .single();

            if (error) throw error;
            if (!data) return null;

            return {
                name: data.name,
                address: data.address || '',
                phone: data.phone || '',
                googleMapsUrl: data.google_maps_url || '',
                category: data.category || '',
                slug: data.slug || '',
                logoUrl: data.logo_url || '',
                description: data.description || '',
                primaryColor: data.primary_color || '',
                accentColor: data.accent_color || '',
                bookingDaysAhead: data.booking_days_ahead,
                commissionsEnabled: data.commissions_enabled || false,
                enableAddons: data.enable_addons || false,
                confirmationTemplate: data.confirmation_template || '',
                reminderTemplate: data.reminder_template || '',
                showDashboardMetrics: data.show_dashboard_metrics ?? true,
                breakBetweenAppointments: data.break_between_appointments || 0,
                smsProvider: (data.sms_provider as 'demo' | 'whatsapp') || 'demo',
                brandSlug: data.brand_slug,
            };
        },
        enabled: !!tenantId,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    const updateMutation = useMutation({
        mutationFn: async (newData: Partial<BusinessConfig>) => {
            if (!tenantId) throw new Error("No tenant info");

            const payload: any = {};
            if (newData.name !== undefined) payload.name = newData.name;
            if (newData.address !== undefined) payload.address = newData.address;
            if (newData.phone !== undefined) payload.phone = newData.phone;
            if (newData.googleMapsUrl !== undefined) payload.google_maps_url = newData.googleMapsUrl;
            if (newData.category !== undefined) payload.category = newData.category;
            if (newData.slug !== undefined) payload.slug = newData.slug;
            if (newData.logoUrl !== undefined) payload.logo_url = newData.logoUrl;
            if (newData.description !== undefined) payload.description = newData.description;
            if (newData.primaryColor !== undefined) payload.primary_color = newData.primaryColor;
            if (newData.accentColor !== undefined) payload.accent_color = newData.accentColor;
            if (newData.bookingDaysAhead !== undefined) payload.booking_days_ahead = newData.bookingDaysAhead;
            if (newData.commissionsEnabled !== undefined) payload.commissions_enabled = newData.commissionsEnabled;
            if (newData.enableAddons !== undefined) payload.enable_addons = newData.enableAddons;
            if (newData.confirmationTemplate !== undefined) payload.confirmation_template = newData.confirmationTemplate;
            if (newData.reminderTemplate !== undefined) payload.reminder_template = newData.reminderTemplate;
            if (newData.showDashboardMetrics !== undefined) payload.show_dashboard_metrics = newData.showDashboardMetrics;
            if (newData.breakBetweenAppointments !== undefined) payload.break_between_appointments = newData.breakBetweenAppointments;

            const { error } = await supabase
                .from('tenants')
                .update(payload)
                .eq('id', tenantId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        },
        onError: (err: any) => {
            showToast(`Error: ${err.message}`, 'error');
        }
    });

    return {
        ...query,
        updateTenantData: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending
    };
};
