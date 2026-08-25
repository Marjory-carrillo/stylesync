import type { Service, Stylist, WeekSchedule } from './types/store.types';

// ─── Default Schedules ───
const STANDARD_SCHEDULE: WeekSchedule = {
    monday: { open: true, start: '09:00', end: '18:00' },
    tuesday: { open: true, start: '09:00', end: '18:00' },
    wednesday: { open: true, start: '09:00', end: '18:00' },
    thursday: { open: true, start: '09:00', end: '18:00' },
    friday: { open: true, start: '09:00', end: '18:00' },
    saturday: { open: true, start: '10:00', end: '15:00' },
    sunday: { open: false, start: '09:00', end: '14:00' },
};

export const CATEGORY_DEFAULTS: Record<string, {
    services: (Omit<Service, 'id'> & { is_addon?: boolean; enable_quoter?: boolean; description?: string })[];
    stylists: Omit<Stylist, 'id'>[];
    schedule: WeekSchedule;
}> = {
    barbershop: {
        services: [
            { name: 'Corte Clásico', price: 180, duration: 30, image: '', is_addon: false, enable_quoter: false },
            { name: 'Corte + Barba (Ritual)', price: 280, duration: 50, image: '', is_addon: false, enable_quoter: false },
            { name: 'Arreglo de Barba & Toalla Caliente', price: 150, duration: 25, image: '', is_addon: false, enable_quoter: false },
            { name: 'Corte Niño', price: 140, duration: 30, image: '', is_addon: false, enable_quoter: false },
            { name: 'Exfoliación & Mascarilla Black', price: 120, duration: 20, image: '', is_addon: true, enable_quoter: false },
        ],
        stylists: [
            { name: 'Barbero Principal', role: 'Master Barber', phone: '', image: '' },
        ],
        schedule: STANDARD_SCHEDULE
    },
    beauty_salon: {
        services: [
            { name: 'Corte Dama & Peinado', price: 250, duration: 45, image: '', is_addon: false, enable_quoter: false },
            { name: 'Tinte Completo', price: 650, duration: 120, image: '', is_addon: false, enable_quoter: false },
            { name: 'Balayage / Efectos de Color', price: 1200, duration: 180, image: '', is_addon: false, enable_quoter: false },
            { name: 'Peinado Evento / Alaciado', price: 350, duration: 60, image: '', is_addon: false, enable_quoter: false },
            { name: 'Tratamiento Capilar Profundo', price: 300, duration: 30, image: '', is_addon: true, enable_quoter: false },
        ],
        stylists: [
            { name: 'Estilista Senior', role: 'Senior Stylist', phone: '', image: '' },
        ],
        schedule: STANDARD_SCHEDULE
    },
    nail_bar: {
        services: [
            { name: 'Manicura', price: 180, duration: 60, image: '', is_addon: false, enable_quoter: false },
            { name: 'Uñas Acrílicas (1 tono liso)', price: 300, duration: 120, image: '', is_addon: false, enable_quoter: true, description: '(Un tono liso)' },
            { name: 'Uñas Poligel', price: 250, duration: 75, image: '', is_addon: false, enable_quoter: false },
            { name: 'Gel Semipermanente', price: 200, duration: 45, image: '', is_addon: false, enable_quoter: false },
            { name: 'Facial Express', price: 250, duration: 15, image: '', is_addon: true, enable_quoter: false },
        ],
        stylists: [
            { name: 'Master Nail Artist', role: 'Especialista en Uñas', phone: '', image: '' },
        ],
        schedule: STANDARD_SCHEDULE
    },
    nails: {
        services: [
            { name: 'Manicura', price: 180, duration: 60, image: '', is_addon: false, enable_quoter: false },
            { name: 'Uñas Acrílicas (1 tono liso)', price: 300, duration: 120, image: '', is_addon: false, enable_quoter: true, description: '(Un tono liso)' },
            { name: 'Uñas Poligel', price: 250, duration: 75, image: '', is_addon: false, enable_quoter: false },
            { name: 'Gel Semipermanente', price: 200, duration: 45, image: '', is_addon: false, enable_quoter: false },
            { name: 'Facial Express', price: 250, duration: 15, image: '', is_addon: true, enable_quoter: false },
        ],
        stylists: [
            { name: 'Master Nail Artist', role: 'Especialista en Uñas', phone: '', image: '' },
        ],
        schedule: STANDARD_SCHEDULE
    },
    spa: {
        services: [
            { name: 'Masaje Relajante Completo', price: 550, duration: 60, image: '', is_addon: false, enable_quoter: false },
            { name: 'Limpieza Facial Profunda', price: 450, duration: 50, image: '', is_addon: false, enable_quoter: false },
            { name: 'Masaje Descontracturante', price: 650, duration: 60, image: '', is_addon: false, enable_quoter: false },
            { name: 'Exfoliación Corporal', price: 350, duration: 30, image: '', is_addon: true, enable_quoter: false },
        ],
        stylists: [
            { name: 'Terapeuta Principal', role: 'Cosmetóloga & Terapeuta', phone: '', image: '' },
        ],
        schedule: STANDARD_SCHEDULE
    },
    pet_grooming: {
        services: [
            { name: 'Baño Perro Pequeño', price: 200, duration: 45, image: '', is_addon: false, enable_quoter: false },
            { name: 'Baño Perro Grande', price: 350, duration: 75, image: '', is_addon: false, enable_quoter: false },
            { name: 'Corte de Raza & Estilizado', price: 400, duration: 90, image: '', is_addon: false, enable_quoter: false },
            { name: 'Corte de Uñas & Limpieza', price: 100, duration: 15, image: '', is_addon: true, enable_quoter: false },
        ],
        stylists: [
            { name: 'Groomer Principal', role: 'Estilista Canino', phone: '', image: '' },
        ],
        schedule: STANDARD_SCHEDULE
    },
    consulting: {
        services: [
            { name: 'Consulta General', price: 500, duration: 30, image: '', is_addon: false, enable_quoter: false },
            { name: 'Asesoría Especializada', price: 800, duration: 60, image: '', is_addon: false, enable_quoter: false },
        ],
        stylists: [
            { name: 'Consultor Principal', role: 'Especialista', phone: '', image: '' },
        ],
        schedule: {
            ...STANDARD_SCHEDULE,
            saturday: { open: false, start: '10:00', end: '14:00' },
        }
    },
    lashes: {
        services: [
            { name: 'Pestañas Clásicas 1x1', price: 380, duration: 90, image: '', is_addon: false, enable_quoter: false },
            { name: 'Pestañas Volumen Híbrido / Ruso', price: 480, duration: 120, image: '', is_addon: false, enable_quoter: false },
            { name: 'Lifting de Pestañas', price: 300, duration: 60, image: '', is_addon: false, enable_quoter: false },
            { name: 'Diseño de Cejas & Laminado', price: 250, duration: 40, image: '', is_addon: false, enable_quoter: false },
        ],
        stylists: [
            { name: 'Lashista Principal', role: 'Lash & Brow Expert', phone: '', image: '' },
        ],
        schedule: STANDARD_SCHEDULE
    },
    other: {
        services: [
            { name: 'Servicio Principal', price: 250, duration: 45, image: '', is_addon: false, enable_quoter: false },
            { name: 'Servicio Secundario', price: 180, duration: 30, image: '', is_addon: false, enable_quoter: false },
        ],
        stylists: [
            { name: 'Especialista Principal', role: 'Staff', phone: '', image: '' },
        ],
        schedule: STANDARD_SCHEDULE
    }
};
