// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WA_FROM     = Deno.env.get('TWILIO_WA_FROM') ?? 'whatsapp:+15706349708';

// ── SIDs de plantillas aprobadas por Meta ── Notificaciones al Admin
const TEMPLATE_ADMIN_NUEVA_CITA      = 'HX4b316926b4e052833a93cfc485c25d39';
const TEMPLATE_ADMIN_REPROGRAMACION  = 'HXfe45424793d1a462c99700d880350fb8';
const TEMPLATE_ADMIN_CANCELACION     = 'HXba4fd144b9e00ea17fcbf38349859d47';
// Cliente (cancelacion/reprogramacion)
const TEMPLATE_CLIENTE_CANCELACION    = 'HX57d98cdadf1b4ba0d560f15c9a6b1ecd';
const TEMPLATE_CLIENTE_REPROGRAMACION = 'HX197821733621547516ac219bf561c65e';
// Fallback (confirmacion_v2) — se usa si el template específico falla
const TEMPLATE_FALLBACK = 'HXc86774c877ad719610460e035b8c7fd3';

function formatDateTime(date: string, time: string, timezone = 'America/Mexico_City'): string {
    const days   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const d = new Date(`${date}T${time}`);
    const parts = new Intl.DateTimeFormat('es-MX', {
        timeZone: timezone,
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
    return `${days[d.getDay()]} ${get('day')} de ${months[d.getMonth()]} a las ${time.slice(0,5)}`;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeToWA(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    // Siempre enviamos con +52 sin el 1 intermedio, ya que WhatsApp (y Twilio) están fallando en rutas +521.
    if (digits.startsWith('521') && digits.length === 13) return `whatsapp:+52${digits.slice(3)}`;
    if (digits.startsWith('52') && digits.length === 12) return `whatsapp:+${digits}`;
    return `whatsapp:+52${digits.slice(-10)}`;
}

/** Envía texto libre al admin (ventana de sesión activa) */
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

/** Envía plantilla aprobada por Meta (to debe ser whatsapp:+...) */
async function sendTemplate(
    to: string,
    contentSid: string,
    variables: Record<string, string>
): Promise<boolean> {
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    // Si 'to' no empieza con 'whatsapp:', normalizamos; si ya viene formateado, lo usamos directo
    const waTo = to.startsWith('whatsapp:') ? to : normalizeToWA(to);
    const form = new URLSearchParams({
        To: waTo,
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
    console.log('[notify-admin] Template send:', res.status, waTo, data.sid ?? data.message ?? JSON.stringify(data));
    return res.ok;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const payload = await req.json();
        const { tenant_id, event_type, appointment } = payload;
        const directPhone = payload.admin_phone as string | undefined;
        const directName  = payload.business_name as string | undefined;

        // Supabase client for logging
        const supabaseLog = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        console.log('[notify-admin] received tenant_id:', tenant_id, '| event:', event_type, '| direct_phone:', directPhone);

        let adminPhone   = directPhone;
        let businessName = directName ?? 'CitaLink';

        // Solo consulta la BD si no viene el teléfono directo del frontend
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

        // ── 1. NOTIFICACIÓN AL ADMIN ──────────────────────────────────────────
        const adminWA = normalizeToWA(adminPhone);
        console.log('[notify-admin] sending to admin WA:', adminWA);

        // Obtener timezone del tenant para formateo correcto
        let tZone = 'America/Mexico_City';
        try {
            const { data: tenantTz } = await supabaseLog
                .from('tenants')
                .select('timezone')
                .eq('id', tenant_id ?? '')
                .single();
            if (tenantTz?.timezone) tZone = tenantTz.timezone;
        } catch (_) { /* usar timezone por defecto */ }

        // ── Notificar al admin ──────────────────────────────────────────────────
        const fechaAdmin = formatDateTime(appointment.date, appointment.time, tZone);
        const adminTemplateMap: Record<string, string> = {
            new:        TEMPLATE_ADMIN_NUEVA_CITA,
            reschedule: TEMPLATE_ADMIN_REPROGRAMACION,
            cancel:     TEMPLATE_ADMIN_CANCELACION,
        };
        // Plantilla admin: {{1}}=negocio, {{2}}=cliente, {{3}}=servicio, {{4}}=fecha, {{5}}=tel
        let adminSent = await sendTemplate(adminWA, adminTemplateMap[event_type], {
            '1': businessName,
            '2': appointment.client_name,
            '3': appointment.service_name ?? 'Servicio',
            '4': fechaAdmin,
            '5': appointment.client_phone,
        });

        // Fallback: template genérico si el específico falla
        if (!adminSent) {
            adminSent = await sendTemplate(adminWA, TEMPLATE_FALLBACK, {
                '1': appointment.client_name,
                '2': businessName,
                '3': fechaAdmin,
                '4': appointment.service_name ?? 'Servicio',
                '5': appointment.client_phone,
            });
        }

        // Fallback final: texto libre
        if (!adminSent) {
            const icons: Record<string, string> = { new: '🆕', reschedule: '🔄', cancel: '❌' };
            const lbls:  Record<string, string> = { new: 'NUEVA CITA', reschedule: 'REPROGRAMADA', cancel: 'CANCELADA' };
            adminSent = await sendWA(adminWA,
                `${icons[event_type] ?? '📅'} *${lbls[event_type] ?? 'CITA'}* — ${businessName}
👤 ${appointment.client_name}  ✂️ ${appointment.service_name ?? 'Servicio'}
📆 ${fechaAdmin}  📱 ${appointment.client_phone}`);
        }

        // Log admin notification
        if (adminSent && tenant_id) {
            await supabaseLog.from('sms_logs').insert({
                tenant_id,
                phone: adminPhone,
                message_type: `admin_${event_type}`,
                provider: 'whatsapp',
                status: 'sent',
            }).then(r => { if (r.error) console.warn('[notify-admin] sms_logs insert error (admin):', r.error.message); });
        }


        // ── 2. NOTIFICACIÓN AL CLIENTE (plantilla aprobada por Meta) ─────────
        let clientSent = false;

        if (appointment.client_phone) {
            const fechaFormateada = formatDateTime(appointment.date, appointment.time, tZone);

            if (event_type === 'new') {
                // El cliente YA recibió confirmación+OTP vía verify-otp al elegir hora
                clientSent = true;

            } else if (event_type === 'cancel') {
                clientSent = await sendTemplate(
                    appointment.client_phone, TEMPLATE_CLIENTE_CANCELACION,
                    { '1': appointment.client_name, '2': businessName, '3': fechaFormateada }
                );
                if (!clientSent) {
                    clientSent = await sendTemplate(
                        appointment.client_phone, TEMPLATE_FALLBACK,
                        { '1': appointment.client_name, '2': businessName, '3': fechaFormateada, '4': 'Cita cancelada', '5': 'Contacta al negocio' }
                    );
                }

            } else if (event_type === 'reschedule') {
                clientSent = await sendTemplate(
                    appointment.client_phone, TEMPLATE_CLIENTE_REPROGRAMACION,
                    { '1': appointment.client_name, '2': businessName, '3': fechaFormateada, '4': appointment.service_name ?? 'Servicio' }
                );
                if (!clientSent) {
                    clientSent = await sendTemplate(
                        appointment.client_phone, TEMPLATE_FALLBACK,
                        { '1': appointment.client_name, '2': businessName, '3': fechaFormateada, '4': appointment.service_name ?? 'Servicio', '5': 'Reprogramada ✅' }
                    );
                }
            }

            // Log client notification
            if (clientSent && tenant_id) {
                await supabaseLog.from('sms_logs').insert({
                    tenant_id,
                    phone: appointment.client_phone,
                    message_type: `client_${event_type}`,
                    provider: 'whatsapp',
                    status: 'sent',
                }).then(r => { if (r.error) console.warn('[notify-admin] sms_logs insert error (client):', r.error.message); });
            }
        }

        return new Response(
            JSON.stringify({ success: adminSent, admin_notified: adminSent, client_notified: clientSent }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err: any) {
        console.error('[notify-admin] Fatal error:', err.message);
        return new Response(
            JSON.stringify({ success: false, error: err.message }),
            { status: 500, headers: corsHeaders }
        );
    }
});
