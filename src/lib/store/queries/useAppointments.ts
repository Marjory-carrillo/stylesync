import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { Appointment } from '../../types/store.types';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

// Helper: notify barber via WhatsApp (fire-and-forget)
async function notifyAdmin(
    tenantId: string,
    eventType: 'new' | 'reschedule' | 'cancel' | 'price_update',
    appointment: { id?: string; client_name: string; client_phone: string; service_name?: string; date: string; time: string; stylist_id?: number | null; additional_services?: string[]; confirmed_price?: number },
    adminPhone?: string,
    businessName?: string,
) {
    try {
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
        const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
        await fetch(`${SUPABASE_URL}/functions/v1/notify-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ANON_KEY}`,
                'apikey': ANON_KEY,
            },
            body: JSON.stringify({
                tenant_id: tenantId,
                event_type: eventType,
                appointment,
                ...(adminPhone   ? { admin_phone:   adminPhone   } : {}),
                ...(businessName ? { business_name: businessName } : {}),
            }),
        });
    } catch (_) { /* fire-and-forget */ }
}

// Module-level in-flight mutex to block concurrent spam across all components
const inFlightLocks = new Set<string>();

export const useAppointments = (options?: { startDate?: string; adminPhone?: string; businessName?: string; tenantId?: string }) => {
    const { tenantId: authTenantId } = useAuthStore();
    const tenantId = options?.tenantId || authTenantId;
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
                confirmedByClient: a.confirmed_by_client || false,
                confirmedByClientAt: a.confirmed_by_client_at,
                cancellationReason: a.cancellation_reason,
                additionalServices: a.additional_services,
                bookingSource: a.booking_source || 'direct',
                marketplaceCommissionAmount: a.marketplace_commission_amount || 0,
                commissionBilled: a.commission_billed || false,
                depositRequired: a.deposit_required || false,
                depositAmount: a.deposit_amount || 0,
                depositStatus: a.deposit_status || 'none',
                depositReceiptUrl: a.deposit_receipt_url || null,
            })) as Appointment[];
        },
        enabled: !!tenantId,
        refetchOnWindowFocus: true,
        refetchInterval: 8000,
    });

    // Live realtime sync for appointments
    useEffect(() => {
        if (!tenantId) return;
        const channelName = `appointments-live-${tenantId}-${Math.random().toString(36).substring(2, 7)}`;
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'appointments',
            }, (payload) => {
                const rec = (payload.new || payload.old) as any;
                if (!rec || !rec.tenant_id || rec.tenant_id === tenantId) {
                    queryClient.invalidateQueries({ queryKey: ['appointments'] });
                    queryClient.refetchQueries({ queryKey: ['appointments'] });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenantId, queryClient]);

    // ADD Appointment
    const addMutation = useMutation({
        mutationFn: async (appt: Omit<Appointment, 'id' | 'status' | 'bookedAt'>) => {
            if (!tenantId) throw new Error('No tenant info');
            // Intentar invocar RPC con la nueva firma de 10 parámetros
            let rpcResult: any = null;
            let rpcError: any = null;

            const rpcParams = {
                p_tenant_id: tenantId,
                p_client_name: appt.clientName,
                p_client_phone: appt.clientPhone,
                p_service_id: appt.serviceId,
                p_stylist_id: appt.stylistId,
                p_date: appt.date,
                p_time: appt.time,
                p_additional_services: appt.additionalServices ?? null,
                p_booking_source: appt.bookingSource ?? 'direct',
                p_commission_amount: appt.marketplaceCommissionAmount ?? 0,
            };

            const res = await supabase.rpc('create_appointment_v3', rpcParams);
            rpcResult = res.data;
            rpcError = res.error;

            // Si falla por descalce de firma (PGRST202 / 42883), hacer fallback a la firma clásica de 7 parámetros
            if (rpcError && (rpcError.code === 'PGRST202' || rpcError.code === '42883' || rpcError.message?.includes('schema cache'))) {
                const classicParams = {
                    p_tenant_id: tenantId,
                    p_client_name: appt.clientName,
                    p_client_phone: appt.clientPhone,
                    p_service_id: appt.serviceId,
                    p_stylist_id: appt.stylistId,
                    p_date: appt.date,
                    p_time: appt.time,
                };
                const fallbackRes = await supabase.rpc('create_appointment_v3', classicParams);
                rpcResult = fallbackRes.data;
                rpcError = fallbackRes.error;
            }

            if (rpcError) throw rpcError;
            if (!rpcResult?.success) throw new Error(rpcResult?.error || 'Error desconocido al reservar');

            // Actualizar campos de adicionales y anticipos
            if (rpcResult?.id) {
                const updatePayload: any = {};
                if (appt.additionalServices && appt.additionalServices.length > 0) {
                    updatePayload.additional_services = appt.additionalServices;
                }
                if (appt.bookingSource) {
                    updatePayload.booking_source = appt.bookingSource;
                }
                if (appt.marketplaceCommissionAmount !== undefined && appt.marketplaceCommissionAmount > 0) {
                    updatePayload.marketplace_commission_amount = appt.marketplaceCommissionAmount;
                }
                if (appt.depositRequired !== undefined) {
                    updatePayload.deposit_required = appt.depositRequired;
                }
                if (appt.depositAmount !== undefined) {
                    updatePayload.deposit_amount = appt.depositAmount;
                }
                if (appt.depositStatus) {
                    updatePayload.deposit_status = appt.depositStatus;
                }
                if (appt.depositReceiptUrl) {
                    updatePayload.deposit_receipt_url = appt.depositReceiptUrl;
                }

                // 🎯 Regla de 6 Horas:
                // Si agendó con 6 horas o menos de anticipación antes de la cita, se AUTOCONFIRMA directamente (confirmed_by_client = true).
                // Si agendó con más de 6 horas de anticipación, NO se autoconfirma todavía para que reciba su recordatorio por WhatsApp y confirme desde el link.
                const isBookedWithin6Hours = (() => {
                    try {
                        const apptDt = new Date(`${appt.date}T${appt.time.slice(0, 5)}`);
                        const now = new Date();
                        const diffHours = (apptDt.getTime() - now.getTime()) / (1000 * 60 * 60);
                        return diffHours <= 6;
                    } catch {
                        return false;
                    }
                })();

                if (isBookedWithin6Hours) {
                    updatePayload.confirmed_by_client = true;
                    updatePayload.confirmed_by_client_at = new Date().toISOString();
                } else {
                    updatePayload.confirmed_by_client = false;
                }

                if (Object.keys(updatePayload).length > 0) {
                    try {
                        await supabase
                            .from('appointments')
                            .update(updatePayload)
                            .eq('id', rpcResult.id);
                    } catch (_) { /* ignore fallback errors */ }
                }
            }

            return { ...rpcResult, _appt: appt };
        },
        onSuccess: (data) => {
            if (data.id) setDeviceHasPending(data.id);
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.refetchQueries({ queryKey: ['appointments'] });
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            showToast('Cita reservada con éxito', 'success');

            // ⚡ Broadcast instantáneo al canal de admin
            if (tenantId && data.id) {
                try {
                    const bcChannel = supabase.channel(`admin-notifications-${tenantId}`);
                    bcChannel.send({
                        type: 'broadcast',
                        event: 'new_appointment',
                        payload: {
                            id: data.id,
                            clientName: data._appt?.clientName || 'Cliente',
                            clientPhone: data._appt?.clientPhone || '',
                            date: data._appt?.date || '',
                            time: data._appt?.time || '',
                        }
                    }).catch(() => {});
                } catch (_) {}
            }
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
        mutationFn: async (payload: { id: string; serviceName?: string; reason?: string } | string) => {
            const id = typeof payload === 'string' ? payload : payload.id;
            const serviceName = typeof payload === 'string' ? '' : (payload.serviceName || '');
            const reason = typeof payload === 'string' ? undefined : payload.reason;

            if (!tenantId) throw new Error('No tenant info');
            const apt = query.data?.find(a => a.id === id);

            // Si ya está cancelada o ya se está procesando la cancelación de esta cita, evitar duplicados
            const lockKey = `cancel:${id}`;
            if (inFlightLocks.has(lockKey)) {
                console.warn(`[useAppointments] Cancelación en curso para cita ${id}, ignorando llamada duplicada.`);
                return { id, apt, serviceName, reason, skipped: true };
            }
            if (apt && apt.status === 'cancelada') {
                console.warn(`[useAppointments] La cita ${id} ya estaba cancelada previamente.`);
                return { id, apt, serviceName, reason, skipped: true };
            }

            inFlightLocks.add(lockKey);

            try {
                const { data, error } = await supabase.rpc('cancel_appointment_by_client', {
                    p_appointment_id: id,
                    p_tenant_id: tenantId,
                });
                if (error) throw error;
                if (!data?.success) throw new Error(data?.error || 'Error al cancelar');

                if (reason) {
                    await supabase
                        .from('appointments')
                        .update({ cancellation_reason: reason })
                        .eq('id', id);
                }

                return { id, apt, serviceName, reason, skipped: false };
            } finally {
                // Mantener el bloqueo 3 segundos para amortiguar ráfagas de clics con mala conexión
                setTimeout(() => inFlightLocks.delete(lockKey), 3000);
            }
        },
        onSuccess: ({ id, apt, serviceName, reason, skipped }) => {
            if (skipped) return;
            if (getDevicePendingId() === id) clearDevicePending();
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.refetchQueries({ queryKey: ['appointments'] });
            queryClient.invalidateQueries({ queryKey: ['cancellation_log'] });
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            showToast('Cita cancelada', 'success');
            if (tenantId && apt) {
                notifyAdmin(tenantId, 'cancel', {
                    id: id,
                    client_name: `${apt.clientName || (apt as any).client_name}${reason ? ` (Motivo: ${reason})` : ''}`,
                    client_phone: apt.clientPhone || (apt as any).client_phone,
                    service_name: serviceName,
                    date: apt.date,
                    time: apt.time,
                    stylist_id: apt.stylistId || (apt as any).stylist_id,
                    additional_services: apt.additionalServices || (apt as any).additional_services || [],
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
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.refetchQueries({ queryKey: ['appointments'] });
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            showToast('Cita completada', 'success');
        },
        onError: (err: any) => showToast(`Error al completar: ${err.message}`, 'error'),
    });

    // UPDATE TIME + DATE (REAGENDAR)
    const updateTimeMutation = useMutation({
        mutationFn: async ({ id, newTime, newDate, serviceName }: { id: string; newTime: string; newDate?: string; serviceName: string }) => {
            if (!tenantId) throw new Error('No tenant info');

            // Verificar estado actual directo en base de datos
            const { data: currentAppt, error: checkErr } = await supabase
                .from('appointments')
                .select('id, status, client_name, client_phone, date, time, stylist_id, additional_services')
                .eq('id', id)
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (checkErr) throw checkErr;
            if (!currentAppt) {
                throw new Error('La cita no existe o ya fue eliminada');
            }
            if (currentAppt.status === 'cancelada') {
                throw new Error('Esta cita ya fue cancelada y no se puede reagendar');
            }

            const lockKey = `reschedule:${id}`;
            if (inFlightLocks.has(lockKey)) {
                console.warn(`[useAppointments] Reagendamiento en curso para cita ${id}, ignorando llamada duplicada.`);
                return { id, apt: currentAppt, newTime, newDate, serviceName, skipped: true };
            }
            inFlightLocks.add(lockKey);

            try {
                const { data, error } = await supabase.rpc('update_appointment_time_by_client', {
                    p_appointment_id: id,
                    p_tenant_id: tenantId,
                    p_new_time: newTime,
                    p_new_date: newDate ?? null,
                });
                if (error) throw error;
                if (!data?.success) throw new Error(data?.error || 'Error al actualizar');
                return { id, apt: currentAppt, newTime, newDate, serviceName, skipped: false };
            } finally {
                setTimeout(() => inFlightLocks.delete(lockKey), 3000);
            }
        },
        onSuccess: ({ id, apt, newTime, newDate, serviceName, skipped }) => {
            if (skipped) return;
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.refetchQueries({ queryKey: ['appointments'] });
            showToast('Hora actualizada', 'success');
            if (tenantId && apt && apt.status !== 'cancelada') {
                notifyAdmin(tenantId, 'reschedule', {
                    id: id,
                    client_name: apt.client_name || (apt as any).clientName,
                    client_phone: apt.client_phone || (apt as any).clientPhone,
                    service_name: serviceName,
                    date: newDate ?? apt.date,
                    time: newTime,
                    stylist_id: apt.stylist_id || (apt as any).stylistId,
                    additional_services: apt.additional_services || (apt as any).additionalServices || [],
                }, adminPhone, businessName);
            }
        },
        onError: (err: any) => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.refetchQueries({ queryKey: ['appointments'] });
            showToast(`Error al reagendar: ${err.message}`, 'error');
        },
    });

    // MARK NO SHOW
    const markNoShowMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error('No tenant info');
            const { data, error } = await supabase.rpc('mark_no_show', {
                p_appointment_id: id,
                p_tenant_id: tenantId,
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'Error al marcar como no asistió');
            return id;
        },
        onSuccess: (id) => {
            if (getDevicePendingId() === id) clearDevicePending();
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.refetchQueries({ queryKey: ['appointments'] });
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            queryClient.invalidateQueries({ queryKey: ['blocked_phones'] });
            showToast('Cliente marcado como No Asistió y bloqueado 🚫', 'error');
        },
        onError: (err: any) => showToast(`Error al marcar: ${err.message}`, 'error'),
    });

    // MARK REMINDER SENT
    const markReminderSentMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error('No tenant info');
            const { error } = await supabase
                .from('appointments')
                .update({ reminder_sent: true })
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['appointments', tenantId] });
        },
    });

    // CONFIRM BY CLIENT / APPROVE DEPOSIT
    const confirmByClientMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('appointments')
                .update({
                    deposit_status: 'approved',
                    confirmed_by_client: true,
                    confirmed_by_client_at: new Date().toISOString()
                })
                .eq('id', id);
            if (error) throw error;
            return id;
        },
        onSuccess: (id) => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            showToast('¡Anticipo verificado y cita aprobada con éxito! 🎉', 'success');
            if (tenantId) {
                const apt = query.data?.find(a => a.id === id);
                if (apt) {
                    notifyAdmin(tenantId, 'new', {
                        id: id,
                        client_name: `${apt.clientName} (ANTICIPO APROBADO ✅)`,
                        client_phone: apt.clientPhone,
                        date: apt.date,
                        time: apt.time,
                        stylist_id: apt.stylistId,
                    }, adminPhone, businessName);
                }
            }
        },
        onError: (err: any) => showToast(`Error al confirmar anticipo: ${err.message}`, 'error'),
    });

    return {
        ...query,
        appointments: query.data || [],
        addAppointment: addMutation.mutateAsync,
        cancelAppointment: cancelMutation.mutateAsync,
        completeAppointment: completeMutation.mutateAsync,
        updateAppointmentTime: updateTimeMutation.mutateAsync,
        markNoShow: markNoShowMutation.mutateAsync,
        markReminderSent: markReminderSentMutation.mutateAsync,
        confirmByClient: confirmByClientMutation.mutateAsync,
        isAdding: addMutation.isPending,
        isCancelling: cancelMutation.isPending,
        isUpdatingTime: updateTimeMutation.isPending,
        isCompleting: completeMutation.isPending,
        isMarkingNoShow: markNoShowMutation.isPending,
        isConfirmingByClient: confirmByClientMutation.isPending,
    };
};
