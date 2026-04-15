// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const STRIPE_SECRET_KEY    = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const PRICE_EXTRA_EMPLOYEE  = Deno.env.get('STRIPE_PRICE_EXTRA_EMPLOYEE') || '';
const PRICE_EXTRA_BRANCH    = Deno.env.get('STRIPE_PRICE_EXTRA_BRANCH') || '';

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
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}?expand[]=items.data.price`, {
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
    });
    return res.json();
}

// ── Extract add-on quantities from subscription items ──
function extractAddons(subscription: any): { extraEmployees: number; extraBranches: number } {
    let extraEmployees = 0;
    let extraBranches = 0;

    const items = subscription?.items?.data || [];
    for (const item of items) {
        const priceId = item.price?.id || item.plan?.id || '';
        const qty = item.quantity || 0;

        if (priceId === PRICE_EXTRA_EMPLOYEE) {
            extraEmployees = qty;
        } else if (priceId === PRICE_EXTRA_BRANCH) {
            extraBranches = qty;
        }
    }

    console.log(`[stripe-webhook] Add-ons detected: employees=${extraEmployees}, branches=${extraBranches}`);
    return { extraEmployees, extraBranches };
}

// ── Sync plan across all branches with the same brand_slug ──
async function syncBrandSiblings(supabase: any, tenantId: string, updateData: Record<string, any>) {
    try {
        // Get the brand_slug of the updated tenant
        const { data: tenant } = await supabase
            .from('tenants')
            .select('brand_slug')
            .eq('id', tenantId)
            .single();

        if (!tenant?.brand_slug) return; // No brand = single location, nothing to sync

        // Update ALL tenants with the same brand_slug
        const { data: updated, error } = await supabase
            .from('tenants')
            .update(updateData)
            .eq('brand_slug', tenant.brand_slug)
            .neq('id', tenantId) // Don't re-update the one we already changed
            .select('id, slug');

        if (error) {
            console.error('[stripe-webhook] Brand sync error:', error.message);
        } else if (updated?.length > 0) {
            console.log(`[stripe-webhook] 🔄 Synced ${updated.length} sibling(s):`, updated.map((t: any) => t.slug), JSON.stringify(updateData));
        }
    } catch (e: any) {
        console.error('[stripe-webhook] Brand sync exception:', e.message);
    }
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

        // Verify Stripe signature (REQUIRED in production)
        const isValid = await verifyStripeSignature(body, sigHeader, STRIPE_WEBHOOK_SECRET);
        if (!isValid) {
            console.error('[stripe-webhook] ❌ Invalid signature');
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        console.log('[stripe-webhook] ✅ Signature verified');

        const event = JSON.parse(body);
        console.log('[stripe-webhook] Event:', event.type, event.id);

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

                // Fetch full subscription to get add-on quantities
                let extraEmployees = 0;
                let extraBranches = 0;
                if (subscriptionId) {
                    const sub = await getSubscription(subscriptionId);
                    const addons = extractAddons(sub);
                    extraEmployees = addons.extraEmployees;
                    extraBranches = addons.extraBranches;
                }

                // Update tenant plan in database
                const updateData: Record<string, any> = {
                    plan: plan,
                    stripe_customer_id: customerId,
                    stripe_subscription_id: subscriptionId,
                    trial_ends_at: null, // Clear trial — they're paying now
                    extra_employees_paid: extraEmployees,
                    extra_branches_paid: extraBranches,
                };

                const { error } = await supabase
                    .from('tenants')
                    .update(updateData)
                    .eq('id', tenantId);

                if (error) {
                    console.error('[stripe-webhook] DB update error:', error.message);
                } else {
                    console.log(`[stripe-webhook] ✅ Tenant ${tenantId} upgraded to ${plan} (extras: emp=${extraEmployees}, branch=${extraBranches})`);
                    // Sync sibling branches
                    await syncBrandSiblings(supabase, tenantId, { plan, extra_employees_paid: extraEmployees, extra_branches_paid: extraBranches });
                }
                break;
            }

            // ═══ SUBSCRIPTION UPDATED (plan change, renewal, add-on change) ═══
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
                    // Extract add-on quantities from subscription items
                    const addons = extractAddons(subscription);

                    const updateData: Record<string, any> = {
                        stripe_subscription_id: subscription.id,
                        extra_employees_paid: addons.extraEmployees,
                        extra_branches_paid: addons.extraBranches,
                    };
                    if (plan) updateData.plan = plan;

                    await supabase.from('tenants').update(updateData).eq('id', tenantId);
                    console.log(`[stripe-webhook] ✅ Tenant ${tenantId} synced (extras: emp=${addons.extraEmployees}, branch=${addons.extraBranches})`);

                    // Sync siblings
                    const syncData: Record<string, any> = {
                        extra_employees_paid: addons.extraEmployees,
                        extra_branches_paid: addons.extraBranches,
                    };
                    if (plan) syncData.plan = plan;
                    await syncBrandSiblings(supabase, tenantId, syncData);

                } else if (status === 'past_due' || status === 'unpaid') {
                    // Payment failed — don't downgrade immediately
                    console.warn(`[stripe-webhook] Subscription ${status} for tenant ${tenantId}`);
                } else if (status === 'canceled') {
                    // Downgrade to free, reset add-ons
                    await supabase.from('tenants').update({
                        plan: 'free',
                        stripe_subscription_id: null,
                        extra_employees_paid: 0,
                        extra_branches_paid: 0,
                    }).eq('id', tenantId);
                    await syncBrandSiblings(supabase, tenantId, { plan: 'free', extra_employees_paid: 0, extra_branches_paid: 0 });
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
                    extra_employees_paid: 0,
                    extra_branches_paid: 0,
                }).eq('id', tenantId);

                await syncBrandSiblings(supabase, tenantId, { plan: 'free', extra_employees_paid: 0, extra_branches_paid: 0 });
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
