// @ts-nocheck — Deno runtime (Supabase Edge Functions)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WA_FROM     = Deno.env.get('TWILIO_WA_FROM') ?? 'whatsapp:+15706349708';

// ── Plantillas aprobadas por Meta — Notificaciones al CLIENTE ───────────────
const TEMPLATE_CLIENTE_CONFIRMACION   = 'HXfa893170a1790b0bd8aeff7448fde298';
const TEMPLATE_CLIENTE_CANCELACION    = 'HX57d98cdadf1b4ba0d560f15c9a6b1ecd';
const TEMPLATE_CLIENTE_REPROGRAMACION = 'HX197821733621547516ac219bf561c65e';

// ── Plantillas aprobadas por Meta — Notificaciones al ADMIN ─────────────────
const TEMPLATE_ADMIN_NUEVA_CITA    = 'HX4b518926b4e052885a93cfc485c25d39';
const TEMPLATE_ADMIN_REPROGRAMACION = 'HXfe45424793d1a462c99700d880350fb8';
const TEMPLATE_ADMIN_CANCELACION   = 'HXba4fd144b9e00ea17fcbf58349859d47';

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

/** Envía plantilla aprobada por Meta al CLIENTE (outbound sin sesión activa) */
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
    console.log('[notify-admin] Template to client:', res.status, data.sid ?? data.message ?? JSON.stringify(data));
    return res.ok;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const payload = await req.json();
        const { tenant_id, event_type, appointment } = payload;
        const directPhone = payload.admin_phone as string | undefined;
        const directName  = payload.business_name as string | undefined;

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

        // ── 1. NOTIFICACIÓN AL ADMIN (texto libre) ────────────────────────────
        const adminWA = normalizeToWA(adminPhone);
        console.log('[notify-admin] sending to admin WA:', adminWA);

        // Formateado combinado de fecha+hora para plantilla {{4}}
        const days_   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
        const months_ = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        const formatDTAdmin = (date: string, time: string) => {
            const d = new Date(`${date}T${time}`);
            return `${days_[d.getDay()]} ${d.getDate()} de ${months_[d.getMonth()]} a las ${time.slice(0,5)}`;
        };
        const fechaAdmin = formatDTAdmin(appointment.date, appointment.time);

        // ── Seleccionar plantilla del admin según evento ──────────────────────
        const adminTemplates: Record<string, string> = {
            new:        TEMPLATE_ADMIN_NUEVA_CITA,
            reschedule: TEMPLATE_ADMIN_REPROGRAMACION,
            cancel:     TEMPLATE_ADMIN_CANCELACION,
        };
        const adminTemplateSid = adminTemplates[event_type];

        let adminSent = false;
        if (adminTemplateSid) {
            // Plantilla aprobada: {{1}}=negocio, {{2}}=cliente, {{3}}=servicio, {{4}}=fecha, {{5}}=tel
            adminSent = await sendTemplate(adminWA, adminTemplateSid, {
                '1': businessName,
                '2': appointment.client_name,
                '3': appointment.service_name ?? 'Servicio',
                '4': fechaAdmin,
                '5': appointment.client_phone,
            });
        }

        // Fallback: texto libre si la plantilla no está aprobada aún
        if (!adminSent) {
            const icons:  Record<string, string> = { new: '🆕', reschedule: '🔄', cancel: '❌' };
            const labels: Record<string, string> = { new: 'NUEVA CITA', reschedule: 'REPROGRAMADA', cancel: 'CANCELADA' };
            const adminMsg = `${icons[event_type] ?? '📅'} *${labels[event_type] ?? 'CITA'}* — ${businessName}
👤 ${appointment.client_name}
✂️ ${appointment.service_name ?? 'Servicio'}
📆 ${fechaAdmin}
📱 ${appointment.client_phone}`;
            adminSent = await sendWA(adminWA, adminMsg);
        }


        // ── 2. NOTIFICACIÓN AL CLIENTE (plantilla aprobada por Meta) ─────────
        let clientSent = false;

        if (appointment.client_phone) {
            const days   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
            const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

            const formatDT = (date: string, time: string) => {
                const d = new Date(`${date}T${time}`);
                return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]} a las ${time.slice(0,5)}`;
            };

            const fechaFormateada = formatDT(appointment.date, appointment.time);

            if (event_type === 'new') {
                // Plantilla citalink_cliente_confirmacion:
                // {{1}} = nombre cliente, {{2}} = negocio, {{3}} = fecha, {{4}} = servicio
                clientSent = await sendTemplate(
                    appointment.client_phone,
                    TEMPLATE_CLIENTE_CONFIRMACION,
                    {
                        '1': appointment.client_name,
                        '2': businessName,
                        '3': fechaFormateada,
                        '4': appointment.service_name ?? 'Servicio',
                    }
                );

            } else if (event_type === 'cancel') {
                // Plantilla citalink_cliente_cancelacion:
                // {{1}} = nombre cliente, {{2}} = negocio, {{3}} = fecha
                clientSent = await sendTemplate(
                    appointment.client_phone,
                    TEMPLATE_CLIENTE_CANCELACION,
                    {
                        '1': appointment.client_name,
                        '2': businessName,
                        '3': fechaFormateada,
                    }
                );

            } else if (event_type === 'reschedule') {
                // Plantilla citalink_cliente_reprogramacion:
                // {{1}} = nombre cliente, {{2}} = negocio, {{3}} = fecha, {{4}} = servicio
                clientSent = await sendTemplate(
                    appointment.client_phone,
                    TEMPLATE_CLIENTE_REPROGRAMACION,
                    {
                        '1': appointment.client_name,
                        '2': businessName,
                        '3': fechaFormateada,
                        '4': appointment.service_name ?? 'Servicio',
                    }
                );
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
