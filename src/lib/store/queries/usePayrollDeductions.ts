import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import type { PayrollDeduction } from '../../types/store.types';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';

const getLocalDeductions = (tenantId: string): PayrollDeduction[] => {
    try {
        const raw = localStorage.getItem(`citalink_payroll_deductions_${tenantId}`);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const saveLocalDeductions = (tenantId: string, items: PayrollDeduction[]) => {
    try {
        localStorage.setItem(`citalink_payroll_deductions_${tenantId}`, JSON.stringify(items));
    } catch (e) {
        console.error('Error saving local deductions:', e);
    }
};

export const usePayrollDeductions = () => {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['payroll_deductions', tenantId];

    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<PayrollDeduction[]> => {
            if (!tenantId) return [];

            try {
                const { data, error } = await supabase
                    .from('payroll_deductions')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .order('date', { ascending: false });

                if (error) {
                    return getLocalDeductions(tenantId);
                }

                const mapped: PayrollDeduction[] = (data || []).map((row: any) => ({
                    id: String(row.id),
                    tenantId: String(row.tenant_id),
                    stylistId: Number(row.stylist_id),
                    amount: Number(row.amount || 0),
                    concept: row.concept || 'Adelanto de sueldo',
                    date: row.date,
                    notes: row.notes || undefined,
                    createdAt: row.created_at || new Date().toISOString(),
                }));

                saveLocalDeductions(tenantId, mapped);
                return mapped;
            } catch {
                return getLocalDeductions(tenantId);
            }
        },
        enabled: !!tenantId,
        staleTime: 1000 * 60 * 2,
    });

    const addDeduction = useMutation({
        onMutate: async (newDeduction: Omit<PayrollDeduction, 'id' | 'tenantId' | 'createdAt'>) => {
            if (!tenantId) return;
            await queryClient.cancelQueries({ queryKey });

            const previousDeductions = queryClient.getQueryData<PayrollDeduction[]>(queryKey) || [];
            const tempId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `ded_${Date.now()}`;
            
            const optimisticItem: PayrollDeduction = {
                id: tempId,
                tenantId,
                stylistId: newDeduction.stylistId,
                amount: Number(newDeduction.amount),
                concept: newDeduction.concept.trim() || 'Adelanto de sueldo',
                date: newDeduction.date,
                notes: newDeduction.notes?.trim() || undefined,
                createdAt: new Date().toISOString(),
            };

            const nextList = [optimisticItem, ...previousDeductions];
            queryClient.setQueryData<PayrollDeduction[]>(queryKey, nextList);
            saveLocalDeductions(tenantId, nextList);

            return { previousDeductions, tempId };
        },
        mutationFn: async (deduction: Omit<PayrollDeduction, 'id' | 'tenantId' | 'createdAt'>) => {
            if (!tenantId) throw new Error('No hay tenant activo');

            const insertId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `ded_${Date.now()}`;
            const payload = {
                id: insertId,
                tenant_id: tenantId,
                stylist_id: deduction.stylistId,
                amount: Number(deduction.amount),
                concept: deduction.concept.trim() || 'Adelanto de sueldo',
                date: deduction.date,
                notes: deduction.notes?.trim() || null,
            };

            try {
                const { data, error } = await supabase
                    .from('payroll_deductions')
                    .insert([payload])
                    .select()
                    .single();

                if (error) {
                    console.warn('Supabase insert fallback to local:', error);
                    return null;
                }
                return data;
            } catch (err) {
                console.warn('Supabase insert network fallback:', err);
                return null;
            }
        },
        onSuccess: (data, _variables, context) => {
            if (data && context?.tempId && tenantId) {
                const updatedList = (queryClient.getQueryData<PayrollDeduction[]>(queryKey) || []).map(item =>
                    item.id === context.tempId ? {
                        id: String(data.id),
                        tenantId: String(data.tenant_id),
                        stylistId: Number(data.stylist_id),
                        amount: Number(data.amount),
                        concept: data.concept,
                        date: data.date,
                        notes: data.notes || undefined,
                        createdAt: data.created_at
                    } : item
                );
                queryClient.setQueryData<PayrollDeduction[]>(queryKey, updatedList);
                saveLocalDeductions(tenantId, updatedList);
            }
            showToast('Adelanto registrado correctamente', 'success');
        },
        onError: (_err: any, _variables, context) => {
            if (context?.previousDeductions && tenantId) {
                queryClient.setQueryData(queryKey, context.previousDeductions);
                saveLocalDeductions(tenantId, context.previousDeductions);
            }
            showToast('Error al registrar adelanto', 'error');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    const deleteDeduction = useMutation({
        onMutate: async (idToDelete: string) => {
            if (!tenantId) return;
            await queryClient.cancelQueries({ queryKey });

            const previousDeductions = queryClient.getQueryData<PayrollDeduction[]>(queryKey) || [];
            const nextList = previousDeductions.filter(item => item.id !== idToDelete);

            // Actualización instantánea en memoria y local
            queryClient.setQueryData<PayrollDeduction[]>(queryKey, nextList);
            saveLocalDeductions(tenantId, nextList);

            return { previousDeductions };
        },
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error('No hay tenant activo');

            try {
                const { error } = await supabase
                    .from('payroll_deductions')
                    .delete()
                    .eq('id', id)
                    .eq('tenant_id', tenantId);

                if (error) {
                    console.warn('Supabase delete error:', error);
                }
            } catch (err) {
                console.warn('Supabase delete network error:', err);
            }
            return id;
        },
        onSuccess: () => {
            showToast('Adelanto eliminado correctamente', 'info');
        },
        onError: (_err: any, _id, context) => {
            if (context?.previousDeductions && tenantId) {
                queryClient.setQueryData(queryKey, context.previousDeductions);
                saveLocalDeductions(tenantId, context.previousDeductions);
            }
            showToast('Error al eliminar adelanto', 'error');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    return {
        deductions: query.data || [],
        isLoading: query.isLoading,
        addDeduction: addDeduction.mutateAsync,
        isAdding: addDeduction.isPending,
        deleteDeduction: deleteDeduction.mutateAsync,
        isDeleting: deleteDeduction.isPending,
    };
};