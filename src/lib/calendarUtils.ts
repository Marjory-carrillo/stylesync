/**
 * Calendar Utilities for CITA-LINK
 * Generates Google Calendar links and .ics file downloads
 * with automatic 1-hour reminder.
 */

interface CalendarEvent {
  title: string;
  description: string;
  location: string;
  startDate: string;   // 'yyyy-MM-dd'
  startTime: string;   // 'HH:mm'
  durationMinutes: number;
}

/**
 * Converts a local date+time string to a UTC Date object.
 * Assumes the input is in the user's local timezone.
 */
function toUTCDate(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Formats a Date to the Google Calendar format: YYYYMMDDTHHmmss
 * Uses local time (Google Calendar handles timezone via ctz param).
 */
function toGoogleCalFormat(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

/**
 * Formats a Date to iCalendar UTC format: YYYYMMDDTHHmmssZ
 */
function toICSFormat(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
}

/**
 * Generate a Google Calendar event link.
 * Opens in a new tab, works on mobile and desktop.
 */
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const start = toUTCDate(event.startDate, event.startTime);
  const end = new Date(start.getTime() + event.durationMinutes * 60000);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toGoogleCalFormat(start)}/${toGoogleCalFormat(end)}`,
    details: event.description,
    location: event.location,
    // Timezone: Mexico City (most CITA-LINK users)
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate and download an .ics file (Apple Calendar, Outlook, etc.)
 * Includes a VALARM reminder 1 hour before.
 */
export function downloadICSFile(event: CalendarEvent): void {
  const start = toUTCDate(event.startDate, event.startTime);
  const end = new Date(start.getTime() + event.durationMinutes * 60000);
  const now = new Date();

  // Escape special characters for iCalendar format
  const escapeICS = (str: string) => str.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CitaLink//Booking//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${toICSFormat(start)}`,
    `DTEND:${toICSFormat(end)}`,
    `DTSTAMP:${toICSFormat(now)}`,
    `UID:citalink-${Date.now()}@citalink.app`,
    `SUMMARY:${escapeICS(event.title)}`,
    `DESCRIPTION:${escapeICS(event.description)}`,
    `LOCATION:${escapeICS(event.location)}`,
    'STATUS:CONFIRMED',
    // 1-hour reminder alarm
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Tu cita es en 1 hora: ${escapeICS(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  // Create and trigger download
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cita-${event.startDate}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
