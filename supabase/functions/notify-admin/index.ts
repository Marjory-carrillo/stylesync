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
    console.log('[notify-admin] Twilio response:', res.status, JSON.stringify(data));
    return res.ok;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const payload = await req.json();
        const { tenant_id, event_type, appointment } = payload;
        // Optional: admin_phone and business_name can be passed directly from frontend
        const directPhone = payload.admin_phone as string | undefined;
        const directName  = payload.business_name as string | undefined;

        console.log('[notify-admin] received tenant_id:', tenant_id, '| event:', event_type, '| direct_phone:', directPhone);

        let adminPhone = directPhone;
        let businessName = directName ?? 'CitaLink';

        // Only query DB if phone wasn't passed directly
        if (!adminPhone) {
            const supabase = createClient(
                Deno.env.get('SUPABASE_URL')!,
                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
            );

            const { data: tenant, error: tenantError } = await supabase
                .from('tenants')
                .select('name, phone, sms_provider')
                .eq('id', tenant_id)
                .single();

            console.log('[notify-admin] tenant lookup:', JSON.stringify(tenant), '| error:', tenantError?.message);

            if (!tenant?.phone) {
                console.warn('[notify-admin] No phone on tenant, tenant_id was:', tenant_id);
                return new Response(JSON.stringify({ success: false, error: 'No phone' }), { headers: corsHeaders });
            }

            if (tenant.sms_provider !== 'whatsapp') {
                console.log('[notify-admin] sms_provider is not whatsapp:', tenant.sms_provider);
                return new Response(JSON.stringify({ success: false, reason: 'whatsapp not enabled' }), { headers: corsHeaders });
            }

            adminPhone   = tenant.phone;
            businessName = tenant.name;
        }

        const adminWA = normalizeToWA(adminPhone);
        console.log('[notify-admin] sending to WA:', adminWA);

        const icons:  Record<string, string> = { new: '🆕', reschedule: '🔄', cancel: '❌' };
        const labels: Record<string, string> = { new: 'NUEVA CITA', reschedule: 'CITA REPROGRAMADA', cancel: 'CITA CANCELADA' };

        const icon  = icons[event_type]  ?? '📅';
        const label = labels[event_type] ?? 'EVENTO DE CITA';

        const msg = `${icon} *${label}* — ${businessName}
👤 *${appointment.client_name}*
✂️ ${appointment.service_name ?? 'Servicio'}
📆 ${appointment.date} · ${appointment.time}
📱 ${appointment.client_phone}`;

        const sent = await sendWA(adminWA, msg);
        return new Response(JSON.stringify({ success: sent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err: any) {
        console.error('[notify-admin] Fatal error:', err.message);
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
    }
});
