import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

// ── Mapeo de Content SIDs de Twilio a Nombres de Plantilla Oficiales en Meta Cloud API ──
export const META_TEMPLATE_MAP: Record<string, { name: string; lang?: string }> = {
    // Cliente
    'HXcc71cca366ff7fa242044edb96ead1bc': { name: 'citalink_cliente_cita_manual', lang: 'es_MX' },
    'HX9f85e85c7229648e7e4966e678f8d204': { name: 'citalink_cliente_confirmacion_v3', lang: 'es_MX' },
    'HX35ed4a23580c8a4b1050a95802a335c0': { name: 'citalink_cliente_recordatorio_v5', lang: 'es_MX' },
    'HXb2828c0bd3aabc8edd912c81db56884f': { name: 'citalink_cliente_cancelacion', lang: 'es_MX' },
    'HX84b5a4b7cf045e4fe976564f705a0613': { name: 'citalink_cliente_reprogramacion', lang: 'es_MX' },
    'HX7e31d42fe0693980543f4fb2308e05a8': { name: 'citalink_cliente_actualizacion_precio', lang: 'es_MX' },
    'HXd40f3d2ff477c580f15009ad07c89cb9': { name: 'citalink_otp_codigo', lang: 'es_MX' },
    // Admin / Superadmin
    'HXd19a0ab5d8bf37655221320bb6555ea1': { name: 'citalink_admin_nueva_cita', lang: 'es_MX' },
    'HX16247c41bf5cf9f31236c2e574337308': { name: 'citalink_admin_reprogramacion', lang: 'es_MX' },
    'HXdc7be5995c074f498642e9536b157947': { name: 'citalink_admin_cancelacion', lang: 'es_MX' },
    'HXe57fdea8c7ab7bd6311190fd5737c638': { name: 'citalink_superadmin_nuevo_negocio', lang: 'es_MX' },
    'HXc86774c877ad719610460e035b8c7fd3': { name: 'citalink_notificacion_general', lang: 'es_MX' },
};

async function sendViaMeta(params: {
    digits: string;
    template_name?: string;
    template_sid?: string;
    template_variables?: Record<string, any>;
    template_lang?: string;
    message?: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string; data?: any }> {
    const metaToken = process.env.META_WA_ACCESS_TOKEN;
    const metaPhoneId = process.env.META_WA_PHONE_NUMBER_ID || '1337471699449991';

    if (!metaToken) {
        return { ok: false, error: 'META_WA_ACCESS_TOKEN no configurado' };
    }

    try {
        let waDigits = params.digits;
        if (params.digits.length === 10) {
            waDigits = `52${params.digits}`;
        } else if (params.digits.startsWith('521') && params.digits.length === 13) {
            waDigits = `52${params.digits.slice(3)}`;
        }

        let targetMetaTemplate = params.template_name;
        let targetMetaLang = params.template_lang || 'es_MX';

        if (!targetMetaTemplate && params.template_sid && META_TEMPLATE_MAP[params.template_sid]) {
            targetMetaTemplate = META_TEMPLATE_MAP[params.template_sid].name;
            targetMetaLang = params.template_lang || META_TEMPLATE_MAP[params.template_sid].lang || 'es_MX';
        }

        let metaPayload: any;

        if (targetMetaTemplate) {
            const bodyParameters = params.template_variables
                ? Object.keys(params.template_variables)
                      .sort((a, b) => Number(a) - Number(b))
                      .map((k) => ({
                          type: 'text',
                          text: String(params.template_variables![k] ?? ''),
                      }))
                : [];

            console.log(`[api/send-sms] 🚀 Enviando plantilla oficial Meta Cloud API '${targetMetaTemplate}' a ${waDigits}...`);

            metaPayload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: waDigits,
                type: 'template',
                template: {
                    name: targetMetaTemplate,
                    language: {
                        code: targetMetaLang,
                    },
                    ...(bodyParameters.length > 0
                        ? {
                              components: [
                                  {
                                      type: 'body',
                                      parameters: bodyParameters,
                                  },
                              ],
                          }
                        : {}),
                },
            };
        } else {
            console.log(`[api/send-sms] 🚀 Enviando WhatsApp texto libre vía Meta Cloud API a ${waDigits}...`);
            metaPayload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: waDigits,
                type: 'text',
                text: {
                    preview_url: false,
                    body: params.message || 'Notificación de CitaLink',
                },
            };
        }

        const metaRes = await fetch(`https://graph.facebook.com/v21.0/${metaPhoneId}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${metaToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(metaPayload),
        });

        const metaData = await metaRes.json();
        console.log('[api/send-sms] Respuesta de Meta Cloud API:', metaRes.status, JSON.stringify(metaData));

        if (metaRes.ok) {
            const messageId = metaData?.messages?.[0]?.id;
            return { ok: true, messageId, data: metaData };
        } else {
            return { ok: false, error: metaData?.error?.message || 'Meta Cloud API error', data: metaData };
        }
    } catch (err: any) {
        console.warn('[api/send-sms] Excepción en Meta Cloud API:', err.message);
        return { ok: false, error: err.message };
    }
}

async function sendViaTwilio(params: {
    e164: string;
    provider: string;
    template_sid?: string;
    template_variables?: Record<string, any>;
    message?: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.VITE_TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.VITE_TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WA_FROM || process.env.VITE_TWILIO_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER || '+15706349708';

    if (!accountSid || !authToken) {
        return { ok: false, error: 'Credenciales Twilio no configuradas' };
    }

    try {
        const client = twilio(accountSid, authToken);
        let msgOptions: any = {};

        if (params.provider === 'whatsapp') {
            const rawFrom = fromNumber.replace('whatsapp:', '');
            msgOptions.from = `whatsapp:${rawFrom.startsWith('+') ? rawFrom : `+${rawFrom}`}`;
            msgOptions.to = `whatsapp:${params.e164}`;

            if (params.template_sid && params.template_variables) {
                msgOptions.contentSid = params.template_sid;
                msgOptions.contentVariables = JSON.stringify(params.template_variables);
            } else if (params.message) {
                msgOptions.body = params.message;
            }
        } else {
            const rawFrom = fromNumber.replace('whatsapp:', '');
            msgOptions.from = rawFrom.startsWith('+') ? rawFrom : `+${rawFrom}`;
            msgOptions.to = params.e164;
            msgOptions.body = params.message;
        }

        console.log('[api/send-sms] Enviando con Twilio:', {
            to: msgOptions.to,
            from: msgOptions.from,
            hasTemplate: !!msgOptions.contentSid,
        });

        const response = await client.messages.create(msgOptions);
        console.log('[api/send-sms] Twilio Success SID:', response.sid);
        return { ok: true, messageId: response.sid };
    } catch (err: any) {
        console.error('[api/send-sms] Error Twilio:', err.message);
        return { ok: false, error: err.message };
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. CORS Seguro: Restringir a dominios autorizados de CitaLink
    const origin = (req.headers.origin as string) || '';
    const isAllowedOrigin =
        !origin ||
        origin === 'https://www.citalink.app' ||
        origin === 'https://citalink.app' ||
        origin.endsWith('.vercel.app') ||
        origin === 'http://localhost:5173' ||
        origin === 'http://localhost:3000';

    if (isAllowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin || 'https://www.citalink.app');
    } else {
        return res.status(403).json({ error: 'Origen no autorizado para envío de mensajería.' });
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, apikey'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const {
        phone,
        to,
        message,
        tenantId,
        tenant_id,
        provider = 'whatsapp',
        template_name,
        template_sid,
        template_variables,
        template_lang = 'es_MX',
    } = req.body || {};

    const targetPhone = to || phone;
    const finalTenantId = tenantId || tenant_id;

    if (!targetPhone || (!message && !template_sid && !template_name)) {
        return res.status(400).json({ error: 'Faltan parámetros phone/to o message/template' });
    }

    // 2. Blindaje Anti-Abuso / Anti Toll-Fraud:
    const hasValidTemplate =
        (template_sid && typeof template_sid === 'string' && template_sid.startsWith('HX')) ||
        (template_name && typeof template_name === 'string');
    if (!hasValidTemplate && message) {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Para mensajes de texto libre se requiere sesión autenticada o el uso de plantillas oficiales de CitaLink.',
            });
        }
    }

    // Normalizar teléfono
    const rawStr = String(targetPhone).trim();
    const digits = rawStr.replace(/\D/g, '');
    if (digits.length < 10) {
        return res.status(400).json({ error: 'Número de teléfono inválido (mínimo 10 dígitos)' });
    }

    let e164: string;
    if (rawStr.startsWith('+1') || (digits.startsWith('1') && digits.length === 11)) {
        e164 = `+1${digits.slice(-10)}`;
    } else if (digits.startsWith('521') && digits.length === 13) {
        e164 = `+52${digits.slice(3)}`;
    } else if (digits.startsWith('52') && digits.length === 12) {
        e164 = `+${digits}`;
    } else if (rawStr.startsWith('+')) {
        e164 = `+${digits}`;
    } else {
        e164 = `+52${digits.slice(-10)}`;
    }

    const primaryProvider = process.env.WHATSAPP_PROVIDER || 'meta';
    console.log(`[api/send-sms] Proveedor primario configurado: '${primaryProvider}'`);

    const logToSupabase = async (usedProvider: string, sid?: string) => {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey && finalTenantId) {
            try {
                const supabase = createClient(supabaseUrl, supabaseKey);
                await supabase.from('sms_logs').insert([{
                    tenant_id: finalTenantId,
                    phone_to: e164,
                    status: 'success',
                    provider: usedProvider,
                    provider_sid: sid,
                }]);
            } catch (logErr) {
                console.warn('[api/send-sms] Error guardando log en Supabase:', logErr);
            }
        }
    };

    // ── ESTRATEGIA DE ENVÍO DUAL CON PRIORIDAD CONFIGURABLE ──────────────────
    if (primaryProvider === 'twilio') {
        // 1. Intentar Twilio primero (para gastar saldo restante de Twilio)
        const twilioResult = await sendViaTwilio({
            e164,
            provider,
            template_sid,
            template_variables,
            message,
        });

        if (twilioResult.ok) {
            await logToSupabase('twilio', twilioResult.messageId);
            return res.status(200).json({ success: true, provider: 'twilio', messageId: twilioResult.messageId });
        }

        console.warn('[api/send-sms] Twilio falló o sin saldo, activando fallback con Meta Cloud API...');

        // 2. Fallback con Meta Cloud API
        const metaResult = await sendViaMeta({
            digits,
            template_name,
            template_sid,
            template_variables,
            template_lang,
            message,
        });

        if (metaResult.ok) {
            await logToSupabase('meta', metaResult.messageId);
            return res.status(200).json({ success: true, provider: 'meta', messageId: metaResult.messageId, data: metaResult.data });
        }

        return res.status(500).json({
            success: false,
            error: `Twilio error: ${twilioResult.error}. Meta fallback error: ${metaResult.error}`,
        });
    } else {
        // 1. Intentar Meta Cloud API primero
        const metaResult = await sendViaMeta({
            digits,
            template_name,
            template_sid,
            template_variables,
            template_lang,
            message,
        });

        if (metaResult.ok) {
            await logToSupabase('meta', metaResult.messageId);
            return res.status(200).json({ success: true, provider: 'meta', messageId: metaResult.messageId, data: metaResult.data });
        }

        console.warn('[api/send-sms] Meta falló, activando fallback con Twilio...');

        // 2. Fallback con Twilio
        const twilioResult = await sendViaTwilio({
            e164,
            provider,
            template_sid,
            template_variables,
            message,
        });

        if (twilioResult.ok) {
            await logToSupabase('twilio', twilioResult.messageId);
            return res.status(200).json({ success: true, provider: 'twilio', messageId: twilioResult.messageId });
        }

        return res.status(500).json({
            success: false,
            error: `Meta error: ${metaResult.error}. Twilio fallback error: ${twilioResult.error}`,
        });
    }
}
