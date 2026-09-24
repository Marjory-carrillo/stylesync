import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { Promotion, Service } from '../../types/store.types';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

/** Convierte row de DB (snake_case) a Promotion (camelCase) */
function fromDbPromotion(row: Record<string, any>): Promotion {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        name: row.name,
        description: row.description || '',
        discountType: row.discount_type,
        discountValue: Number(row.discount_value || 0),
        daysOfWeek: row.days_of_week || [],
        serviceIds: row.service_ids || [],
        commissionPolicy: row.commission_policy || 'charged_price',
        isActive: row.is_active ?? true,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/** Convierte Promotion (camelCase) a DB (snake_case) */
function toDbPromotion(p: Partial<Promotion> & Record<string, any>) {
    const db: Record<string, any> = {};
    if (p.tenantId !== undefined) db.tenant_id = p.tenantId;
    if (p.name !== undefined) db.name = p.name;
    if (p.description !== undefined) db.description = p.description;
    if (p.discountType !== undefined) db.discount_type = p.discountType;
    if (p.discountValue !== undefined) db.discount_value = p.discountValue;
    if (p.daysOfWeek !== undefined) db.days_of_week = p.daysOfWeek;
    if (p.serviceIds !== undefined) db.service_ids = p.serviceIds;
    if (p.commissionPolicy !== undefined) db.commission_policy = p.commissionPolicy;
    if (p.isActive !== undefined) db.is_active = p.isActive;
    return db;
}

/**
 * Calcula el precio final efectivo de un servicio aplicando una promoción dada.
 */
export function calculateEffectiveServicePrice(service: Service, promotion?: Promotion | null): number {
    if (!promotion || !promotion.isActive) return service.price;

    // Verificar si aplica a este servicio
    if (promotion.serviceIds && promotion.serviceIds.length > 0 && !promotion.serviceIds.includes(service.id)) {
        return service.price;
    }

    if (promotion.discountType === 'fixed_price') {
        return Math.min(service.price, promotion.discountValue);
    }
    if (promotion.discountType === 'fixed_discount') {
        return Math.max(0, service.price - promotion.discountValue);
    }
    if (promotion.discountType === 'percentage') {
        const discountAmount = (service.price * promotion.discountValue) / 100;
        return Math.max(0, Math.round(service.price - discountAmount));
    }
    return service.price;
}

/**
 * Obtiene la promoción aplicable a un servicio en una fecha determinada.
 */
export function getMatchingPromotionForDate(
    promotions: Promotion[],
    serviceId: number,
    dateStr: string // "YYYY-MM-DD"
): Promotion | null {
    if (!promotions || promotions.length === 0 || !dateStr) return null;

    try {
        const [year, month, day] = dateStr.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const dayIndex = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ...
        const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDayKey = dayKeys[dayIndex];

        return promotions.find(p => {
            if (!p.isActive) return false;
            // Coincidencia de día de la semana
            const matchesDay = p.daysOfWeek.includes(currentDayKey);
            if (!matchesDay) return false;

            // Coincidencia de servicio (vacío = aplica a todos)
            const matchesService = !p.serviceIds || p.serviceIds.length === 0 || p.serviceIds.includes(serviceId);
            return matchesService;
        }) || null;
    } catch {
        return null;
    }
}

export const usePromotions = (explicitTenantId?: string) => {
    const { tenantId: authTenantId } = useAuthStore();
    const tenantId = explicitTenantId || authTenantId;
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['promotions', tenantId];

    // GET Promociones
    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<Promotion[]> => {
            if (!tenantId) return [];
            try {
                const { data, error } = await supabase
                    .from('promotions')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false });

                if (error) {
                    // Si la tabla no existe aún en Supabase, responder vacío limpiamente
                    if (error.code === '42P01') {
                        console.info('[usePromotions] Tabla promotions pendiente de creación en Supabase.');
                        return [];
                    }
                    throw error;
                }
                return (data || []).map(fromDbPromotion);
            } catch (err: any) {
                console.warn('[usePromotions] Error consultando promociones:', err?.message);
                return [];
            }
        },
        enabled: Boolean(tenantId),
        staleTime: 1000 * 60 * 3, // 3 minutos
    });

    // CREATE Promoción
    const addMutation = useMutation({
        mutationFn: async (promoData: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>) => {
            if (!tenantId) throw new Error('No tenant seleccionado');
            const dbPayload = toDbPromotion({ ...promoData, tenantId });
            const { data, error } = await supabase
                .from('promotions')
                .insert([dbPayload])
                .select()
                .single();
            if (error) throw error;
            return fromDbPromotion(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('¡Promoción creada con éxito! 🎉', 'success');
        },
        onError: (err: any) => showToast(`Error al crear promoción: ${err.message}`, 'error'),
    });

    // UPDATE Promoción
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Promotion> }) => {
            const dbPayload = toDbPromotion(data);
            const { error } = await supabase
                .from('promotions')
                .update({ ...dbPayload, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Promoción actualizada', 'success');
        },
        onError: (err: any) => showToast(`Error al actualizar promoción: ${err.message}`, 'error'),
    });

    // TOGGLE Active / Inactive
    const toggleActiveMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            const { error } = await supabase
                .from('promotions')
                .update({ is_active: isActive, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;
            return { id, isActive };
        },
        onSuccess: ({ isActive }) => {
            queryClient.invalidateQueries({ queryKey });
            showToast(isActive ? 'Promoción activada' : 'Promoción pausada', 'success');
        },
        onError: (err: any) => showToast(`Error al cambiar estado: ${err.message}`, 'error'),
    });

    // DELETE Promoción
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('promotions')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Promoción eliminada', 'success');
        },
        onError: (err: any) => showToast(`Error al eliminar promoción: ${err.message}`, 'error'),
    });

    return {
        ...query,
        promotions: query.data || [],
        addPromotion: addMutation.mutateAsync,
        updatePromotion: updateMutation.mutateAsync,
        togglePromotionActive: toggleActiveMutation.mutateAsync,
        deletePromotion: deleteMutation.mutateAsync,
        isAdding: addMutation.isPending,
        isUpdating: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
    };
};
