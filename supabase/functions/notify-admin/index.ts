// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WA_FROM     = Deno.env.get('TWILIO_WA_FROM') ?? 'whatsapp:+15706349708';

// ── SIDs de plantillas aprobadas por Meta ── Notificaciones al Admin
const TEMPLATE_ADMIN_NUEVA_CITA      = 'HXd19a0ab5d8bf37655221320bb6555ea1';
const TEMPLATE_ADMIN_REPROGRAMACION  = 'HX16247c41bf5cf9f31236c2e574337308';
const TEMPLATE_ADMIN_CANCELACION     = 'HXdc7be5995c074f498642e9536b157947';
// Cliente (cancelacion/reprogramacion/precio)
const TEMPLATE_CLIENTE_CANCELACION          = 'HXb2828c0bd3aabc8edd912c81db56884f';
const TEMPLATE_CLIENTE_REPROGRAMACION       = 'HX84b5a4b7cf045e4fe976564f705a0613';
const TEMPLATE_CLIENTE_ACTUALIZACION_PRECIO = 'HX7e31d42fe0693980543f4fb2308e05a8';
// Fallback — se usa si el template específico falla
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

/** Envía un mensaje multimedia (foto) al admin */
async function sendWAMedia(to: string, body: string, mediaUrl: string): Promise<boolean> {
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const form = new URLSearchParams({
        To: to,
        From: TWILIO_WA_FROM,
        Body: body,
        MediaUrl: mediaUrl,
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
    console.log('[notify-admin] Twilio media response:', res.status, JSON.stringify(data));
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
        const directSlug  = payload.business_slug as string | undefined;
        // Nombres de servicios adicionales (para formato ➕ Adicional: ...)
        const additionalServices: string[] = appointment?.additional_services ?? [];
        const isVariablePrice: boolean = appointment?.is_variable_price ?? payload?.is_variable_price ?? false;

        // Supabase client for logging
        const supabaseLog = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('APP_SERVICE_KEY')!
        );

        console.log('[notify-admin] received tenant_id:', tenant_id, '| event:', event_type, '| direct_phone:', directPhone);

        let adminPhone   = directPhone;
        let businessName = directName ?? 'CitaLink';

        // Solo consulta la BD si no viene el teléfono directo del frontend
        if (!adminPhone) {
            const supabase = createClient(
                Deno.env.get('SUPABASE_URL')!,
                Deno.env.get('APP_SERVICE_KEY')!
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

        // ── 1. NOTIFICACIÓN AL PROFESIONAL Y/O ADMIN ─────────────────────────────
        // Búsqueda del profesional (estilista/barbero) si se proporcionó stylist_id
        let stylistPhone: string | null = null;
        let stylistName: string | null = null;

        if (appointment.stylist_id) {
            try {
                const { data: stylist } = await supabaseLog
                    .from('stylists')
                    .select('name, phone')
                    .eq('id', appointment.stylist_id)
                    .single();
                if (stylist?.phone) {
                    stylistPhone = stylist.phone.trim();
                }
                if (stylist?.name) {
                    stylistName = stylist.name;
                }
            } catch (errStylist: any) {
                console.warn('[notify-admin] error looking up stylist:', errStylist.message);
            }
        }

        // Construir lista de teléfonos destino sin duplicados
        const targetPhones: Array<{ phone: string; role: 'stylist' | 'admin' }> = [];
        const addedNormalized = new Set<string>();

        if (stylistPhone) {
            const stylistWA = normalizeToWA(stylistPhone);
            targetPhones.push({ phone: stylistPhone, role: 'stylist' });
            addedNormalized.add(stylistWA);
        }

        if (adminPhone) {
            const adminWA = normalizeToWA(adminPhone);
            if (!addedNormalized.has(adminWA)) {
                targetPhones.push({ phone: adminPhone, role: 'admin' });
                addedNormalized.add(adminWA);
            }
        }

        // Obtener timezone y slug del tenant para formateo correcto
        let tZone = 'America/Mexico_City';
        let businessSlug = directSlug ?? '';
        try {
            const { data: tenantTz } = await supabaseLog
                .from('tenants')
                .select('timezone, slug')
                .eq('id', tenant_id ?? '')
                .single();
            if (tenantTz?.timezone) tZone = tenantTz.timezone;
            if (!businessSlug && tenantTz?.slug) businessSlug = tenantTz.slug;
        } catch (_) { /* usar timezone por defecto */ }

        const fechaAdmin = formatDateTime(appointment.date, appointment.time, tZone);

        // Formatear nombre de servicio principal (limpiando detalles técnicos de la calculadora y links de referencia)
        let mainServiceOnly = (appointment.service_name ?? 'Servicio')
            .split(' + Largo:')[0]
            .split(' + Diseño:')[0]
            .split(' + Extra:')[0]
            .split(' + Referencia:')[0]
            .split(' + Cotización')[0]
            .trim();

        // Filtrar adicionales reales de la lista (excluyendo entradas de la calculadora)
        const realAddOns = additionalServices.filter(s => 
            !s.startsWith('Largo:') && 
            !s.startsWith('Diseño:') && 
            !s.startsWith('Extra:') && 
            !s.startsWith('Cotización') && 
            !s.startsWith('Referencia:')
        );

        let formattedService = realAddOns.length > 0
            ? `${mainServiceOnly} (+ ${realAddOns.join(', ')})`
            : mainServiceOnly;

        if (isVariablePrice && event_type === 'new') {
            formattedService += ' (PENDIENTE DE COTIZAR)';
        }

        const adminTemplateMap: Record<string, string> = {
            new:        TEMPLATE_ADMIN_NUEVA_CITA,
            reschedule: TEMPLATE_ADMIN_REPROGRAMACION,
            cancel:     TEMPLATE_ADMIN_CANCELACION,
        };

        let anyNotified = false;

        // Enviar notificación a cada destinatario (profesional y/o admin)
        for (const target of targetPhones) {
            const targetWA = normalizeToWA(target.phone);
            console.log(`[notify-admin] sending to ${target.role} WA:`, targetWA);

            // Plantilla admin: {{1}}=negocio, {{2}}=cliente, {{3}}=servicio, {{4}}=fecha, {{5}}=tel
            let sent = await sendTemplate(targetWA, adminTemplateMap[event_type], {
                '1': businessName,
                '2': appointment.client_name,
                '3': formattedService,
                '4': fechaAdmin,
                '5': appointment.client_phone,
            });

            // Fallback: template genérico si el específico falla
            if (!sent) {
                sent = await sendTemplate(targetWA, TEMPLATE_FALLBACK, {
                    '1': appointment.client_name,
                    '2': businessName,
                    '3': fechaAdmin,
                    '4': formattedService,
                    '5': appointment.client_phone,
                });
            }

            // Fallback final: texto libre
            if (!sent) {
                const icons: Record<string, string> = { new: '🆕', reschedule: '🔄', cancel: '❌' };
                const lbls:  Record<string, string> = { new: 'NUEVA CITA', reschedule: 'REPROGRAMADA', cancel: 'CANCELADA' };
                const profInfo = stylistName ? `\n💈 Atiende: ${stylistName}` : '';
                sent = await sendWA(targetWA,
                    `${icons[event_type] ?? '📅'} *${lbls[event_type] ?? 'CITA'}* — ${businessName}
👤 ${appointment.client_name}  ✂️ ${appointment.service_name ?? 'Servicio'}${profInfo}
📆 ${fechaAdmin}  📱 ${appointment.client_phone}`);
            }

            // Si hay una foto de diseño adjunta, intentar enviarla como mensaje multimedia
            if (sent && appointment.design_photo) {
                console.log(`[notify-admin] Intentando enviar foto de diseño a ${target.role}:`, appointment.design_photo);
                try {
                    const photoSent = await sendWAMedia(
                        targetWA,
                        `📷 Foto de referencia de diseño enviada por ${appointment.client_name} para su cita.`,
                        appointment.design_photo
                    );
                    console.log(`[notify-admin] Resultado del envío de foto a ${target.role}:`, photoSent);
                } catch (errPhoto: any) {
                    console.error(`[notify-admin] Error al enviar foto de WhatsApp a ${target.role}:`, errPhoto.message);
                }
            }

            // Registrar en sms_logs
            if (sent && tenant_id) {
                anyNotified = true;
                await supabaseLog.from('sms_logs').insert({
                    tenant_id,
                    phone_to: target.phone,
                    message_type: `${target.role}_${event_type}`,
                    provider: 'whatsapp',
                    status: 'sent',
                }).then(r => { if (r.error) console.warn(`[notify-admin] sms_logs insert error (${target.role}):`, r.error.message); });
            }
        }


        // ── 2. NOTIFICACIÓN AL CLIENTE (plantilla aprobada por Meta) ─────────
        let clientSent = false;

        if (appointment.client_phone) {
            const fechaFormateada = formatDateTime(appointment.date, appointment.time, tZone);

            if (event_type === 'new') {
                // El cliente YA recibió confirmación+OTP vía verify-otp al elegir hora
                clientSent = true;

            } else if (event_type === 'cancel') {
                const bookingLink = businessSlug
                    ? `https://www.citalink.app/reserva/${businessSlug}`
                    : 'https://www.citalink.app';
                clientSent = await sendTemplate(
                    appointment.client_phone, TEMPLATE_CLIENTE_CANCELACION,
                    { '1': appointment.client_name, '2': businessName, '3': fechaFormateada, '4': bookingLink }
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
                    { '1': appointment.client_name, '2': businessName, '3': fechaFormateada, '4': mainServiceOnly }
                );
                if (!clientSent) {
                    clientSent = await sendTemplate(
                        appointment.client_phone, TEMPLATE_FALLBACK,
                        { '1': appointment.client_name, '2': businessName, '3': fechaFormateada, '4': mainServiceOnly, '5': 'Reprogramada ✅' }
                    );
                }
            } else if (event_type === 'price_update') {
                const bookingLink = businessSlug
                    ? `https://www.citalink.app/reserva/${businessSlug}`
                    : 'https://www.citalink.app';
                const confirmedPriceStr = appointment.confirmed_price ? `*${appointment.confirmed_price} MXN*` : '*0 MXN*';
                clientSent = await sendTemplate(
                    appointment.client_phone, TEMPLATE_CLIENTE_ACTUALIZACION_PRECIO,
                    { 
                        '1': appointment.client_name, 
                        '2': businessName, 
                        '3': fechaFormateada, 
                        '4': mainServiceOnly, 
                        '5': confirmedPriceStr,
                        '6': bookingLink
                    }
                );
                if (!clientSent) {
                    clientSent = await sendTemplate(
                        appointment.client_phone, TEMPLATE_FALLBACK,
                        { '1': appointment.client_name, '2': businessName, '3': fechaFormateada, '4': mainServiceOnly, '5': `Precio confirmado: $${confirmedPriceStr}` }
                    );
                }
            }

            // Log client notification
            if (clientSent && tenant_id) {
                await supabaseLog.from('sms_logs').insert({
                    tenant_id,
                    phone_to: appointment.client_phone,
                    message_type: `client_${event_type}`,
                    provider: 'whatsapp',
                    status: 'sent',
                }).then(r => { if (r.error) console.warn('[notify-admin] sms_logs insert error (client):', r.error.message); });
            }
        }

        return new Response(
            JSON.stringify({ success: anyNotified, notified: anyNotified, client_notified: clientSent }),
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
