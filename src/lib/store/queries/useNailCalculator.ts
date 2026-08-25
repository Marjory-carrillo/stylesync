import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';
import type { QuotingCategory } from '../../types/store.types';

export const DEFAULT_NAIL_CONFIG: QuotingCategory[] = [
    {
      id: "base_services",
      name: "Servicio Base (Técnica)",
      type: "radio",
      items: [
        { id: "2", name: "Gel semipermanente", price: 200 },
        { id: "4", name: "Nivelación Rubber", price: 300 },
        { id: "5", name: "Baño acrílico", price: 350 },
        { id: "6", name: "Softgel (Incluye color base)", price: 400 },
        { id: "7", name: "Uñas Acrílicas (1 tono liso)", price: 400 }
      ]
    },
    {
      id: "sizes",
      name: "Tamaño (Largo)",
      type: "radio",
      items: [
        { id: "s1", name: "Largo #1", price: 0 },
        { id: "s2", name: "Largo #2", price: 100 },
        { id: "s3", name: "Largo #3", price: 200 },
        { id: "s4", name: "Largo #4", price: 300 },
        { id: "s5", name: "Largo #5", price: 400 },
        { id: "s6", name: "Largo #6", price: 500 },
        { id: "s7", name: "Largo #7", price: 600 },
        { id: "s8", name: "Largo #8", price: 700 }
      ]
    },
    {
      id: "styles",
      name: "Estilos / Diseño",
      type: "checkbox",
      items: [
        { id: "d1", name: "Francés", unit: "por uña", price: 15 },
        { id: "d2", name: "Efecto (Chrome, Aurora, Carey)", unit: "por uña", price: 15 },
        { id: "d3", name: "Mano Alzada", unit: "por uña", price: 15 },
        { id: "d4", name: "Cristales", unit: "por pieza", price: 5 },
        { id: "d5", name: "Charms / Dije", unit: "por pieza", price: 20 },
        { id: "d6", name: "Encapsulado", unit: "por uña", price: 20 },
        { id: "d7", name: "Tono extra", unit: "por pieza", price: 30 },
        { id: "d8", name: "Figuras 3D", unit: "por uña", price: 30 },
        { id: "d9", name: "Relieves", unit: "por uña", price: 20 },
        { id: "d10", name: "Cat Eye", unit: "por uña", price: 15 }
      ]
    },
    {
      id: "extras",
      name: "Adicionales / Extras",
      type: "checkbox",
      items: [
        { id: "e1", name: "Retiro de sistema anterior", price: 150, duration: 20 },
        { id: "e2", name: "Reparación de uña", price: 50, duration: 15 },
        { id: "e3", name: "Retiro de otro salón", price: 170, duration: 20 },
        { id: "e4", name: "Retoque acrílico", price: 300, duration: 60 }
      ]
    },
    {
      id: "simplified_designs",
      name: "Niveles de Diseño (App Clientes)",
      type: "radio",
      items: [
        { id: "basic", name: "Básico (1 solo tono)", price: 0, desc: "Esmaltado liso de un solo color sin decoraciones." },
        { id: "simple", name: "Sencillo (Francés o Efectos)", price: 160, desc: "Francés clásico/Baby boomer, efectos chrome/cat-eye, o diseño minimalista en 2-4 uñas." },
        { id: "complex", name: "Elaborado (Full Art / Pedrería)", price: 380, desc: "Diseños a mano alzada en todas las uñas, cristales, charms, encapsulados o decoraciones 3D." }
      ]
    }
];

export const useNailCalculator = () => {
    const { tenantId } = useAuthStore();
    const { showToast } = useUIStore();
    const queryClient = useQueryClient();
    const queryKey = ['nail_calculator_config', tenantId];

    const query = useQuery({
        queryKey,
        queryFn: async (): Promise<QuotingCategory[]> => {
            if (!tenantId) return DEFAULT_NAIL_CONFIG;
            const { data, error } = await supabase
                .from('nail_calculator_config')
                .select('config')
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (error) throw error;
            if (!data) {
                // Insert default config on first load
                const { error: insertError } = await supabase
                    .from('nail_calculator_config')
                    .insert([{ tenant_id: tenantId, config: DEFAULT_NAIL_CONFIG }]);
                if (insertError) {
                    console.error("Error creating default quoter config:", insertError);
                }
                return DEFAULT_NAIL_CONFIG;
            }
            const dbConfig = (data.config as QuotingCategory[]) || [];
            
            // Asegurar que categorías nuevas existan para clientes antiguos (como simplified_designs)
            const mergedConfig = [...dbConfig];
            DEFAULT_NAIL_CONFIG.forEach(defaultCat => {
                const exists = mergedConfig.some(c => c.id === defaultCat.id);
                if (!exists) {
                    mergedConfig.push(defaultCat);
                }
            });
            return mergedConfig;
        },
        enabled: !!tenantId,
    });

    const updateConfigMutation = useMutation({
        mutationFn: async (newConfig: QuotingCategory[]) => {
            if (!tenantId) throw new Error("No tenant info");

            const { data: existing } = await supabase
                .from('nail_calculator_config')
                .select('id')
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (existing) {
                const { error } = await supabase
                    .from('nail_calculator_config')
                    .update({ config: newConfig })
                    .eq('tenant_id', tenantId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('nail_calculator_config')
                    .insert([{ tenant_id: tenantId, config: newConfig }]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            showToast('Calculadora de uñas actualizada exitosamente', 'success');
        },
        onError: (err: any) => showToast(`Error al guardar cambios: ${err.message}`, 'error'),
    });

    return {
        ...query,
        config: query.data || DEFAULT_NAIL_CONFIG,
        saveConfig: updateConfigMutation.mutateAsync,
        isSaving: updateConfigMutation.isPending,
    };
};
