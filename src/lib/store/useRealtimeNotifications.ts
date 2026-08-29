import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { useAuthStore } from './authStore';
import { playChimeSound, showDesktopNotification } from '../soundNotification';

export type NotifType = 'new' | 'reschedule' | 'cancel' | 'complete' | 'waiting_list';

export interface AdminNotification {
    id: string;
    type: NotifType;
    clientName: string;
    clientPhone: string;
    serviceName?: string;
    date: string;
    time: string;
    read: boolean;
    createdAt: Date;
}

const STORAGE_KEY = 'citalink_admin_notifications';

function loadFromStorage(tenantId: string): AdminNotification[] {
    try {
        const raw = localStorage.getItem(`${STORAGE_KEY}_${tenantId}`);
        if (!raw) return [];
        return JSON.parse(raw).map((n: any) => ({ ...n, createdAt: new Date(n.createdAt) }));
    } catch { return []; }
}

function saveToStorage(tenantId: string, notifs: AdminNotification[]) {
    try {
        // Keep only last 50 notifications
        localStorage.setItem(`${STORAGE_KEY}_${tenantId}`, JSON.stringify(notifs.slice(0, 50)));
    } catch { /* ignore */ }
}

export function useRealtimeNotifications() {
    const { tenantId: storeTenantId } = useAuthStore();
    const tenantId = storeTenantId || (typeof window !== 'undefined' ? localStorage.getItem('citalink_tenant_id') : null);
    const [notifications, setNotifications] = useState<AdminNotification[]>([]);

    // Load from localStorage on mount
    useEffect(() => {
        if (!tenantId) return;
        setNotifications(loadFromStorage(tenantId));
    }, [tenantId]);

    // Save whenever notifications change
    useEffect(() => {
        if (!tenantId) return;
        saveToStorage(tenantId, notifications);
    }, [notifications, tenantId]);

    const addNotification = useCallback((notif: Omit<AdminNotification, 'id' | 'read' | 'createdAt'>) => {
        const newNotif: AdminNotification = {
            ...notif,
            id: `${Date.now()}-${Math.random()}`,
            read: false,
            createdAt: new Date(),
        };
        setNotifications(prev => [newNotif, ...prev]);

        // 🔊 1. Reproducir sonido de campana / chime
        try {
            playChimeSound(notif.type);
        } catch (e) {
            console.warn('Audio play error:', e);
        }

        // 📱 2. Lanzar notificación push nativa del navegador si está minimizado
        const titles: Record<NotifType, string> = {
            new: 'CitaLink · ✨ ¡Nueva Cita Agendada!',
            reschedule: 'CitaLink · 🔄 Cita Reprogramada',
            cancel: 'CitaLink · ⚠️ Cita Cancelada',
            complete: 'CitaLink · ✅ Cita Completada',
            waiting_list: 'CitaLink · 📋 Nuevo en Lista de Espera',
        };
        const title = titles[notif.type] || 'CitaLink';
        const bodyText = `${notif.clientName} · ${notif.date} ${notif.time ? `a las ${notif.time}` : ''}`;
        try {
            showDesktopNotification(title, bodyText);
        } catch (e) {
            console.warn('Desktop notif error:', e);
        }

        // 🔔 3. Disparar evento para Banner Flotante en pantalla
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('citalink:realtime-notification', {
                detail: newNotif
            }));
        }
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const dismiss = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const clearAll = useCallback(() => setNotifications([]), []);

    const queryClient = useQueryClient();
    const knownAppointmentIds = useRef<Set<string>>(new Set());
    const isInitialLoadDone = useRef<boolean>(false);

    // Inicializar IDs conocidos al montar la sesión para NUNCA alertar sobre citas viejas
    useEffect(() => {
        if (!tenantId) return;

        supabase
            .from('appointments')
            .select('id')
            .eq('tenant_id', tenantId)
            .then(({ data }) => {
                if (data) {
                    data.forEach(a => knownAppointmentIds.current.add(a.id));
                }
                isInitialLoadDone.current = true;
            });
    }, [tenantId]);

    // Sondeo de respaldo cada 5s: SOLO alerta si llega un ID nuevo después de la carga inicial
    useEffect(() => {
        if (!tenantId) return;

        const interval = setInterval(async () => {
            if (!isInitialLoadDone.current) return;

            try {
                const { data } = await supabase
                    .from('appointments')
                    .select('id, client_name, client_phone, date, time')
                    .eq('tenant_id', tenantId);

                if (data && data.length > 0) {
                    data.forEach(a => {
                        if (!knownAppointmentIds.current.has(a.id)) {
                            knownAppointmentIds.current.add(a.id);
                            // Es una cita nueva en tiempo real
                            addNotification({
                                type: 'new',
                                clientName: a.client_name || 'Cliente',
                                clientPhone: a.client_phone || '',
                                date: a.date || '',
                                time: a.time ? a.time.slice(0, 5) : '',
                            });
                            queryClient.invalidateQueries({ queryKey: ['appointments'] });
                            queryClient.refetchQueries({ queryKey: ['appointments'] });
                        }
                    });
                }
            } catch (err) {
                // Silencioso
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [tenantId, addNotification, queryClient]);

    // Subscribe to Supabase Realtime (Websocket & Broadcast)
    useEffect(() => {
        if (!tenantId) return;

        const channel = supabase
            .channel(`admin-notifications-${tenantId}`)
            .on('broadcast', { event: 'new_appointment' }, (payload) => {
                const a = payload.payload as any;
                if (a && a.id && isInitialLoadDone.current && !knownAppointmentIds.current.has(a.id)) {
                    knownAppointmentIds.current.add(a.id);
                    addNotification({
                        type: 'new',
                        clientName: a?.clientName || a?.client_name || 'Cliente',
                        clientPhone: a?.clientPhone || a?.client_phone || '',
                        date: a?.date || '',
                        time: a?.time ? a.time.slice(0, 5) : '',
                    });
                    queryClient.invalidateQueries({ queryKey: ['appointments'] });
                    queryClient.refetchQueries({ queryKey: ['appointments'] });
                }
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'appointments',
            }, (payload) => {
                const a = payload.new as any;
                if (a && a.tenant_id && a.tenant_id !== tenantId) return;

                if (a && a.id && isInitialLoadDone.current && !knownAppointmentIds.current.has(a.id)) {
                    knownAppointmentIds.current.add(a.id);
                    addNotification({
                        type: 'new',
                        clientName: a?.client_name || 'Cliente',
                        clientPhone: a?.client_phone || '',
                        date: a?.date || '',
                        time: a?.time ? a.time.slice(0, 5) : '',
                    });
                    queryClient.invalidateQueries({ queryKey: ['appointments'] });
                    queryClient.refetchQueries({ queryKey: ['appointments'] });
                    queryClient.invalidateQueries({ queryKey: ['clients'] });
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'appointments',
            }, (payload) => {
                const a = payload.new as any;
                if (a && a.tenant_id && a.tenant_id !== tenantId) return;
                if (a?.status === 'cancelada') {
                    addNotification({ type: 'cancel', clientName: a?.client_name || 'Cliente', clientPhone: a?.client_phone || '', date: a?.date || '', time: a?.time || '' });
                } else if (a?.status === 'completada') {
                    addNotification({ type: 'complete', clientName: a?.client_name || 'Cliente', clientPhone: a?.client_phone || '', date: a?.date || '', time: a?.time || '' });
                } else {
                    addNotification({ type: 'reschedule', clientName: a?.client_name || 'Cliente', clientPhone: a?.client_phone || '', date: a?.date || '', time: a?.time || '' });
                }
                queryClient.invalidateQueries({ queryKey: ['appointments'] });
                queryClient.refetchQueries({ queryKey: ['appointments'] });
                queryClient.invalidateQueries({ queryKey: ['cancellation_log'] });
                queryClient.invalidateQueries({ queryKey: ['clients'] });
            })
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'appointments',
            }, (payload) => {
                const a = (payload.old || payload.new) as any;
                if (a && a.tenant_id && a.tenant_id !== tenantId) return;
                queryClient.invalidateQueries({ queryKey: ['appointments'] });
                queryClient.refetchQueries({ queryKey: ['appointments'] });
                queryClient.invalidateQueries({ queryKey: ['cancellation_log'] });
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'cancellation_log',
            }, (payload) => {
                const c = payload.new as any;
                if (c && c.tenant_id && c.tenant_id !== tenantId) return;
                addNotification({
                    type: 'cancel',
                    clientName: c?.client_name || 'Cliente',
                    clientPhone: c?.client_phone || '',
                    date: c?.appointment_date || new Date().toISOString().split('T')[0],
                    time: c?.appointment_time || '',
                });
                queryClient.invalidateQueries({ queryKey: ['cancellation_log'] });
                queryClient.invalidateQueries({ queryKey: ['appointments'] });
                queryClient.refetchQueries({ queryKey: ['appointments'] });
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'waiting_list',
            }, (payload) => {
                const w = payload.new as any;
                if (w && w.tenant_id && w.tenant_id !== tenantId) return;
                addNotification({
                    type: 'waiting_list',
                    clientName: w?.name || w?.client_name || 'Cliente',
                    clientPhone: w?.phone || w?.client_phone || '',
                    date: w?.date || '',
                    time: 'Lista de espera',
                });
                queryClient.invalidateQueries({ queryKey: ['waiting_list'] });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [tenantId, addNotification, queryClient]);

    const unreadCount = notifications.filter(n => !n.read).length;

    return { notifications, unreadCount, markAllRead, dismiss, clearAll };
}
