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
        const {
            action,
            phone,
            code,
            tenant_id,
            businessName       = 'CitaLink',
            clientName         = 'Cliente',
            serviceName        = 'tu servicio',
            appointmentDateTime = 'próximamente',
        } = await req.json();
        const e164 = normalizeE164(phone);


        console.log(`[verify-otp] action=${action} phone=${e164}`);
        console.log(`[verify-otp] SUPABASE_URL=${SUPABASE_URL?.slice(0,30)} KEY=${SUPABASE_KEY?.slice(0,10)}`);

        // ── ENVIAR código ─────────────────────────────────────────────────────
        if (action === 'send') {
            // Verificar credenciales de Twilio
            if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_WA) {
                return new Response(
                    JSON.stringify({ success: false, error: `Credenciales Twilio faltantes: SID=${!!TWILIO_ACCOUNT_SID} TOKEN=${!!TWILIO_AUTH_TOKEN} FROM=${!!TWILIO_FROM_WA}` }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

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

            const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
            const msgUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
            const waTo   = `whatsapp:${toWaNumber(e164)}`;

            // ── Plantilla Utility: confirmación + OTP en un solo mensaje ──────────
            // citalink_cliente_confirmacion_v2 (Approved, Utility)
            // {{1}}=cliente {{2}}=negocio {{3}}=fecha/hora {{4}}=servicio {{5}}=código
            const CONFIRM_OTP_SID = 'HXc86774c877ad719610460e035b8c7fd3';

            const templateRes = await fetch(msgUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    From:             TWILIO_FROM_WA,
                    To:               waTo,
                    ContentSid:       CONFIRM_OTP_SID,
                    ContentVariables: JSON.stringify({
                        '1': clientName         || 'Cliente',
                        '2': businessName       || 'CitaLink',
                        '3': appointmentDateTime || 'próximamente',
                        '4': serviceName        || 'tu servicio',
                        '5': otp,               // ← el código OTP
                    }),
                }).toString(),
            });
            const templateData = await templateRes.json();
            console.log('[verify-otp] Template send:', templateRes.status, templateData.sid ?? templateData.message);

            if (!templateRes.ok) {
                // Error 63024: el número no tiene WhatsApp registrado
                const twilioCode = templateData.code ?? templateData.error_code;
                const isInvalidRecipient = twilioCode === 63024 || String(twilioCode) === '63024';
                const errorMsg = isInvalidRecipient
                    ? 'Este número no tiene WhatsApp. Por favor verifica que sea el número correcto de WhatsApp y vuelve a intentarlo.'
                    : (templateData.message ?? 'Error al enviar el mensaje de WhatsApp.');
                return new Response(
                    JSON.stringify({ success: false, error: errorMsg, code: twilioCode }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            // Log the OTP/confirmation message
            if (tenant_id) {
                const logRes = await fetch(`${SUPABASE_URL}/rest/v1/sms_logs`, {
                    method: 'POST',
                    headers: {
                        'apikey':        SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type':  'application/json',
                        'Prefer':        'return=minimal',
                    },
                    body: JSON.stringify({
                        tenant_id,
                        phone: e164,
                        message_type: 'client_otp',
                        provider: 'whatsapp',
                        status: 'sent',
                    }),
                });
                console.log('[verify-otp] sms_logs insert:', logRes.status);
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
        console.error('[verify-otp] Fatal:', err?.message ?? String(err));
        // Retornamos 200 para que el SDK de Supabase no genere un error genérico
        // y el frontend pueda leer el mensaje de error real
        return new Response(
            JSON.stringify({ success: false, error: `Error interno: ${err?.message ?? String(err)}` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
