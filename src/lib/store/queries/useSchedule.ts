import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { WeekSchedule, DaySchedule } from '../../types/store.types';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

const DEFAULT_SCHEDULE: WeekSchedule = {
    monday: { open: true, start: '09:00', end: '18:00' },
    tuesday: { open: true, start: '09:00', end: '18:00' },
    wednesday: { open: true, start: '09:00', end: '18:00' },
    thursday: { open: true, start: '09:00', end: '18:00' },
    friday: { open: true, start: '09:00', end: '18:00' },
    saturday: { open: true, start: '09:00', end: '14:00' },
    sunday: { open: false, start: '09:00', end: '14:00' },
};

export const useSchedule = () => {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['schedule', tenantId];

    // GET Schedule
    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<WeekSchedule> => {
            if (!tenantId) return DEFAULT_SCHEDULE;
            const { data, error } = await supabase
                .from('schedule_config')
                .select('schedule')
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;

            // If none exists, create default silently
            if (!data) {
                const { error: insertError } = await supabase.from('schedule_config').insert({
                    tenant_id: tenantId,
                    schedule: DEFAULT_SCHEDULE
                });
                if (insertError) console.error("Could not insert default schedule", insertError);
                return DEFAULT_SCHEDULE;
            }

            return data.schedule as WeekSchedule;
        },
        enabled: !!tenantId,
    });

    const schedule = query.data || DEFAULT_SCHEDULE;

    // SAVE full schedule
    const saveMutation = useMutation({
        mutationFn: async (newSchedule: WeekSchedule) => {
            if (!tenantId) throw new Error("No tenant info");

            // Upsert mechanism manually
            const { data: existing } = await supabase
                .from('schedule_config')
                .select('id')
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (existing) {
                const { error } = await supabase
                    .from('schedule_config')
                    .update({ schedule: newSchedule })
                    .eq('tenant_id', tenantId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('schedule_config')
                    .insert({ tenant_id: tenantId, schedule: newSchedule });
                if (error) throw error;
            }
        },
        onSuccess: (_, variables) => {
            // Optimistic manual cache update
            queryClient.setQueryData(queryKey, variables);
            showToast('Horarios guardados exitosamente', 'success');
        },
        onError: (err: any) => showToast(`Error al guardar horarios: ${err.message}`, 'error')
    });

    // UPDATE Single day
    const updateDaySchedule = async (day: string, data: Partial<DaySchedule>) => {
        const newSchedule = { ...schedule, [day]: { ...schedule[day], ...data } };
        return saveMutation.mutateAsync(newSchedule);
    };

    return {
        ...query,
        schedule,
        saveSchedule: saveMutation.mutateAsync,
        updateDaySchedule,
        isSaving: saveMutation.isPending
    };
};
