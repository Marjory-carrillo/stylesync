import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import { useAuthStore } from './authStore';

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
    const { tenantId } = useAuthStore();
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
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const dismiss = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const clearAll = useCallback(() => setNotifications([]), []);

    const queryClient = useQueryClient();

    // Subscribe to Supabase Realtime
    useEffect(() => {
        if (!tenantId) return;

        const channel = supabase
            .channel(`admin-notifications-${tenantId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'appointments',
            }, (payload) => {
                const a = payload.new as any;
                if (a && a.tenant_id && a.tenant_id !== tenantId) return;
                addNotification({
                    type: 'new',
                    clientName: a?.client_name || 'Cliente',
                    clientPhone: a?.client_phone || '',
                    date: a?.date || '',
                    time: a?.time || '',
                });
                queryClient.invalidateQueries({ queryKey: ['appointments'] });
                queryClient.refetchQueries({ queryKey: ['appointments'] });
                queryClient.invalidateQueries({ queryKey: ['clients'] });
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
