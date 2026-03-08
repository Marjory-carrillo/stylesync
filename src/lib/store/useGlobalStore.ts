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
            const { data, error } = await supabase
                .from('global_configs')
                .select('*')
                .eq('id', 'main')
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // Fallback to defaults if table is empty but exists
                    set({
                        config: {
                            basic_plan_price: 499.00,
                            premium_plan_price: 999.00,
                            trial_days: 14,
                            maintenance_mode: false,
                            system_email: 'soporte@citalink.app'
                        }
                    });
                } else {
                    console.error('Error fetching global config:', error);
                }
            } else {
                set({ config: data });
            }
        } catch (err) {
            console.error('Unexpected error fetching global config:', err);
        } finally {
            set({ loadingConfig: false });
        }
    }
}));
