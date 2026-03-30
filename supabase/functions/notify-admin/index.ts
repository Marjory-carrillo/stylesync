// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WA_FROM     = Deno.env.get('TWILIO_WA_FROM') ?? 'whatsapp:+14155238886';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeToWA(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('521') && digits.length === 13) return `whatsapp:+${digits}`;
    if (digits.startsWith('52') && digits.length === 12) return `whatsapp:+521${digits.slice(2)}`;
    return `whatsapp:+521${digits.slice(-10)}`;
}

async function sendWA(to: string, body: string): Promise<boolean> {
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const form = new URLSearchParams({ To: to, From: TWILIO_WA_FROM, Body: body });
    const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        { method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() }
    );
    const data = await res.json();
    console.log('[notify-admin] Twilio:', res.status, data.sid ?? data.message);
    return res.ok;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const { tenant_id, event_type, appointment } = await req.json();
        // event_type: 'new' | 'reschedule' | 'cancel'

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Get barber's phone from tenants table
        const { data: tenant } = await supabase
            .from('tenants')
            .select('name, phone, sms_provider')
            .eq('id', tenant_id)
            .single();

        if (!tenant?.phone) {
            console.warn('[notify-admin] No phone configured for tenant');
            return new Response(JSON.stringify({ success: false, error: 'No phone' }), { headers: corsHeaders });
        }

        if (tenant.sms_provider !== 'whatsapp') {
            console.log('[notify-admin] WA not enabled (provider:', tenant.sms_provider, ')');
            return new Response(JSON.stringify({ success: false, reason: 'whatsapp not enabled' }), { headers: corsHeaders });
        }

        const adminWA = normalizeToWA(tenant.phone);

        // Build message based on event type
        const icons: Record<string, string> = { new: '🆕', reschedule: '🔄', cancel: '❌' };
        const labels: Record<string, string> = { new: 'NUEVA CITA', reschedule: 'CITA REPROGRAMADA', cancel: 'CITA CANCELADA' };

        const icon  = icons[event_type]  ?? '📅';
        const label = labels[event_type] ?? 'EVENTO DE CITA';

        const msg = `${icon} *${label}* — ${tenant.name}
👤 *${appointment.client_name}*
✂️ ${appointment.service_name ?? 'Servicio'}
📆 ${appointment.date} · ${appointment.time}
📱 ${appointment.client_phone}`;

        const sent = await sendWA(adminWA, msg);
        return new Response(JSON.stringify({ success: sent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err: any) {
        console.error('[notify-admin] Error:', err.message);
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
    }
});
