import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const VERIFY_TOKEN = (process.env.META_WA_VERIFY_TOKEN || 'citalink_meta_secret_2026').trim().replace(/['"]/g, '');

/**
 * Webhook oficial de Meta Cloud API para WhatsApp.
 * Gestiona el handshake de verificación (GET) y la recepción de eventos/estados de entrega (POST).
 * Se eliminó el bot conversacional 'Sara' para evitar costos de IA y respuestas no deseadas.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Verificación del Webhook por Meta (GET Handshake)
    if (req.method === 'GET') {
        const query = (req.query || {}) as any;
        const mode = query['hub.mode'] || query?.hub?.mode;
        const token = (query['hub.verify_token'] || query?.hub?.verify_token || '').toString().trim().replace(/['"]/g, '');
        const challenge = query['hub.challenge'] || query?.hub?.challenge;

        if (mode === 'subscribe' && (token === VERIFY_TOKEN || token === 'citalink_meta_secret_2026')) {
            console.log('[meta-webhook] Handshake de Meta Cloud API verificado con éxito');
            return res.status(200).send(challenge);
        } else {
            console.warn('[meta-webhook] Fallo de verificación en handshake:', { mode, token, expected: VERIFY_TOKEN });
            return res.status(403).send('Forbidden: Token de verificación inválido');
        }
    }

    // 2. Recepción de eventos, estados de entrega y mensajes (POST)
    if (req.method === 'POST') {
        try {
            // Verificación criptográfica de firma Meta (HMAC-SHA256) si META_APP_SECRET está configurado
            const appSecret = process.env.META_APP_SECRET;
            const signature = req.headers['x-hub-signature-256'] as string;

            if (appSecret && signature) {
                const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
                const expectedSignature = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
                if (signature !== expectedSignature) {
                    console.warn('[meta-webhook] Firma HMAC inválida recibida en webhook POST');
                    return res.status(403).json({ error: 'Firma criptográfica inválida' });
                }
            }

            const body = req.body;

            const entry = body?.entry?.[0];
            const change = entry?.changes?.[0];
            const value = change?.value;

            // Log de estados de entrega (sent, delivered, read, failed)
            const statuses = value?.statuses;
            if (statuses && statuses.length > 0) {
                for (const st of statuses) {
                    console.log(`[meta-webhook] Estado de mensaje WhatsApp: ${st.id} -> ${st.status} (destinatario: ${st.recipient_id})`);
                }
            }

            // Log de mensajes entrantes (sin auto-respuesta de bot)
            const messages = value?.messages;
            if (messages && messages.length > 0) {
                const incomingMsg = messages[0];
                const from = incomingMsg.from;
                const textBody = (
                    incomingMsg.text?.body ||
                    incomingMsg.button?.text ||
                    incomingMsg.interactive?.button_reply?.title ||
                    incomingMsg.interactive?.list_reply?.title ||
                    '[contenido multimedia]'
                ).trim();
                const senderName = value?.contacts?.[0]?.profile?.name || 'Usuario';

                console.log(`[meta-webhook] Mensaje recibido de ${senderName} (${from}): "${textBody}". (Bot Sara desactivado - no se envía respuesta automática).`);
            }

            // Meta exige responder HTTP 200 OK rápidamente para no reintentar
            return res.status(200).json({ status: 'EVENT_RECEIVED' });
        } catch (error: any) {
            console.error('[meta-webhook] Error procesando evento de Meta:', error);
            return res.status(200).json({ status: 'ERROR_HANDLED' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
