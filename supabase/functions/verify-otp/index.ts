// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!;
// Número SMS de Twilio (sin prefijo whatsapp:)
const TWILIO_FROM_SMS    = (Deno.env.get('TWILIO_WA_FROM') ?? '').replace('whatsapp:', '');

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeE164(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('52') && digits.length === 12) return `+${digits}`;
    if (digits.startsWith('521') && digits.length === 13) return `+52${digits.slice(3)}`;
    return `+52${digits.slice(-10)}`;
}

function generateCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { action, phone, code } = await req.json();
        const e164 = normalizeE164(phone);
        const db   = createClient(SUPABASE_URL, SUPABASE_KEY);

        // ── ENVIAR código ─────────────────────────────────────────────────────
        if (action === 'send') {
            const otp       = generateCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

            // Guardar/sobreescribir en la tabla
            const { error: dbErr } = await db.from('otp_codes').upsert(
                { phone: e164, code: otp, expires_at: expiresAt, attempts: 0 },
                { onConflict: 'phone' }
            );
            if (dbErr) {
                console.error('[verify-otp] DB error on upsert:', dbErr.message);
                return new Response(
                    JSON.stringify({ success: false, error: 'Error interno al crear código' }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Enviar SMS con Twilio Messages API
            const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
            const smsRes = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        From: TWILIO_FROM_SMS,
                        To:   e164,
                        Body: `Tu código de verificación es: ${otp}. Válido por 10 minutos.`,
                    }).toString(),
                }
            );
            const smsData = await smsRes.json();
            console.log('[verify-otp] SMS send:', smsRes.status, smsData.sid ?? smsData.message);

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
            const { data: row, error: fetchErr } = await db
                .from('otp_codes')
                .select('code, expires_at, attempts')
                .eq('phone', e164)
                .single();

            if (fetchErr || !row) {
                console.log('[verify-otp] check: no record found for', e164);
                return new Response(
                    JSON.stringify({ success: true, verified: false }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Verificar expiración
            if (new Date(row.expires_at) < new Date()) {
                await db.from('otp_codes').delete().eq('phone', e164);
                console.log('[verify-otp] check: code expired for', e164);
                return new Response(
                    JSON.stringify({ success: true, verified: false, reason: 'expired' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Actualizar intentos
            const newAttempts = (row.attempts ?? 0) + 1;
            await db.from('otp_codes').update({ attempts: newAttempts }).eq('phone', e164);

            if (row.code !== code) {
                console.log('[verify-otp] check: wrong code for', e164, `(attempt ${newAttempts})`);
                return new Response(
                    JSON.stringify({ success: true, verified: false }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // ✅ Código correcto — eliminar registro
            await db.from('otp_codes').delete().eq('phone', e164);
            console.log('[verify-otp] check: APPROVED for', e164);
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
