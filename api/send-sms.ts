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
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { phone, message, tenantId } = req.body;

    if (!phone || !message || !tenantId) {
        return res.status(400).json({ error: 'Faltan parámetros phone, message o tenantId' });
    }

    // Supabase Setup
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    // Twilio Setup
    const accountSid = process.env.VITE_TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.VITE_TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.VITE_TWILIO_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER;

    if (!supabaseUrl || !supabaseKey || !accountSid || !authToken || !fromPhone) {
        console.error('Configuración incompleta');
        return res.status(500).json({ error: 'Servidor mal configurado.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // 1. Verificar si el tenant tiene SMS habilitados
        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('sms_enabled')
            .eq('id', tenantId)
            .single();

        if (tenantError || !tenant) {
            console.error('Tenant not found or error:', tenantError);
            return res.status(404).json({ error: 'Negocio no encontrado.' });
        }

        if (!tenant.sms_enabled) {
            // Log de bloqueo por falta de permiso
            await supabase.from('sms_logs').insert([{
                tenant_id: tenantId,
                phone_to: phone,
                status: 'blocked',
                error_message: 'SMS service disabled for this tenant'
            }]);
            return res.status(403).json({ error: 'El servicio de SMS no está activo para este negocio.' });
        }

        const client = twilio(accountSid, authToken);

        // Twilio requiere formato internacional (E.164)
        let formattedPhone = phone.replace(/\s+/g, '');
        if (!formattedPhone.startsWith('+')) {
            formattedPhone = `+52${formattedPhone}`;
        }

        const response = await client.messages.create({
            body: message,
            from: fromPhone,
            to: formattedPhone,
        });

        // 2. Registrar log de éxito
        await supabase.from('sms_logs').insert([{
            tenant_id: tenantId,
            phone_to: formattedPhone,
            status: 'success',
            provider_sid: response.sid
        }]);

        console.log(`Log guardado y SMS enviado: ${response.sid}`);
        return res.status(200).json({ success: true, messageId: response.sid });
    } catch (error: any) {
        console.error('Error procesando SMS:', error);

        // Registrar log de error si es posible
        if (tenantId) {
            await supabase.from('sms_logs').insert([{
                tenant_id: tenantId,
                phone_to: phone,
                status: 'error',
                error_message: error.message
            }]);
        }

        return res.status(500).json({ success: false, error: error.message || 'Error técnico al enviar SMS.' });
    }
}
