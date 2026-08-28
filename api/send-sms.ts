import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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

    // Twilio Setup
    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.VITE_TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.VITE_TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WA_FROM || process.env.VITE_TWILIO_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER || '+15706349708';

    if (!accountSid || !authToken) {
        console.error('Configuración Twilio incompleta en Vercel:', { hasSid: !!accountSid, hasToken: !!authToken });
        return res.status(500).json({ error: 'Servidor Twilio no configurado.' });
    }

    // Normalizar teléfono (WhatsApp México sin el '1' intermedio)
    const digits = String(targetPhone).replace(/\D/g, '');
    let e164: string;
    if (digits.startsWith('521') && digits.length === 13) {
        e164 = `+52${digits.slice(3)}`;
    } else if (digits.startsWith('52') && digits.length === 12) {
        e164 = `+${digits}`;
    } else {
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
