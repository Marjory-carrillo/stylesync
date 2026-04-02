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

        const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('VITE_SITE_URL') || 'https://citalink.app';

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
        // Use inviteUserByEmail — this reliably sends an email via Supabase SMTP
        // The redirect URL carries the plaintext password so the login page can prefill/show it
        const redirectTo = `${siteUrl}/login?email=${encodeURIComponent(email)}&pw=${encodeURIComponent(password)}`;

        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            redirectTo,
            data: {
                business_name: businessName || '',
                business_slug: businessSlug || '',
            },
        });

        if (inviteError) {
            // Fallback if invite fails (e.g. user exists but wasn't found)
            console.warn('[create-owner] invite failed, falling back to createUser:', inviteError.message);
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
            });
            if (createError) throw createError;
            console.log(`[create-owner] ✅ Created (fallback) ${email} → ${newUser.user.id}`);
            return new Response(
                JSON.stringify({ success: true, userId: newUser.user.id, isExisting: false }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`[create-owner] ✅ Invited ${email} → ${inviteData.user.id}`);

        // Set the password on the invited user so they can also log in directly
        await supabaseAdmin.auth.admin.updateUserById(inviteData.user.id, {
            password,
            email_confirm: true,
        }).catch(e => console.warn('[create-owner] updateUserById warn:', e.message));

        return new Response(
            JSON.stringify({ success: true, userId: inviteData.user.id, isExisting: false }),
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
