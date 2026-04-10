// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const STRIPE_SECRET_KEY    = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// ── Stripe signature verification (HMAC-SHA256) ──
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
    try {
        const parts = sigHeader.split(',').reduce((acc: Record<string, string>, part) => {
            const [key, val] = part.split('=');
            acc[key.trim()] = val;
            return acc;
        }, {} as Record<string, string>);

        const timestamp = parts['t'];
        const signature = parts['v1'];
        if (!timestamp || !signature) return false;

        // Check timestamp is within 5 minutes
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - parseInt(timestamp)) > 300) {
            console.warn('[stripe-webhook] Timestamp too old');
            return false;
        }

        const signedPayload = `${timestamp}.${payload}`;
        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
        const computedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

        return computedSig === signature;
    } catch (e) {
        console.error('[stripe-webhook] Sig verification error:', e);
        return false;
    }
}

// ── Get subscription details from Stripe ──
async function getSubscription(subscriptionId: string) {
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
    });
    return res.json();
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('APP_SERVICE_KEY')!
    );

    try {
        const body = await req.text();
        const sigHeader = req.headers.get('stripe-signature') || '';

        // TODO: Re-enable signature verification for production
        // For now, skip verification during test mode to debug the flow
        console.log('[stripe-webhook] Received event, sig present:', !!sigHeader);

        const event = JSON.parse(body);
        console.log('[stripe-webhook] Event:', event.type, event.id);
        console.log('[stripe-webhook] Event data keys:', Object.keys(event.data?.object || {}));

        // ── Handle events ──
        switch (event.type) {

            // ═══ CHECKOUT COMPLETED — User just paid ═══
            case 'checkout.session.completed': {
                const session = event.data.object;
                const tenantId = session.metadata?.tenant_id || session.client_reference_id;
                const plan = session.metadata?.plan;
                const subscriptionId = session.subscription;
                const customerId = session.customer;

                if (!tenantId || !plan) {
                    console.warn('[stripe-webhook] Missing tenant_id or plan in metadata');
                    break;
                }

                console.log(`[stripe-webhook] Checkout complete: tenant=${tenantId} plan=${plan} sub=${subscriptionId}`);

                // Update tenant plan in database
                const { error } = await supabase
                    .from('tenants')
                    .update({
                        plan: plan,
                        stripe_customer_id: customerId,
                        stripe_subscription_id: subscriptionId,
                        trial_ends_at: null, // Clear trial — they're paying now
                    })
                    .eq('id', tenantId);

                if (error) {
                    console.error('[stripe-webhook] DB update error:', error.message);
                } else {
                    console.log(`[stripe-webhook] ✅ Tenant ${tenantId} upgraded to ${plan}`);
                }
                break;
            }

            // ═══ SUBSCRIPTION UPDATED (plan change, renewal) ═══
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const tenantId = subscription.metadata?.tenant_id;
                const plan = subscription.metadata?.plan;
                const status = subscription.status; // active, past_due, canceled, unpaid

                if (!tenantId) {
                    console.warn('[stripe-webhook] No tenant_id in subscription metadata');
                    break;
                }

                console.log(`[stripe-webhook] Subscription updated: tenant=${tenantId} status=${status} plan=${plan}`);

                if (status === 'active') {
                    // Subscription is active & paid
                    const updateData: Record<string, any> = {
                        stripe_subscription_id: subscription.id,
                    };
                    if (plan) updateData.plan = plan;

                    await supabase.from('tenants').update(updateData).eq('id', tenantId);
                } else if (status === 'past_due' || status === 'unpaid') {
                    // Payment failed — downgrade to free after grace period
                    console.warn(`[stripe-webhook] Subscription ${status} for tenant ${tenantId}`);
                    // Don't downgrade immediately — give them a few days
                } else if (status === 'canceled') {
                    // Downgrade to free
                    await supabase.from('tenants').update({
                        plan: 'free',
                        stripe_subscription_id: null,
                    }).eq('id', tenantId);
                    console.log(`[stripe-webhook] ⬇️ Tenant ${tenantId} downgraded to free (canceled)`);
                }
                break;
            }

            // ═══ SUBSCRIPTION DELETED (canceled and expired) ═══
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const tenantId = subscription.metadata?.tenant_id;

                if (!tenantId) break;

                console.log(`[stripe-webhook] Subscription deleted: tenant=${tenantId}`);

                await supabase.from('tenants').update({
                    plan: 'free',
                    stripe_subscription_id: null,
                }).eq('id', tenantId);

                console.log(`[stripe-webhook] ⬇️ Tenant ${tenantId} downgraded to free (deleted)`);
                break;
            }

            // ═══ INVOICE PAYMENT FAILED ═══
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const subscriptionId = invoice.subscription;

                if (subscriptionId) {
                    const sub = await getSubscription(subscriptionId);
                    const tenantId = sub?.metadata?.tenant_id;
                    if (tenantId) {
                        console.warn(`[stripe-webhook] ⚠️ Payment failed for tenant ${tenantId}`);
                        // Could send a WhatsApp notification here in the future
                    }
                }
                break;
            }

            default:
                console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        console.error('[stripe-webhook] Fatal:', err.message);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: corsHeaders }
        );
    }
});
