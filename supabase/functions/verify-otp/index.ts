// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const TWILIO_ACCOUNT_SID    = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN     = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_FROM_WA        = Deno.env.get('TWILIO_WA_FROM') ?? '';          // whatsapp:+15706349708
const TWILIO_FROM_SMS       = TWILIO_FROM_WA.replace('whatsapp:', '');        // +15706349708
const TWILIO_WA_TEMPLATE    = Deno.env.get('TWILIO_WA_TEMPLATE_SID') ?? ''; // HXxxxxxx — cuando esté aprobado

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeE164(phone: string): string {
    let digits = phone.replace(/\D/g, '');

    // Strip leading 521XXXXXXXXXX → +52XXXXXXXXXX (13 digits with mobile prefix)
    if (digits.startsWith('521') && digits.length === 13) return `+52${digits.slice(3)}`;
    // Already 52XXXXXXXXXX (12 digits)
    if (digits.startsWith('52') && digits.length === 12) return `+${digits}`;
    // Strip leading 0 if user typed 0XXXXXXXXX (common mistake in MX)
    if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
    // Return last 10 digits with +52 prefix
    return `+52${digits.slice(-10)}`;
}

// WhatsApp Mexico requires +521XXXXXXXXXX (13 digits with mobile prefix 1)
function toWaNumber(e164: string): string {
    if (e164.startsWith('+52') && !e164.startsWith('+521') && e164.length === 12) {
        return `+521${e164.slice(3)}`; // +52XXXXXXXXXX → +521XXXXXXXXXX
    }
    return e164; // already correct or non-MX
}

function generateCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Helper: Supabase REST request with service role
async function sbRest(path: string, method: string, body?: unknown) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers: {
            'apikey':        SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type':  'application/json',
            'Prefer':        method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=representation',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : null };
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { action, phone, code, businessName = 'CitaLink' } = await req.json();
        const e164 = normalizeE164(phone);

        console.log(`[verify-otp] action=${action} phone=${e164}`);
        console.log(`[verify-otp] SUPABASE_URL=${SUPABASE_URL?.slice(0,30)} KEY=${SUPABASE_KEY?.slice(0,10)}`);

        // ── ENVIAR código ─────────────────────────────────────────────────────
        if (action === 'send') {
            const otp       = generateCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

            // Upsert en otp_codes via REST
            const db = await sbRest('otp_codes?on_conflict=phone', 'POST', {
                phone: e164, code: otp, expires_at: expiresAt, attempts: 0,
            });
            console.log('[verify-otp] DB upsert:', db.status, JSON.stringify(db.body));

            if (!db.ok && db.status !== 409) {
                return new Response(
                    JSON.stringify({ success: false, error: `DB error: ${JSON.stringify(db.body)}` }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Enviar via WhatsApp Template (si está disponible) o SMS como respaldo
            const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
            const msgUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

            let msgBody: Record<string, string>;
            if (TWILIO_WA_TEMPLATE) {
                // ── WhatsApp Template: citalink_cliente_v ──────────────────
                // {{1}} = businessName, {{2}} = código OTP
                msgBody = {
                    From:             TWILIO_FROM_WA,
                    To:               `whatsapp:${toWaNumber(e164)}`,
                    ContentSid:       TWILIO_WA_TEMPLATE,
                    ContentVariables: JSON.stringify({ '1': businessName, '2': otp }),
                };
                console.log('[verify-otp] Sending WA template to:', toWaNumber(e164));
            } else {
                // ── SMS como respaldo ───────────────────────────────────────
                msgBody = {
                    From: TWILIO_FROM_SMS,
                    To:   e164,
                    Body: `Tu código de verificación es: ${otp}. Válido por 10 minutos.`,
                };
                console.log('[verify-otp] Sending via SMS (no WA template configured)');
            }

            const smsRes = await fetch(msgUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(msgBody).toString(),
            });
            const smsData = await smsRes.json();
            console.log('[verify-otp] Msg send:', smsRes.status, smsData.sid ?? smsData.message);

            if (!smsRes.ok) {
                return new Response(
                    JSON.stringify({ success: false, error: smsData.message }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            return new Response(
                JSON.stringify({ success: true, status: 'pending' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ── VERIFICAR código ──────────────────────────────────────────────────
        if (action === 'check') {
            const db = await sbRest(
                `otp_codes?phone=eq.${encodeURIComponent(e164)}&select=code,expires_at,attempts`,
                'GET'
            );
            console.log('[verify-otp] DB fetch:', db.status, JSON.stringify(db.body));

            const row = Array.isArray(db.body) ? db.body[0] : null;
            if (!row) {
                return new Response(
                    JSON.stringify({ success: true, verified: false }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            if (new Date(row.expires_at) < new Date()) {
                await sbRest(`otp_codes?phone=eq.${encodeURIComponent(e164)}`, 'DELETE');
                return new Response(
                    JSON.stringify({ success: true, verified: false, reason: 'expired' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            const newAttempts = (row.attempts ?? 0) + 1;
            await sbRest(`otp_codes?phone=eq.${encodeURIComponent(e164)}`, 'PATCH', { attempts: newAttempts });

            if (row.code !== code) {
                return new Response(
                    JSON.stringify({ success: true, verified: false }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            await sbRest(`otp_codes?phone=eq.${encodeURIComponent(e164)}`, 'DELETE');
            console.log('[verify-otp] APPROVED for', e164);
            return new Response(
                JSON.stringify({ success: true, verified: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ success: false, error: 'action must be send or check' }),
            { status: 400, headers: corsHeaders }
        );

    } catch (err: any) {
        console.error('[verify-otp] Fatal:', err.message);
        return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: corsHeaders }
        );
    }
});
