import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';

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

    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ error: 'Faltan parámetros phone o message' });
    }

    // Las variables de entorno en Vercel pueden estar con o sin prefijo VITE_ dependiendo de cómo las configures
    const accountSid = process.env.VITE_TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.VITE_TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.VITE_TWILIO_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromPhone) {
        console.error('Credenciales de Twilio faltantes');
        return res.status(500).json({ error: 'Servidor mal configurado, credenciales de Twilio no asignadas.' });
    }

    try {
        const client = twilio(accountSid, authToken);

        const response = await client.messages.create({
            body: message,
            from: fromPhone,
            to: phone,
        });

        console.log(`SMS enviado correctamente con SID: ${response.sid}`);
        return res.status(200).json({ success: true, messageId: response.sid });
    } catch (error: any) {
        console.error('Error al enviar SMS usando Twilio:', error);
        return res.status(500).json({ success: false, error: error.message || 'Error técnico al contactar a la proveedora de SMS.' });
    }
}
