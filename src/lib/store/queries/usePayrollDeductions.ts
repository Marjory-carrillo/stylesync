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
        mutationFn: async (deduction: Omit<PayrollDeduction, 'id' | 'tenantId' | 'createdAt'>) => {
            if (!tenantId) throw new Error('No hay tenant activo');

            const newId = crypto.randomUUID ? crypto.randomUUID() : `ded_${Date.now()}`;
            const item: PayrollDeduction = {
                id: newId,
                tenantId,
                stylistId: deduction.stylistId,
                amount: Number(deduction.amount),
                concept: deduction.concept.trim() || 'Adelanto de sueldo',
                date: deduction.date,
                notes: deduction.notes?.trim() || undefined,
                createdAt: new Date().toISOString(),
            };

            try {
                const { error } = await supabase
                    .from('payroll_deductions')
                    .insert([{
                        id: item.id,
                        tenant_id: item.tenantId,
                        stylist_id: item.stylistId,
                        amount: item.amount,
                        concept: item.concept,
                        date: item.date,
                        notes: item.notes || null,
                    }]);

                if (error) {
                    const current = getLocalDeductions(tenantId);
                    saveLocalDeductions(tenantId, [item, ...current]);
                }
            } catch {
                const current = getLocalDeductions(tenantId);
                saveLocalDeductions(tenantId, [item, ...current]);
            }

            return item;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Adelanto registrado correctamente', 'success');
        },
        onError: (err: any) => {
            showToast('Error al registrar adelanto: ' + (err?.message || 'Error'), 'error');
        }
    });

    const deleteDeduction = useMutation({
        mutationFn: async (id: string) => {
            if (!tenantId) throw new Error('No hay tenant activo');

            try {
                const { error } = await supabase
                    .from('payroll_deductions')
                    .delete()
                    .eq('id', id)
                    .eq('tenant_id', tenantId);

                const current = getLocalDeductions(tenantId);
                saveLocalDeductions(tenantId, current.filter(c => c.id !== id));

                if (error && error.code !== '42P01') {
                    console.warn('Supabase delete error:', error);
                }
            } catch {
                const current = getLocalDeductions(tenantId);
                saveLocalDeductions(tenantId, current.filter(c => c.id !== id));
            }

            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Registro eliminado', 'info');
        },
        onError: (err: any) => {
            showToast('Error al eliminar registro: ' + (err?.message || 'Error'), 'error');
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