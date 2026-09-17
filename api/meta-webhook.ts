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
    hasActiveAppointment: boolean;
    activeAppointmentSummary?: string;
    todayStr: string;
    currentTimeStr: string;
    formattedNow: string;
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

function getMexicoDateTime(): { todayStr: string; currentTimeStr: string; formattedNow: string } {
    const now = new Date();
    const dtf = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    const parts = dtf.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const todayStr = `${get('year')}-${get('month')}-${get('day')}`;
    const currentTimeStr = `${get('hour')}:${get('minute')}:${get('second')}`;

    const fullFormatter = new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
    const formattedNow = fullFormatter.format(now);

    return { todayStr, currentTimeStr, formattedNow };
}

function formatFriendlyDate(dateStr: string, timeStr: string): string {
    try {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const dayName = days[dateObj.getDay()];
        const monthName = months[dateObj.getMonth()];
        const timeClean = timeStr.slice(0, 5);
        return `${dayName} ${d} ${monthName} a las ${timeClean} hrs`;
    } catch {
        return `${dateStr} a las ${timeStr.slice(0, 5)} hrs`;
    }
}

function cleanWhatsAppFormatting(text: string, businessName?: string): string {
    if (!text) return '';
    let cleaned = text;

    // 1. Convertir encabezados markdown (# Título) a negrita WhatsApp (*Título*)
    cleaned = cleaned.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

    // 2. Convertir enlaces markdown [texto](url) a formato WhatsApp limpio sin duplicar enlaces
    cleaned = cleaned.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
        const cleanLabel = label.trim();
        const cleanUrl = url.trim();
        if (!cleanLabel || cleanLabel === cleanUrl || cleanLabel.startsWith('http')) {
            return cleanUrl;
        }
        return `${cleanLabel} 👉 ${cleanUrl}`;
    });

    // 3. Limpiar corchetes residuales alrededor de URLs: [https://...]
    cleaned = cleaned.replace(/\[(https?:\/\/[^\s\]]+)\]/g, '$1');

    // 4. Limpiar paréntesis residuales alrededor de URLs solas: (https://...)
    cleaned = cleaned.replace(/\((https?:\/\/[^\s\)]+)\)/g, '$1');

    // 5. Asegurar que el nombre del negocio siempre aparezca en negritas (*Nombre*) si fue mencionado sin asteriscos
    if (businessName && businessName.trim() && businessName !== 'CitaLink') {
        const escaped = businessName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<!\\*)\\b(${escaped})\\b(?!\\*)`, 'gi');
        cleaned = cleaned.replace(regex, '*$1*');
    }

    return cleaned.trim();
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

        const { todayStr, currentTimeStr, formattedNow } = getMexicoDateTime();

        // 6. Traer citas recientes o próximas del cliente
        let appointmentsText = 'No se encontraron citas registradas.';
        let hasActiveAppointment = false;
        let activeAppointmentSummary: string | undefined = undefined;

        try {
            const { data: apts } = await supabase
                .from('appointments')
                .select('id, date, time, status, service_id, stylist_id, tenant_id, additional_services')
                .ilike('client_phone', `%${digits}%`)
                .order('date', { ascending: false })
                .order('time', { ascending: false })
                .limit(10);

            if (apts && apts.length > 0) {
                const resolvedApts = await Promise.all(
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

                        const isCancelled = a.status === 'cancelada';
                        const isCompleted = a.status === 'completada';
                        const aDate = String(a.date || '').slice(0, 10);
                        const aTime = String(a.time || '00:00:00').slice(0, 8);
                        const isPast = !aDate || aDate < todayStr || (aDate === todayStr && aTime < currentTimeStr);
                        const isActive = !isCancelled && !isCompleted && !isPast && (a.status === 'confirmada' || a.status === 'pendiente');
                        const friendlyDate = formatFriendlyDate(aDate, aTime);

                        return {
                            ...a,
                            sName,
                            stName,
                            tName,
                            extras,
                            isCancelled,
                            isCompleted,
                            isPast,
                            isActive,
                            friendlyDate,
                        };
                    })
                );

                const activeList = resolvedApts.filter((a) => a.isActive);

                hasActiveAppointment = activeList.length > 0;

                if (hasActiveAppointment) {
                    activeAppointmentSummary = activeList
                        .map((a) => `• ${a.friendlyDate}${a.tName} — Servicio: ${a.sName}${a.extras} — Con: ${a.stName}`)
                        .join('\n');
                }

                if (activeList.length > 0) {
                    appointmentsText = `🟢 CITAS ACTIVAS Y VIGENTES (PROGRAMADAS A FUTURO):\n` +
                        activeList.map((a) => `• [ACTIVA] ${a.friendlyDate}${a.tName} — Servicio: ${a.sName}${a.extras} — Con: ${a.stName}`).join('\n');
                } else {
                    appointmentsText = `🟢 CITAS ACTIVAS Y VIGENTES: NINGUNA (El cliente NO tiene ninguna cita activa ni pendiente programada en este momento).`;
                }
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
            hasActiveAppointment,
            activeAppointmentSummary,
            todayStr,
            currentTimeStr,
            formattedNow,
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
    todayStr?: string;
    currentTimeStr?: string;
    formattedNow?: string;
}): Promise<string | null> {
    const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
    if (!apiKey) return null;

    const cleanMapsUrl = params.googleMapsUrl || (params.businessAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(params.businessAddress + ' ' + params.businessName)}` : null);

    const nowInfo = params.formattedNow
        ? `FECHA Y HORA ACTUAL DEL SISTEMA (Zona Horaria México / CST):
- Hoy es: ${params.formattedNow} (Fecha ISO: ${params.todayStr || 'hoy'})
- Hora actual: ${params.currentTimeStr ? params.currentTimeStr.slice(0, 5) : 'actual'} hrs\n\n`
        : '';

    const systemPrompt = `Eres Sara, la recepcionista y asistente virtual oficial de "${params.businessName}".
Tu personalidad es amable, cálida, atenta y resolutiva. Hablas siempre en español con un tono acogedor.
Formateas tus mensajes para WhatsApp con viñetas limpias y directas para una lectura rápida y cómoda.

INFORMACIÓN DEL NEGOCIO "${params.businessName}":
- Enlace para agendar en línea: ${params.bookingUrl}
- Dirección física: ${params.businessAddress || 'Consulta los detalles en nuestro enlace de reservas'}
- Enlace exacto a Google Maps / GPS: ${cleanMapsUrl || 'No disponible'}
- Teléfono de contacto: ${params.businessPhone || 'N/A'}
- Horarios de atención: Lunes a Sábado de 9:00 AM a 8:00 PM.

${nowInfo}EQUIPO DE PROFESIONALES DISPONIBLES:
${params.stylistsText || 'Equipo profesional disponible.'}

CATÁLOGO DE SERVICIOS Y PRECIOS:
${params.servicesText || 'Servicios disponibles en la plataforma.'}

ESTADO DE CITAS DEL CLIENTE (${params.clientName || 'Cliente'}):
${params.appointmentsText}

REGLAS OBLIGATORIAS DE COMPORTAMIENTO (CUMPLE CON MÁXIMA RIGUROSIDAD):

1. CONSULTA DE CITAS EXISTENTES (SOLO SI EL CLIENTE PREGUNTA EXPRESAMENTE POR SU CITA):
   - Aplica ESTA regla ÚNICAMENTE si el cliente pregunta si ya tiene una cita registrada (ejemplo: "¿Tengo cita?", "¿Tengo cita pendiente?", "¿Cuándo es mi cita?", "¿A qué hora me toca?", "¿Tengo algo apartado?").
   - Una cita cuya fecha ya pasó (ayer, hace días o meses) NUNCA es activa. NUNCA digas que el cliente tiene cita si la fecha ya transcurrió.
   - NUNCA digas que el cliente tiene una cita programada a menos que aparezca explícitamente listada bajo "🟢 CITAS ACTIVAS Y VIGENTES".
   - NUNCA menciones citas canceladas ni digas "tu cita previa fue cancelada". NUNCA inventes ni menciones citas de fechas pasadas.
   - Si la sección dice "🟢 CITAS ACTIVAS Y VIGENTES: NINGUNA":
     Respóndele amablemente:
     "En este momento no tienes ninguna cita programada en *${params.businessName}*. Si deseas apartar un turno, con gusto te ayudo: 👉 ${params.bookingUrl}"
   - Si el cliente SÍ tiene una cita activa bajo "🟢 CITAS ACTIVAS Y VIGENTES":
     Confírmale con calidez su cita utilizando exactamente el formato de fecha con día y mes en mayúscula inicial (ejemplo: Martes 12 Noviembre a las 11:00 hrs):
     "Veo que tienes una cita programada en *${params.businessName}* para el [Día Número Mes a las HH:MM hrs] con [profesional] para [servicio] ✨. ¡Te esperamos con mucho gusto! Si necesitas consultar algún detalle o realizar algún cambio en tu cita, házmelo saber con confianza."
     REGLA ESTRICTA: NUNCA le recomiendes agendar una cita adicional ni le preguntes si desea agendar otra cita cuando ya tiene una cita activa existente. Solo confírmale su cita y dile "¡Te esperamos con gusto!" o similar.
   - Si el cliente pregunta si puede cancelar o reagendar:
     Explícale que puede gestionar su cita directamente desde el enlace de CitaLink con su número de teléfono.

2. CUANDO EL CLIENTE DICE QUE QUIERE AGENDAR O RESERVAR (NUEVA CITA):
   - Esta regla aplica cuando el cliente expresa el deseo o intención de apartar una cita a futuro (ej: "quisiera agendar", "quiero agendar", "puedo agendar?", "ayúdame a reservar", "cómo aparto cita", "quiero una cita", "apartar un turno").
   - NO APLICA si el cliente dice que YA agendó, ya reservó o ya terminó (para eso aplica la regla 2.1).
   - ¡PROHIBIDO TERMINANTEMENTE DECIR "En este momento no tienes ninguna cita programada"! Eso confunde al cliente porque él no preguntó si tenía cita, él quiere agendar.
   - NUNCA envíes listas de pasos numeradas ("Paso 1: Haz clic, Paso 2: Escribe tu nombre..."). Eso parece un manual frío o una plantilla de bot y suena poco profesional en WhatsApp.
   - Respóndele de forma amable, cercana y natural invitándolo a ver los horarios y apartar su lugar:
     "¡Claro que sí! Con mucho gusto. Aquí puedes ver los horarios que tenemos libres en *${params.businessName}* y elegir el que mejor te quede: 👉 ${params.bookingUrl} ¿Para qué día te gustaría?"

2.1 CUANDO EL CLIENTE AVISA QUE YA AGENDÓ, YA RESERVÓ O YA TERMINÓ ("ya agendé", "ok ya agende", "ya quedó", "listo ya agendé", "ya terminé", "ya aparté mi cita", "ya lo hice", "listo"):
   - ¡PROHIBIDO TOTALMENTE volver a mandarle los pasos para agendar o el enlace de reservas como si no hubiera agendado!
   - El cliente te está avisando que YA realizó su reserva en la página.
   - Si el cliente YA tiene una cita activa en la sección "🟢 CITAS ACTIVAS Y VIGENTES":
     Confírmale con alegría y calidez los datos exactos de su cita:
     "¡Excelente${params.clientName ? ', ' + params.clientName : ''}! 🎉 Veo que tu cita en *${params.businessName}* quedó confirmada para el [Día Número Mes a las HH:MM hrs] con [profesional] para [servicio] ✨. ¡Te esperamos con mucho gusto! Si necesitas consultar algún detalle o realizar algún cambio, avísame con toda confianza."
   - Si en la sección dice "🟢 CITAS ACTIVAS Y VIGENTES: NINGUNA" (por ejemplo, porque la cita recién se envió y está terminando de registrarse):
     Respóndele con alegría y calidez:
     "¡Excelente${params.clientName ? ', ' + params.clientName : ''}! 🎉 ¡Muchas gracias por reservar en *${params.businessName}*! ¡Te esperamos con mucho gusto! ✨ Si necesitas consultar algún detalle o hacer algún cambio, avísame con toda confianza."
   - ¡PROHIBIDO MENCIONAR CÓDIGOS DE VERIFICACIÓN O CÓDIGOS OTP! NUNCA menciones códigos OTP ni le digas que no tiene cita ni le vuelvas a enviar la lista de pasos para agendar.

2.2 AGRADECIMIENTOS O CIERRES ("gracias", "muchas gracias", "ok gracias", "enterado", "perfecto", "vale", "excelente"):
   - Si el cliente agradece o confirma que entendió (ej: "muchas gracias", "gracias", "ok gracias", "enterado", "perfecto", "vale", "dale", "de acuerdo"):
     Respóndele con amabilidad y naturalidad:
     "¡Con mucho gusto! ✨ Quedo a tus órdenes si necesitas algo más en *${params.businessName}*. ¡Que tengas un excelente día! 🌸"
   - NUNCA repitas listas de pasos para agendar ni menús largos ante un simple agradecimiento.

3. CONVERSACIÓN NATURAL Y SALUDOS (PROHIBIDO DECIR "¡HOLA!" EN CADA RESPUESTA):
   - NUNCA comiences todas tus respuestas con "¡Hola! ✨". En una conversación fluida de WhatsApp, repetir "¡Hola!" en cada interacción suena como un contestador automático frío y robótico.
   - Si el cliente SOLO está saludando por primera vez (ej: "hola", "buenas tardes"): saluda con calidez: "¡Hola! ✨ ¿En qué puedo ayudarte hoy en *${params.businessName}*?"
   - Si el cliente ya está conversando, preguntando o pidiendo agendar (ej: "quisiera agendar", "puedo agendar?", "ayúdame a reservar", "cuánto cuesta el corte?"): VE DIRECTO AL TEMA con calidez, usando frases naturales como:
     • "¡Con mucho gusto!"
     • "¡Claro que sí!"
     • "Por supuesto,"
     • "Con gusto te ayudo:"

4. UBICACIÓN, DIRECCIÓN Y GOOGLE MAPS (¡MUY IMPORTANTE!):
   - Cuando el cliente pregunte por la ubicación, dirección, dónde están ubicados, cómo llegar, o qué ciudad/estado/colonia es (ej. "¿dónde se ubican?", "¿qué estado es?", "¿es en Tamaulipas, Matamoros o dónde?"):
     a) Indica la dirección física exacta de *${params.businessName}*: ${params.businessAddress || 'Consulta los detalles en nuestro enlace'}.
     b) Justo debajo de la dirección física, incluye OBLIGATORIAMENTE el enlace a Google Maps para que el cliente lo abra y vea la ubicación exacta en su GPS:
        📍 *Ubicación de ${params.businessName}:*
        ${params.businessAddress || 'Consulta nuestra ubicación en el enlace'}
        🗺️ *Cómo llegar en Google Maps:*
        ${cleanMapsUrl || 'Enlace disponible en la web de reserva'}
     c) Si el cliente pregunta por la ciudad, estado o zona geográfica, aclara la información disponible y recomiéndale abrir el enlace de Google Maps para ver la ruta y mapa exacto.

5. PROHIBICIÓN TOTAL DEL EMOJI DE TIJERAS (✂️):
   - CitaLink es una plataforma multi-rubro para estéticas, uñas, spas, barberías y clínicas de belleza.
   - PROHIBIDO TERMINANTEMENTE USAR EL EMOJI DE TIJERAS (✂️) EN CUALQUIER PARTE DEL MENSAJE O AL DESPEDIRTE. NUNCA USES ✂️.
   - Tampoco uses el poste de barbero (💈).
   - Usa únicamente emojis neutrales, elegantes y profesionales: ✨, 🗓️, 🌸, 📍, 🗺️, ⭐, 👤, 📋.

6. CONSULTAS DE PROFESIONALES Y SERVICIOS:
   - Si preguntan quién atiende o cuántos profesionales hay, menciona los nombres de los profesionales disponibles en *${params.businessName}*.
   - Si preguntan por precios de un servicio (ej. corte, tinte, uñas, pestañas, cejas), responde con los precios y duraciones exactos del catálogo.

7. REGLA DE VERACIDAD Y CONCISIÓN:
   - Mantén tus respuestas breves, cordiales y fáciles de leer en WhatsApp. NUNCA inventes información no presente en este contexto.

8. FORMATO DE ENLACES PARA WHATSAPP (¡CRÍTICO!):
   - WhatsApp NO soporta enlaces en formato markdown [texto](url) ni [url](url). Si usas corchetes o paréntesis, WhatsApp muestra el enlace repetido y roto como [https://...](https://...).
   - Escribe SIEMPRE la URL limpia directamente sin corchetes ni paréntesis, preferentemente precedida de 👉.
   - Ejemplo correcto:
     1. Haz clic en el enlace: ${params.bookingUrl}
   - PROHIBIDO TERMINANTEMENTE escribir enlaces con corchetes o paréntesis como [${params.bookingUrl}](${params.bookingUrl}) o [enlace](${params.bookingUrl}).

9. MENCIÓN DEL NOMBRE DEL NEGOCIO EN NEGRITAS (*${params.businessName}*):
   - Siempre y cuando sea oportuno y necesario mencionar el nombre del negocio (al saludar, dar la bienvenida, confirmar citas, dar horarios, ubicación o invitar a agendar), menciona SIEMPRE el nombre del negocio en negritas usando asteriscos de WhatsApp: *${params.businessName}*.
   - Ejemplos: "en *${params.businessName}*", "el equipo de *${params.businessName}*", "tu cita en *${params.businessName}*".`;

    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
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
        const rawContent = data?.choices?.[0]?.message?.content?.trim() || null;
        return rawContent ? cleanWhatsAppFormatting(rawContent, params.businessName) : null;
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

                // Formatear servicios y estilistas para el contexto
                const servicesText = formatServicesCategorized(services);
                const stylistsText = formatStylists(stylists, businessName);

                // 1. Intentar respuesta con Inteligencia Artificial real de Sara (OpenAI GPT-4o-mini)
                let replyText = '';
                const hasOpenAI = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
                if (hasOpenAI && tenant) {
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
                        todayStr: context?.todayStr,
                        currentTimeStr: context?.currentTimeStr,
                        formattedNow: context?.formattedNow,
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
                            replyText = `¡Hola${greetingName}! 🌸 Con mucho gusto te atiendo en *${businessName}*. ¿En qué te puedo apoyar hoy? Si gustas agendar una cita, ver nuestros servicios o consultar dudas, dime con toda confianza ✨`;
                        } else {
                            replyText = `¡Hola${greetingName}! 🌸 Soy Sara, tu asistente de CitaLink ✨ ¿En qué te puedo apoyar hoy? Con gusto te ayudo con tus citas y servicios.`;
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
                    // B.1) Cliente avisa que ya agendó / ya reservó / ya quedó
                    else if (
                        lower.includes('ya agend') ||
                        lower.includes('ya reserv') ||
                        lower.includes('ya qued') ||
                        lower.includes('ya termin') ||
                        lower.includes('ya la saque') ||
                        lower.includes('ya la apart') ||
                        lower.includes('ya lo hice') ||
                        lower.includes('listo ya') ||
                        lower.includes('ya tengo cita') ||
                        lower.includes('ya se agend') ||
                        lower === 'ya quedo' ||
                        lower === 'listo' ||
                        lower === 'ok ya' ||
                        lower.startsWith('ok ya agend') ||
                        lower.includes('ya agende')
                    ) {
                        if (context?.hasActiveAppointment && context.activeAppointmentSummary) {
                            replyText = `¡Buenísimo${greetingName}! 🎉 Ya quedó confirmada tu cita en *${businessName}*:\n\n${context.activeAppointmentSummary}\n\n¡Por acá te esperamos con mucho gusto! ✨`;
                        } else {
                            replyText = `¡Excelente${greetingName}! 🎉 ¡Muchas gracias por reservar en *${businessName}*! Ya recibimos tu solicitud, por acá te esperamos con mucho gusto ✨. Si necesitas checar o cambiar algo, avísame con toda confianza.`;
                        }
                    }
                    // B.2) Agradecimientos / Cierres
                    else if (
                        lower === 'gracias' ||
                        lower.includes('muchas gracias') ||
                        lower.includes('mil gracias') ||
                        lower.includes('gracias sara') ||
                        lower.includes('ok gracias') ||
                        lower === 'perfecto' ||
                        lower === 'excelente' ||
                        lower === 'enterado' ||
                        lower === 'vale gracias' ||
                        lower === 'ok perfecto' ||
                        lower === 'de acuerdo'
                    ) {
                        replyText = `¡Con mucho gusto${greetingName}! ✨ Quedo a tus órdenes si necesitas algo más en *${businessName}*. ¡Que tengas un excelente día! 🌸`;
                    }
                    // C) Agendar cita / Consultar cita
                    else if (
                        lower.includes('agend') ||
                        lower.includes('cita') ||
                        lower.includes('reserv') ||
                        lower.includes('turno') ||
                        lower.includes('apartar') ||
                        lower.includes('tengo') ||
                        lower.includes('pendiente') ||
                        lower.includes('cuando') ||
                        lower.includes('cuándo')
                    ) {
                        if (context?.hasActiveAppointment && context.activeAppointmentSummary) {
                            replyText = `Veo que tienes una cita programada en *${businessName}*:\n\n${context.activeAppointmentSummary}\n\n¡Te esperamos con mucho gusto! ✨ Si necesitas consultar algún detalle o hacer algún cambio en tu cita, avísame con toda confianza.`;
                        } else if (lower.includes('tengo') || lower.includes('pendiente') || lower.includes('cuando') || lower.includes('cuándo') || lower.includes('mi cita')) {
                            replyText = `Ahorita no tienes ninguna cita programada con nosotros en *${businessName}*. Si gustas apartar un turno, con gusto te paso el enlace directo:\n👉 ${bookingUrl}`;
                        } else {
                            replyText = `¡Claro que sí${greetingName}! Con mucho gusto. Aquí puedes checar los horarios libres que tenemos en *${businessName}* y elegir el que mejor te quede:\n👉 ${bookingUrl}\n\n¿Para qué día te gustaría apartar? ✨`;
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
                        replyText = `¡Hola${greetingName}! 🌸 Con gusto puedo ayudarte con cualquier consulta sobre *${businessName}*:\n\n• *Agendar citas* (escribe "agendar")\n• *Ver servicios y paquetes* (escribe "servicios")\n• *Conocer al equipo* (escribe "disponibles")\n• *Ver nuestra ubicación* (escribe "ubicación")\n\nO aparta tu cita directamente en nuestra agenda en línea 👉 ${bookingUrl} ✨`;
                    }
                }

                replyText = cleanWhatsAppFormatting(replyText, businessName);
                console.log('[meta-webhook] Texto a responder por Sara:\n', replyText);

                // Enviar respuesta inmediata a WhatsApp vía Meta Graph API
                const metaToken = process.env.META_WA_ACCESS_TOKEN || META_WA_ACCESS_TOKEN;
                const metaUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
                const sendRes = await fetch(metaUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${metaToken}`,
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
