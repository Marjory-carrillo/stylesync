import { supabase } from '../supabaseClient';

export interface SelfServeTenantPayload {
    businessName: string;
    category: string;
    slug: string;
    contactName: string;
    email: string;
    password: string;
    phone: string;
    address: string;
    countryCode?: string;
    currency?: string;
    currencySymbol?: string;
    defaultPhonePrefix?: string;
}

/**
 * Normaliza un nombre para convertirlo en un slug amigable y limpio.
 */
export function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
        .replace(/[^a-z0-9\s-]/g, '') // Quitar caracteres especiales
        .trim()
        .replace(/\s+/g, '-'); // Espacios a guiones
}

/**
 * Verifica si un slug ya está en uso.
 */
export async function checkSlugAvailability(slug: string): Promise<boolean> {
    if (!slug || slug.trim().length < 2) return false;
    const cleanSlug = slug.trim().toLowerCase();
    
    // Slugs reservados del sistema
    const reserved = ['admin', 'super-admin', 'login', 'register', 'explore', 'terms', 'privacy', 'api', 'b'];
    if (reserved.includes(cleanSlug)) return false;

    const { data, error } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', cleanSlug)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
        console.error('Error al verificar slug:', error);
        return false;
    }

    return !data;
}

/**
 * Crea un negocio de forma 100% autónoma en el backend:
 * 1. Llama a la Edge Function `create-owner` con permisos service_role (crea auth, tenant, tenant_users, servicios y cotizador)
 * 2. Inicia sesión en Supabase y guarda el tenantId en localStorage
 * 3. Notifica al Super Admin vía WhatsApp
 */
export async function createSelfServeTenant(payload: SelfServeTenantPayload): Promise<{
    success: boolean;
    tenantId?: string;
    slug?: string;
    error?: string;
}> {
    try {
        const {
            businessName,
            category,
            slug,
            contactName,
            email,
            password,
            phone,
            address,
            countryCode = 'MX',
            currency = 'MXN',
            currencySymbol = '$',
            defaultPhonePrefix = '+52'
        } = payload;

        if (!businessName || !email || !password || !slug) {
            return { success: false, error: 'Faltan campos obligatorios para registrar el negocio.' };
        }

        // 1. Llamar a la Edge Function segura en el backend
        const fnRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-owner`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    email,
                    password,
                    businessName,
                    businessSlug: slug,
                    category: category || 'nail_bar',
                    contactName,
                    phone,
                    address,
                    createTenant: true,
                    countryCode,
                    currency,
                    currencySymbol,
                    defaultPhonePrefix
                }),
            }
        );

        const fnData = await fnRes.json();
        if (!fnData.success || !fnData.userId) {
            return {
                success: false,
                error: fnData.error || 'No se pudo crear la cuenta de usuario. Intenta con otro correo o contraseña.',
            };
        }

        const tenantId = fnData.tenantId;

        // 2. Iniciar sesión automáticamente en el cliente
        try {
            const { error: signInErr } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (signInErr) {
                console.warn('Auto-login post registro falló:', signInErr.message);
            }
        } catch (loginErr) {
            console.warn('Error al iniciar sesión automáticamente:', loginErr);
        }

        if (tenantId) {
            localStorage.setItem('citalink_tenant_id', tenantId);
        }

        // 1.5 Asegurar que el tenant quede marcado con origen 'landing' y datos de contacto
        if (tenantId) {
            try {
                await supabase
                    .from('tenants')
                    .update({
                        registration_source: 'landing',
                        phone: phone || '',
                    })
                    .eq('id', tenantId);
            } catch (updErr) {
                console.warn('Error actualizando registration_source en tenant:', updErr);
            }
        }

        // 3. Notificación instantánea al Super Admin vía WhatsApp
        try {
            const { data: globalConfig } = await supabase
                .from('global_configs')
                .select('superadmin_phone, trial_days')
                .eq('id', 'main')
                .single();

            if (globalConfig?.superadmin_phone) {
                const bizLabels: Record<string, string> = {
                    barbershop: 'Barbería',
                    nail_bar: "Salón de Uñas (Nail's)",
                    nails: "Salón de Uñas (Nail's)",
                    beauty_salon: 'Salón de Belleza',
                    lashes: 'Pestañas / Lashes',
                    spa: 'Spa / Estética',
                    pet_grooming: 'Grooming Canino',
                    consulting: 'Consultorio',
                    other: 'Otro Giro',
                };
                const catLabel = bizLabels[category] || category;
                const trialDays = globalConfig.trial_days || 30;
                const trialEndDate = new Date();
                trialEndDate.setDate(trialEndDate.getDate() + trialDays);
                const dateStr = trialEndDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

                const messageText = `🚀 *¡Nuevo Negocio Registrado en CitaLink!*\n\n🏪 *Negocio:* ${businessName}\n🏷️ *Giro:* ${catLabel}\n👤 *Dueño:* ${contactName}\n📞 *WhatsApp:* ${phone}\n📧 *Email:* ${email}\n📍 *Dirección:* ${address || 'No especificada'}\n🌐 *Link de Reservas:* https://www.citalink.app/${slug}\n📱 *Origen:* Registro Online (Landing Page)\n⚡ *Período de Prueba:* ${trialDays} días (Vence el ${dateStr})\n\nNotificación automática del sistema CitaLink.`;

                const templateSid = 'HX878dcd19ec5a3f0a439395330923ec8d';
                const templateVariables = {
                    '1': businessName,
                    '2': catLabel,
                    '3': contactName,
                    '4': phone,
                    '5': email,
                    '6': address || 'No especificada',
                    '7': `https://www.citalink.app/${slug}`,
                    '8': 'Registro Online (Landing Page)',
                    '9': `${trialDays} días (Vence el ${dateStr})`,
                };

                const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
                const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

                void fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${ANON_KEY}`,
                        apikey: ANON_KEY,
                    },
                    body: JSON.stringify({
                        to: globalConfig.superadmin_phone,
                        provider: 'whatsapp',
                        template_sid: templateSid,
                        template_variables: templateVariables,
                        message: messageText,
                    }),
                });
            }
        } catch (alertErr) {
            console.warn('Error enviando alerta de auto-registro a superadmin:', alertErr);
        }

        return {
            success: true,
            tenantId,
            slug: fnData.slug || slug,
        };
    } catch (err: any) {
        console.error('Error general en createSelfServeTenant:', err);
        return {
            success: false,
            error: err?.message || 'Ocurrió un error inesperado al registrar el negocio.',
        };
    }
}
