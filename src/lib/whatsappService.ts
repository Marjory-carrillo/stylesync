// Servicio para envío de plantillas oficiales de WhatsApp vía backend seguro /api/send-sms
// Las credenciales de Twilio permanecen 100% privadas en el servidor y NUNCA se exponen al navegador.

export const TEMPLATE_CLIENTE_CITA_MANUAL = 'HXcc71cca366ff7fa242044edb96ead1bc';

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
        if (!params.clientPhone) {
            return false;
        }

        const fechaFormateada = formatDateTimeDisplay(params.date, params.time);
        const bookingLink = params.businessSlug
            ? `https://www.citalink.app/reserva/${params.businessSlug}`
            : 'https://www.citalink.app';

        const res = await fetch('/api/send-sms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phone: params.clientPhone,
                provider: 'whatsapp',
                template_sid: TEMPLATE_CLIENTE_CITA_MANUAL,
                template_variables: {
                    '1': params.clientName.trim(),
                    '2': params.businessName || 'CitaLink',
                    '3': fechaFormateada,
                    '4': params.serviceName,
                    '5': bookingLink,
                },
            }),
        });

        const data = await res.json().catch(() => ({}));
        return res.ok && data.success === true;
    } catch (e) {
        console.warn('[whatsappService] Error sending client notification:', e);
        return false;
    }
}
