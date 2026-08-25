// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STANDARD_SCHEDULE = {
    monday: { open: true, start: '09:00', end: '18:00' },
    tuesday: { open: true, start: '09:00', end: '18:00' },
    wednesday: { open: true, start: '09:00', end: '18:00' },
    thursday: { open: true, start: '09:00', end: '18:00' },
    friday: { open: true, start: '09:00', end: '18:00' },
    saturday: { open: true, start: '10:00', end: '15:00' },
    sunday: { open: false, start: '09:00', end: '14:00' },
};

const DEFAULT_NAIL_CONFIG = [
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

const CATEGORY_SERVICES = {
    nail_bar: [
        { name: 'Manicura', price: 180, duration: 60, image: '', is_addon: false, enable_quoter: false },
        { name: 'Uñas Acrílicas (1 tono liso)', price: 300, duration: 120, image: '', is_addon: false, enable_quoter: true, description: '(Un tono liso)' },
        { name: 'Uñas Poligel', price: 250, duration: 75, image: '', is_addon: false, enable_quoter: false },
        { name: 'Gel Semipermanente', price: 200, duration: 45, image: '', is_addon: false, enable_quoter: false },
        { name: 'Facial Express', price: 250, duration: 15, image: '', is_addon: true, enable_quoter: false },
    ],
    nails: [
        { name: 'Manicura', price: 180, duration: 60, image: '', is_addon: false, enable_quoter: false },
        { name: 'Uñas Acrílicas (1 tono liso)', price: 300, duration: 120, image: '', is_addon: false, enable_quoter: true, description: '(Un tono liso)' },
        { name: 'Uñas Poligel', price: 250, duration: 75, image: '', is_addon: false, enable_quoter: false },
        { name: 'Gel Semipermanente', price: 200, duration: 45, image: '', is_addon: false, enable_quoter: false },
        { name: 'Facial Express', price: 250, duration: 15, image: '', is_addon: true, enable_quoter: false },
    ],
    barbershop: [
        { name: 'Corte Clásico', price: 180, duration: 30, image: '', is_addon: false, enable_quoter: false },
        { name: 'Corte + Barba (Ritual)', price: 280, duration: 50, image: '', is_addon: false, enable_quoter: false },
        { name: 'Arreglo de Barba & Toalla Caliente', price: 150, duration: 25, image: '', is_addon: false, enable_quoter: false },
        { name: 'Corte Niño', price: 140, duration: 30, image: '', is_addon: false, enable_quoter: false },
        { name: 'Exfoliación & Mascarilla Black', price: 120, duration: 20, image: '', is_addon: true, enable_quoter: false },
    ],
    beauty_salon: [
        { name: 'Corte Dama & Peinado', price: 250, duration: 45, image: '', is_addon: false, enable_quoter: false },
        { name: 'Tinte Completo', price: 650, duration: 120, image: '', is_addon: false, enable_quoter: false },
        { name: 'Balayage / Efectos de Color', price: 1200, duration: 180, image: '', is_addon: false, enable_quoter: false },
        { name: 'Peinado Evento / Alaciado', price: 350, duration: 60, image: '', is_addon: false, enable_quoter: false },
        { name: 'Tratamiento Capilar Profundo', price: 300, duration: 30, image: '', is_addon: true, enable_quoter: false },
    ],
    lashes: [
        { name: 'Pestañas Clásicas 1x1', price: 380, duration: 90, image: '', is_addon: false, enable_quoter: false },
        { name: 'Pestañas Volumen Híbrido / Ruso', price: 480, duration: 120, image: '', is_addon: false, enable_quoter: false },
        { name: 'Lifting de Pestañas', price: 300, duration: 60, image: '', is_addon: false, enable_quoter: false },
        { name: 'Diseño de Cejas & Laminado', price: 250, duration: 40, image: '', is_addon: false, enable_quoter: false },
    ],
    spa: [
        { name: 'Masaje Relajante Completo', price: 550, duration: 60, image: '', is_addon: false, enable_quoter: false },
        { name: 'Limpieza Facial Profunda', price: 450, duration: 50, image: '', is_addon: false, enable_quoter: false },
        { name: 'Masaje Descontracturante', price: 650, duration: 60, image: '', is_addon: false, enable_quoter: false },
        { name: 'Exfoliación Corporal', price: 350, duration: 30, image: '', is_addon: true, enable_quoter: false },
    ]
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const body = await req.json();

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('APP_SERVICE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

        // Admin client (for user creation & table seeding with full service_role)
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
        // Regular client (for sending magic link emails)
        const supabaseClient = createClient(supabaseUrl, anonKey);

        // ── ACCIÓN: Eliminar Tenant y su Usuario de Authentication ─────────────
        if (body.action === 'delete_tenant') {
            const { tenant_id } = body;
            if (!tenant_id) {
                return new Response(
                    JSON.stringify({ success: false, error: 'tenant_id es requerido.' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            console.log('[create-owner] Deleting tenant and auth users:', tenant_id);

            // 1. Obtener los user_ids asociados al tenant antes de borrar
            const { data: tenant } = await supabaseAdmin.from('tenants').select('owner_id').eq('id', tenant_id).maybeSingle();
            const { data: tenantUsers } = await supabaseAdmin.from('tenant_users').select('user_id, email').eq('tenant_id', tenant_id);

            const userIdsToDelete = new Set<string>();
            if (tenant?.owner_id) userIdsToDelete.add(tenant.owner_id);
            if (tenantUsers) {
                tenantUsers.forEach((tu: any) => {
                    if (tu.user_id) userIdsToDelete.add(tu.user_id);
                });
            }

            // 2. Borrar tablas relacionadas (evita bloqueos de FK)
            await Promise.allSettled([
                supabaseAdmin.from('appointments').delete().eq('tenant_id', tenant_id),
                supabaseAdmin.from('services').delete().eq('tenant_id', tenant_id),
                supabaseAdmin.from('stylists').delete().eq('tenant_id', tenant_id),
                supabaseAdmin.from('schedule_config').delete().eq('tenant_id', tenant_id),
                supabaseAdmin.from('tenant_users').delete().eq('tenant_id', tenant_id),
                supabaseAdmin.from('sms_logs').delete().eq('tenant_id', tenant_id),
                supabaseAdmin.from('announcements').delete().eq('tenant_id', tenant_id),
                supabaseAdmin.from('blocked_slots').delete().eq('tenant_id', tenant_id),
                supabaseAdmin.from('blocked_phones').delete().eq('tenant_id', tenant_id),
                supabaseAdmin.from('nail_calculator_config').delete().eq('tenant_id', tenant_id),
                supabaseAdmin.from('reviews').delete().eq('tenant_id', tenant_id),
                supabaseAdmin.from('waiting_list').delete().eq('tenant_id', tenant_id),
            ]);

            // 3. Borrar el registro del tenant
            const { error: delTenantErr } = await supabaseAdmin.from('tenants').delete().eq('id', tenant_id);
            if (delTenantErr) {
                console.error('[create-owner] Error deleting tenant row:', delTenantErr);
            }

            // 4. Borrar de auth.users si no es SuperAdmin
            for (const uId of userIdsToDelete) {
                try {
                    const { data: uInfo } = await supabaseAdmin.auth.admin.getUserById(uId);
                    const email = uInfo?.user?.email?.toLowerCase() || '';
                    if (email && email !== 'citalink.soporte@gmail.com' && !email.includes('superadmin')) {
                        await supabaseAdmin.auth.admin.deleteUser(uId);
                        console.log('[create-owner] Deleted user from auth.users:', uId, email);
                    }
                } catch (delUserErr) {
                    console.warn('[create-owner] Could not delete user from auth:', uId, delUserErr);
                }
            }

            return new Response(
                JSON.stringify({ success: true, message: 'Negocio y usuario de autenticación eliminados con éxito.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const {
            email, password, businessName, businessSlug, lookupOnly,
            createTenant = true, category = 'nail_bar', contactName,
            address = '', phone = '', countryCode = 'MX', currency = 'MXN',
            currencySymbol = '$', defaultPhonePrefix = '+52'
        } = body;

        if (!email) {
            return new Response(
                JSON.stringify({ success: false, error: 'Email es requerido.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // lookupOnly = solo buscar el userId sin cambiar contraseña (usado por relinkOwner)
        if (!lookupOnly && (!password || password.length < 6)) {
            return new Response(
                JSON.stringify({ success: false, error: 'La contraseña debe tener al menos 6 caracteres.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const siteUrl = (Deno.env.get('SITE_URL') || Deno.env.get('VITE_SITE_URL') || 'https://www.citalink.app').replace(/\/$/, '');
        const redirectTo = `${siteUrl}/login?email=${encodeURIComponent(email)}&pw=${encodeURIComponent(password)}`;

        // 1. Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        let userId = existingUsers?.users?.find((u: any) => u.email?.toLowerCase() === email?.toLowerCase())?.id;
        let isExisting = !!userId;

        if (isExisting) {
            if (lookupOnly) {
                console.log('[create-owner] lookupOnly → devolviendo userId sin cambiar contraseña:', email);
                return new Response(
                    JSON.stringify({ success: true, userId, isExisting: true }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Actualizar contraseña del usuario existente
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                userId,
                { password, email_confirm: true }
            );
            if (updateError) throw updateError;
        } else {
            // Crear nuevo usuario en auth.users
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    business_name: businessName || '',
                    business_slug: businessSlug || '',
                },
            });

            if (createError) {
                console.error('[create-owner] createUser error:', createError.message);
                return new Response(
                    JSON.stringify({ success: false, error: createError.message }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            userId = newUser.user.id;
            console.log(`[create-owner] ✅ Created ${email} → ${userId}`);
        }

        // 2. Si se solicita crear el negocio y datos de seeding (createTenant === true)
        let tenantId = null;
        if (createTenant && businessName && businessSlug) {
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 30);

            // Verificar si el slug ya existe, si existe agregar sufijo
            let finalSlug = businessSlug.toLowerCase().trim();
            const { data: existingTenant } = await supabaseAdmin
                .from('tenants')
                .select('id')
                .eq('slug', finalSlug)
                .maybeSingle();

            if (existingTenant) {
                finalSlug = `${finalSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
            }

            // Insertar Tenant con serviceRoleKey
            const { data: newTenant, error: tenantErr } = await supabaseAdmin
                .from('tenants')
                .insert([{
                    name: businessName.trim(),
                    slug: finalSlug,
                    category: category || 'nail_bar',
                    address: address || '',
                    phone: phone || '',
                    owner_id: userId,
                    timezone: 'America/Mexico_City',
                    sms_provider: 'whatsapp',
                    plan: 'pro',
                    trial_ends_at: trialEndDate.toISOString(),
                    country_code: countryCode || 'MX',
                    currency: currency || 'MXN',
                    currency_symbol: currencySymbol || '$',
                    default_phone_prefix: defaultPhonePrefix || '+52',
                }])
                .select()
                .single();

            if (tenantErr) {
                console.error('[create-owner] tenant insert error:', tenantErr);
                return new Response(
                    JSON.stringify({ success: false, error: `Error creando negocio: ${tenantErr.message}` }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            } else if (newTenant) {
                tenantId = newTenant.id;

                // Insertar tenant_users
                const { error: tuErr } = await supabaseAdmin.from('tenant_users').insert({
                    tenant_id: tenantId,
                    user_id: userId,
                    email: email.trim().toLowerCase(),
                    role: 'owner',
                });
                if (tuErr) console.error('[create-owner] tenant_users error:', tuErr);

                // Insertar schedule_config
                const { error: scErr } = await supabaseAdmin.from('schedule_config').insert({
                    tenant_id: tenantId,
                    schedule: STANDARD_SCHEDULE,
                });
                if (scErr) console.error('[create-owner] schedule_config error:', scErr);

                // Insertar estilista #1
                const { error: stErr } = await supabaseAdmin.from('stylists').insert({
                    tenant_id: tenantId,
                    name: contactName ? contactName.trim() : 'Especialista Principal',
                    role: category === 'nail_bar' || category === 'nails' ? 'Master Nail Artist' : 'Especialista Principal',
                    phone: phone || '',
                    active: true,
                });
                if (stErr) console.error('[create-owner] stylists error:', stErr);

                // Insertar servicios pre-cargados
                try {
                    const templateServices = CATEGORY_SERVICES[category] || CATEGORY_SERVICES['nail_bar'];
                    const servicesPayload = templateServices.map((s: any) => ({
                        tenant_id: tenantId,
                        name: s.name,
                        price: s.price,
                        duration: s.duration,
                        image: s.image || '',
                        is_addon: s.is_addon || false,
                        enable_quoter: s.enable_quoter || false,
                        description: s.description || null,
                    }));
                    const { error: srvErr } = await supabaseAdmin.from('services').insert(servicesPayload);
                    if (srvErr) console.error('[create-owner] services error:', srvErr);
                } catch (sErr) {
                    console.error('[create-owner] services exception:', sErr);
                }

                // Cotizador de Uñas (si la tabla existe)
                if (category === 'nail_bar' || category === 'nails') {
                    try {
                        await supabaseAdmin.from('nail_calculator_config').insert({
                            tenant_id: tenantId,
                            config: DEFAULT_NAIL_CONFIG,
                        });
                    } catch (ncErr) {
                        console.warn('[create-owner] nail_calculator_config:', ncErr);
                    }
                }
            }
        }

        // 3. Enviar magic link email opcional de bienvenida
        try {
            await supabaseClient.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: false,
                    emailRedirectTo: redirectTo,
                },
            });
        } catch (otpErr) {
            console.warn('[create-owner] signInWithOtp:', otpErr);
        }

        return new Response(
            JSON.stringify({
                success: true,
                userId,
                tenantId,
                slug: businessSlug,
                isExisting
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('[create-owner] Error:', err.message);
        return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
