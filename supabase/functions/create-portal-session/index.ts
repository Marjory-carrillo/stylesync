// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { tenant_id, return_url } = await req.json();

        if (!tenant_id) {
            return new Response(
                JSON.stringify({ error: 'Missing tenant_id' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Look up the Stripe customer ID from our database
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('APP_SERVICE_KEY')!
        );

        const { data: tenant, error: dbError } = await supabase
            .from('tenants')
            .select('stripe_customer_id, name')
            .eq('id', tenant_id)
            .single();

        if (dbError || !tenant) {
            console.error('[create-portal] DB error:', dbError?.message);
            return new Response(
                JSON.stringify({ error: 'Negocio no encontrado' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!tenant.stripe_customer_id) {
            return new Response(
                JSON.stringify({ error: 'No tienes una suscripción activa. Primero actualiza tu plan.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Create Stripe Billing Portal session
        const params = new URLSearchParams({
            'customer': tenant.stripe_customer_id,
            'return_url': return_url || 'https://www.citalink.app/admin/settings',
        });

        const stripeRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const session = await stripeRes.json();

        if (!stripeRes.ok) {
            console.error('[create-portal] Stripe error:', JSON.stringify(session));
            return new Response(
                JSON.stringify({ error: session.error?.message || 'Error creando sesión del portal' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('[create-portal] Portal session created for tenant:', tenant_id, 'customer:', tenant.stripe_customer_id);

        return new Response(
            JSON.stringify({ url: session.url }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('[create-portal] Fatal:', err.message);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: corsHeaders }
        );
    }
});
