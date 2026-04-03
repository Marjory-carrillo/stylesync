// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WA_FROM     = Deno.env.get('TWILIO_WA_FROM') ?? 'whatsapp:+15706349708';

// ── Plantilla aprobada por Meta (Content SID de Twilio) ─────────────────────
// citalink_cliente_recordatorio: {{1}}=cliente {{2}}=negocio {{3}}=fecha/hora {{4}}=servicio
const TEMPLATE_RECORDATORIO = 'HXc99ae2355cd2f306973e448d922dc77f';

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

/** Envía mensaje usando una plantilla aprobada por Meta (ContentSid) */
async function sendTemplate(
    to: string,
    contentSid: string,
    variables: Record<string, string>
): Promise<boolean> {
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const form = new URLSearchParams({
        To: normalizeToWA(to),
        From: TWILIO_WA_FROM,
        ContentSid: contentSid,
        ContentVariables: JSON.stringify(variables),
    });
    const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
            method: 'POST',
            headers: {
                Authorization: `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form.toString(),
        }
    );
    const data = await res.json();
    console.log('[process-reminders] Template WA to', to, '→', res.status, data.sid ?? data.message ?? JSON.stringify(data));
    return res.ok;
}

function formatDateTime(date: string, time: string): string {
    const days   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const d = new Date(`${date}T${time}`);
    return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]} a las ${time.slice(0,5)}`;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    let reminders = 0;

    try {
        // ── RECORDATORIOS: citas confirmadas sin recordatorio enviado ─────────
        // Busca citas con status='confirmada' (único estado de citas activas)
        // que aún no tengan reminder_sent=true y sean futuras
        const { data: pending, error: fetchError } = await supabase
            .from('appointments')
            .select('*, tenants(name, sms_provider, timezone)')
            .eq('status', 'confirmada')
            .eq('reminder_sent', false);

        if (fetchError) {
            console.error('[process-reminders] DB fetch error:', fetchError.message);
            throw fetchError;
        }

        console.log(`[process-reminders] Citas pendientes de recordatorio: ${pending?.length ?? 0}`);

        for (const appt of (pending ?? [])) {
            const tenant = appt.tenants;

            // Solo enviar si el negocio usa WhatsApp
            if (tenant?.sms_provider !== 'whatsapp') continue;
            if (!appt.client_phone) continue;

            const tZone = tenant.timezone || 'America/Mexico_City';

            // Deno ejecuta en UTC. Necesitamos saber qué "Offset" tiene la zona del cliente en este preciso instante de ejecución.
            const offsetParts = new Intl.DateTimeFormat('en-US', {
                timeZone: tZone,
                timeZoneName: 'shortOffset'
            }).formatToParts(now);
            
            const offsetString = offsetParts.find(p => p.type === 'timeZoneName')?.value; // ej: "GMT-6" o "GMT-05:00" o "GMT"
            
            // Re-ensamblar la fecha como un string ISO 8601 absoluto para que JavaScript lo parsee como tiempo real:
            // "2024-04-03T10:00:00-06:00"
            let isoOffset = 'Z';
            if (offsetString && offsetString !== 'GMT') {
                isoOffset = offsetString.replace('GMT', '');
                // JS requiere HH:mm, si viene -6 o -6:00 ajustarlo.
                if (!isoOffset.includes(':')) {
                    isoOffset += ':00'; // de "-6" a "-6:00"
                }
                const sign = isoOffset[0];
                let [h, m] = isoOffset.slice(1).split(':');
                if (h.length === 1) h = '0' + h;
                isoOffset = `${sign}${h}:${m}`;
            }

            const apptDatetime = new Date(`${appt.date}T${appt.time}${isoOffset}`);
            
            const msUntilAppt    = apptDatetime.getTime() - now.getTime();
            const hoursUntilAppt = msUntilAppt / (1000 * 60 * 60);

            // Ignorar citas que ya pasaron
            if (hoursUntilAppt <= 0) continue;

            // Ignorar citas que faltan más de 25 horas (demasiado pronto para recordar)
            if (hoursUntilAppt > 25) continue;

            // Ventana de recordatorio: entre 1h y 25h antes de la cita
            const shouldSendNow = hoursUntilAppt <= 25 && hoursUntilAppt > 0;

            if (!shouldSendNow) continue;

            // Obtener nombre del servicio
            const { data: svc } = await supabase
                .from('services')
                .select('name')
                .eq('id', appt.service_id)
                .single();

            // Construir nombre del servicio con adicionales si existen
            const addOnNames: string[] = appt.additional_services ?? [];
            const serviceName = (svc?.name ?? 'Servicio') +
                (addOnNames.length > 0 ? ' + ' + addOnNames.join(' + ') : '');

            // Variables de la plantilla citalink_cliente_recordatorio:
            // {{1}} = nombre cliente, {{2}} = negocio, {{3}} = fecha, {{4}} = servicio
            const ok = await sendTemplate(appt.client_phone, TEMPLATE_RECORDATORIO, {
                '1': appt.client_name ?? 'Cliente',
                '2': tenant.name ?? 'el negocio',
                '3': formatDateTime(appt.date, appt.time),
                '4': serviceName,
            });

            if (ok) {
                await supabase
                    .from('appointments')
                    .update({ reminder_sent: true })
                    .eq('id', appt.id);
                reminders++;
                console.log(`[process-reminders] ✅ Recordatorio enviado a ${appt.client_phone} para cita ${appt.id}`);
            }
        }

        console.log(`[process-reminders] ✅ Recordatorios enviados: ${reminders}`);
        return new Response(
            JSON.stringify({ success: true, reminders }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('[process-reminders] Fatal:', err.message);
        return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: corsHeaders }
        );
    }
});
