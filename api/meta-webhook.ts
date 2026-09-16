import type { VercelRequest, VercelResponse } from '@vercel/node';

const VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN || 'citalink_meta_secret_2026';
const META_WA_ACCESS_TOKEN = process.env.META_WA_ACCESS_TOKEN || 'EAAaAOZBzRqVIBSjPgz0yZAk4FS3wWO9k8chAKvldSs0c79EgZBwAIQjOOvevQKzwBRFzj9hhlFpUDUNNnDJIS1tZAJjiNtAxQdzug6lF0nPfOZChfWSLoM1bkwuifWDRE6TJZBtiSTjwPHwUxZAL9GybQSAC4s3oPTVO92mpCMzK4iE4J9ylWLxE1phtVmNzy7sKAZDZD';
const DEFAULT_PHONE_NUMBER_ID = process.env.META_WA_PHONE_NUMBER_ID || '1337471699449991';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Verificación del Webhook por Meta (GET Handshake)
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('[meta-webhook] Handshake de Meta verificado con éxito');
            return res.status(200).send(challenge);
        } else {
            console.warn('[meta-webhook] Fallo de verificación en handshake:', { mode, token });
            return res.status(403).send('Forbidden: Token de verificación inválido');
        }
    }

    // 2. Recepción de eventos y mensajes de WhatsApp (POST)
    if (req.method === 'POST') {
        try {
            const body = req.body;

            // Extraer mensaje entrante si existe
            const entry = body?.entry?.[0];
            const change = entry?.changes?.[0];
            const value = change?.value;
            const messages = value?.messages;

            if (messages && messages.length > 0) {
                const incomingMsg = messages[0];
                const from = incomingMsg.from; // Teléfono del usuario (ej: 5218681361010)
                const textBody = (
                    incomingMsg.text?.body ||
                    incomingMsg.button?.text ||
                    incomingMsg.interactive?.button_reply?.title ||
                    incomingMsg.interactive?.list_reply?.title ||
                    ''
                ).trim();
                const senderName = value?.contacts?.[0]?.profile?.name || '';
                const phoneNumberId = value?.metadata?.phone_number_id || DEFAULT_PHONE_NUMBER_ID;

                // Normalizar teléfono para México: Meta en allowed list usa 52... sin el 1 móvil (521...)
                let targetPhone = String(from || '').trim();
                if (targetPhone.startsWith('521') && targetPhone.length === 13) {
                    targetPhone = '52' + targetPhone.slice(3);
                }

                console.log('[meta-webhook] Mensaje entrante de:', { from, targetPhone, senderName, textBody });

                // Lógica de respuesta conversacional inteligente de Sara
                const lower = textBody.toLowerCase();
                const greetingName = senderName ? ` ${senderName.trim()}` : '';
                let replyText = '';

                if (!lower || lower.includes('hola') || lower.includes('buenas') || lower.includes('buenos') || lower.includes('hey') || lower.includes('inicio')) {
                    replyText = `¡Hola${greetingName}! 🌸 Soy Sara, tu asistente inteligente de CitaLink ✨\n\nEstoy lista para ayudarte con tus citas:\n\n📅 *Agendar una cita*: Escribe "agendar" o "cita"\n💇 *Ver servicios y precios*: Escribe "servicios"\n🕒 *Horarios de atención*: Escribe "horarios"\n👤 *Hablar con una persona*: Escribe "humano"\n\n¿En qué te puedo apoyar hoy?`;
                } else if (lower.includes('agend') || lower.includes('cita') || lower.includes('reserv') || lower.includes('turno')) {
                    replyText = `¡Con gusto te ayudo a agendar tu cita! 🗓️✨\n\nPuedes consultar la disponibilidad en tiempo real y elegir a tu profesional favorito directamente desde nuestra plataforma:\n\n👉 https://www.citalink.app\n\n¿Buscas algún servicio o profesional en específico?`;
                } else if (lower.includes('precio') || lower.includes('costo') || lower.includes('cuanto') || lower.includes('servicio') || lower.includes('catalogo')) {
                    replyText = `Ofrecemos un catálogo completo de belleza, estilismo, barbería, uñas y más ✂️💅\n\nPuedes ver todos los precios actualizados y duraciones de cada servicio aquí:\n👉 https://www.citalink.app\n\n¿Te gustaría que te reservemos un espacio?`;
                } else if (lower.includes('horario') || lower.includes('hora') || lower.includes('abierto') || lower.includes('dias')) {
                    replyText = `Nuestros horarios de atención habituales son de Lunes a Sábado de 9:00 AM a 8:00 PM ⏰\n\nPuedes ver los turnos libres de hoy y de la semana aquí:\n👉 https://www.citalink.app`;
                } else if (lower.includes('humano') || lower.includes('persona') || lower.includes('asesor') || lower.includes('ayuda')) {
                    replyText = `¡Entendido${greetingName}! 👤 Un asesor de nuestro equipo se pondrá en contacto contigo a la brevedad por este mismo chat. Mientras tanto, dime con confianza si hay algo puntual que quieras resolver.`;
                } else {
                    replyText = `Te he leído fuerte y claro${greetingName}: *"${textBody}"* 🌸\n\nComo asistente de CitaLink puedo ayudarte a *agendar citas*, *consultar servicios* o *revisar horarios*.\n\nEscribe *cita* para reservar o visita directamente 👉 https://www.citalink.app ✨`;
                }

                // Enviar respuesta inmediata a WhatsApp vía Meta Graph API
                const metaUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
                const sendRes = await fetch(metaUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${META_WA_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: targetPhone,
                        type: 'text',
                        text: {
                            preview_url: false,
                            body: replyText,
                        },
                    }),
                });

                const sendData = await sendRes.json();
                console.log('[meta-webhook] Respuesta de Meta al enviar mensaje:', sendRes.status, sendData);
            }

            // Meta exige responder HTTP 200 OK rápidamente
            return res.status(200).json({ status: 'EVENT_RECEIVED' });
        } catch (error: any) {
            console.error('[meta-webhook] Error procesando evento de Meta:', error);
            return res.status(200).json({ status: 'ERROR_HANDLED' });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
