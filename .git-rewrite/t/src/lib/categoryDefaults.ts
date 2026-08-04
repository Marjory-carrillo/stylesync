import type { Service, Stylist, WeekSchedule } from './store';

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
    services: Omit<Service, 'id'>[];
    stylists: Omit<Stylist, 'id'>[];
    schedule: WeekSchedule;
}> = {
    barbershop: {
        services: [
            { name: 'Corte Clásico', price: 15, duration: 30, image: '' },
            { name: 'Corte + Barba', price: 25, duration: 50, image: '' },
            { name: 'Afeitado Royal', price: 12, duration: 25, image: '' },
            { name: 'Corte Niño', price: 12, duration: 30, image: '' },
        ],
        stylists: [
            { name: 'Barbero Principal', role: 'Master Barber', phone: '', image: '' },
            { name: 'Silla 2', role: 'Junior Barber', phone: '', image: '' },
        ],
        schedule: STANDARD_SCHEDULE
    },
    beauty_salon: {
        services: [
            { name: 'Corte Dama', price: 25, duration: 45, image: '' },
            { name: 'Manicure Gel', price: 30, duration: 60, image: '' },
            { name: 'Tinte Completo', price: 60, duration: 120, image: '' },
            { name: 'Brushing', price: 20, duration: 30, image: '' },
        ],
        stylists: [
            { name: 'Estilista Senior', role: 'Senior Stylist', phone: '', image: '' },
            { name: 'Manicurista', role: 'Nail Artist', phone: '', image: '' },
        ],
        schedule: STANDARD_SCHEDULE
    },
    spa: {
        services: [
            { name: 'Masaje Relajante', price: 50, duration: 60, image: '' },
            { name: 'Limpieza Facial', price: 40, duration: 50, image: '' },
            { name: 'Masaje Descontracturante', price: 60, duration: 60, image: '' },
        ],
        stylists: [
            { name: 'Terapeuta 1', role: 'Masajista', phone: '', image: '' },
            { name: 'Cosmetóloga', role: 'Facialist', phone: '', image: '' },
        ],
        schedule: STANDARD_SCHEDULE
    },
    pet_grooming: {
        services: [
            { name: 'Baño Perro Pequeño', price: 20, duration: 45, image: '' },
            { name: 'Baño Perro Grande', price: 35, duration: 75, image: '' },
            { name: 'Corte de Raza', price: 40, duration: 90, image: '' },
            { name: 'Corte de Uñas', price: 10, duration: 15, image: '' },
        ],
        stylists: [
            { name: 'Groomer Principal', role: 'Estilista Canino', phone: '', image: '' },
            { name: 'Asistente de Baño', role: 'Bañador', phone: '', image: '' },
        ],
        schedule: STANDARD_SCHEDULE
    },
    consulting: {
        services: [
            { name: 'Consulta General', price: 50, duration: 30, image: '' },
            { name: 'Asesoría Especializada', price: 80, duration: 60, image: '' },
        ],
        stylists: [
            { name: 'Consultor Principal', role: 'Especialista', phone: '', image: '' },
        ],
        schedule: {
            ...STANDARD_SCHEDULE,
            saturday: { open: false, start: '10:00', end: '14:00' }, // Usually closed weekends
        }
    },
    other: {
        services: [
            { name: 'Servicio Básico', price: 20, duration: 30, image: '' },
            { name: 'Servicio Premium', price: 50, duration: 60, image: '' },
        ],
        stylists: [
            { name: 'Profesional 1', role: 'Staff', phone: '', image: '' },
        ],
        schedule: STANDARD_SCHEDULE
    }
};
