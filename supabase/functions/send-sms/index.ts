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
        const { to, message, tenant_id } = await req.json();

        if (!to || !message || !tenant_id) {
            return new Response(
                JSON.stringify({ success: false, error: 'Faltan campos requeridos: to, message, tenant_id' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Cliente Supabase con service role para saltarse RLS
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Obtener configuración del tenant
        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('sms_provider, name')
            .eq('id', tenant_id)
            .single();

        if (tenantError || !tenant) {
            return new Response(
                JSON.stringify({ success: false, error: 'Tenant no encontrado' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const provider = tenant.sms_provider ?? 'demo';
        let messageSid: string | null = null;
        let status = 'demo';

        if (provider === 'whatsapp') {
            // Normalizar número de teléfono para WhatsApp
            // El teléfono ya viene como +52XXXXXXXXXX desde el frontend
            const digits = to.replace(/\D/g, '');
            const waTo = digits.startsWith('52')
                ? `whatsapp:+${digits}`
                : `whatsapp:+52${digits.slice(-10)}`;

            // Llamar a la API de Twilio
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

            if (!twilioRes.ok) {
                // Registrar intento fallido
                await supabase.from('sms_logs').insert({
                    tenant_id, phone: to, message,
                    provider: 'whatsapp', status: 'failed',
                    error: twilioData.message ?? 'Error de Twilio',
                });

                return new Response(
                    JSON.stringify({ success: false, error: twilioData.message, provider }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            messageSid = twilioData.sid;
            status = 'sent';
        }

        // Registrar en sms_logs
        await supabase.from('sms_logs').insert({
            tenant_id,
            phone: to,
            message,
            provider,
            status,
            twilio_sid: messageSid,
        });

        return new Response(
            JSON.stringify({ success: true, provider, sid: messageSid }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
