// Servicio para envío de plantillas oficiales de WhatsApp vía backend seguro /api/send-sms
// Las credenciales de Twilio permanecen 100% privadas en el servidor y NUNCA se exponen al navegador.

export const TEMPLATE_CLIENTE_CITA_MANUAL = 'HXcc71cca366ff7fa242044edb96ead1bc';
export const META_TEMPLATE_CLIENTE_CITA_MANUAL = 'citalink_cliente_cita_manual';

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
    tenantId?: string;
}): Promise<boolean> {
    try {
        if (!params.clientPhone) return false;

        const fechaFormateada = formatDateTimeDisplay(params.date, params.time);
        const bookingLink = params.businessSlug
            ? `https://www.citalink.app/reserva/${params.businessSlug}`
            : 'https://www.citalink.app';

        const res = await fetch('/api/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: params.clientPhone,
                provider: 'whatsapp',
                tenant_id: params.tenantId,
                template_name: META_TEMPLATE_CLIENTE_CITA_MANUAL,
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

export async function sendAppointmentCancellationNotification(params: {
    clientPhone?: string;
    clientName: string;
    businessName: string;
    date: string;
    time: string;
    serviceName?: string;
    adminPhone?: string;
    tenantId?: string;
}): Promise<void> {
    const fechaFormateada = formatDateTimeDisplay(params.date, params.time);
    const bName = params.businessName || 'CitaLink';

    // 1. Notificar al Cliente vía Meta Cloud API
    if (params.clientPhone) {
        try {
            await fetch('/api/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: params.clientPhone,
                    provider: 'whatsapp',
                    tenant_id: params.tenantId,
                    template_name: 'citalink_cliente_cancelacion',
                    template_sid: 'HXb2828c0bd3aabc8edd912c81db56884f',
                    template_variables: {
                        '1': params.clientName.trim(),
                        '2': bName,
                        '3': fechaFormateada,
                    },
                }),
            });
        } catch (e) {
            console.warn('[whatsappService] Error notificando cancelación a cliente:', e);
        }
    }

    // 2. Notificar al Admin / Profesional vía Meta Cloud API
    if (params.adminPhone) {
        try {
            await fetch('/api/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: params.adminPhone,
                    provider: 'whatsapp',
                    tenant_id: params.tenantId,
                    template_name: 'citalink_admin_cancelacion',
                    template_sid: 'HXdc7be5995c074f498642e9536b157947',
                    template_variables: {
                        '1': bName,
                        '2': params.clientName.trim(),
                        '3': params.serviceName || 'Servicio',
                        '4': fechaFormateada,
                        '5': params.clientPhone || 'No especificado',
                    },
                }),
            });
        } catch (e) {
            console.warn('[whatsappService] Error notificando cancelación a admin:', e);
        }
    }
}

export async function sendAppointmentRescheduleNotification(params: {
    clientPhone?: string;
    clientName: string;
    businessName: string;
    date: string;
    time: string;
    serviceName: string;
    oldDate?: string;
    oldTime?: string;
    adminPhone?: string;
    tenantId?: string;
}): Promise<void> {
    const fechaFormateada = formatDateTimeDisplay(params.date, params.time);
    const bName = params.businessName || 'CitaLink';

    // 1. Notificar al Cliente vía Meta Cloud API
    if (params.clientPhone) {
        try {
            await fetch('/api/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: params.clientPhone,
                    provider: 'whatsapp',
                    tenant_id: params.tenantId,
                    template_name: 'citalink_cliente_reprogramacion',
                    template_sid: 'HX84b5a4b7cf045e4fe976564f705a0613',
                    template_variables: {
                        '1': params.clientName.trim(),
                        '2': bName,
                        '3': fechaFormateada,
                        '4': params.serviceName,
                    },
                }),
            });
        } catch (e) {
            console.warn('[whatsappService] Error notificando reprogramación a cliente:', e);
        }
    }

    // 2. Notificar al Admin / Profesional vía Meta Cloud API
    if (params.adminPhone) {
        const fechaAnterior = params.oldDate && params.oldTime
            ? formatDateTimeDisplay(params.oldDate, params.oldTime)
            : 'Previa';
        try {
            await fetch('/api/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: params.adminPhone,
                    provider: 'whatsapp',
                    tenant_id: params.tenantId,
                    template_name: 'citalink_admin_reprogramacion',
                    template_sid: 'HX16247c41bf5cf9f31236c2e574337308',
                    template_variables: {
                        '1': bName,
                        '2': params.clientName.trim(),
                        '3': params.serviceName,
                        '4': fechaFormateada,
                        '5': params.clientPhone || 'No especificado',
                        '6': fechaAnterior,
                    },
                }),
            });
        } catch (e) {
            console.warn('[whatsappService] Error notificando reprogramación a admin:', e);
        }
    }
}

export async function sendPriceUpdateNotification(params: {
    clientPhone: string;
    clientName: string;
    businessName: string;
    date: string;
    time: string;
    serviceName: string;
    price: number;
    appointmentId?: string;
    businessSlug?: string;
    tenantId?: string;
}): Promise<void> {
    if (!params.clientPhone) return;

    const fechaFormateada = formatDateTimeDisplay(params.date, params.time);
    const bName = params.businessName || 'CitaLink';
    const bookingLink = params.appointmentId
        ? `https://www.citalink.app/reagendar/${params.appointmentId}`
        : (params.businessSlug ? `https://www.citalink.app/reserva/${params.businessSlug}` : 'https://www.citalink.app');

    try {
        await fetch('/api/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: params.clientPhone,
                provider: 'whatsapp',
                tenant_id: params.tenantId,
                template_name: 'citalink_cliente_actualizacion_precio',
                template_sid: 'HX7e31d42fe0693980543f4fb2308e05a8',
                template_variables: {
                    '1': params.clientName.trim(),
                    '2': bName,
                    '3': fechaFormateada,
                    '4': params.serviceName,
                    '5': String(params.price),
                    '6': bookingLink,
                },
            }),
        });
    } catch (e) {
        console.warn('[whatsappService] Error notificando actualización de precio a cliente:', e);
    }
}
