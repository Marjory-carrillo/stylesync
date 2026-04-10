// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

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

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

        // Admin client (for user creation)
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

        // Regular client (for sending magic link emails — signInWithOtp actually sends the email)
        const supabaseClient = createClient(supabaseUrl, anonKey);

        const siteUrl = (Deno.env.get('SITE_URL') || Deno.env.get('VITE_SITE_URL') || 'https://www.citalink.app').replace(/\/$/, '');
        const redirectTo = `${siteUrl}/login?email=${encodeURIComponent(email)}&pw=${encodeURIComponent(password)}`;

        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find((u: any) => u.email === email);

        if (existingUser) {
            // User exists — update their password
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                existingUser.id,
                { password, email_confirm: true }
            );
            if (updateError) throw updateError;

            // Send magic link email (signInWithOtp ACTUALLY sends the email via Supabase SMTP)
            const { error: otpError } = await supabaseClient.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: false,
                    emailRedirectTo: redirectTo,
                },
            });

            if (otpError) {
                console.warn('[create-owner] signInWithOtp error (existing):', otpError.message);
            } else {
                console.log('[create-owner] ✅ Magic link email sent to existing user:', email);
            }

            return new Response(
                JSON.stringify({ success: true, userId: existingUser.id, isExisting: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ── NEW USER ─────────────────────────────────────────────────────────
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

        console.log(`[create-owner] ✅ Created ${email} → ${newUser.user.id}`);

        // Send magic link email to the new user
        // signInWithOtp uses Supabase's built-in SMTP and ACTUALLY delivers the email
        const { error: otpError } = await supabaseClient.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: false,  // user already exists
                emailRedirectTo: redirectTo,
            },
        });

        if (otpError) {
            console.warn('[create-owner] signInWithOtp error (new):', otpError.message);
        } else {
            console.log('[create-owner] ✅ Magic link email sent to new user:', email);
        }

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
