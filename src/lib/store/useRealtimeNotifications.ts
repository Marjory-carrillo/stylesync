import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuthStore } from './authStore';

export type NotifType = 'new' | 'reschedule' | 'cancel' | 'complete';

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

    // Subscribe to Supabase Realtime
    useEffect(() => {
        if (!tenantId) return;

        const channel = supabase
            .channel(`admin-appointments-${tenantId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'appointments',
                filter: `tenant_id=eq.${tenantId}`,
            }, (payload) => {
                const a = payload.new as any;
                addNotification({
                    type: 'new',
                    clientName: a.client_name,
                    clientPhone: a.client_phone,
                    date: a.date,
                    time: a.time,
                });
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'appointments',
                filter: `tenant_id=eq.${tenantId}`,
            }, (payload) => {
                const a = payload.new as any;
                const old = payload.old as any;

                if (a.status === 'cancelada' && old.status !== 'cancelada') {
                    addNotification({ type: 'cancel', clientName: a.client_name, clientPhone: a.client_phone, date: a.date, time: a.time });
                } else if (a.status === 'completada' && old.status !== 'completada') {
                    addNotification({ type: 'complete', clientName: a.client_name, clientPhone: a.client_phone, date: a.date, time: a.time });
                } else if (a.time !== old.time || a.date !== old.date) {
                    // Si cambia la fecha u hora (sin importar si es confirmada o pendiente)
                    addNotification({ type: 'reschedule', clientName: a.client_name, clientPhone: a.client_phone, date: a.date, time: a.time });
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [tenantId, addNotification]);

    const unreadCount = notifications.filter(n => !n.read).length;

    return { notifications, unreadCount, markAllRead, dismiss, clearAll };
}
