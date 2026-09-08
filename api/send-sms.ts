import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

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
        template_sid,
        template_variables,
    } = req.body || {};

    const targetPhone = to || phone;
    const finalTenantId = tenantId || tenant_id;

    if (!targetPhone || (!message && !template_sid)) {
        return res.status(400).json({ error: 'Faltan parámetros phone/to o message/template_sid' });
    }

    // 2. Blindaje Anti-Abuso / Anti Toll-Fraud:
    // Si no es una plantilla oficial aprobada (template_sid), validar que sea una llamada autenticada
    const hasValidTemplate = template_sid && typeof template_sid === 'string' && template_sid.startsWith('HX');
    if (!hasValidTemplate && message) {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Para mensajes de texto libre se requiere sesión autenticada o el uso de plantillas oficiales de CitaLink.',
            });
        }
    }

    // Twilio Setup
    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.VITE_TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.VITE_TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WA_FROM || process.env.VITE_TWILIO_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER || '+15706349708';

    if (!accountSid || !authToken) {
        console.error('Configuración Twilio incompleta en Vercel:', { hasSid: !!accountSid, hasToken: !!authToken });
        return res.status(500).json({ error: 'Servidor Twilio no configurado.' });
    }

    // Normalizar teléfono con soporte para México (+52), EE.UU./Canadá (+1) e internacional
    const rawStr = String(targetPhone).trim();
    const digits = rawStr.replace(/\D/g, '');
    if (digits.length < 10) {
        return res.status(400).json({ error: 'Número de teléfono inválido (mínimo 10 dígitos)' });
    }

    let e164: string;
    // 1. Estados Unidos / Canadá (+1)
    if (rawStr.startsWith('+1') || (digits.startsWith('1') && digits.length === 11)) {
        e164 = `+1${digits.slice(-10)}`;
    }
    // 2. México (+52) - eliminar '1' intermedio antiguo para WhatsApp México
    else if (digits.startsWith('521') && digits.length === 13) {
        e164 = `+52${digits.slice(3)}`;
    } else if (digits.startsWith('52') && digits.length === 12) {
        e164 = `+${digits}`;
    }
    // 3. Otro código internacional explícito (+34, +57, +58, etc.)
    else if (rawStr.startsWith('+')) {
        e164 = `+${digits}`;
    }
    // 4. 10 dígitos sin prefijo (por defecto México local)
    else {
        e164 = `+52${digits.slice(-10)}`;
    }

    try {
        const client = twilio(accountSid, authToken);

        let msgOptions: any = {};

        if (provider === 'whatsapp') {
            const rawFrom = fromNumber.replace('whatsapp:', '');
            msgOptions.from = `whatsapp:${rawFrom.startsWith('+') ? rawFrom : `+${rawFrom}`}`;
            msgOptions.to = `whatsapp:${e164}`;

            if (template_sid && template_variables) {
                msgOptions.contentSid = template_sid;
                msgOptions.contentVariables = JSON.stringify(template_variables);
            } else if (message) {
                msgOptions.body = message;
            }
        } else {
            const rawFrom = fromNumber.replace('whatsapp:', '');
            msgOptions.from = rawFrom.startsWith('+') ? rawFrom : `+${rawFrom}`;
            msgOptions.to = e164;
            msgOptions.body = message;
        }

        console.log('[api/send-sms] Enviando con Twilio:', {
            to: msgOptions.to,
            from: msgOptions.from,
            hasTemplate: !!msgOptions.contentSid,
        });

        const response = await client.messages.create(msgOptions);

        console.log('[api/send-sms] Twilio Success SID:', response.sid);

        // Opcional: Registrar log en Supabase si hay tenantId
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey && finalTenantId) {
            try {
                const supabase = createClient(supabaseUrl, supabaseKey);
                await supabase.from('sms_logs').insert([{
                    tenant_id: finalTenantId,
                    phone_to: e164,
                    status: 'success',
                    provider_sid: response.sid,
                }]);
            } catch (logErr) {
                console.warn('[api/send-sms] Error guardando log en Supabase:', logErr);
            }
        }

        return res.status(200).json({ success: true, messageId: response.sid });
    } catch (error: any) {
        console.error('[api/send-sms] Error Twilio:', error);
        return res.status(500).json({ success: false, error: error.message || 'Error técnico al enviar mensaje.' });
    }
}
