import { z } from 'zod';
import DOMPurify from 'dompurify';

// Utilidad para sanitizar strings y eliminar HTML malicioso
const sanitize = (val: string) => DOMPurify.sanitize(val);

// Utilidad para normalizar teléfonos a formato E.164 internacional (+[código_país][número])
export const normalizePhone = (val: any) => {
    if (typeof val !== 'string') return val;
    const str = val.trim();
    if (!str) return val;

    // Si el usuario ingresó con el signo +, conservamos íntegro su código internacional (+1305..., +34..., +58..., +593...)
    if (str.startsWith('+')) {
        const digits = str.slice(1).replace(/\D/g, '');
        return digits ? `+${digits}` : val;
    }

    const digits = str.replace(/\D/g, '');
    if (digits.length === 0) return val;

    // Si es un número internacional sin el signo + (ej. 1 para EE.UU./Canadá, 52 MX, 58 Vzla, 593 Ecuador, 34 España, 57 Colombia, 54 Argentina, 56 Chile, 51 Perú)
    if (digits.length >= 11 && (
        digits.startsWith('1') || digits.startsWith('52') || digits.startsWith('58') || 
        digits.startsWith('593') || digits.startsWith('34') || digits.startsWith('57') || 
        digits.startsWith('54') || digits.startsWith('56') || digits.startsWith('51')
    )) {
        return `+${digits}`;
    }

    // Por defecto para números locales de 10 dígitos (estándar México)
    return `+52${digits}`;
};

// Utilidad para mostrar teléfonos de manera limpia y uniforme en la interfaz
export const formatPhoneDisplay = (val: any): string => {
    if (!val || typeof val !== 'string') return '';
    const str = val.trim();
    if (!str) return '';

    // Para números locales de México (+52) de 10 dígitos, se remueve el +52 para mostrar los 10 dígitos limpios
    if (str.startsWith('+52') && str.length === 13) {
        return str.slice(3);
    }
    if (str.startsWith('52') && str.length === 12 && !str.startsWith('+')) {
        return str.slice(2);
    }

    // Para cualquier otro país (EE.UU. +1, España +34, Venezuela +58, Ecuador +593, etc.),
    // se mantiene completo con su código internacional intacto
    return str;
};

// Esquema para validar una nueva Cita (Appointment)
export const appointmentSchema = z.object({
    clientName: z.preprocess((val) => typeof val === 'string' ? sanitize(val) : val, z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'El nombre es demasiado largo')),
    clientPhone: z.preprocess((val) => normalizePhone(sanitize(String(val))), z.string().regex(/^\+[1-9]\d{7,14}$/, 'Número de teléfono inválido (debe incluir 10 dígitos o código internacional).')),
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
    description: z.preprocess((val) => typeof val === 'string' ? sanitize(val) : val, z.string().max(500, 'La descripción no debe exceder 500 caracteres').optional().or(z.literal(''))),
    price: z.number().min(0, 'El precio no puede ser negativo').max(1000000, 'El precio es demasiado alto'),
    duration: z.number().min(5, 'La duración mínima es 5 minutos').max(480, 'La duración máxima es 480 minutos (8 horas)'),
    image: z.string().url('URL de imagen inválida').optional().or(z.literal('')),
    isAddon: z.boolean().optional().default(false),
    enableQuoter: z.boolean().optional().default(false),
    priceType: z.enum(['fixed', 'no_price', 'range']).optional().default('fixed'),
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

// Esquema para validar un Miembro del Equipo (Stylist)
export const stylistSchema = z.object({
    name: z.preprocess((val) => typeof val === 'string' ? sanitize(val) : val, z.string().min(2, 'El nombre es muy corto').max(100)),
    role: z.preprocess((val) => typeof val === 'string' ? sanitize(val) : val, z.string().min(2, 'El rol es muy corto').max(50)),
    phone: z.preprocess((val) => typeof val === 'string' ? sanitize(val) : val, z.string().regex(/^\+?[0-9]{8,15}$/, 'Número de teléfono inválido').optional().or(z.literal(''))),
    image: z.string().url('URL de imagen inválida').optional().or(z.literal('')),
    commissionRate: z.number().min(0).max(100).optional(),
    schedule: z.any().optional().nullable(),
    serviceIds: z.array(z.number()).optional().nullable(),
});

export type StylistInput = z.infer<typeof stylistSchema>;

// Esquema para validar la creación de un nuevo Negocio (Tenant)
export const createTenantSchema = z.object({
    name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(100, 'El nombre es demasiado largo'),
    slug: z.string()
        .min(3, 'El link debe tener al menos 3 caracteres')
        .max(50, 'El link es demasiado largo')
        .regex(/^[a-z0-9-]+$/, 'El Link solo puede contener letras minúsculas, números y guiones.'),
    address: z.string().max(200, 'La dirección es demasiado larga').optional(),
    category: z.string().min(1, 'Por favor selecciona el tipo de negocio.'),
    ownerEmail: z.string().email('El correo del dueño no es válido').min(1, 'El correo del dueño es requerido'),
});

// Esquema para la configuración del negocio (Settings)
export const businessConfigSchema = z.object({
    name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').max(100),
    phone: z.string()
        .regex(/^\+?[0-9\s-]{8,15}$/, 'Número de teléfono inválido')
        .optional()
        .or(z.literal('')),
    address: z.string().max(200).optional(),
    googleMapsUrl: z.string()
        .url('Debe ser una URL válida (ej. https://maps.app.goo.gl/...)')
        .optional()
        .or(z.literal('')),
    category: z.string().optional(),
    instagramUrl: z.string().url('Debe ser una URL válida').optional().or(z.literal('')),
    facebookUrl: z.string().url('Debe ser una URL válida').optional().or(z.literal('')),
    tiktokUrl: z.string().url('Debe ser una URL válida').optional().or(z.literal('')),
    marketplaceEnabled: z.boolean().optional(),
    marketplaceCommissionRate: z.number().min(0).max(100).optional(),
});
