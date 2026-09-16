import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN || 'citalink_meta_secret_2026';
const META_WA_ACCESS_TOKEN = process.env.META_WA_ACCESS_TOKEN || 'EAAaAOZBzRqVIBSjPgz0yZAk4FS3wWO9k8chAKvldSs0c79EgZBwAIQjOOvevQKzwBRFzj9hhlFpUDUNNnDJIS1tZAJjiNtAxQdzug6lF0nPfOZChfWSLoM1bkwuifWDRE6TJZBtiSTjwPHwUxZAL9GybQSAC4s3oPTVO92mpCMzK4iE4J9ylWLxE1phtVmNzy7sKAZDZD';
const DEFAULT_PHONE_NUMBER_ID = process.env.META_WA_PHONE_NUMBER_ID || '1337471699449991';

interface TenantContext {
    clientName?: string;
    tenant: {
        id: string;
        name: string;
        slug: string;
        address?: string | null;
        phone?: string | null;
    };
    services: Array<{
        name: string;
        price: number;
        duration: number;
        is_addon?: boolean;
    }>;
}

async function resolveTenantContext(phone: string): Promise<TenantContext | null> {
    try {
        const digits = phone.replace(/\D/g, '').slice(-10);
        if (!digits || digits.length < 10) return null;

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) return null;

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Buscar en appointments más reciente
        const { data: apt } = await supabase
            .from('appointments')
            .select('tenant_id, client_name')
            .ilike('client_phone', `%${digits}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let tenantId = apt?.tenant_id;
        let clientName = apt?.client_name;

        // 2. Si no hay cita, buscar en sms_logs (donde se registró el último OTP o mensaje)
        if (!tenantId) {
            const { data: log } = await supabase
                .from('sms_logs')
                .select('tenant_id')
                .ilike('phone', `%${digits}%`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            tenantId = log?.tenant_id;
        }

        if (!tenantId) return null;

        // 3. Traer información del negocio
        const { data: tenant } = await supabase
            .from('tenants')
            .select('id, name, slug, address, phone')
            .eq('id', tenantId)
            .single();

        if (!tenant) return null;

        // 4. Traer catálogo de servicios del negocio
        const { data: services } = await supabase
            .from('services')
            .select('name, price, duration, is_addon')
            .eq('tenant_id', tenantId)
            .order('price', { ascending: true })
            .limit(8);

        return {
            clientName: clientName || undefined,
            tenant,
            services: services || [],
        };
    } catch (err) {
        console.warn('[meta-webhook] Error resolviendo contexto de tenant:', err);
        return null;
    }
}

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

                // Resolver contexto del negocio a partir del número de teléfono
                const context = await resolveTenantContext(targetPhone);
                const tenant = context?.tenant;
                const services = context?.services || [];
                const clientName = context?.clientName || senderName;
                const greetingName = clientName ? ` ${clientName.trim()}` : '';

                const businessName = tenant ? tenant.name : 'CitaLink';
                const bookingUrl = tenant ? `https://www.citalink.app/reserva/${tenant.slug}` : 'https://www.citalink.app';
                const businessAddress = tenant?.address ? tenant.address.trim() : null;

                // Formatear catálogo de servicios si existe
                let formattedServices = '';
                if (services.length > 0) {
                    formattedServices = services
                        .map((s) => `• *${s.name}*: $${s.price} (${s.duration} min)`)
                        .join('\n');
                }

                // Lógica de respuesta conversacional inteligente de Sara adaptada al negocio
                const lower = textBody.toLowerCase();
                let replyText = '';

                if (!lower || lower.includes('hola') || lower.includes('buenas') || lower.includes('buenos') || lower.includes('hey') || lower.includes('inicio')) {
                    if (tenant) {
                        replyText = `¡Hola${greetingName}! 🌸 Soy Sara, la recepcionista virtual de *${businessName}* ✨\n\n¿En qué te puedo apoyar hoy?\n\n📅 *Agendar cita*: Escribe "agendar" o "cita"\n💇 *Ver servicios y precios*: Escribe "servicios"\n📍 *Ubicación*: Escribe "ubicacion"\n🕒 *Horarios*: Escribe "horarios"\n👤 *Hablar con una persona*: Escribe "humano"`;
                    } else {
                        replyText = `¡Hola${greetingName}! 🌸 Soy Sara, tu asistente inteligente de CitaLink ✨\n\nEstoy lista para ayudarte con tus citas:\n\n📅 *Agendar una cita*: Escribe "agendar"\n💇 *Ver servicios*: Escribe "servicios"\n👤 *Hablar con una persona*: Escribe "humano"\n\n¿En qué te puedo apoyar hoy?`;
                    }
                } else if (lower.includes('agend') || lower.includes('cita') || lower.includes('reserv') || lower.includes('turno')) {
                    replyText = `¡Con gusto te ayudo a agendar tu cita en *${businessName}*! 🗓️✨\n\nPuedes consultar la disponibilidad en tiempo real y elegir a tu profesional favorito directamente desde nuestra plataforma:\n\n👉 ${bookingUrl}\n\n¿Buscas algún servicio o profesional en específico?`;
                } else if (lower.includes('precio') || lower.includes('costo') || lower.includes('cuanto') || lower.includes('servicio') || lower.includes('catalogo') || lower.includes('corte') || lower.includes('unas') || lower.includes('uñas')) {
                    if (formattedServices) {
                        replyText = `En *${businessName}* contamos con los siguientes servicios:\n\n${formattedServices}\n\n👉 Puedes reservar tu turno directamente aquí:\n${bookingUrl}`;
                    } else {
                        replyText = `Puedes consultar todos los servicios y precios actualizados de *${businessName}* aquí:\n👉 ${bookingUrl}`;
                    }
                } else if (lower.includes('ubicacion') || lower.includes('donde') || lower.includes('direccion') || lower.includes('llegar') || lower.includes('local')) {
                    if (businessAddress) {
                        replyText = `📍 *Ubicación de ${businessName}*:\n${businessAddress}\n\n¡Te esperamos con gusto! ¿Te gustaría agendar una cita antes de venir? 👉 ${bookingUrl}`;
                    } else {
                        replyText = `Puedes consultar la ubicación y detalles de *${businessName}* en nuestro portal:\n👉 ${bookingUrl}`;
                    }
                } else if (lower.includes('horario') || lower.includes('hora') || lower.includes('abierto') || lower.includes('dias')) {
                    replyText = `Nuestros horarios de atención habituales en *${businessName}* son de Lunes a Sábado de 9:00 AM a 8:00 PM ⏰\n\nPuedes ver los turnos libres de hoy y de la semana aquí:\n👉 ${bookingUrl}`;
                } else if (lower.includes('humano') || lower.includes('persona') || lower.includes('asesor') || lower.includes('ayuda')) {
                    replyText = `¡Entendido${greetingName}! 👤 Un asesor de *${businessName}* se pondrá en contacto contigo a la brevedad por este mismo chat. Mientras tanto, dime con confianza si hay algo puntual que quieras resolver.`;
                } else {
                    replyText = `Te he leído fuerte y claro${greetingName}: *"${textBody}"* 🌸\n\nComo asistente de *${businessName}* puedo ayudarte a *agendar citas*, *consultar servicios y precios* o *darte nuestra ubicación*.\n\nEscribe *cita* para reservar o visita directamente 👉 ${bookingUrl} ✨`;
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
