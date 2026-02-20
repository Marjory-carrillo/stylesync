import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { supabase } from './supabaseClient';
import SplashScreen from '../components/SplashScreen';

// ─── Types ───────────────────────────────────────────────────────────────────

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
    logoUrl?: string;
    description?: string;
    primaryColor?: string;
    accentColor?: string;
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

// ─── Day Names ───────────────────────────────────────────────────────────────

export const DAY_NAMES: Record<string, string> = {
    monday: 'Lunes',
    tuesday: 'Martes',
    wednesday: 'Miércoles',
    thursday: 'Jueves',
    friday: 'Viernes',
    saturday: 'Sábado',
    sunday: 'Domingo',
};

export const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ─── State & Actions ─────────────────────────────────────────────────────────

interface StoreContextType {
    // Auth & SaaS
    user: User | null;
    session: Session | null;
    tenantId: string | null;
    loadingAuth: boolean;
    createTenant: (name: string, slug: string, address: string, category: string) => Promise<{ success: boolean; error?: string }>;
    loadTenantBySlug: (slug: string) => Promise<boolean>;
    uploadLogo: (file: File) => Promise<string | null>;
    uploadStylistPhoto: (file: File) => Promise<string | null>;
    uploadServiceImage: (file: File) => Promise<string | null>;

    services: Service[];
    stylists: Stylist[];
    appointments: Appointment[];
    schedule: WeekSchedule; // Changed from ScheduleConfig to WeekSchedule
    businessConfig: BusinessConfig;
    announcements: Announcement[];
    waitingList: WaitingClient[];
    cancellationLog: CancellationLog[];
    blockedSlots: BlockedSlot[];
    blockedPhones: string[];
    toasts: Toast[];

    // Super Admin
    allTenants: Tenant[];
    isSuperAdmin: boolean;
    fetchAllTenants: () => Promise<void>;
    switchTenant: (tenantId: string) => Promise<void>;
    deleteTenant: (tenantId: string) => Promise<void>;

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
    toggleAnnouncement: (id: string) => Promise<void>; // Added

    addToWaitingList: (client: Omit<WaitingClient, 'id' | 'createdAt'>) => Promise<void>;
    removeFromWaitingList: (id: string) => Promise<void>;
    getWaitingListForDate: (date: string) => WaitingClient[];

    addBlockedSlot: (slot: Omit<BlockedSlot, 'id'>) => Promise<void>;
    removeBlockedSlot: (id: string) => Promise<void>;
    getBlockedSlotsForDate: (date: string) => BlockedSlot[];

    isPhoneBlocked: (phone: string) => boolean;
    blockPhone: (phone: string) => Promise<void>;
    unblockPhone: (phone: string) => Promise<void>;

    getServiceById: (id: number) => Service | undefined;
    getStylistById: (id: number | null) => Stylist | undefined; // Changed from getStaffById

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

// ─── Store Type ──────────────────────────────────────────────────────────────
export type Store = StoreContextType;

// ─── Constants & Utils ────────────────────────────────────────────────────────
import { CATEGORY_DEFAULTS } from './categoryDefaults';

const DEVICE_BOOKING_KEY = 'citalink_pending_booking';

// function persistDevicePending(id: string) { localStorage.setItem(DEVICE_BOOKING_KEY, id); } // Removed unused helper
function getDevicePendingId(): string | null { return localStorage.getItem(DEVICE_BOOKING_KEY); }
function clearDevicePending() { localStorage.removeItem(DEVICE_BOOKING_KEY); }

// ─── Week Helper ─────────────────────────────────────────────────────────────

function getStartOfWeek(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
}

function getTodayDayKey(): string {
    const idx = new Date().getDay(); // 0=Sun
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][idx];
}

// ─── Default Schedule ────────────────────────────────────────────────────────


const DEFAULT_SCHEDULE: WeekSchedule = {
    monday: { open: true, start: '09:00', end: '18:00' },
    tuesday: { open: true, start: '09:00', end: '18:00' },
    wednesday: { open: true, start: '09:00', end: '18:00' },
    thursday: { open: true, start: '09:00', end: '18:00' },
    friday: { open: true, start: '09:00', end: '18:00' },
    saturday: { open: true, start: '09:00', end: '14:00' },
    sunday: { open: false, start: '09:00', end: '14:00' },
};

const INITIAL_BUSINESS: BusinessConfig = {
    name: 'CitaLink',
    address: 'Av. Principal #123, Centro',
    googleMapsUrl: 'https://maps.google.com/?q=Av+Principal+123+Centro',
    phone: '555-0100',
    category: 'barbershop',
    slug: 'demo'
};

// ─── Context ─────────────────────────────────────────────────────────────────

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
    const ctx = useContext(StoreContext);
    if (!ctx) throw new Error('useStore must be used inside StoreProvider');
    return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: ReactNode }) {
    const [services, setServices] = useState<Service[]>([]);
    const [stylists, setStylists] = useState<Stylist[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
    const [blockedPhones, setBlockedPhones] = useState<string[]>([]);
    const [cancellationLog, setCancellationLog] = useState<CancellationLog[]>([]);
    const [businessConfig, setBusinessConfig] = useState<BusinessConfig>(INITIAL_BUSINESS);
    const [toasts, setToasts] = useState<Toast[]>([]);
    // ─── Actions & State ───
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);

    // ─── Auth Init ───
    // ─── Auth Init ───
    useEffect(() => {
        // Single source of truth: onAuthStateChange
        // It fires INITIAL_SESSION on mount, reducing race conditions
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                // User is logged in, ensure loading is TRUE while we fetch tenant data
                setLoadingAuth(true);
                loadTenant(session.user.id);
            } else {
                // User is not logged in, stop loading immediately
                setTenantId(null);
                setLoadingAuth(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const loadTenant = async (userId: string) => {
        try {
            // Find tenant owned by user
            const { data } = await supabase.from('tenants').select('id').eq('owner_id', userId).single();
            if (data) {
                setTenantId(data.id);
            } else {
                setTenantId(null); // Triggers "Create Business" flow
            }
        } catch (e) {
            console.error('Error loading tenant:', e);
        } finally {
            // Small delay to ensure router state stabilizes and prevent flickering
            setTimeout(() => setLoadingAuth(false), 300);
        }
    };

    const loadTenantBySlug = async (slug: string) => {
        try {
            setLoading(true);
            const { data } = await supabase.from('tenants').select('id').eq('slug', slug).single();
            if (data) {
                setTenantId(data.id);
                // Wait for all data to be loaded before finishing
                await fetchData(data.id);
                // Persist last visited slug for PWA smart routing
                localStorage.setItem('citalink_last_slug', slug);
                return true;
            }
            return false;
        } catch (e) {
            console.error('Error loading tenant by slug:', e);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const createTenant = useCallback(async (name: string, slug: string, address: string, category: string) => {
        if (!user) return { success: false, error: 'No user logged in' };

        // 1. Check if slug exists
        const { data: existing } = await supabase.from('tenants').select('id').eq('slug', slug).single();
        if (existing) return { success: false, error: 'Este link ya ha sido ocupado.' };

        // 2. Create Tenant
        // Note: Ensure 'category' column exists in your Supabase 'tenants' table.
        const { data, error } = await supabase.from('tenants').insert([{
            name,
            slug,
            address,
            category,
            owner_id: user.id,
        }]).select().single();

        if (error || !data) return { success: false, error: error?.message || 'Error al crear negocio' };

        // 3. Set Tenant ID & init
        // 3. Set Tenant ID local state
        setTenantId(data.id);

        // 4. Inject Category Defaults (Seed Data)
        const defaults = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS['other'];

        // A. Schedule
        await supabase.from('schedule_config').insert({ tenant_id: data.id, schedule: defaults.schedule });

        // B. Services
        if (defaults.services.length > 0) {
            const svl = defaults.services.map(s => ({ ...s, tenant_id: data.id }));
            await supabase.from('services').insert(svl);
        }

        // C. Staff/Stylists
        if (defaults.stylists.length > 0) {
            const stl = defaults.stylists.map(s => ({ ...s, tenant_id: data.id }));
            await supabase.from('stylists').insert(stl);
        }

        fetchData(data.id);
        return { success: true };
    }, [user]);

    const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_SCHEDULE);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [waitingList, setWaitingList] = useState<WaitingClient[]>([]);

    // Restore missing state for device pending
    const [deviceHasPendingId, setDeviceHasPendingId] = useState<string | null>(() => getDevicePendingId());
    const deviceHasPending = !!deviceHasPendingId;

    const setDeviceHasPending = (id: string | null) => {
        if (id) {
            localStorage.setItem(DEVICE_BOOKING_KEY, id);
            setDeviceHasPendingId(id);
        } else {
            localStorage.removeItem(DEVICE_BOOKING_KEY);
            setDeviceHasPendingId(null);
        }
    };

    const [allTenants, setAllTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);

    const isSuperAdmin = user?.email === 'infinitummisael@gmail.com';

    // ── Safety Timeout (Reduced for better UX) ──
    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 1000);
        return () => clearTimeout(timer);
    }, []);

    // ── Realtime Subscription ──
    useEffect(() => {
        if (!tenantId) return;

        fetchData(tenantId); // Fetch initial data

        const channel = supabase
            .channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `tenant_id=eq.${tenantId}` }, () => fetchData(tenantId))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'services', filter: `tenant_id=eq.${tenantId}` }, () => fetchData(tenantId))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stylists', filter: `tenant_id=eq.${tenantId}` }, () => fetchData(tenantId))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_slots', filter: `tenant_id=eq.${tenantId}` }, () => fetchData(tenantId))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_config', filter: `tenant_id=eq.${tenantId}` }, () => fetchData(tenantId))
            // ... add other tables if needed
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [tenantId]);

    const fetchData = async (currentTenantId: string | null = tenantId) => {
        if (!currentTenantId) {
            setLoading(false);
            return;
        }

        try {
            const [
                { data: sData },
                { data: stData },
                { data: aData },
                { data: bsData },
                { data: tData },
                { data: scData, error: scError },
                { data: anData },
                { data: wlData },
                { data: bpData },
                { data: clData }
            ] = await Promise.all([
                supabase.from('services').select('*').eq('tenant_id', currentTenantId).order('id'),
                supabase.from('stylists').select('*').eq('tenant_id', currentTenantId).order('id'),
                supabase.from('appointments').select('*').eq('tenant_id', currentTenantId),
                supabase.from('blocked_slots').select('*').eq('tenant_id', currentTenantId),
                supabase.from('tenants').select('*').eq('id', currentTenantId).single(),
                supabase.from('schedule_config').select('*').eq('tenant_id', currentTenantId).limit(1).single(),
                supabase.from('announcements').select('*').eq('tenant_id', currentTenantId).order('created_at', { ascending: false }),
                supabase.from('waiting_list').select('*').eq('tenant_id', currentTenantId),
                supabase.from('blocked_phones').select('phone').eq('tenant_id', currentTenantId),
                supabase.from('cancellation_log').select('*').eq('tenant_id', currentTenantId)
            ]);

            if (sData) setServices(sData);
            if (stData) setStylists(stData);
            if (aData) setAppointments(aData.map((a: any) => ({
                ...a,
                clientName: a.client_name,
                clientPhone: a.client_phone,
                serviceId: a.service_id,
                stylistId: a.stylist_id,
                bookedAt: a.booked_at,
            })));
            if (bsData) setBlockedSlots(bsData.map((b: any) => ({ ...b, startTime: b.start_time, endTime: b.end_time })));

            if (tData) {
                setBusinessConfig({
                    name: tData.name,
                    address: tData.address || '',
                    phone: tData.phone || '',
                    googleMapsUrl: tData.google_maps_url || '',
                    category: tData.category || '',
                    slug: tData.slug || '',
                    logoUrl: tData.logo_url || '',
                    description: tData.description || '',
                    primaryColor: tData.primary_color || '',
                    accentColor: tData.accent_color || ''
                });
            }

            if (scError && scError.code !== 'PGRST116') console.error('Error fetching schedule:', scError);
            if (scData?.schedule) setSchedule(scData.schedule);
            else {
                const { error: insertError } = await supabase.from('schedule_config').insert({
                    tenant_id: currentTenantId,
                    schedule: DEFAULT_SCHEDULE
                });
                if (!insertError) setSchedule(DEFAULT_SCHEDULE);
            }

            if (anData) setAnnouncements(anData.map((a: any) => ({ ...a, createdAt: a.created_at })));
            if (wlData) setWaitingList(wlData.map((w: any) => ({ ...w, serviceId: w.service_id, createdAt: w.created_at })));
            if (bpData) setBlockedPhones(bpData.map((p: any) => p.phone));
            if (clData) setCancellationLog(clData.map((c: any) => ({
                ...c,
                appointmentId: c.appointment_id,
                clientName: c.client_name,
                clientPhone: c.client_phone,
                serviceName: c.service_name,
                cancelledAt: c.cancelled_at
            })));

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };



    // ─── Actions ─────────────────────────────────────────────────────────────────

    const uploadLogo = async (file: File) => {
        if (!tenantId) return null;
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${tenantId}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('logos')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
            return data.publicUrl;
        } catch (error: any) {
            console.error('Logo upload error:', error);
            showToast(`Error al subir logo: ${error.message || error}`, 'error');
            return null;
        }
    };

    const uploadStylistPhoto = async (file: File) => {
        if (!tenantId) return null;
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `staff-${tenantId}-${Date.now()}.${fileExt}`;

            // Reusing 'logos' bucket as requested/planned
            const { error: uploadError } = await supabase.storage
                .from('logos')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
            return data.publicUrl;
        } catch (error: any) {
            console.error('Error uploading staff photo:', error);
            alert(`Error al subir foto: ${error.message || error}`);
            return null;
        }
    };

    const uploadServiceImage = async (file: File) => {
        if (!tenantId) return null;
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `service-${tenantId}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('logos') // Reusing same bucket
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
            return data.publicUrl;
        } catch (error: any) {
            console.error('Error uploading service image:', error);
            alert(`Error al subir imagen: ${error.message || error}`);
            return null;
        }
    };

    const addService = useCallback(async (service: Omit<Service, 'id'>) => {
        if (!tenantId) return;
        const { error } = await supabase.from('services').insert([{ ...service, tenant_id: tenantId }]);
        if (error) console.error(error);
        fetchData();
    }, [tenantId, fetchData]);

    const removeService = useCallback(async (id: number) => {
        if (!tenantId) return;
        await supabase.from('services').delete().eq('id', id).eq('tenant_id', tenantId);
        fetchData();
    }, [tenantId, fetchData]);

    const updateService = useCallback(async (id: number, data: Partial<Service>) => {
        if (!tenantId) return;
        await supabase.from('services').update(data).eq('id', id).eq('tenant_id', tenantId);
        fetchData();
    }, [tenantId, fetchData]);

    const addStylist = useCallback(async (stylist: Omit<Stylist, 'id'>) => {
        if (!tenantId) return;
        const { error } = await supabase.from('stylists').insert([{ ...stylist, tenant_id: tenantId }]);
        if (error) console.error(error);
        fetchData();
    }, [tenantId, fetchData]);

    const removeStylist = useCallback(async (id: number) => {
        if (!tenantId) return;
        await supabase.from('stylists').delete().eq('id', id).eq('tenant_id', tenantId);
        fetchData();
    }, [tenantId, fetchData]);

    const updateStylist = useCallback(async (id: number, data: Partial<Stylist>) => {
        if (!tenantId) return;
        await supabase.from('stylists').update(data).eq('id', id).eq('tenant_id', tenantId);
        fetchData();
    }, [tenantId, fetchData]);

    const addAppointment = useCallback(async (appt: Omit<Appointment, 'id' | 'status' | 'bookedAt'>): Promise<{ success: boolean; error?: string }> => {
        if (blockedPhones.includes(appt.clientPhone)) {
            return { success: false, error: 'Este número ha sido bloqueado. Contacta al establecimiento.' };
        }

        // Use RPC for atomic booking (prevents race conditions)
        const { data: rpcResult, error: rpcError } = await supabase.rpc('create_appointment_v3', {
            p_tenant_id: tenantId,
            p_client_name: appt.clientName,
            p_client_phone: appt.clientPhone,
            p_service_id: appt.serviceId,
            p_stylist_id: appt.stylistId,
            p_date: appt.date,
            p_time: appt.time
        });

        if (rpcError) {
            console.error('RPC Booking Error:', rpcError);
            return { success: false, error: 'Error al procesar la reserva. Inténtalo de nuevo.' };
        }

        if (rpcResult && rpcResult.success) {
            const newId = rpcResult.id;
            setDeviceHasPending(newId);
            fetchData();
            return { success: true };
        }

        return { success: false, error: rpcResult?.error || 'Error desconocido al reservar.' };
    }, [blockedPhones, tenantId, fetchData]);

    const cancelAppointment = useCallback(async (id: string, byClient = false): Promise<{ success: boolean; error?: string }> => {
        console.log('Intento de cancelar cita:', id);
        const apt = appointments.find(a => a.id === id);
        if (!apt) {
            console.error('Cita no encontrada en estado local.');
            return { success: false, error: 'Cita no encontrada.' };
        }

        if (byClient) {
            const weekStart = getStartOfWeek();
            // Ensure cancelledAt is a valid date string comparison
            const weekCancels = cancellationLog.filter(c => c.clientPhone === apt.clientPhone && c.cancelledAt >= weekStart).length;
            if (weekCancels >= 2) {
                return { success: false, error: 'Has alcanzado el límite de 2 cancelaciones esta semana.' };
            }
        }

        const svc = services.find(s => s.id === apt.serviceId);

        // 1. Log cancellation
        const { error: logError } = await supabase.from('cancellation_log').insert([{
            appointment_id: apt.id,
            client_name: apt.clientName,
            client_phone: apt.clientPhone,
            service_name: svc?.name ?? 'Desconocido',
            date: apt.date,
            time: apt.time
        }]);

        if (logError) console.error('Error logging cancellation:', logError);

        // 2. Update status
        const { error: updateError } = await supabase.from('appointments').update({ status: 'cancelada' }).eq('id', id).eq('tenant_id', tenantId);

        if (updateError) {
            console.error('Error updating appointment status:', updateError);
            return { success: false, error: 'Error al actualizar estado en base de datos.' };
        }

        if (getDevicePendingId() === id) clearDevicePending();
        fetchData();

        return { success: true };
    }, [appointments, cancellationLog, services, tenantId, fetchData]);

    const completeAppointment = useCallback(async (id: string) => {
        if (!tenantId) return;
        await supabase.from('appointments').update({ status: 'completada' }).eq('id', id).eq('tenant_id', tenantId);
        fetchData();
        if (getDevicePendingId() === id) clearDevicePending();
    }, [tenantId, fetchData]);

    const updateAppointmentTime = useCallback(async (id: string, newTime: string) => {
        if (!tenantId) return;
        await supabase.from('appointments').update({ time: newTime }).eq('id', id).eq('tenant_id', tenantId);
        fetchData();
    }, [tenantId, fetchData]);

    const getActiveAppointmentByPhone = useCallback((phone: string): Appointment | undefined => {
        const t = format(new Date(), 'yyyy-MM-dd');
        return appointments.find(a => a.clientPhone === phone && a.date >= t && a.status === 'confirmada');
    }, [appointments]);

    // ── Toast Actions ────────────────────────────────────────────────────

    const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prevToasts => [...prevToasts, { id, message, type }]);

        // Auto-remove
        setTimeout(() => {
            setToasts(prevToasts => prevToasts.filter(t => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prevToasts => prevToasts.filter(t => t.id !== id));
    }, []);

    // ── Anti-Spam Actions ──────────────────────────────────────────────────

    const blockPhone = useCallback(async (phone: string) => {
        if (!tenantId) return;
        await supabase.from('blocked_phones').upsert([{ phone, reason: 'Manual Block', tenant_id: tenantId }]);
        fetchData();
    }, [tenantId, fetchData]);

    const unblockPhone = useCallback(async (phone: string) => {
        if (!tenantId) return;
        await supabase.from('blocked_phones').delete().eq('phone', phone).eq('tenant_id', tenantId);
        fetchData();
    }, [tenantId, fetchData]);

    const isPhoneBlocked = useCallback((phone: string) => blockedPhones.includes(phone), [blockedPhones]);

    // ── Super Admin Actions ────────────────────────────────────────────────

    const fetchAllTenants = useCallback(async () => {
        if (!isSuperAdmin) return;
        const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching all tenants:', error);
            return;
        }
        setAllTenants(data || []);
    }, [isSuperAdmin]);

    const switchTenant = useCallback(async (id: string) => {
        if (!isSuperAdmin) return;
        localStorage.setItem('stylesync_tenant_id', id);
        setTenantId(id);
        // Refresh data for the new tenant
        window.location.reload();
    }, [isSuperAdmin]);

    const deleteTenant = useCallback(async (id: string) => {
        if (!isSuperAdmin) return;
        const { error } = await supabase.from('tenants').delete().eq('id', id);
        if (error) {
            console.error('Error deleting tenant:', error);
            showToast('Error al eliminar negocio', 'error');
            return;
        }
        showToast('Negocio eliminado', 'success');
        fetchAllTenants();
    }, [isSuperAdmin, fetchAllTenants, showToast]);

    const canDeviceBook = useCallback(() => {
        const pendingId = getDevicePendingId();
        if (!pendingId) return true;

        // We verify against the live appointments list
        const still = appointments.find(a => a.id === pendingId && a.status === 'confirmada');
        if (!still) { clearDevicePending(); return true; }
        return false;
    }, [appointments]);

    const hasActiveAppointment = useCallback((phone: string) => {
        const t = format(new Date(), 'yyyy-MM-dd');
        return appointments.some(a => a.clientPhone === phone && a.date >= t && a.status === 'confirmada');
    }, [appointments]);

    const getWeeklyCancellations = useCallback((phone: string) => {
        const weekStart = getStartOfWeek();
        return cancellationLog.filter(c => c.clientPhone === phone && c.cancelledAt >= weekStart).length;
    }, [cancellationLog]);

    // ── Waiting List Actions ───────────────────────────────────────────────

    const addToWaitingList = useCallback(async (client: Omit<WaitingClient, 'id' | 'createdAt'>) => {
        if (!tenantId) return;
        // Avoid duplicates for same service/date locally first (optimistic)
        if (waitingList.some(c => c.phone === client.phone && c.date === client.date)) return;

        await supabase.from('waiting_list').insert([{
            tenant_id: tenantId,
            name: client.name,
            phone: client.phone,
            date: client.date,
            service_id: client.serviceId
        }]);
        fetchData();
    }, [waitingList, tenantId, fetchData]);

    const removeFromWaitingList = useCallback(async (id: string) => {
        if (!tenantId) return;
        await supabase.from('waiting_list').delete().eq('id', id).eq('tenant_id', tenantId);
        fetchData();
    }, [tenantId, fetchData]);

    const getWaitingListForDate = useCallback((date: string) => {
        return waitingList.filter(c => c.date === date);
    }, [waitingList]);

    // ── Schedule Actions ───────────────────────────────────────────────────

    const updateDaySchedule = useCallback(async (day: string, data: Partial<DaySchedule>) => {
        if (!tenantId) return;
        console.log(`[updateDaySchedule] Updating ${day} with:`, data);
        const newSchedule = { ...schedule, [day]: { ...schedule[day], ...data } };

        // Optimistic update
        setSchedule(newSchedule);

        try {
            // Upsert based on tenant_id unique constraint
            const { error } = await supabase.from('schedule_config').upsert({
                tenant_id: tenantId,
                schedule: newSchedule
            }, { onConflict: 'tenant_id' });

            if (error) {
                console.error('Error updating schedule:', error);
                showToast(`Error al guardar: ${error.message}`, 'error');
                fetchData(); // Revert
            } else {
                console.log('[updateDaySchedule] Success!');
            }
        } catch (err: any) {
            console.error('Unexpected error:', err);
            showToast(`Error inesperado: ${err.message}`, 'error');
            fetchData(); // Revert
        }
    }, [schedule, tenantId, fetchData]);

    const saveSchedule = useCallback(async (newSchedule: WeekSchedule) => {
        if (!tenantId) return;
        console.log('[saveSchedule] Saving full schedule:', newSchedule);

        // Optimistic update
        setSchedule(newSchedule);

        try {
            // Manual Upsert: 1. Check if exists
            const { data: existing } = await supabase
                .from('schedule_config')
                .select('id')
                .eq('tenant_id', tenantId)
                .single();

            let error;

            if (existing) {
                // 2. Update
                const { error: updateError } = await supabase
                    .from('schedule_config')
                    .update({ schedule: newSchedule })
                    .eq('tenant_id', tenantId);

                // No need to select if we only check for error.
                // Or if we need data: .select();

                console.log('[saveSchedule] Update result:', { error: updateError });
                error = updateError;
            } else {
                // 3. Insert
                const { error: insertError, data: inserted } = await supabase
                    .from('schedule_config')
                    .insert({ tenant_id: tenantId, schedule: newSchedule })
                    .select();

                console.log('[saveSchedule] Insert result:', { error: insertError, data: inserted });
                error = insertError;
            }

            if (error) {
                console.error('Error saving schedule:', error);
                showToast(`Error al guardar horarios: ${error.message}`, 'error');
                fetchData(); // Revert
            } else {
                console.log('[saveSchedule] Success!');
                // Force fetch to ensure we have the DB state
                await fetchData();
            }
        } catch (err: any) {
            console.error('Unexpected error:', err);
            showToast(`Error inesperado: ${err.message}`, 'error');
            fetchData();
        }
    }, [tenantId, fetchData]);

    const getTodaySchedule = useCallback((): DaySchedule => {
        const dayKey = getTodayDayKey();
        return schedule[dayKey] ?? DEFAULT_SCHEDULE[dayKey] ?? { open: false, start: '09:00', end: '18:00' };
    }, [schedule]);

    const getScheduleForDate = useCallback((dateStr: string): DaySchedule => {
        const d = new Date(dateStr + 'T12:00:00');
        const idx = d.getDay();
        const dayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][idx];
        return schedule[dayKey] ?? DEFAULT_SCHEDULE[dayKey] ?? { open: false, start: '09:00', end: '18:00' };
    }, [schedule]);

    // ── Announcement Actions ───────────────────────────────────────────────

    const addAnnouncement = useCallback(async (message: string, type: Announcement['type']) => {
        if (!tenantId) return;
        await supabase.from('announcements').insert([{ tenant_id: tenantId, message, type, active: true }]);
        fetchData();
    }, [tenantId, fetchData]);

    const removeAnnouncement = useCallback(async (id: string) => {
        if (!tenantId) return;
        await supabase.from('announcements').delete().eq('id', id).eq('tenant_id', tenantId);
        fetchData();
    }, [tenantId, fetchData]);

    const toggleAnnouncement = useCallback(async (id: string) => {
        if (!tenantId) return;
        const ann = announcements.find(a => a.id === id);
        if (ann) {
            await supabase.from('announcements').update({ active: !ann.active }).eq('id', id).eq('tenant_id', tenantId);
            fetchData();
        }
    }, [announcements, tenantId, fetchData]);

    const getActiveAnnouncements = useCallback(() => announcements.filter(a => a.active), [announcements]);

    // ── Business Config Actions ──────────────────────────────────────────

    const updateBusinessConfig = useCallback(async (data: Partial<BusinessConfig>) => {
        if (!tenantId) return;
        // Map BusinessConfig to Tenants table columns
        const updatePayload: any = {};
        if (data.name !== undefined) updatePayload.name = data.name;
        if (data.address !== undefined) updatePayload.address = data.address;
        if (data.phone !== undefined) updatePayload.phone = data.phone;
        if (data.googleMapsUrl !== undefined) updatePayload.google_maps_url = data.googleMapsUrl;
        if (data.logoUrl !== undefined) updatePayload.logo_url = data.logoUrl;
        if (data.description !== undefined) updatePayload.description = data.description;
        if (data.category !== undefined) updatePayload.category = data.category;
        if (data.slug !== undefined) updatePayload.slug = data.slug;
        if (data.primaryColor !== undefined) updatePayload.primary_color = data.primaryColor;
        if (data.accentColor !== undefined) updatePayload.accent_color = data.accentColor;

        const { error } = await supabase.from('tenants').update(updatePayload).eq('id', tenantId);

        if (error) {
            console.error('Error updating config:', error);
            showToast(`Error al guardar configuración: ${error.message}`, 'error');
        }

        // Optimistic
        setBusinessConfig(prev => ({ ...prev, ...data }));
        // Do not call fetchData() immediately if we just want optimistic update to stick
        // But fetchData is good to ensure sync. Let's keep it.
        fetchData();
    }, [tenantId, fetchData]);

    // ── Blocked Slots Actions ──────────────────────────────────────────────

    const addBlockedSlot = useCallback(async (slot: Omit<BlockedSlot, 'id'>) => {
        if (!tenantId) return;
        await supabase.from('blocked_slots').insert([{
            tenant_id: tenantId,
            date: slot.date,
            start_time: slot.startTime,
            end_time: slot.endTime,
            reason: slot.reason
        }]);
        fetchData();
    }, [tenantId, fetchData]);

    const removeBlockedSlot = useCallback(async (id: string) => {
        if (!tenantId) return;
        await supabase.from('blocked_slots').delete().eq('id', id).eq('tenant_id', tenantId);
        fetchData();
    }, [tenantId, fetchData]);

    const getBlockedSlotsForDate = useCallback((date: string) => {
        return blockedSlots.filter(b => b.date === date);
    }, [blockedSlots]);

    // ── Reminders ─────────────────────────────────────────────────────────

    const getReminders = useCallback((): Appointment[] => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

        return appointments.filter(a => {
            if (a.date !== tomorrowStr || a.status !== 'confirmada') return false;
            // Only include if booked 3+ days before the appointment
            const bookedDate = new Date(a.bookedAt);
            const apptDate = new Date(a.date + 'T12:00:00');
            const diffDays = Math.floor((apptDate.getTime() - bookedDate.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays >= 3;
        });
    }, [appointments]);

    const generateReminderWhatsAppUrl = useCallback((apt: Appointment) => {
        const svc = services.find(s => s.id === apt.serviceId);
        const message = encodeURIComponent(
            `👋 Hola *${apt.clientName}*,\n\n` +
            `Te recordamos que tienes una cita *mañana* en *${businessConfig.name}*:\n\n` +
            `💇 Servicio: ${svc?.name ?? 'N/A'}\n` +
            `🕐 Hora: ${apt.time}\n` +
            `📍 Ubicación: ${businessConfig.address}\n${businessConfig.googleMapsUrl}\n\n` +
            `¿Confirmas tu asistencia? ✅`
        );
        return `https://wa.me/${apt.clientPhone.replace(/\D/g, '')}?text=${message}`;
    }, [services, businessConfig]);

    // ── Helpers ────────────────────────────────────────────────────────────

    const getServiceById = useCallback((id: number) => services.find(s => s.id === id), [services]);
    const getStylistById = useCallback((id: number | null) => (id ? stylists.find(s => s.id === id) : undefined), [stylists]);

    const getAppointmentsForToday = useCallback(() => {
        const t = format(new Date(), 'yyyy-MM-dd');
        return appointments.filter(a => a.date === t && a.status !== 'cancelada');
    }, [appointments]);

    const sendSMS = useCallback(async (phone: string, message: string) => {
        // En producción, llamaríamos a una Supabase Edge Function:
        // const { data, error } = await supabase.functions.invoke('send-sms', { body: { phone, message } });

        console.log(`[SMS Link - Twilio] Enviando a ${phone}: ${message}`);

        // Simulación: Mostrar en pantalla para pruebas (especialmente en móvil)
        showToast(message, 'info');

        return { success: true };
    }, [showToast]);

    const getAppointmentsForDate = useCallback((dateStr: string) => {
        return appointments.filter(a => a.date === dateStr && a.status !== 'cancelada');
    }, [appointments]);

    const getTodayRevenue = useCallback(() => {
        const todayAppts = getAppointmentsForToday();
        return todayAppts.reduce((sum, a) => {
            const svc = services.find(s => s.id === a.serviceId);
            return sum + (svc?.price ?? 0);
        }, 0);
    }, [getAppointmentsForToday, services]);

    const generateWhatsAppUrl = useCallback((apt: Appointment) => {
        const svc = services.find(s => s.id === apt.serviceId);
        const message = encodeURIComponent(
            `✂️ *${businessConfig.name}*\n\n📋 *Confirmación de Cita*\n━━━━━━━━━━━━━━━\n` +
            `👤 Cliente: ${apt.clientName}\n💇 Servicio: ${svc?.name ?? 'N/A'}\n📅 Fecha: ${apt.date}\n🕐 Hora: ${apt.time}\n💰 Precio: $${svc?.price ?? 0}\n` +
            `━━━━━━━━━━━━━━━\n\n📍 *Ubicación:*\n${businessConfig.address}\n${businessConfig.googleMapsUrl}\n\n¡Te esperamos! 💈`
        );
        return `https://wa.me/${apt.clientPhone.replace(/\D/g, '')}?text=${message}`;
    }, [services, businessConfig]);

    // ── Store Value ────────────────────────────────────────────────────────

    const store: StoreContextType = {
        user,
        session,
        tenantId,
        loadingAuth,
        createTenant,
        loadTenantBySlug,
        uploadLogo,
        uploadStylistPhoto,
        uploadServiceImage,

        services,
        stylists,
        appointments,
        schedule,
        businessConfig,
        announcements,
        waitingList,
        cancellationLog,
        blockedSlots,
        blockedPhones,
        toasts,

        loading,

        addService,
        removeService,
        updateService,

        addStylist,
        removeStylist,
        updateStylist,

        addAppointment,
        cancelAppointment,
        completeAppointment,
        updateAppointmentTime,

        updateDaySchedule,
        saveSchedule,
        updateBusinessConfig,

        addAnnouncement,
        removeAnnouncement,
        toggleAnnouncement,

        addToWaitingList,
        removeFromWaitingList,
        getWaitingListForDate,

        addBlockedSlot,
        removeBlockedSlot,

        isPhoneBlocked,
        blockPhone,
        unblockPhone,

        getServiceById,
        getStylistById, // Changed from getStaffById to getStylistById to match existing function name

        getTodaySchedule,
        getScheduleForDate,
        getActiveAnnouncements,

        hasActiveAppointment,
        getActiveAppointmentByPhone,
        getWeeklyCancellations,

        // New items from instruction
        deviceHasPending,
        setDeviceHasPending,

        // Existing items not explicitly listed in instruction's new structure, but present in original store
        canDeviceBook,
        getBlockedSlotsForDate,
        getReminders,
        generateReminderWhatsAppUrl,
        getAppointmentsForToday,
        getAppointmentsForDate,
        getTodayRevenue,
        generateWhatsAppUrl,

        // Toast
        showToast,
        removeToast,
        sendSMS,

        // Super Admin
        allTenants,
        isSuperAdmin,
        fetchAllTenants,
        switchTenant,
        deleteTenant
    };

    if (loading) {
        return <SplashScreen />;
    }

    return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
