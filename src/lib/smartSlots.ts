
import { addMinutes, format, parse, isBefore, isAfter } from 'date-fns';

export interface TimeSlot {
    time: string; // "10:00"
    available: boolean;
}

export interface Appointment {
    id: string;
    stylistId: string;
    start: Date;
    end: Date;
}

export interface BlockedInterval {
    start: Date;
    end: Date;
}

/**
 * Calculates total appointment duration in minutes (base service + all extra/addon services + quoter items).
 */
export function calculateAppointmentDuration(
    apt: { serviceId?: number | string | null; service_id?: number | string | null; additionalServices?: string[] | null; additional_services?: string[] | null },
    services: any[] = [],
    nailQuoterConfig?: any[] | null
): number {
    const rawSvcId = apt.serviceId ?? apt.service_id;
    const baseSvc = services.find(s => String(s.id) === String(rawSvcId));
    let baseDuration = Number(baseSvc?.duration) || 30;

    const addServices = apt.additionalServices || apt.additional_services || [];
    if (!Array.isArray(addServices) || addServices.length === 0) return baseDuration;

    // Si se seleccionó un diseño del catálogo, su duración es la duración base del servicio
    const catalogItem = addServices.find((s: string) => typeof s === 'string' && s.startsWith('Diseño Catálogo:'));
    if (catalogItem) {
        const catDurMatch = catalogItem.match(/\(?\+?(\d+)\s*min/i);
        if (catDurMatch && catDurMatch[1]) {
            baseDuration = Number(catDurMatch[1]);
        }
    }

    let total = baseDuration;

    // Pre-extract nail quoter items if config is provided
    const allNailItems: any[] = [];
    if (nailQuoterConfig && Array.isArray(nailQuoterConfig)) {
        nailQuoterConfig.forEach(cat => {
            if (cat.items && Array.isArray(cat.items)) {
                allNailItems.push(...cat.items);
            }
        });
    }

    addServices.forEach((name: string) => {
        if (!name || typeof name !== 'string') return;
        if (
            name.startsWith('Referencia:') || 
            name.startsWith('Cotización Confirmada:') || 
            name.startsWith('Cotización Estimada:') ||
            name.startsWith('Diseño Catálogo:')
        ) {
            return;
        }

        // 1. Tag de duración explícita ej. "(+15 min)", "(+20min)", "20 min", "(+30 mins)"
        const durMatch = name.match(/\(\+(\d+)\s*min/i) || name.match(/(\d+)\s*min/i) || name.match(/\+(\d+)\s*m\b/i);
        if (durMatch && durMatch[1]) {
            total += Number(durMatch[1]);
            return;
        }

        // 2. Limpieza de prefijos comunes y sufijos de precio para buscar por nombre
        const cleanName = name
            .split('(+')[0]
            .split('($')[0]
            .replace(/^Extra:\s*/i, '')
            .replace(/^Diseño:\s*/i, '')
            .replace(/^Largo:\s*/i, '')
            .replace(/^Diseño Catálogo:\s*/i, '')
            .replace(/^Adicional:\s*/i, '')
            .replace(/^Estilo:\s*/i, '')
            .replace(/\s*\(.*?\)\s*/g, '')
            .trim();

        // 3. Buscar en el catálogo de servicios generales (is_addon o cualquier servicio)
        const matchingService = services.find(s =>
            s.name.toLowerCase() === cleanName.toLowerCase() ||
            s.name.toLowerCase() === name.toLowerCase() ||
            cleanName.toLowerCase().startsWith(s.name.toLowerCase()) ||
            s.name.toLowerCase().startsWith(cleanName.toLowerCase())
        );

        if (matchingService && matchingService.duration) {
            total += Number(matchingService.duration);
            return;
        }

        // 4. Buscar en los items del cotizador de uñas (extras, largos, etc.)
        if (allNailItems.length > 0) {
            const matchingNail = allNailItems.find(item =>
                item.name.toLowerCase() === cleanName.toLowerCase() ||
                item.name.toLowerCase() === name.toLowerCase()
            );
            if (matchingNail && matchingNail.duration) {
                total += Number(matchingNail.duration);
                return;
            }
        }
    });

    return total;
}

/**
 * Detects if an additional_services entry is a nail calculator / internal metadata item
 * rather than a standalone additional service from the catalog.
 */
export function isQuoterOrMetaOption(s: string): boolean {
    if (!s || typeof s !== 'string') return true;
    const trimmed = s.trim();
    return (
        trimmed.startsWith('Referencia') ||
        trimmed.startsWith('Cotización') ||
        trimmed.startsWith('Diseño') ||
        trimmed.startsWith('Catálogo') ||
        trimmed.startsWith('Largo') ||
        trimmed.startsWith('Forma') ||
        trimmed.startsWith('Grosor') ||
        trimmed.startsWith('Técnica') ||
        trimmed.startsWith('Color') ||
        trimmed.startsWith('Efecto') ||
        trimmed.startsWith('Decoración') ||
        trimmed.startsWith('Extra') ||
        trimmed.startsWith('Estilo') ||
        trimmed.startsWith('Tamaño') ||
        trimmed.startsWith('Nivel')
    );
}

/**
 * Returns only the clean names of real additional services from the catalog
 * (e.g. ['Facial Express', 'Mascarilla']) filtering out all calculator metadata.
 */
export function getRealAdditionalServices(additionalServices?: string[] | null, services: any[] = []): string[] {
    if (!additionalServices || !Array.isArray(additionalServices) || additionalServices.length === 0) return [];
    return additionalServices
        .filter(s => !isQuoterOrMetaOption(s))
        .map(s => {
            const cleanName = s
                .replace(/^Adicional:\s*/i, '')
                .split('(+')[0]
                .split('($')[0]
                .trim();
            const matchingSvc = services.find(serv =>
                serv.name.toLowerCase() === cleanName.toLowerCase() ||
                serv.name.toLowerCase() === s.toLowerCase()
            );
            return matchingSvc ? matchingSvc.name : cleanName;
        })
        .filter(Boolean);
}

/**
 * Formats a single item from additionalServices for display in appointment details,
 * ensuring duration tags e.g. "(+20 min)" are shown if the item or service has an assigned time.
 */
export function formatAddOnItemDisplay(
    itemStr: string,
    services: any[] = [],
    nailQuoterConfig: any[] = []
): string {
    if (!itemStr) return '';
    let trimmed = itemStr.trim();
    if (trimmed.startsWith('Referencia:')) return trimmed;

    // Limpiar duraciones en cero como ", +0 min", "+0 min", "(+0 min)"
    trimmed = trimmed
        .replace(/,\s*\+0\s*min/gi, '')
        .replace(/\(\+0\s*min\)/gi, '')
        .replace(/\+0\s*min/gi, '')
        .trim();

    // Si ya contiene especificación de duración explícita positiva ej: "+20 min" o "(20 min)", retornarlo tal cual
    if (/\d+\s*min/i.test(trimmed)) {
        return trimmed;
    }

    // 1. Si es un servicio del catálogo
    const cleanServiceName = trimmed
        .replace(/^Adicional:\s*/i, '')
        .split('(+')[0]
        .split('($')[0]
        .trim();

    const matchingService = services.find(s =>
        s.name.toLowerCase() === cleanServiceName.toLowerCase() ||
        s.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (matchingService && matchingService.duration && matchingService.duration > 0) {
        if (trimmed.includes('(+') || trimmed.includes('(+$')) {
            return trimmed.replace(/\)$/, `, +${matchingService.duration} min)`);
        }
        return `${trimmed} (+${matchingService.duration} min)`;
    }

    // 2. Si es una opción del cotizador de uñas (Largo, Diseño, Extra, etc.)
    if (nailQuoterConfig && Array.isArray(nailQuoterConfig)) {
        for (const cat of nailQuoterConfig) {
            if (!cat.items || !Array.isArray(cat.items)) continue;
            for (const item of cat.items) {
                if (!item.name) continue;
                if (trimmed.toLowerCase().includes(item.name.toLowerCase())) {
                    if (item.duration && item.duration > 0) {
                        if (trimmed.includes('(+') || trimmed.includes('(+$')) {
                            return trimmed.replace(/\)$/, `, +${item.duration} min)`);
                        }
                        return `${trimmed} (+${item.duration} min)`;
                    }
                }
            }
        }
    }

    return trimmed;
}

/**
 * Generates available time slots for a given day and stylist, 
 * filtering out slots that don't fit the service duration.
 */
export function getSmartSlots(
    date: Date,
    serviceDurationMinutes: number,
    workStart: string = "09:00",
    workEnd: string = "18:00",
    existingAppointments: Appointment[] = [],
    blockedIntervals: BlockedInterval[] = [],
    bufferMinutes: number = 10 // New parameter with default
): string[] {
    const slots: string[] = [];
    const interval = 30; // 30-minute grid: shows only 9:00, 9:30, 10:00...
    const potentialStarts: Date[] = [];

    let scanTime = parse(workStart, 'HH:mm', date);
    const endTime = parse(workEnd, 'HH:mm', date);

    // 1. Generate standard grid slots (00, 15, 30, 45...)
    const now = new Date();
    while (isBefore(scanTime, endTime)) {
        potentialStarts.push(new Date(scanTime));
        scanTime = addMinutes(scanTime, interval);
    }

    // 2. Add "smart" slots: immediately after each existing appointment (PLUS BUFFER) or blocked interval
    // This allows a slot to open exactly when the previous appointment + buffer finishes.
    existingAppointments.forEach(appt => {
        const effectiveEnd = addMinutes(appt.end, bufferMinutes); // Add buffer to existing appt end
        if (isAfter(effectiveEnd, parse(workStart, 'HH:mm', date)) && isBefore(effectiveEnd, endTime)) {
            potentialStarts.push(effectiveEnd);
        }
    });

    blockedIntervals.forEach(block => {
        if (isAfter(block.end, parse(workStart, 'HH:mm', date)) && isBefore(block.end, endTime)) {
            potentialStarts.push(block.end);
        }
    });

    // 3. Sort and deduplicate timestamps
    let uniqueStarts = Array.from(new Set(potentialStarts.map(d => d.getTime())))
        .sort((a, b) => a - b)
        .map(ts => new Date(ts));

    // Filter out past slots if today (Add 15 min lead time)
    if (date.toDateString() === now.toDateString()) {
        const leadTime = addMinutes(now, 15);
        uniqueStarts = uniqueStarts.filter(start => isAfter(start, leadTime));
    }

    // 4. Validate each potential start time
    uniqueStarts.forEach(startTime => {
        // Calculate potential end time of the service (Displayed to user)
        const serviceEnd = addMinutes(startTime, serviceDurationMinutes);

        // Calculate the effective busy time this new appointment would cause (Service + Buffer)
        const busyEnd = addMinutes(startTime, serviceDurationMinutes + bufferMinutes);

        // Check if the service fits within working hours
        // strictly speaking, the service must finish by workEnd. The buffer clean up can happen after closing? 
        // usually shops want to be out at workEnd. Let's enforce busyEnd <= endTime for safety, or serviceEnd <= endTime.
        // Let's enforce serviceEnd <= endTime (User leaves at closing). Cleanup happens after.
        if (isAfter(serviceEnd, endTime) || isBefore(startTime, parse(workStart, 'HH:mm', date))) {
            return;
        }

        // Check for collision with existing appointments
        // Collision if: (StartA < EndB) and (EndA > StartB)
        // New Appt "Effective" Interval: [startTime, busyEnd]
        // Existing Appt "Effective" Interval: [appt.start, appt.end + buffer]

        const conflictWithAppt = existingAppointments.some(appt => {
            const existingEffectiveEnd = addMinutes(appt.end, bufferMinutes);
            return isBefore(startTime, existingEffectiveEnd) && isAfter(busyEnd, appt.start);
        });

        // Check for collision with manual blocked intervals
        // Manual blocks usually don't need buffers? Let's assume they are strict blocks.
        const conflictWithBlock = blockedIntervals.some(block => {
            return isBefore(startTime, block.end) && isAfter(busyEnd, block.start);
        });

        if (!conflictWithAppt && !conflictWithBlock) {
            slots.push(format(startTime, 'HH:mm'));
        }
    });

    return slots;
}
