import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import { useAuthStore } from '../authStore';
import { useUIStore } from '../uiStore';
import type { QuotingCategory } from '../../types/store.types';

const DEFAULT_NAIL_CONFIG: QuotingCategory[] = [
    {
      id: "base_services",
      name: "Servicio Base (Técnica)",
      type: "radio",
      items: [
        { id: "1", name: "Gel Semipermanente (Manos)", price: 120 },
        { id: "2", name: "Gel Semipermanente con diseño(Manos)", price: 160 },
        { id: "3", name: "Gel Semipermanente (Pies)", price: 150 },
        { id: "4", name: "nivelación rubber", price: 170 },
        { id: "5", name: "Baño de Acrílico (Sobre uña natural)", price: 250 },
        { id: "6", name: "Softgel (Incluye color base)", price: 250 },
        { id: "7", name: "Uñas Acrílicas (Set Nuevo)", price: 300 },
        { id: "8", name: "Acripie (Acrílico en pies)", price: 230 }
      ]
    },
    {
      id: "sizes",
      name: "Tamaño (Largo)",
      type: "radio",
      items: [
        { id: "s1", name: "Corto / Natural", price: 0 },
        { id: "s2", name: "Mediano", price: 50 },
        { id: "s3", name: "Largo", price: 100 },
        { id: "s4", name: "Extra Largo (XL)", price: 150 }
      ]
    },
    {
      id: "styles",
      name: "Estilos / Diseño",
      type: "checkbox",
      items: [
        { id: "d1", name: "Francés / Baby Boomer", price: 50 },
        { id: "d2", name: "Efecto (Chrome, Aura, Cat Eye)", price: 50 },
        { id: "d3", name: "Mano Alzada", price: 50, unit: "por uña" },
        { id: "d4", name: "Cristales", price: 10, unit: "por pieza" },
        { id: "d5", name: "Charms / Dije", price: 15, unit: "por pieza" },
        { id: "d6", name: "Encapsulado", price: 50, unit: "por uña" }
      ]
    },
    {
      id: "extras",
      name: "Adicionales / Extras",
      type: "checkbox",
      items: [
        { id: "e1", name: "Retiro de sistema anterior", price: 50 },
        { id: "e2", name: "Reparación de uña", price: 40 },
        { id: "e3", name: "Retiro de otro salón", price: 100 }
      ]
    },
    {
      id: "simplified_designs",
      name: "Niveles de Diseño (App Clientes)",
      type: "radio",
      items: [
        { id: "basic", name: "Básico (1 solo tono)", price: 0, desc: "Esmaltado liso de un solo color sin decoraciones." },
        { id: "simple", name: "Sencillo (Francés o Efectos)", price: 50, desc: "Francés clásico/Baby boomer, efectos chrome/cat-eye, o diseño minimalista en 2-4 uñas." },
        { id: "complex", name: "Elaborado (Full Art / Pedrería)", price: 150, desc: "Diseños a mano alzada en todas las uñas, cristales, charms, encapsulados o decoraciones 3D." }
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
            const { error } = await supabase
                .from('nail_calculator_config')
                .upsert({ tenant_id: tenantId, config: newConfig }, { onConflict: 'tenant_id' });
            if (error) throw error;
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
