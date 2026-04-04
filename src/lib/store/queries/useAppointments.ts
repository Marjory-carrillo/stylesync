import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { Appointment } from '../../types/store.types';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

// Helper: notify barber via WhatsApp (fire-and-forget)
async function notifyAdmin(
    tenantId: string,
    eventType: 'new' | 'reschedule' | 'cancel',
    appointment: { client_name: string; client_phone: string; service_name?: string; date: string; time: string },
    adminPhone?: string,
    businessName?: string,
) {
    try {
        await supabase.functions.invoke('notify-admin', {
            body: {
                tenant_id: tenantId,
                event_type: eventType,
                appointment,
                ...(adminPhone   ? { admin_phone:   adminPhone   } : {}),
                ...(businessName ? { business_name: businessName } : {}),
            },
        });
    } catch (_) { /* fire-and-forget */ }
}

export const useAppointments = (options?: { startDate?: string; adminPhone?: string; businessName?: string }) => {
    const { tenantId } = useAuthStore();
    const { showToast, setDeviceHasPending, getDevicePendingId, clearDevicePending } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['appointments', tenantId, options?.startDate];
    const adminPhone   = options?.adminPhone;
    const businessName = options?.businessName;

    // GET Appointments
    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<Appointment[]> => {
            if (!tenantId) return [];
            let queryBuilder = supabase.from('appointments').select('*').eq('tenant_id', tenantId);
            if (options?.startDate) queryBuilder = queryBuilder.gte('date', options.startDate);
            const { data, error } = await queryBuilder;
            if (error) throw error;
            return data.map((a: any) => ({
                ...a,
                clientName: a.client_name,
                clientPhone: a.client_phone,
                serviceId: a.service_id,
                stylistId: a.stylist_id,
                bookedAt: a.booked_at,
                reminderSent: a.reminder_sent,
                confirmationSent: a.confirmation_sent,
            })) as Appointment[];
        },
        enabled: !!tenantId,
    });

    // ADD Appointment
    const addMutation = useMutation({
        mutationFn: async (appt: Omit<Appointment, 'id' | 'status' | 'bookedAt'>) => {
            if (!tenantId) throw new Error('No tenant info');
            const { data: rpcResult, error: rpcError } = await supabase.rpc('create_appointment_v3', {
                p_tenant_id: tenantId,
                p_client_name: appt.clientName,
                p_client_phone: appt.clientPhone,
                p_service_id: appt.serviceId,
                p_stylist_id: appt.stylistId,
                p_date: appt.date,
                p_time: appt.time,
            });
            if (rpcError) throw rpcError;
            if (!rpcResult?.success) throw new Error(rpcResult?.error || 'Error desconocido al reservar');

            // Save additional services if provided (non-blocking fire-and-forget)
            if (rpcResult?.id && appt.additionalServices && appt.additionalServices.length > 0) {
                void (async () => {
                    try {
                        await supabase
                            .from('appointments')
                            .update({ additional_services: appt.additionalServices })
                            .eq('id', rpcResult.id);
                    } catch { /* non-blocking */ }
                })();
            }

            return { ...rpcResult, _appt: appt };
        },
        onSuccess: (data) => {
            if (data.id) setDeviceHasPending(data.id);
            queryClient.invalidateQueries({ queryKey });
            showToast('Cita reservada con éxito', 'success');
        },
        onError: (err: any) => {
            if (err.message === 'MONTHLY_LIMIT_REACHED') {
                showToast('Límite de 30 citas/mes alcanzado en Plan Free. Actualiza a Pro para citas ilimitadas.', 'error');
            } else {
                showToast(`Error al reservar: ${err.message}`, 'error');
            }
        },
    });

    // CANCEL Appointment
    const cancelMutation = useMutation({
        mutationFn: async ({ id, serviceName }: { id: string; serviceName: string }) => {
            if (!tenantId) throw new Error('No tenant info');
            const apt = query.data?.find(a => a.id === id);
            const { data, error } = await supabase.rpc('cancel_appointment_by_client', {
                p_appointment_id: id,
                p_tenant_id: tenantId,
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'Error al cancelar');
            return { id, apt, serviceName };
        },
        onSuccess: ({ id, apt, serviceName }) => {
            if (getDevicePendingId() === id) clearDevicePending();
            queryClient.invalidateQueries({ queryKey });
            showToast('Cita cancelada', 'success');
            if (tenantId && apt) {
                notifyAdmin(tenantId, 'cancel', {
                    client_name: apt.clientName,
                    client_phone: apt.clientPhone,
                    service_name: serviceName,
                    date: apt.date,
                    time: apt.time,
                }, adminPhone, businessName);
            }
        },
        onError: (err: any) => showToast(`Error al cancelar: ${err.message}`, 'error'),
    });

    // COMPLETE Appointment
    const completeMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error('No tenant info');
            const { error } = await supabase.from('appointments')
                .update({ status: 'completada' })
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
            return id;
        },
        onSuccess: (id) => {
            if (getDevicePendingId() === id) clearDevicePending();
            queryClient.invalidateQueries({ queryKey });
            showToast('Cita completada', 'success');
        },
        onError: (err: any) => showToast(`Error al completar: ${err.message}`, 'error'),
    });

    // UPDATE TIME + DATE
    const updateTimeMutation = useMutation({
        mutationFn: async ({ id, newTime, newDate, serviceName }: { id: string; newTime: string; newDate?: string; serviceName: string }) => {
            if (!tenantId) throw new Error('No tenant info');
            const apt = query.data?.find(a => a.id === id);
            const { data, error } = await supabase.rpc('update_appointment_time_by_client', {
                p_appointment_id: id,
                p_tenant_id: tenantId,
                p_new_time: newTime,
                p_new_date: newDate ?? null,
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'Error al actualizar');
            return { apt, newTime, newDate, serviceName };
        },
        onSuccess: ({ apt, newTime, newDate, serviceName }) => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Hora actualizada', 'success');
            if (tenantId && apt) {
                notifyAdmin(tenantId, 'reschedule', {
                    client_name: apt.clientName,
                    client_phone: apt.clientPhone,
                    service_name: serviceName,
                    date: newDate ?? apt.date,
                    time: newTime,
                }, adminPhone, businessName);
            }
        },
        onError: (err: any) => showToast(`Error al actualizar hora: ${err.message}`, 'error'),
    });

    return {
        ...query,
        appointments: query.data || [],
        addAppointment: addMutation.mutateAsync,
        cancelAppointment: cancelMutation.mutateAsync,
        completeAppointment: completeMutation.mutateAsync,
        updateAppointmentTime: updateTimeMutation.mutateAsync,
        isAdding: addMutation.isPending,
        isCancelling: cancelMutation.isPending,
        isCompleting: completeMutation.isPending,
    };
};
