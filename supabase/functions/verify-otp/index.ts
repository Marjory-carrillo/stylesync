// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_VERIFY_SID  = Deno.env.get('TWILIO_VERIFY_SID')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeE164(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('521') && digits.length === 13) return `+${digits}`;
    if (digits.startsWith('52')  && digits.length === 12) return `+521${digits.slice(2)}`;
    return `+521${digits.slice(-10)}`;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { action, phone, code } = await req.json();
        const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
        const e164 = normalizeE164(phone);

        // ── ENVIAR código ─────────────────────────────────────────────────────
        if (action === 'send') {
            const res = await fetch(
                `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SID}/Verifications`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        To:      e164,
                        Channel: 'sms',
                        Locale:  'es',
                    }).toString(),
                }
            );
            const data = await res.json();
            console.log('[verify-otp] send:', res.status, data.status ?? data.message);

            if (!res.ok) {
                return new Response(
                    JSON.stringify({ success: false, error: data.message }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }
            return new Response(
                JSON.stringify({ success: true, status: data.status }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // ── VERIFICAR código ──────────────────────────────────────────────────
        if (action === 'check') {
            const res = await fetch(
                `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SID}/VerificationChecks`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        To:   e164,
                        Code: code,
                    }).toString(),
                }
            );
            const data = await res.json();
            console.log('[verify-otp] check:', res.status, JSON.stringify(data));

            const verified = data.status === 'approved';
            return new Response(
                JSON.stringify({ success: true, verified, raw: data.status }),
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
