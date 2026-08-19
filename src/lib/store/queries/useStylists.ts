import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { Stylist } from '../../types/store.types';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

export const useStylists = () => {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['stylists', tenantId];

    // GET Stylists / Staff
    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<Stylist[]> => {
            if (!tenantId) return [];
            const { data, error } = await supabase
                .from('stylists')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('id');
            if (error) throw error;

            // Map db columns to frontend interface
            return data.map(st => {
                const csp = st.custom_service_prices || {};
                const customQuoterConfig = csp._quoter || st.custom_quoter_config || null;
                const cleanedCsp = { ...csp };
                delete cleanedCsp._quoter;

                return {
                    ...st,
                    commissionRate: st.commission_rate,
                    serviceIds: st.service_ids,
                    customServicePrices: cleanedCsp,
                    customQuoterConfig,
                    depositBankName: st.deposit_bank_name || '',
                    depositClabe: st.deposit_clabe || '',
                    depositHolderName: st.deposit_holder_name || '',
                };
            }) as Stylist[];
        },
        enabled: !!tenantId,
    });

    // ADD Stylist
    const addMutation = useMutation({
        mutationFn: async (stylist: Omit<Stylist, 'id'>) => {
            if (!tenantId) throw new Error("No tenant info");
            const combinedCustomPrices = {
                ...(stylist.customServicePrices || {}),
                ...(stylist.customQuoterConfig ? { _quoter: stylist.customQuoterConfig } : {})
            };

            const payload = {
                ...stylist,
                tenant_id: tenantId,
                commission_rate: stylist.commissionRate,
                service_ids: stylist.serviceIds,
                custom_service_prices: combinedCustomPrices,
                deposit_bank_name: stylist.depositBankName || null,
                deposit_clabe: stylist.depositClabe || null,
                deposit_holder_name: stylist.depositHolderName || null,
            };
            delete (payload as any).commissionRate;
            delete (payload as any).serviceIds;
            delete (payload as any).customServicePrices;
            delete (payload as any).customQuoterConfig;
            delete (payload as any).depositBankName;
            delete (payload as any).depositClabe;
            delete (payload as any).depositHolderName;

            const { data, error } = await supabase
                .from('stylists')
                .insert([payload])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Miembro agregado al equipo', 'success');
        },
        onError: (err: any) => showToast(`Error al agregar: ${err.message}`, 'error')
    });

    // UPDATE Stylist
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: Partial<Stylist> }) => {
            if (!tenantId) throw new Error("No tenant info");

            const payload = { ...data };
            if (payload.commissionRate !== undefined) {
                (payload as any).commission_rate = payload.commissionRate;
                delete payload.commissionRate;
            }
            if (payload.serviceIds !== undefined) {
                (payload as any).service_ids = payload.serviceIds;
                delete payload.serviceIds;
            }
            if (payload.depositBankName !== undefined) {
                (payload as any).deposit_bank_name = payload.depositBankName;
                delete payload.depositBankName;
            }
            if (payload.depositClabe !== undefined) {
                (payload as any).deposit_clabe = payload.depositClabe;
                delete payload.depositClabe;
            }
            if (payload.depositHolderName !== undefined) {
                (payload as any).deposit_holder_name = payload.depositHolderName;
                delete payload.depositHolderName;
            }
            if (payload.customServicePrices !== undefined || payload.customQuoterConfig !== undefined) {
                const combinedCustomPrices = {
                    ...(payload.customServicePrices || {}),
                    ...(payload.customQuoterConfig ? { _quoter: payload.customQuoterConfig } : {})
                };
                (payload as any).custom_service_prices = combinedCustomPrices;
                delete payload.customServicePrices;
                delete payload.customQuoterConfig;
            }

            const { error } = await supabase
                .from('stylists')
                .update(payload)
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Miembro actualizado', 'success');
        },
        onError: (err: any) => showToast(`Error al actualizar: ${err.message}`, 'error')
    });

    // DELETE Stylist
    const removeMutation = useMutation({
        mutationFn: async (id: number) => {
            if (!tenantId) throw new Error("No tenant info");
            const { error } = await supabase
                .from('stylists')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Miembro eliminado', 'success');
        },
        onError: (err: any) => showToast(`Error al eliminar: ${err.message}`, 'error')
    });

    return {
        ...query,
        stylists: query.data || [],
        addStylist: addMutation.mutateAsync,
        updateStylist: updateMutation.mutateAsync,
        removeStylist: removeMutation.mutateAsync,
        isAdding: addMutation.isPending,
        isUpdating: updateMutation.isPending,
        isRemoving: removeMutation.isPending
    };
};
