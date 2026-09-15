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

    // Estado Pantalla Completa Calendario
    isCalendarFullscreen: boolean;
    setCalendarFullscreen: (val: boolean) => void;
    toggleCalendarFullscreen: () => void;

    // Estado Colapso Barra Lateral (Iconos vs Completo)
    isSidebarCollapsed: boolean;
    setSidebarCollapsed: (val: boolean) => void;
    toggleSidebar: () => void;
}

const DEVICE_BOOKING_KEY = 'citalink_pending_booking';
const CALENDAR_FULLSCREEN_KEY = 'citalink_calendar_fullscreen';

const getInitialFullscreen = (): boolean => {
    try {
        return localStorage.getItem(CALENDAR_FULLSCREEN_KEY) === 'true';
    } catch {
        return false;
    }
};

const initialFullscreen = getInitialFullscreen();

export const useUIStore = create<UIState>((set, get) => ({
    toasts: [],
    deviceHasPendingId: localStorage.getItem(DEVICE_BOOKING_KEY),
    isCalendarFullscreen: initialFullscreen,
    isSidebarCollapsed: initialFullscreen,

    setCalendarFullscreen: (val) => {
        try {
            localStorage.setItem(CALENDAR_FULLSCREEN_KEY, String(val));
        } catch {}
        set({
            isCalendarFullscreen: val,
            isSidebarCollapsed: val,
        });
    },
    toggleCalendarFullscreen: () => set((state) => {
        const next = !state.isCalendarFullscreen;
        try {
            localStorage.setItem(CALENDAR_FULLSCREEN_KEY, String(next));
        } catch {}
        return {
            isCalendarFullscreen: next,
            isSidebarCollapsed: next,
        };
    }),

    setSidebarCollapsed: (val) => set({ isSidebarCollapsed: val }),
    toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

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
