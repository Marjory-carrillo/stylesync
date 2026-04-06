// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WA_FROM     = Deno.env.get('TWILIO_WA_FROM') ?? 'whatsapp:+15706349708';

// Plantilla aprobada por Meta (Content SID de Twilio)
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

/**
 * Calcula los días calendario de diferencia entre dos fechas (en la zona horaria del negocio).
 * Ej: booking = "2026-04-06", appointment = "2026-04-06" → 0 (mismo día)
 *     booking = "2026-04-06", appointment = "2026-04-07" → 1 (mañana)
 *     booking = "2026-04-06", appointment = "2026-04-08" → 2 (pasado mañana)
 */
function calendarDaysDiff(bookingDate: string, appointmentDate: string): number {
    const booking = new Date(bookingDate + 'T00:00:00');
    const appointment = new Date(appointmentDate + 'T00:00:00');
    const diffMs = appointment.getTime() - booking.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Extrae solo la fecha YYYY-MM-DD de un timestamp ISO, ajustado a una zona horaria.
 */
function getDateInTimezone(isoTimestamp: string, timezone: string): string {
    const d = new Date(isoTimestamp);
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    return parts; // Returns YYYY-MM-DD format
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    let reminders = 0;
    let skipped = 0;

    try {
        // ── Buscar citas confirmadas sin recordatorio enviado ──
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

            // ── Calcular el offset de la zona horaria del negocio ──
            const offsetParts = new Intl.DateTimeFormat('en-US', {
                timeZone: tZone,
                timeZoneName: 'shortOffset'
            }).formatToParts(now);
            
            const offsetString = offsetParts.find(p => p.type === 'timeZoneName')?.value;
            
            let isoOffset = 'Z';
            if (offsetString && offsetString !== 'GMT') {
                isoOffset = offsetString.replace('GMT', '');
                if (!isoOffset.includes(':')) isoOffset += ':00';
                const sign = isoOffset[0];
                let [h, m] = isoOffset.slice(1).split(':');
                if (h.length === 1) h = '0' + h;
                isoOffset = `${sign}${h}:${m}`;
            }

            // Fecha/hora absoluta de la cita
            const apptDatetime = new Date(`${appt.date}T${appt.time}${isoOffset}`);
            const msUntilAppt = apptDatetime.getTime() - now.getTime();
            const hoursUntilAppt = msUntilAppt / (1000 * 60 * 60);

            // Ignorar citas que ya pasaron
            if (hoursUntilAppt <= 0) continue;

            // ── Determinar regla de recordatorio basada en días de anticipación ──
            // Obtener la fecha de booking y la fecha de cita en la zona del negocio
            const bookingDateLocal = getDateInTimezone(appt.created_at, tZone);
            const appointmentDate = appt.date; // ya está en formato YYYY-MM-DD
            const daysAhead = calendarDaysDiff(bookingDateLocal, appointmentDate);

            // Calcular cuántas horas había entre el momento de booking y la cita
            const bookingTime = new Date(appt.created_at);
            const hoursGapAtBooking = (apptDatetime.getTime() - bookingTime.getTime()) / (1000 * 60 * 60);

            let reminderHoursBefore: number;
            let ruleApplied: string;

            if (daysAhead === 0) {
                // ═══ MISMO DÍA ═══
                if (hoursGapAtBooking < 10) {
                    // Cita muy cercana al booking → NO enviar recordatorio
                    console.log(`[process-reminders] SKIP cita ${appt.id}: mismo día, gap=${hoursGapAtBooking.toFixed(1)}h (<10h)`);
                    // Marcar como enviada para no procesarla de nuevo
                    await supabase.from('appointments').update({ reminder_sent: true }).eq('id', appt.id);
                    skipped++;
                    continue;
                }
                // Mismo día pero con ≥10h de gap → recordatorio 1h antes
                reminderHoursBefore = 1;
                ruleApplied = `mismo-día (gap=${hoursGapAtBooking.toFixed(1)}h) → 1h antes`;
            } else if (daysAhead === 1) {
                // ═══ MAÑANA ═══
                reminderHoursBefore = 2;
                ruleApplied = 'mañana → 2h antes';
            } else {
                // ═══ 2+ DÍAS (pasado mañana en adelante) ═══
                reminderHoursBefore = 5;
                ruleApplied = `${daysAhead} días adelante → 5h antes`;
            }

            // ── ¿Es momento de enviar? ──
            // Ventana: desde (reminderHoursBefore + 0.5h) hasta (reminderHoursBefore - 0.5h)
            // Esto da una ventana de 1 hora centrada en el target
            // Con cron cada 30 min, siempre cae al menos una ejecución en la ventana
            const windowStart = reminderHoursBefore + 0.5; // ej: 5.5h antes
            const windowEnd   = reminderHoursBefore - 0.5; // ej: 4.5h antes

            if (hoursUntilAppt > windowStart || hoursUntilAppt <= windowEnd) {
                // Fuera de la ventana de envío
                continue;
            }

            console.log(`[process-reminders] 🎯 Cita ${appt.id} EN VENTANA: ${hoursUntilAppt.toFixed(1)}h antes | Regla: ${ruleApplied}`);

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
                console.log(`[process-reminders] ✅ Recordatorio enviado a ${appt.client_phone} para cita ${appt.id} (${ruleApplied})`);
            }
        }

        console.log(`[process-reminders] ✅ Resumen: ${reminders} enviados, ${skipped} saltados (mismo día <10h)`);
        return new Response(
            JSON.stringify({ success: true, reminders, skipped }),
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
