import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface UIState {
    toasts: Toast[];
    deviceHasPendingId: string | null;

    // Acciones Toasts
    showToast: (message: string, type?: ToastType) => void;
    removeToast: (id: string) => void;

    // Acciones Dispositivo
    setDeviceHasPending: (id: string | null) => void;
    getDevicePendingId: () => string | null;
    clearDevicePending: () => void;
}

const DEVICE_BOOKING_KEY = 'citalink_pending_booking';

export const useUIStore = create<UIState>((set, get) => ({
    toasts: [],
    deviceHasPendingId: localStorage.getItem(DEVICE_BOOKING_KEY),

    showToast: (message, type = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
        setTimeout(() => get().removeToast(id), 5000);
    },

    removeToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    },

    setDeviceHasPending: (id) => {
        if (id) {
            localStorage.setItem(DEVICE_BOOKING_KEY, id);
            set({ deviceHasPendingId: id });
        } else {
            localStorage.removeItem(DEVICE_BOOKING_KEY);
            set({ deviceHasPendingId: null });
        }
    },

    getDevicePendingId: () => {
        return get().deviceHasPendingId;
    },

    clearDevicePending: () => {
        get().setDeviceHasPending(null);
    }
}));
