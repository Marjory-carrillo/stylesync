import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const VERIFY_TOKEN = process.env.META_WA_VERIFY_TOKEN || 'citalink_meta_secret_2026';
const META_WA_ACCESS_TOKEN = process.env.META_WA_ACCESS_TOKEN;
const DEFAULT_PHONE_NUMBER_ID = process.env.META_WA_PHONE_NUMBER_ID || '1337471699449991';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface ServiceItem {
    name: string;
    price: number;
    duration: number;
    is_addon?: boolean;
    is_package?: boolean;
    price_type?: string;
    min_price?: number;
    max_price?: number;
}

interface StylistItem {
    name: string;
    role?: string | null;
    active?: boolean;
}

interface TenantContext {
    clientName?: string;
    tenant: {
        id: string;
        name: string;
        slug: string;
        address?: string | null;
        phone?: string | null;
        google_maps_url?: string | null;
    };
    services: ServiceItem[];
    stylists: StylistItem[];
    appointmentsText: string;
}

function formatPrice(s: ServiceItem): string {
    if (s.price_type === 'variable' && s.min_price && s.max_price) {
        return `$${s.min_price} - $${s.max_price}`;
    }
    return `$${s.price}`;
}

function formatServicesCategorized(services: ServiceItem[], userMessage?: string): string {
    const lowerMsg = (userMessage || '').toLowerCase();

    // Búsqueda específica si el usuario preguntó por un tipo de servicio (ej: "corte", "barba", "ceja")
    const searchKeywords = ['corte', 'barba', 'ceja', 'mascarilla', 'exfoliacion', 'facial', 'unas', 'uñas', 'gel', 'acrilico', 'pedicure', 'manicure', 'tinte', 'peinado', 'express'];
    const matchedKeyword = searchKeywords.find((kw) => lowerMsg.includes(kw));

    if (matchedKeyword) {
        const matchingServices = services.filter((s) => s.name.toLowerCase().includes(matchedKeyword));
        if (matchingServices.length > 0) {
            const list = matchingServices
                .map((s) => `• *${s.name.trim()}*: ${formatPrice(s)} (${s.duration} min)`)
                .join('\n');
            return `✨ *Opciones para "${matchedKeyword}":*\n\n${list}`;
        }
    }

    // Separar servicios principales, paquetes y adicionales
    const principales = services.filter((s) => !s.is_addon && !s.is_package);
    const paquetes = services.filter((s) => s.is_package);
    const adicionales = services.filter((s) => s.is_addon);

    const sections: string[] = [];

    if (principales.length > 0) {
        sections.push(
            `✨ *Servicios Principales:*\n` +
            principales.map((s) => `• *${s.name.trim()}*: ${formatPrice(s)} (${s.duration} min)`).join('\n')
        );
    }

    if (paquetes.length > 0) {
        sections.push(
            `🎁 *Paquetes & Combos:*\n` +
            paquetes.map((s) => `• *${s.name.trim()}*: ${formatPrice(s)} (${s.duration} min)`).join('\n')
        );
    }

    if (adicionales.length > 0) {
        sections.push(
            `✨ *Servicios Adicionales (Extras):*\n` +
            adicionales.map((s) => `• *${s.name.trim()}*: ${formatPrice(s)} (${s.duration} min)`).join('\n')
        );
    }

    return sections.join('\n\n');
}

function matchesTenant(tenantName: string, tenantSlug: string, userText: string): boolean {
    const clean = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ');
    const cleanMsg = clean(userText);
    const cleanName = clean(tenantName);
    const cleanSlug = tenantSlug.replace(/-/g, ' ');

    if (cleanMsg.includes(cleanName) || cleanMsg.includes(cleanSlug)) return true;

    const words = cleanName.split(/\s+/).filter((w) => w.length >= 3 && !['salon', 'studio', 'barberia', 'beauty', 'nails', 'nail'].includes(w));
    if (words.length > 0 && words.every((w) => cleanMsg.includes(w))) return true;

    const distinct = words.filter((w) => w.length >= 4);
    if (distinct.some((w) => cleanMsg.includes(w))) return true;

    return false;
}

function formatStylists(stylists: StylistItem[], businessName: string): string {
    if (!stylists || stylists.length === 0) {
        return `En *${businessName}* nuestro equipo está listo para atenderte con la mayor calidad.`;
    }
    const count = stylists.length;
    const countText = count === 1 ? '1 profesional disponible' : `${count} profesionales disponibles`;
    const list = stylists
        .map((st) => `• 👤 *${st.name.trim()}*${st.role ? ` — ${st.role.trim()}` : ''}`)
        .join('\n');
    return `En *${businessName}* contamos con *${countText}*:\n\n${list}`;
}

async function resolveTenantContext(phone: string, userMessage?: string): Promise<TenantContext | null> {
    try {
        const digits = phone.replace(/\D/g, '').slice(-10);
        if (!digits || digits.length < 10) return null;

        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) return null;

        const supabase = createClient(supabaseUrl, supabaseKey);

        let tenantId: string | null = null;
        let clientName: string | null = null;

        // 1. Detectar si el usuario mencionó explícitamente otro negocio en su mensaje
        if (userMessage) {
            const { data: allTenants } = await supabase.from('tenants').select('id, name, slug, address, phone, google_maps_url');
            if (allTenants && allTenants.length > 0) {
                const matched = allTenants.find((t) => matchesTenant(t.name, t.slug, userMessage));
                if (matched) {
                    tenantId = matched.id;
                    console.log('[meta-webhook] Negocio detectado por mención en texto:', matched.name);
                }
            }
        }

        // 2. Si no mencionó negocio, buscar en appointments más reciente
        if (!tenantId) {
            const { data: apt } = await supabase
                .from('appointments')
                .select('tenant_id, client_name')
                .ilike('client_phone', `%${digits}%`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            tenantId = apt?.tenant_id || null;
            clientName = apt?.client_name || null;
        }

        // Si aún no tenemos clientName, buscarlo en las citas del cliente
        if (!clientName) {
            const { data: aptClient } = await supabase
                .from('appointments')
                .select('client_name')
                .ilike('client_phone', `%${digits}%`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            clientName = aptClient?.client_name || null;
        }

        // 3. Si no hay cita, buscar en sms_logs (donde se registró el último OTP o mensaje)
        if (!tenantId) {
            const { data: log } = await supabase
                .from('sms_logs')
                .select('tenant_id')
                .ilike('phone', `%${digits}%`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            tenantId = log?.tenant_id || null;
        }

        if (!tenantId) return null;

        // 3. Traer información del negocio incluyendo enlace de google maps
        const { data: tenant } = await supabase
            .from('tenants')
            .select('id, name, slug, address, phone, google_maps_url')
            .eq('id', tenantId)
            .single();

        if (!tenant) return null;

        // 4. Traer catálogo de servicios del negocio (principales, paquetes y adicionales)
        const { data: services } = await supabase
            .from('services')
            .select('name, price, duration, is_addon, is_package, price_type, min_price, max_price')
            .eq('tenant_id', tenantId)
            .eq('active', true)
            .order('price', { ascending: true })
            .limit(30);

        // 5. Traer profesionales / estilistas del negocio
        const { data: stylists } = await supabase
            .from('stylists')
            .select('name, role, active')
            .eq('tenant_id', tenantId)
            .eq('active', true);

        // 6. Traer citas recientes o próximas del cliente
        let appointmentsText = 'No se encontraron citas registradas.';
        try {
            const { data: apts } = await supabase
                .from('appointments')
                .select('date, time, status, service_id, stylist_id, tenant_id, additional_services')
                .ilike('client_phone', `%${digits}%`)
                .order('date', { ascending: false })
                .limit(4);

            if (apts && apts.length > 0) {
                const aptLines = await Promise.all(
                    apts.map(async (a) => {
                        let sName = 'Servicio general';
                        let stName = 'Profesional asignado';
                        let tName = '';
                        if (a.tenant_id && a.tenant_id !== tenantId) {
                            const { data: t } = await supabase.from('tenants').select('name').eq('id', a.tenant_id).maybeSingle();
                            if (t?.name) tName = ` (en ${t.name})`;
                        }
                        if (a.service_id) {
                            const { data: s } = await supabase.from('services').select('name').eq('id', a.service_id).maybeSingle();
                            if (s?.name) sName = s.name;
                        }
                        if (a.stylist_id) {
                            const { data: st } = await supabase.from('stylists').select('name').eq('id', a.stylist_id).maybeSingle();
                            if (st?.name) stName = st.name;
                        }
                        const extras = Array.isArray(a.additional_services) && a.additional_services.length > 0
                            ? ` + Extras: ${a.additional_services.join(', ')}`
                            : '';
                        return `• Cita: ${a.date} a las ${String(a.time).slice(0, 5)} hrs${tName} — Servicio: ${sName}${extras} — Con: ${stName} (Estado: ${a.status})`;
                    })
                );
                appointmentsText = aptLines.join('\n');
            }
        } catch (aptErr) {
            console.warn('[meta-webhook] Error consultando citas de cliente:', aptErr);
        }

        return {
            clientName: clientName || undefined,
            tenant,
            services: (services as ServiceItem[]) || [],
            stylists: (stylists as StylistItem[]) || [],
            appointmentsText,
        };
    } catch (err) {
        console.warn('[meta-webhook] Error resolviendo contexto de tenant:', err);
        return null;
    }
}

async function generateSaraAIResponse(params: {
    userMessage: string;
    businessName: string;
    businessAddress?: string | null;
    googleMapsUrl?: string | null;
    businessPhone?: string | null;
    bookingUrl: string;
    clientName?: string;
    servicesText: string;
    stylistsText: string;
    appointmentsText: string;
}): Promise<string | null> {
    if (!OPENAI_API_KEY) return null;

    const cleanMapsUrl = params.googleMapsUrl || (params.businessAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(params.businessAddress + ' ' + params.businessName)}` : null);

    const systemPrompt = `Eres Sara, la recepcionista y asistente virtual oficial de "${params.businessName}".
Tu personalidad es amable, cálida, atenta y resolutiva. Hablas siempre en español con un tono acogedor.
Formateas tus mensajes para WhatsApp con viñetas limpias y directas para una lectura rápida y cómoda.

INFORMACIÓN DEL NEGOCIO "${params.businessName}":
- Enlace para agendar en línea: ${params.bookingUrl}
- Dirección física: ${params.businessAddress || 'Consulta los detalles en nuestro enlace de reservas'}
- Enlace exacto a Google Maps / GPS: ${cleanMapsUrl || 'No disponible'}
- Teléfono de contacto: ${params.businessPhone || 'N/A'}
- Horarios de atención: Lunes a Sábado de 9:00 AM a 8:00 PM.

EQUIPO DE PROFESIONALES DISPONIBLES:
${params.stylistsText || 'Equipo profesional disponible.'}

CATÁLOGO DE SERVICIOS Y PRECIOS:
${params.servicesText || 'Servicios disponibles en la plataforma.'}

DATOS DEL CLIENTE (${params.clientName || 'Cliente'}):
- Citas registradas en el sistema para este cliente:
${params.appointmentsText || 'No hay citas registradas recientemente.'}

REGLAS OBLIGATORIAS DE COMPORTAMIENTO (CUMPLE CON MÁXIMA RIGUROSIDAD):

1. RECONOCIMIENTO PROACTIVO DE CITAS EXISTENTES (REGLA PRIORITARIA #1):
   - ANTES de sugerir agendar o dar pasos de reserva, REVISA SIEMPRE si el cliente ya tiene una cita registrada en "DATOS DEL CLIENTE -> Citas registradas en el sistema".
   - Si el cliente pregunta "¿Puedo agendar?", "Quiero agendar", "¿Hay citas?", "¿Puedo sacar cita?" o similar, y YA TIENE una cita programada activa (confirmada o próxima):
     DEBES MENCIONARLA DE INMEDIATO PRIMERO:
     Ejemplo: "¡Hola! Veo que ya tienes una cita programada para el [fecha] a las [hora] con [profesional] para [servicio] ✨. ¿Deseas agendar una cita ADICIONAL, o necesitas consultar o modificar tu cita existente?"
   - NUNCA le des los pasos de agendar en blanco ignorando que ya tiene una cita reservada.

2. PASOS EXACTOS PARA RESERVAR EN LÍNEA:
   - Si el cliente solicita los pasos para agendar, o si confirma que desea agendar una nueva cita adicional, utiliza EXACTAMENTE estos 5 pasos breves y claros:
     1. Haz clic en el enlace: ${params.bookingUrl}
     2. Escribe tu nombre y Teléfono.
     3. Escoge Profesional y servicio.
     4. Fecha y Hora.
     5. Confirma.

3. UBICACIÓN, DIRECCIÓN Y GOOGLE MAPS (¡MUY IMPORTANTE!):
   - Cuando el cliente pregunte por la ubicación, dirección, dónde están ubicados, cómo llegar, o qué ciudad/estado/colonia es (ej. "¿dónde se ubican?", "¿qué estado es?", "¿es en Tamaulipas, Matamoros o dónde?"):
     a) Indica la dirección física exacta de ${params.businessName}: ${params.businessAddress || 'Consulta los detalles en nuestro enlace'}.
     b) Justo debajo de la dirección física, incluye OBLIGATORIAMENTE el enlace a Google Maps para que el cliente lo abra y vea la ubicación exacta en su GPS:
        📍 *Ubicación de ${params.businessName}:*
        ${params.businessAddress || 'Consulta nuestra ubicación en el enlace'}
        🗺️ *Cómo llegar en Google Maps:*
        ${cleanMapsUrl || 'Enlace disponible en la web de reserva'}
     c) Si el cliente pregunta por la ciudad, estado o zona geográfica, aclara la información disponible y recomiéndale abrir el enlace de Google Maps para ver la ruta y mapa exacto.

4. PROHIBICIÓN TOTAL DEL EMOJI DE TIJERAS (✂️):
   - CitaLink es una plataforma multi-rubro para estéticas, uñas, spas, barberías y clínicas de belleza.
   - PROHIBIDO TERMINANTEMENTE USAR EL EMOJI DE TIJERAS (✂️) EN CUALQUIER PARTE DEL MENSAJE O AL DESPEDIRTE. NUNCA USES ✂️.
   - Tampoco uses el poste de barbero (💈).
   - Usa únicamente emojis neutrales, elegantes y profesionales: ✨, 🗓️, 🌸, 📍, 🗺️, ⭐, 👤, 📋.

5. CONSULTAS DE PROFESIONALES Y SERVICIOS:
   - Si preguntan quién atiende o cuántos profesionales hay, menciona los nombres de los profesionales disponibles en ${params.businessName}.
   - Si preguntan por precios de un servicio (ej. corte, tinte, uñas, pestañas, cejas), responde con los precios y duraciones exactos del catálogo.

6. REGLA DE VERACIDAD Y CONCISIÓN:
   - Mantén tus respuestas breves, cordiales y fáciles de leer en WhatsApp. NUNCA inventes información no presente en este contexto.`;

    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: params.userMessage },
                ],
                max_tokens: 380,
                temperature: 0.5,
            }),
        });

        if (!res.ok) {
            console.warn('[meta-webhook] Error de OpenAI HTTP:', res.status);
            return null;
        }

        const data = await res.json();
        return data?.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) {
        console.error('[meta-webhook] Excepción llamando a OpenAI:', e);
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

                // Resolver contexto del negocio a partir del número de teléfono y mensaje (para detectar cambios de negocio)
                const context = await resolveTenantContext(targetPhone, textBody);
                const tenant = context?.tenant;
                const services = context?.services || [];
                const stylists = context?.stylists || [];
                const clientName = context?.clientName || senderName;
                const greetingName = clientName ? ` ${clientName.trim()}` : '';

                const businessName = tenant ? tenant.name : 'CitaLink';
                const bookingUrl = tenant ? `https://www.citalink.app/reserva/${tenant.slug}` : 'https://www.citalink.app';
                const businessAddress = tenant?.address ? tenant.address.trim() : null;
                const googleMapsUrl = tenant?.google_maps_url || (businessAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessAddress + ' ' + businessName)}` : null);

                const bookingSteps = `📋 *Pasos para reservar en línea:*\n1. Haz clic en el enlace: ${bookingUrl}\n2. Escribe tu nombre y Teléfono.\n3. Escoge Profesional y servicio.\n4. Fecha y Hora.\n5. Confirma.`;

                // Formatear servicios y estilistas para el contexto
                const servicesText = formatServicesCategorized(services);
                const stylistsText = formatStylists(stylists, businessName);

                // 1. Intentar respuesta con Inteligencia Artificial real de Sara (OpenAI GPT-4o-mini)
                let replyText = '';
                if (OPENAI_API_KEY && tenant) {
                    const aiReply = await generateSaraAIResponse({
                        userMessage: textBody,
                        businessName,
                        businessAddress,
                        googleMapsUrl,
                        businessPhone: tenant?.phone,
                        bookingUrl,
                        clientName: clientName || senderName,
                        servicesText,
                        stylistsText,
                        appointmentsText: context?.appointmentsText || 'No hay citas registradas recientemente.',
                    });
                    if (aiReply) {
                        replyText = aiReply;
                    }
                }

                // 2. Si OpenAI no está disponible o devolvió null, usar reglas conversacionales de respaldo
                if (!replyText) {
                    const lower = textBody.toLowerCase();

                    // A) Saludos
                    if (!lower || lower.includes('hola') || lower.includes('buenas') || lower.includes('buenos') || lower.includes('hey') || lower.includes('inicio')) {
                        if (tenant) {
                            replyText = `¡Hola${greetingName}! 🌸 Soy Sara, la recepcionista virtual de *${businessName}* ✨\n\n¿En qué te puedo apoyar hoy?\n\n📅 *Agendar cita*: Escribe "agendar" o "cita"\n✨ *Servicios y precios*: Escribe "servicios"\n👤 *Profesionales*: Escribe "disponibles" o "equipo"\n📍 *Ubicación*: Escribe "ubicacion"\n🕒 *Horarios*: Escribe "horarios"\n💬 *Hablar con una persona*: Escribe "humano"`;
                        } else {
                            replyText = `¡Hola${greetingName}! 🌸 Soy Sara, tu asistente inteligente de CitaLink ✨\n\nEstoy lista para ayudarte con tus citas:\n\n📅 *Agendar una cita*: Escribe "agendar"\n✨ *Ver servicios*: Escribe "servicios"\n💬 *Hablar con una persona*: Escribe "humano"\n\n¿En qué te puedo apoyar hoy?`;
                        }
                    }
                    // B) Profesionales / Estilistas / Quién atiende
                    else if (
                        lower.includes('profesional') ||
                        lower.includes('estilista') ||
                        lower.includes('barbero') ||
                        lower.includes('quien') ||
                        lower.includes('quién') ||
                        lower.includes('equipo') ||
                        lower.includes('atiende') ||
                        lower.includes('personal') ||
                        (lower.includes('cuales') && (lower.includes('disponible') || lower.includes('hay'))) ||
                        (lower.includes('cuáles') && (lower.includes('disponible') || lower.includes('hay'))) ||
                        (lower.includes('con') && lower.includes('quien'))
                    ) {
                        const stylistsText = formatStylists(stylists, businessName);
                        replyText = `${stylistsText}\n\n🗓️ Puedes consultar los horarios libres de cada uno y apartar tu turno directamente aquí:\n👉 ${bookingUrl}`;
                    }
                    // C) Agendar cita / Pasos para reservar
                    else if (lower.includes('agend') || lower.includes('cita') || lower.includes('reserv') || lower.includes('turno') || lower.includes('apartar')) {
                        if (context?.appointmentsText && context.appointmentsText.includes('• Cita:')) {
                            replyText = `¡Hola${greetingName}! ✨ Veo que ya cuentas con una cita registrada en el sistema:\n\n${context.appointmentsText}\n\n¿Deseas agendar una cita *adicional*, o necesitas consultar o modificar tu cita existente?\n\nSi deseas apartar otro turno, aquí tienes los pasos:\n${bookingSteps}`;
                        } else {
                            replyText = `¡Con gusto te ayudo a agendar tu cita en *${businessName}*! ✨\n\n${bookingSteps}\n\n¿Deseas conocer los precios o consultar con qué profesional atenderte?`;
                        }
                    }
                    // D) Precios / Servicios / Catálogo / Paquetes / Cortes / Búsqueda específica
                    else if (
                        lower.includes('precio') ||
                        lower.includes('costo') ||
                        lower.includes('cuanto') ||
                        lower.includes('cuánto') ||
                        lower.includes('servicio') ||
                        lower.includes('catalogo') ||
                        lower.includes('paquete') ||
                        lower.includes('combo') ||
                        lower.includes('corte') ||
                        lower.includes('barba') ||
                        lower.includes('ceja') ||
                        lower.includes('unas') ||
                        lower.includes('uñas')
                    ) {
                        const categorized = formatServicesCategorized(services, textBody);
                        if (categorized) {
                            replyText = `En *${businessName}* contamos con las siguientes opciones:\n\n${categorized}\n\n👉 *Reserva tu turno directamente aquí:*\n${bookingUrl}`;
                        } else {
                            replyText = `Puedes consultar todos los servicios, paquetes y precios actualizados de *${businessName}* aquí:\n👉 ${bookingUrl}`;
                        }
                    }
                    // E) Ubicación / Dirección / Google Maps / Estado / Ciudad
                    else if (
                        lower.includes('ubicacion') ||
                        lower.includes('ubicación') ||
                        lower.includes('donde') ||
                        lower.includes('dónde') ||
                        lower.includes('direccion') ||
                        lower.includes('dirección') ||
                        lower.includes('llegar') ||
                        lower.includes('local') ||
                        lower.includes('estado') ||
                        lower.includes('ciudad') ||
                        lower.includes('mapa')
                    ) {
                        const mapsSection = googleMapsUrl ? `\n\n🗺️ *Cómo llegar en Google Maps:*\n${googleMapsUrl}` : '';
                        replyText = `📍 *Ubicación de ${businessName}:*\n${businessAddress || 'Puedes consultar nuestra ubicación en el enlace.'}${mapsSection}\n\n¡Te esperamos con gusto! Puedes agendar tu turno antes de venir aquí 👉 ${bookingUrl} ✨`;
                    }
                    // F) Horarios
                    else if (lower.includes('horario') || lower.includes('hora') || lower.includes('abierto') || lower.includes('dias') || lower.includes('días')) {
                        replyText = `Nuestros horarios de atención habituales en *${businessName}* son de Lunes a Sábado de 9:00 AM a 8:00 PM ⏰\n\nPuedes ver los turnos libres de hoy y de la semana aquí:\n👉 ${bookingUrl}`;
                    }
                    // G) Contacto humano
                    else if (lower.includes('humano') || lower.includes('persona') || lower.includes('asesor') || lower.includes('ayuda')) {
                        replyText = `¡Entendido${greetingName}! 👤 Un asesor de *${businessName}* se pondrá en contacto contigo a la brevedad por este mismo chat. Mientras tanto, dime con confianza si hay algo puntual que quieras resolver.`;
                    }
                    // H) Respuesta general con menú
                    else {
                        replyText = `Te he leído fuerte y claro${greetingName}: *"${textBody}"* 🌸\n\nComo asistente de *${businessName}* puedo ayudarte a:\n• *Agendar citas* (escribe "agendar")\n• *Ver servicios y paquetes* (escribe "servicios")\n• *Conocer al equipo* (escribe "disponibles")\n• *Ver nuestra ubicación* (escribe "ubicación")\n\nO visita directamente nuestra agenda en línea 👉 ${bookingUrl} ✨`;
                    }
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
