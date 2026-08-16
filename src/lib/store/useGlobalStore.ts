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

const DEFAULT_CONFIG: GlobalConfig = {
    basic_plan_price: 349.00,
    premium_plan_price: 649.00,
    trial_days: 30,
    maintenance_mode: false,
    system_email: 'soporte@citalink.app'
};

export const useGlobalStore = create<GlobalState>((set) => ({
    config: DEFAULT_CONFIG,
    loadingConfig: false,

    fetchGlobalConfig: async () => {
        try {
            const fetchPromise = supabase
                .from('global_configs')
                .select('*')
                .eq('id', 'main')
                .single();

            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 1000));

            const res = await Promise.race([fetchPromise, timeoutPromise]) as any;

            if (res && !res.timeout && res.data) {
                set({ config: res.data, loadingConfig: false });
            } else {
                set({ config: DEFAULT_CONFIG, loadingConfig: false });
            }

            // Suscripción Realtime para cambios inmediatos
            if (!(supabase as any)._globalConfigChannel) {
                (supabase as any)._globalConfigChannel = supabase
                    .channel('global-config-changes')
                    .on(
                        'postgres_changes',
                        { event: 'UPDATE', schema: 'public', table: 'global_configs', filter: 'id=eq.main' },
                        (payload) => {
                            set({ config: payload.new as GlobalConfig });
                        }
                    )
                    .subscribe();
            }

        } catch (err) {
            set({ config: DEFAULT_CONFIG, loadingConfig: false });
        } finally {
            set({ loadingConfig: false });
        }
    }
}));
