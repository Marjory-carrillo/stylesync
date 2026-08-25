import { useCallback } from 'react';
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
                .select('*, tenant_users(email, role)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!isSuperAdmin,
    });

    const createTenantMutation = useMutation({
        mutationFn: async ({ name, slug, address, category, ownerEmail, ownerPassword, timezone, existingOwnerId, brandSlug, noTrial, countryCode, currency, currencySymbol, defaultPhonePrefix, phone, googleMapsUrl }: { name: string, slug: string, address: string, category: string, ownerEmail: string, ownerPassword: string, timezone?: string, existingOwnerId?: string, brandSlug?: string, noTrial?: boolean, countryCode?: string, currency?: string, currencySymbol?: string, defaultPhonePrefix?: string, phone?: string, googleMapsUrl?: string }) => {
            if (!user) throw new Error('No user logged in');

            // 1. Check if slug exists
            const { data: existing } = await supabase.from('tenants').select('id').eq('slug', slug).single();
            if (existing) throw new Error('Este link ya ha sido ocupado.');

            // 2. Create Tenant — if existingOwnerId, assign to that user; otherwise SuperAdmin is the technical creator
            // Auto-assign 30-day trial for all new businesses (unless noTrial is set)
            const trialEnd = new Date();
            trialEnd.setDate(trialEnd.getDate() + 30);

            const insertPayload: any = {
                name,
                slug,
                address,
                category,
                owner_id: existingOwnerId || user.id,
                timezone: timezone || 'America/Mexico_City',
                sms_provider: 'whatsapp',
                registration_source: 'direct',
                onboarding_completed: false,
                trial_ends_at: noTrial ? null : trialEnd.toISOString(),
                country_code: countryCode || 'MX',
                currency: currency || 'MXN',
                currency_symbol: currencySymbol || '$',
                default_phone_prefix: defaultPhonePrefix || '+52',
            };
            if (brandSlug) insertPayload.brand_slug = brandSlug;
            if (phone) insertPayload.phone = phone;
            if (googleMapsUrl) insertPayload.google_maps_url = googleMapsUrl;

            const { data, error } = await supabase.from('tenants').insert([insertPayload]).select().single();
            
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
            // Skip if assigning to an existing owner (they already have an account)
            let accountCreated = false;
            if (!existingOwnerId) {
                try {
                    const fnRes = await fetch(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-owner`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                            },
                            body: JSON.stringify({ email: ownerEmail, password: ownerPassword, businessName: name, businessSlug: slug }),
                        }
                    );
                    const fnData = await fnRes.json();
                    accountCreated = fnData.success === true;
                    
                    // ✅ KEY FIX: Update tenant owner_id with the real user ID
                    // so that the auth lookup by owner_id works correctly on login
                    if (accountCreated && fnData.userId) {
                        await supabase
                            .from('tenants')
                            .update({ owner_id: fnData.userId })
                            .eq('id', data.id);
                        // Also update tenant_users with the real user_id if column exists
                        await supabase
                            .from('tenant_users')
                            .update({ user_id: fnData.userId })
                            .eq('tenant_id', data.id)
                            .eq('email', ownerEmail);
                    }
                    
                    if (!accountCreated) console.warn('create-owner:', fnData.error);
                } catch (err) {
                    console.warn('No se pudo crear la cuenta del dueño:', err);
                }
            } else {
                accountCreated = true; // Existing owner, no need to create
            }

            // 6. If brand_slug is provided, also update other tenants of the same owner to share the brand
            if (brandSlug && existingOwnerId) {
                await supabase
                    .from('tenants')
                    .update({ brand_slug: brandSlug })
                    .eq('owner_id', existingOwnerId)
                    .is('brand_slug', null);
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
            // Limpiar tenant_users huérfanos antes de borrar el tenant
            await supabase.from('tenant_users').delete().eq('tenant_id', id);
            const { error } = await supabase.from('tenants').delete().eq('id', id);
            if (error) throw new Error(error.message);
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        }
    });

    const updateTenantMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
            if (!isSuperAdmin) throw new Error('No autorizado');
            const { data, error } = await supabase
                .from('tenants')
                .update(payload)
                .eq('id', id)
                .select()
                .single();
            if (error) throw new Error(error.message);
            return data;
        },
        onSuccess: (updatedTenant) => {
            if (updatedTenant) {
                queryClient.setQueryData(queryKey, (old: any[] | undefined) => {
                    if (!old) return [updatedTenant];
                    return old.map((t: any) => (t.id === updatedTenant.id ? { ...t, ...updatedTenant } : t));
                });
            }
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

    const fetchAllTenants = useCallback(() => {
        queryClient.invalidateQueries({ queryKey });
    }, [queryClient]);

    return {
        allTenants: query.data || [],
        isLoading: query.isLoading,
        fetchAllTenants,
        createTenant: async (name: string, slug: string, address: string, category: string, ownerEmail: string, ownerPassword: string, timezone: string = 'America/Mexico_City', existingOwnerId?: string, brandSlug?: string, noTrial?: boolean, countryCode?: string, currency?: string, currencySymbol?: string, defaultPhonePrefix?: string, phone?: string, googleMapsUrl?: string): Promise<{ success: boolean; data?: any; error?: string; accountCreated?: boolean }> => {
            try {
                const res = await createTenantMutation.mutateAsync({ name, slug, address, category, ownerEmail, ownerPassword, timezone, existingOwnerId, brandSlug, noTrial, countryCode, currency, currencySymbol, defaultPhonePrefix, phone, googleMapsUrl });
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
        updateTenant: async (id: string, payload: any): Promise<{ success: boolean; data?: any; error?: string }> => {
            try {
                const res = await updateTenantMutation.mutateAsync({ id, payload });
                return { success: true, data: res };
            } catch (err: any) {
                return { success: false, error: err.message };
            }
        },
        /**
         * Re-vincula el owner_id de un tenant al usuario Auth que tiene el email dado.
         * Útil cuando se borró y re-creó un negocio con distinto correo y el login falla.
         */
        relinkOwner: async (tenantId: string, ownerEmail: string): Promise<{ success: boolean; error?: string }> => {
            if (!isSuperAdmin) return { success: false, error: 'No autorizado' };
            try {
                // Llamar a la Edge Function create-owner para obtener/crear el userId
                const fnRes = await fetch(
                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-owner`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                        },
                        body: JSON.stringify({ email: ownerEmail, lookupOnly: true }),
                    }
                );
                const fnData = await fnRes.json();
                if (!fnData.success || !fnData.userId) {
                    return { success: false, error: fnData.error || 'No se encontró el usuario Auth con ese correo' };
                }
                const userId = fnData.userId;
                // Actualizar owner_id en tenants
                const { error: tenantErr } = await supabase
                    .from('tenants')
                    .update({ owner_id: userId })
                    .eq('id', tenantId);
                if (tenantErr) throw new Error(tenantErr.message);
                // Actualizar user_id en tenant_users
                await supabase
                    .from('tenant_users')
                    .update({ user_id: userId })
                    .eq('tenant_id', tenantId)
                    .eq('role', 'owner');
                // También asegurar que exista el registro en tenant_users con el email correcto
                const { data: existingTu } = await supabase
                    .from('tenant_users')
                    .select('id')
                    .eq('tenant_id', tenantId)
                    .eq('email', ownerEmail)
                    .maybeSingle();
                if (!existingTu) {
                    await supabase.from('tenant_users').insert({
                        tenant_id: tenantId,
                        email: ownerEmail,
                        role: 'owner',
                        user_id: userId,
                        stylist_id: null,
                    });
                }
                queryClient.invalidateQueries({ queryKey });
                return { success: true };
            } catch (err: any) {
                return { success: false, error: err.message };
            }
        },
        /**
         * Restablece la contraseña del usuario Auth dueño (owner) de un negocio.
         */
        resetOwnerPassword: async (ownerEmail: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
            if (!isSuperAdmin) return { success: false, error: 'No autorizado' };
            if (!newPassword || newPassword.length < 6) return { success: false, error: 'La contraseña debe tener al menos 6 caracteres' };
            try {
                const fnRes = await fetch(
                    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-owner`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                        },
                        body: JSON.stringify({ email: ownerEmail.trim().toLowerCase(), password: newPassword }),
                    }
                );
                const fnData = await fnRes.json();
                if (!fnData.success) {
                    return { success: false, error: fnData.error || 'Error al actualizar contraseña' };
                }
                return { success: true };
            } catch (err: any) {
                return { success: false, error: err.message };
            }
        },
        /**
         * Extiende los días de prueba para un tenant específico.
         */
        extendTrial: async (tenantId: string, additionalDays: number): Promise<{ success: boolean; newTrialEnd?: string; error?: string }> => {
            if (!isSuperAdmin) return { success: false, error: 'No autorizado' };
            try {
                const { data: currentTenant, error: fetchErr } = await supabase
                    .from('tenants')
                    .select('trial_ends_at')
                    .eq('id', tenantId)
                    .single();
                if (fetchErr) throw fetchErr;

                let baseDate = new Date();
                if (currentTenant?.trial_ends_at) {
                    const currentEnd = new Date(currentTenant.trial_ends_at);
                    if (currentEnd > baseDate) {
                        baseDate = currentEnd;
                    }
                }
                baseDate.setDate(baseDate.getDate() + additionalDays);
                const newTrialEnd = baseDate.toISOString();

                const { error: updateErr } = await supabase
                    .from('tenants')
                    .update({ trial_ends_at: newTrialEnd, payment_status: 'active' })
                    .eq('id', tenantId);

                if (updateErr) throw updateErr;

                queryClient.invalidateQueries({ queryKey });
                return { success: true, newTrialEnd };
            } catch (err: any) {
                return { success: false, error: err.message };
            }
        },
        /**
         * Fija o restablece manualmente la fecha exacta de fin de prueba (o null si pasa a suscrito).
         */
        setTrialEndDate: async (tenantId: string, newDateIso: string | null): Promise<{ success: boolean; error?: string }> => {
            if (!isSuperAdmin) return { success: false, error: 'No autorizado' };
            try {
                const { error: updateErr } = await supabase
                    .from('tenants')
                    .update({ trial_ends_at: newDateIso })
                    .eq('id', tenantId);

                if (updateErr) throw updateErr;

                queryClient.invalidateQueries({ queryKey });
                return { success: true };
            } catch (err: any) {
                return { success: false, error: err.message };
            }
        },
        switchTenant
    };
}
