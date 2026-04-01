import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import { useAuthStore } from '../authStore';
import { CATEGORY_DEFAULTS } from '../../categoryDefaults';

export function useSuperAdmin() {
    const queryClient = useQueryClient();
    const user = useAuthStore(s => s.user);
    const isSuperAdmin = useAuthStore(s => s.isSuperAdmin);

    const queryKey = ['superadmin_tenants'];

    const query = useQuery({
        queryKey,
        queryFn: async () => {
            if (!isSuperAdmin) return [];
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!isSuperAdmin,
    });

    const createTenantMutation = useMutation({
        mutationFn: async ({ name, slug, address, category, ownerEmail, ownerPassword, timezone }: { name: string, slug: string, address: string, category: string, ownerEmail: string, ownerPassword: string, timezone?: string }) => {
            if (!user) throw new Error('No user logged in');

            // 1. Check if slug exists
            const { data: existing } = await supabase.from('tenants').select('id').eq('slug', slug).single();
            if (existing) throw new Error('Este link ya ha sido ocupado.');

            // 2. Create Tenant
            const { data, error } = await supabase.from('tenants').insert([{
                name,
                slug,
                address,
                category,
                owner_id: user.id, // SuperAdmin es el creador técnico
                timezone: timezone || 'America/Mexico_City',
            }]).select().single();
            
            if (error || !data) throw new Error(error?.message || 'Error al crear negocio');

            // 3. Registrar el correo del dueño en tenant_users con rol 'owner'
            const { error: tuError } = await supabase.from('tenant_users').insert({
                tenant_id: data.id,
                email: ownerEmail,
                role: 'owner',
                stylist_id: null
            });
            if (tuError) {
                console.warn('No se pudo registrar el dueño en tenant_users:', tuError.message);
            }

            // 4. Inyectar datos por defecto según la categoría
            // @ts-ignore CATEGORY_DEFAULTS type
            const defaults = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS['other'] || CATEGORY_DEFAULTS['barbershop'];

            await supabase.from('schedule_config').insert({ tenant_id: data.id, schedule: defaults.schedule });

            if (defaults.services && defaults.services.length > 0) {
                const svl = defaults.services.map((s: any) => ({ ...s, tenant_id: data.id }));
                await supabase.from('services').insert(svl);
            }

            if (defaults.stylists && defaults.stylists.length > 0) {
                const stl = defaults.stylists.map((s: any) => ({ ...s, tenant_id: data.id }));
                await supabase.from('stylists').insert(stl);
            }

            // 5. Crear la cuenta del dueño con email + contraseña vía Edge Function
            let accountCreated = false;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const fnRes = await fetch(
                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-owner`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session?.access_token}`,
                        },
                        body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
                    }
                );
                const fnData = await fnRes.json();
                accountCreated = fnData.success === true;
                if (!accountCreated) console.warn('create-owner:', fnData.error);
            } catch (err) {
                console.warn('No se pudo crear la cuenta del dueño:', err);
            }

            return { success: true, data, accountCreated };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    const deleteTenantMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!isSuperAdmin) throw new Error('No autorizado');
            const { error } = await supabase.from('tenants').delete().eq('id', id);
            if (error) throw new Error(error.message);
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    const switchTenant = async (id: string, callback?: () => void) => {
        if (!isSuperAdmin) return;
        localStorage.setItem('citalink_tenant_id', id);
        // Force a page reload or callback if provided
        if (callback) callback();
        else window.location.href = '/admin'; // reload to init tenant properly
    };

    return {
        allTenants: query.data || [],
        isLoading: query.isLoading,
        fetchAllTenants: () => queryClient.invalidateQueries({ queryKey }),
        createTenant: async (name: string, slug: string, address: string, category: string, ownerEmail: string, ownerPassword: string, timezone: string = 'America/Mexico_City'): Promise<{ success: boolean; data?: any; error?: string; accountCreated?: boolean }> => {
            try {
                const res = await createTenantMutation.mutateAsync({ name, slug, address, category, ownerEmail, ownerPassword, timezone });
                return { success: true, data: res.data, accountCreated: res.accountCreated };
            } catch (err: any) {
                return { success: false, error: err.message };
            }
        },
        deleteTenant: async (id: string) => {
            try {
                await deleteTenantMutation.mutateAsync(id);
                return { success: true };
            } catch (err: any) {
                return { success: false, error: err.message };
            }
        },
        switchTenant
    };
}
