// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WA_FROM     = Deno.env.get('TWILIO_WA_FROM') ?? 'whatsapp:+15706349708';

// ── Plantillas aprobadas por Meta (Content SIDs de Twilio) ──────────────────
const TEMPLATE_CONFIRMACION  = 'HXfa893170a1790b0bd8aeff7448fde298';
const TEMPLATE_RECORDATORIO  = 'HXc99ae2355cd2f306973e448d922dc77f';

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
    let confirmations = 0, reminders = 0;

    try {
        // ── 1. CONFIRMACIONES PENDIENTES ──────────────────────────────────────
        const { data: toConfirm } = await supabase
            .from('appointments')
            .select('*, tenants(name, sms_provider)')
            .eq('status', 'pendiente')
            .eq('confirmation_sent', false);

        for (const appt of (toConfirm ?? [])) {
            const tenant = appt.tenants;
            if (tenant?.sms_provider !== 'whatsapp') continue;
            if (!appt.client_phone) continue;

            // Obtener nombre del servicio
            const { data: svc } = await supabase
                .from('services')
                .select('name')
                .eq('id', appt.service_id)
                .single();

            // Variables de la plantilla citalink_cliente_confirmacion:
            // {{1}} = nombre cliente, {{2}} = negocio, {{3}} = fecha, {{4}} = servicio
            const ok = await sendTemplate(appt.client_phone, TEMPLATE_CONFIRMACION, {
                '1': appt.client_name,
                '2': tenant.name,
                '3': formatDateTime(appt.date, appt.time),
                '4': svc?.name ?? 'Servicio',
            });

            if (ok) {
                await supabase
                    .from('appointments')
                    .update({ confirmation_sent: true })
                    .eq('id', appt.id);
                confirmations++;
            }
        }

        // ── 2. RECORDATORIOS PENDIENTES ───────────────────────────────────────
        const { data: pending } = await supabase
            .from('appointments')
            .select('*, tenants(name, sms_provider)')
            .eq('status', 'pendiente')
            .eq('confirmation_sent', true)
            .eq('reminder_sent', false);

        for (const appt of (pending ?? [])) {
            const tenant = appt.tenants;
            if (tenant?.sms_provider !== 'whatsapp') continue;
            if (!appt.client_phone) continue;

            const apptDatetime   = new Date(`${appt.date}T${appt.time}`);
            const bookedAt       = new Date(appt.booked_at ?? appt.created_at ?? now);
            const diffMs         = apptDatetime.getTime() - bookedAt.getTime();
            const diffHours      = diffMs / (1000 * 60 * 60);
            const msUntilAppt    = apptDatetime.getTime() - now.getTime();
            const hoursUntilAppt = msUntilAppt / (1000 * 60 * 60);

            // Cita del mismo día → solo confirmación, sin recordatorio
            const apptDateStr = appt.date;
            const todayStr    = now.toISOString().split('T')[0];
            if (apptDateStr === todayStr) continue;

            let shouldSendNow = false;

            if (diffHours < 24) {
                // Reservada <24h antes → recordar 1h antes
                if (hoursUntilAppt <= 1 && hoursUntilAppt > 0) shouldSendNow = true;

            } else if (diffHours <= 72) {
                // Reservada 24h–3 días antes → recordar 30min antes del límite de cancelación
                const deadlineMs        = bookedAt.getTime() + (23.5 * 60 * 60 * 1000);
                const minutesToDeadline = (deadlineMs - now.getTime()) / (1000 * 60);
                if (minutesToDeadline <= 15 && minutesToDeadline > -15) shouldSendNow = true;

            } else {
                // Reservada +3 días antes → recordar 5h antes de la cita
                if (hoursUntilAppt <= 5 && hoursUntilAppt > 4.75) shouldSendNow = true;
            }

            if (!shouldSendNow) continue;

            const { data: svc } = await supabase
                .from('services')
                .select('name')
                .eq('id', appt.service_id)
                .single();

            // Variables de la plantilla citalink_cliente_recordatorio:
            // {{1}} = nombre cliente, {{2}} = negocio, {{3}} = fecha, {{4}} = servicio
            const ok = await sendTemplate(appt.client_phone, TEMPLATE_RECORDATORIO, {
                '1': appt.client_name,
                '2': tenant.name,
                '3': formatDateTime(appt.date, appt.time),
                '4': svc?.name ?? 'Servicio',
            });

            if (ok) {
                await supabase
                    .from('appointments')
                    .update({ reminder_sent: true })
                    .eq('id', appt.id);
                reminders++;
            }
        }

        console.log(`[process-reminders] ✅ Confirmaciones: ${confirmations}, Recordatorios: ${reminders}`);
        return new Response(
            JSON.stringify({ success: true, confirmations, reminders }),
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
