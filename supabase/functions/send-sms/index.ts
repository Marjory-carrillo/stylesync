// @ts-nocheck — Este archivo corre en Deno (Supabase Edge Functions), no en Node.js
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WA_FROM     = Deno.env.get('TWILIO_WA_FROM') ?? 'whatsapp:+14155238886';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { to, message, tenant_id, provider: requestedProvider } = body;

        console.log('[send-sms] Request:', { to, tenant_id, provider: requestedProvider });

        if (!to || !message) {
            return new Response(
                JSON.stringify({ success: false, error: 'Faltan campos: to, message' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Usar provider del request (enviado por frontend) o 'demo' como fallback
        let provider = requestedProvider ?? 'demo';

        // Si no vino provider pero sí tenant_id, consultamos la BD
        if (!requestedProvider && tenant_id) {
            try {
                const supabase = createClient(
                    Deno.env.get('SUPABASE_URL')!,
                    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
                );
                const { data: tenant } = await supabase
                    .from('tenants')
                    .select('sms_provider')
                    .eq('id', tenant_id)
                    .single();
                if (tenant?.sms_provider) {
                    provider = tenant.sms_provider;
                }
            } catch (e) {
                console.warn('[send-sms] Could not fetch tenant, using demo:', e);
            }
        }

        console.log('[send-sms] Using provider:', provider);

        let messageSid: string | null = null;

        if (provider === 'whatsapp') {
            const digits = to.replace(/\D/g, '');
            // Mexico WhatsApp: numeros moviles se registran como +521XXXXXXXXXX (13 digitos)
            // Si ya tiene 13 digitos empezando en 521, usarlo directo
            // Si tiene 12 digitos empezando en 52, agregar el 1 movil
            // Si tiene 10 digitos (sin codigo pais), agregar +521
            let e164: string;
            if (digits.startsWith('521') && digits.length === 13) {
                e164 = `+${digits}`;           // ya correcto: +5218681239154
            } else if (digits.startsWith('52') && digits.length === 12) {
                e164 = `+521${digits.slice(2)}`; // +528681239154 → +5218681239154
            } else {
                e164 = `+521${digits.slice(-10)}`; // 8681239154 → +5218681239154
            }
            const waTo = `whatsapp:${e164}`;

            console.log('[send-sms] Sending WA to:', waTo);

            const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
            const formData = new URLSearchParams({
                To:   waTo,
                From: TWILIO_WA_FROM,
                Body: message,
            });

            const twilioRes = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData.toString(),
                }
            );

            const twilioData = await twilioRes.json();
            console.log('[send-sms] Twilio status:', twilioRes.status, 'SID:', twilioData.sid, 'Error:', twilioData.message);

            if (!twilioRes.ok) {
                // Log fallo en BD (best effort, no lanzar error si falla)
                if (tenant_id) {
                    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
                    await supabase.from('sms_logs').insert({
                        tenant_id, phone_to: to, provider: 'whatsapp',
                        status: 'failed', error_message: twilioData.message ?? 'Twilio error',
                    }).catch(() => {});
                }
                return new Response(
                    JSON.stringify({ success: false, error: twilioData.message, provider, twilioCode: twilioData.code }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            messageSid = twilioData.sid;
        }

        // Log a BD (best effort)
        if (tenant_id) {
            try {
                const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
                await supabase.from('sms_logs').insert({
                    tenant_id, phone_to: to, provider,
                    status: provider === 'whatsapp' ? 'sent' : 'demo',
                    ...(messageSid && { provider_sid: messageSid }),
                }).catch(() => {});
            } catch (_) {}
        }

        return new Response(
            JSON.stringify({ success: true, provider, sid: messageSid }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('[send-sms] Fatal error:', err.message);
        return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
