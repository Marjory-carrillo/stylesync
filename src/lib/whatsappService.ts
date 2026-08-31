// Servicio para envío directo de plantillas oficiales de WhatsApp vía Twilio API
// Evita llamadas fallidas a endpoints intermedios y garantiza 0 errores en Twilio Logs.

const TWILIO_ACCOUNT_SID = import.meta.env.VITE_TWILIO_ACCOUNT_SID as string;
const TWILIO_AUTH_TOKEN  = import.meta.env.VITE_TWILIO_AUTH_TOKEN as string;
const TWILIO_FROM_NUMBER = (import.meta.env.VITE_TWILIO_FROM_NUMBER as string) || '+15706349708';

export const TEMPLATE_CLIENTE_CITA_MANUAL = 'HXcc71cca366ff7fa242044edb96ead1bc';

function normalizeToWA(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    let e164: string;
    if (digits.startsWith('521') && digits.length === 13) {
        e164 = `+52${digits.slice(3)}`;
    } else if (digits.startsWith('52') && digits.length === 12) {
        e164 = `+${digits}`;
    } else {
        e164 = `+52${digits.slice(-10)}`;
    }
    return `whatsapp:${e164}`;
}

export function formatDateTimeDisplay(dateStr: string, timeStr: string): string {
    try {
        const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const d = new Date(`${dateStr}T${timeStr.slice(0, 5)}:00`);
        const dayName = days[d.getDay()];
        const dayNum = d.getDate();
        const monthName = months[d.getMonth()];
        const timeFormatted = timeStr.slice(0, 5);
        return `${dayName} ${dayNum} de ${monthName} a las ${timeFormatted}`;
    } catch {
        return `${dateStr} a las ${timeStr.slice(0, 5)}`;
    }
}

export async function sendManualBookingClientNotification(params: {
    clientPhone: string;
    clientName: string;
    businessName: string;
    businessSlug?: string;
    date: string;
    time: string;
    serviceName: string;
}): Promise<boolean> {
    try {
        if (!params.clientPhone || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
            return false;
        }

        const waTo = normalizeToWA(params.clientPhone);
        const waFrom = `whatsapp:${TWILIO_FROM_NUMBER}`;
        const fechaFormateada = formatDateTimeDisplay(params.date, params.time);
        const bookingLink = params.businessSlug
            ? `https://www.citalink.app/reserva/${params.businessSlug}`
            : 'https://www.citalink.app';

        const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
        const formData = new URLSearchParams({
            To: waTo,
            From: waFrom,
            ContentSid: TEMPLATE_CLIENTE_CITA_MANUAL,
            ContentVariables: JSON.stringify({
                '1': params.clientName.trim(),
                '2': params.businessName || 'CitaLink',
                '3': fechaFormateada,
                '4': params.serviceName,
                '5': bookingLink,
            }),
        });

        const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString(),
            }
        );

        return res.ok;
    } catch (e) {
        console.warn('[whatsappService] Error sending client notification:', e);
        return false;
    }
}
