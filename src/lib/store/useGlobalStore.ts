import { create } from 'zustand';
import { supabase } from '../supabaseClient';

interface GlobalConfig {
    basic_plan_price: number;
    premium_plan_price: number;
    trial_days: number;
    maintenance_mode: boolean;
    system_email: string;
}

interface GlobalState {
    config: GlobalConfig | null;
    loadingConfig: boolean;
    fetchGlobalConfig: () => Promise<void>;
}

export const useGlobalStore = create<GlobalState>((set) => ({
    config: null,
    loadingConfig: true,

    fetchGlobalConfig: async () => {
        try {
            set({ loadingConfig: true });

            // 1. Fetch inicial
            const { data, error } = await supabase
                .from('global_configs')
                .select('*')
                .eq('id', 'main')
                .single();

            if (!error && data) {
                set({ config: data });
            } else if (error?.code === 'PGRST116') {
                set({
                    config: {
                        basic_plan_price: 499.00,
                        premium_plan_price: 999.00,
                        trial_days: 14,
                        maintenance_mode: false,
                        system_email: 'soporte@citalink.app'
                    }
                });
            }

            // 2. Suscripción Realtime para cambios inmediatos (Solo si no existe)
            if (!(supabase as any)._globalConfigChannel) {
                (supabase as any)._globalConfigChannel = supabase
                    .channel('global-config-changes')
                    .on(
                        'postgres_changes',
                        { event: 'UPDATE', schema: 'public', table: 'global_configs', filter: 'id=eq.main' },
                        (payload) => {
                            console.log('Global Config Updated:', payload.new);
                            set({ config: payload.new as GlobalConfig });
                        }
                    )
                    .subscribe();
            }

        } catch (err) {
            console.error('Unexpected error fetching global config:', err);
        } finally {
            set({ loadingConfig: false });
        }
    }
}));
