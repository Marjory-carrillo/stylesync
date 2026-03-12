import { z } from 'zod';
import DOMPurify from 'dompurify';

// Utilidad para sanitizar strings y eliminar HTML malicioso
const sanitize = (val: string) => DOMPurify.sanitize(val);

// Utilidad para normalizar teléfonos a formato +52 (México) con longitud flexible
const normalizePhone = (val: any) => {
    if (typeof val !== 'string') return val;
    // Eliminar todo lo que no sea número
    const digits = val.replace(/\D/g, '');
    if (digits.length === 0) return val;

    // Si ya empieza con 52 y tiene una longitud razonable, asumimos que ya tiene el código de país
    if (digits.startsWith('52') && digits.length > 8) {
        return `+${digits}`;
    }
    // Si no, agregamos el +52 por defecto
    return `+52${digits}`;
};

// Esquema para validar una nueva Cita (Appointment)
export const appointmentSchema = z.object({
    clientName: z.preprocess((val) => typeof val === 'string' ? sanitize(val) : val, z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'El nombre es demasiado largo')),
    clientPhone: z.preprocess((val) => normalizePhone(sanitize(String(val))), z.string().regex(/^\+52[0-9]{7,15}$/, 'Número inválido.')),
    serviceId: z.number().positive('Debes seleccionar un servicio válido'),
    stylistId: z.number().nullable().optional(),
    date: z.preprocess((val) => typeof val === 'string' ? sanitize(val) : val, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')),
    time: z.preprocess((val) => typeof val === 'string' ? sanitize(val) : val, z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)')),
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;

// Esquema para validar un nuevo Cliente (Client)
export const clientSchema = z.object({
    name: z.preprocess((val) => typeof val === 'string' ? sanitize(val) : val, z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100)),
    phone: z.preprocess((val) => normalizePhone(sanitize(String(val))), z.string().regex(/^\+52[0-9]{7,15}$/, 'Número inválido.')),
    notes: z.preprocess((val) => typeof val === 'string' ? sanitize(val) : val, z.string().max(500, 'Las notas no pueden exceder los 500 caracteres').optional()),
});

export type ClientInput = z.infer<typeof clientSchema>;

// Esquema para validar un Servicio (Service)
export const serviceSchema = z.object({
    name: z.preprocess((val) => typeof val === 'string' ? sanitize(val) : val, z.string().min(2, 'El nombre del servicio es muy corto').max(100)),
    price: z.number().min(0, 'El precio no puede ser negativo').max(1000000, 'El precio es demasiado alto'),
    duration: z.number().min(5, 'La duración mínima es 5 minutos').max(480, 'La duración máxima es 480 minutos (8 horas)'),
    image: z.string().url('URL de imagen inválida').optional().or(z.literal('')),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

// Esquema para validar un Miembro del Equipo (Stylist)
export const stylistSchema = z.object({
    name: z.preprocess((val) => typeof val === 'string' ? sanitize(val) : val, z.string().min(2, 'El nombre es muy corto').max(100)),
    role: z.preprocess((val) => typeof val === 'string' ? sanitize(val) : val, z.string().min(2, 'El rol es muy corto').max(50)),
    phone: z.preprocess((val) => typeof val === 'string' ? sanitize(val) : val, z.string().regex(/^\+?[0-9]{8,15}$/, 'Número de teléfono inválido').optional().or(z.literal(''))),
    image: z.string().url('URL de imagen inválida').optional().or(z.literal('')),
    commissionRate: z.number().min(0).max(100).optional(),
});

export type StylistInput = z.infer<typeof stylistSchema>;
