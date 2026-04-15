// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_PRICE_PRO  = Deno.env.get('STRIPE_PRICE_PRO')!;
const STRIPE_PRICE_BUSINESS = Deno.env.get('STRIPE_PRICE_BUSINESS')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { plan, tenant_id, user_email, success_url, cancel_url } = await req.json();

        if (!plan || !tenant_id) {
            return new Response(
                JSON.stringify({ error: 'Missing plan or tenant_id' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const priceId = plan === 'pro' ? STRIPE_PRICE_PRO
                      : plan === 'business' ? STRIPE_PRICE_BUSINESS
                      : null;

        if (!priceId) {
            return new Response(
                JSON.stringify({ error: `Invalid plan: ${plan}` }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Create Stripe Checkout Session via API (no SDK needed in Deno)
        const params = new URLSearchParams({
            'mode': 'subscription',
            'payment_method_types[0]': 'card',
            'line_items[0][price]': priceId,
            'line_items[0][quantity]': '1',
            'success_url': success_url || `https://www.citalink.app/admin/dashboard?checkout=success&plan=${plan}`,
            'cancel_url': cancel_url || `https://www.citalink.app/admin/dashboard?checkout=cancel`,
            'client_reference_id': tenant_id,
            'metadata[tenant_id]': tenant_id,
            'metadata[plan]': plan,
            'subscription_data[metadata][tenant_id]': tenant_id,
            'subscription_data[metadata][plan]': plan,
            'allow_promotion_codes': 'true',
        });

        if (user_email) {
            params.set('customer_email', user_email);
        }

        // No Stripe trial — we handle trial internally in our own DB

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const session = await stripeRes.json();

        if (!stripeRes.ok) {
            console.error('[create-checkout] Stripe error:', JSON.stringify(session));
            return new Response(
                JSON.stringify({ error: session.error?.message || 'Stripe error' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log('[create-checkout] Session created:', session.id, 'for tenant:', tenant_id, 'plan:', plan);

        return new Response(
            JSON.stringify({ url: session.url, session_id: session.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('[create-checkout] Fatal:', err.message);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: corsHeaders }
        );
    }
});
