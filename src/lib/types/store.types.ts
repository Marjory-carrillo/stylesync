import type { Session, User } from '@supabase/supabase-js';

// ─── Base Types ──────────────────────────────────────────────────────────────

export interface Service {
    id: number;
    name: string;
    price: number;
    duration: number; // minutes
    image?: string;
}

export interface Stylist {
    id: number;
    name: string;
    role: string;
    phone: string;
    image?: string;
    commissionRate?: number; // percentage (0-100)
}

export interface Appointment {
    id: string;
    clientName: string;
    clientPhone: string;
    serviceId: number;
    stylistId: number | null;
    date: string; // "2026-02-15"
    time: string; // "10:00"
    status: 'confirmada' | 'cancelada' | 'completada';
    bookedAt: string; // ISO timestamp of when this was booked
}

export interface Client {
    id: string;
    tenantId: string;
    name: string;
    phone: string;
    notes?: string;
    tags?: string[];
    createdAt: string;
    // Pre-calculated stats from view
    totalVisits: number;
    totalSpent: number;
    lastVisit: string | null;
    mainService?: string | null;
}

export interface WaitingClient {
    id: string;
    name: string;
    phone: string;
    serviceId: number;
    date: string; // YYYY-MM-DD
    createdAt: string;
}

export interface CancellationLog {
    id: string;
    appointmentId: string;
    clientName: string;
    clientPhone: string;
    serviceName: string;
    date: string;
    time: string;
    cancelledAt: string;
}

export interface BlockedSlot {
    id: string;
    date: string; // YYYY-MM-DD
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    reason?: string;
}

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

export interface BusinessConfig {
    name: string;
    address: string;
    googleMapsUrl: string;
    phone: string;
    category: string;
    slug: string;
    bookingDaysAhead?: number;
    commissionsEnabled?: boolean;
    weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    confirmationTemplate?: string;
    reminderTemplate?: string;
    logoUrl?: string;
    description?: string;
    primaryColor?: string;
    accentColor?: string;
    sms_enabled?: boolean;
    breakBetweenAppointments?: number; // 0 = off, positive = minutes of buffer
    showDashboardMetrics?: boolean;
}

export interface Tenant extends BusinessConfig {
    id: string;
    created_at: string;
}

export interface DaySchedule {
    open: boolean;
    start: string; // "09:00"
    end: string;   // "18:00"
    breakStart?: string; // "14:00"
    breakEnd?: string;   // "15:00"
}

export type WeekSchedule = Record<string, DaySchedule>;

export interface Announcement {
    id: string;
    message: string;
    type: 'info' | 'warning' | 'closed';
    active: boolean;
    createdAt: string;
}

export interface CommissionEntry {
    stylistId: number;
    stylistName: string;
    totalRevenue: number;
    appointmentsCount: number;
    commissionRate: number;
    commissionEarned: number;
}

// ─── Store Interface ─────────────────────────────────────────────────────────

export interface StoreContextType {
    // Auth & SaaS
    user: User | null;
    session: Session | null;
    tenantId: string | null;
    userRole: 'owner' | 'admin' | 'employee' | null;
    userStylistId: number | null;
    loadingAuth: boolean;
    createTenant: (name: string, slug: string, address: string, category: string) => Promise<{ success: boolean; error?: string }>;
    loadTenantBySlug: (slug: string) => Promise<boolean>;
    uploadLogo: (file: File) => Promise<string | null>;
    uploadStylistPhoto: (file: File) => Promise<string | null>;
    uploadServiceImage: (file: File) => Promise<string | null>;

    services: Service[];
    stylists: Stylist[];
    appointments: Appointment[];
    schedule: WeekSchedule;
    businessConfig: BusinessConfig;
    announcements: Announcement[];
    waitingList: WaitingClient[];
    clients: Client[];
    cancellationLog: CancellationLog[];
    blockedSlots: BlockedSlot[];
    blockedPhones: string[];
    toasts: Toast[];

    updateStylistCommissionRate: (stylistId: number, rate: number) => Promise<void>;

    // Super Admin
    allTenants: Tenant[];
    isSuperAdmin: boolean;
    fetchAllTenants: () => Promise<void>;
    switchTenant: (tenantId: string) => Promise<void>;
    deleteTenant: (tenantId: string) => Promise<{ success: boolean; error?: string }>;

    sendSMS: (phone: string, message: string) => Promise<{ success: boolean; error?: string }>;

    loading: boolean;

    // Actions
    addService: (data: Omit<Service, 'id'>) => Promise<void>;
    removeService: (id: number) => Promise<void>;
    updateService: (id: number, data: Partial<Service>) => Promise<void>;

    addStylist: (data: Omit<Stylist, 'id'>) => Promise<void>;
    removeStylist: (id: number) => Promise<void>;
    updateStylist: (id: number, data: Partial<Stylist>) => Promise<void>;

    addAppointment: (data: Omit<Appointment, 'id' | 'status' | 'bookedAt'>) => Promise<{ success: boolean; error?: string }>;
    cancelAppointment: (id: string, byClient?: boolean) => Promise<{ success: boolean; error?: string }>;
    completeAppointment: (id: string) => Promise<void>;
    updateAppointmentTime: (id: string, newTime: string) => Promise<void>;

    updateDaySchedule: (day: string, data: Partial<DaySchedule>) => Promise<void>;
    saveSchedule: (schedule: WeekSchedule) => Promise<void>;
    updateBusinessConfig: (data: Partial<BusinessConfig>) => Promise<void>;

    addAnnouncement: (message: string, type: 'info' | 'warning' | 'closed') => Promise<void>;
    removeAnnouncement: (id: string) => Promise<void>;
    toggleAnnouncement: (id: string) => Promise<void>;

    addToWaitingList: (clientData: Omit<WaitingClient, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string }>;
    removeFromWaitingList: (id: string) => Promise<void>;
    getWaitingListForDate: (date: string) => WaitingClient[];

    updateClientNotes: (id: string, notes: string) => Promise<void>;
    updateClientTags: (id: string, tags: string[]) => Promise<void>;

    addBlockedSlot: (slot: Omit<BlockedSlot, 'id'>) => Promise<void>;
    removeBlockedSlot: (id: string) => Promise<void>;
    getBlockedSlotsForDate: (date: string) => BlockedSlot[];

    isPhoneBlocked: (phone: string) => boolean;
    blockPhone: (phone: string, reason?: string) => Promise<void>;
    unblockPhone: (phone: string) => Promise<void>;

    getServiceById: (id: number) => Service | undefined;
    getStylistById: (id: number | null) => Stylist | undefined;

    getTodaySchedule: () => DaySchedule;
    getScheduleForDate: (date: string) => DaySchedule;
    getActiveAnnouncements: () => Announcement[];

    // Client Side Helpers
    hasActiveAppointment: (phone: string) => boolean;
    getActiveAppointmentByPhone: (phone: string) => Appointment | undefined;

    deviceHasPending: boolean;
    setDeviceHasPending: (id: string | null) => void;

    // Reminders
    getReminders: () => Appointment[];
    generateReminderWhatsAppUrl: (apt: Appointment) => string;

    // Helpers
    getAppointmentsForToday: () => Appointment[];
    getAppointmentsForDate: (date: string) => Appointment[];
    getTodayRevenue: () => number;
    generateWhatsAppUrl: (appointment: Appointment) => string;
    getWeeklyCancellations: (phone: string) => number;
    canDeviceBook: () => boolean;

    // Toast
    showToast: (message: string, type?: Toast['type']) => void;
    removeToast: (id: string) => void;
}

export type Store = StoreContextType;
