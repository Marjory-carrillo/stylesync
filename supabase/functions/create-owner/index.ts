// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { email, password, businessName, businessSlug } = await req.json();

        if (!email || !password) {
            return new Response(
                JSON.stringify({ success: false, error: 'Email y contraseña son requeridos.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (password.length < 6) {
            return new Response(
                JSON.stringify({ success: false, error: 'La contraseña debe tener al menos 6 caracteres.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // SITE_URL must be set as an Edge Function secret in Supabase Dashboard
        // Dashboard → Edge Functions → Secrets → SITE_URL = https://cita-link.vercel.app
        const siteUrl = (Deno.env.get('SITE_URL') || Deno.env.get('VITE_SITE_URL') || 'https://cita-link.vercel.app').replace(/\/$/, '');

        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find((u: any) => u.email === email);

        if (existingUser) {
            // User exists — update their password and send a magic link with credentials
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                existingUser.id,
                { password, email_confirm: true }
            );
            if (updateError) throw updateError;

            // Generate magic link — Supabase SMTP sends this email
            const redirectTo = `${siteUrl}/login?email=${encodeURIComponent(email)}&pw=${encodeURIComponent(password)}`;
            await supabaseAdmin.auth.admin.generateLink({
                type: 'magiclink',
                email,
                options: { redirectTo },
            }).catch(e => console.warn('[create-owner] generateLink warn (existing):', e.message));

            return new Response(
                JSON.stringify({ success: true, userId: existingUser.id, isExisting: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ── NEW USER ─────────────────────────────────────────────────────────
        // Crear usuario directamente con email confirmado y contraseña lista.
        // Esto evita el estado "invited" que impide el login con contraseña.
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,          // El usuario puede hacer login de inmediato
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

        console.log(`[create-owner] ✅ Created ${email} → ${newUser.user.id}`);

        // Enviar magic link de bienvenida para que el dueño tenga acceso rápido
        // El redirectTo lleva email y contraseña como params para que el login los prefille
        const redirectTo = `${siteUrl}/login?email=${encodeURIComponent(email)}&pw=${encodeURIComponent(password)}`;
        await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email,
            options: { redirectTo },
        }).then(({ data: linkData, error: linkError }) => {
            if (linkError) {
                console.warn('[create-owner] generateLink warn:', linkError.message);
            } else {
                console.log('[create-owner] Magic link generated for:', email);
                // Nota: generateLink con email_confirm=true envía el email automáticamente vía SMTP de Supabase
            }
        }).catch(e => console.warn('[create-owner] generateLink exception:', e.message));

        return new Response(
            JSON.stringify({ success: true, userId: newUser.user.id, isExisting: false }),
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
