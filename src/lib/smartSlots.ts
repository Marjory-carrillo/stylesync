
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
    const interval = 15; // Granularity of 15 minutes
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

    // Filter out past slots if today
    if (date.toDateString() === now.toDateString()) {
        uniqueStarts = uniqueStarts.filter(start => isAfter(start, now));
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
