export interface WorkingHours {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface BookingSlot {
  start_time: string;
  end_time: string;
}

export interface BlockedSlot {
  start_time: string;
  end_time: string;
}

const HEBRON_TZ = 'Asia/Hebron';

export function toHebronTime(date: Date): Date {
  const str = date.toLocaleString('en-US', { timeZone: HEBRON_TZ });
  return new Date(str);
}


export function formatTime(date: Date): string {
  return date.toLocaleTimeString('ar-PS', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: HEBRON_TZ,
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('ar-PS', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: HEBRON_TZ,
  });
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('ar-PS', {
    day: 'numeric',
    month: 'short',
    timeZone: HEBRON_TZ,
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString('ar-PS', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: HEBRON_TZ,
  });
}

export function getNext14Days(): Date[] {
  const days: Date[] = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

export function getDayOfWeek(date: Date): number {
  try {
    const dayStr = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: HEBRON_TZ,
    }).format(date);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    if (dayStr in map) return map[dayStr];
  } catch (_) {}
  return date.getDay();
}

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function getAvailableSlots(
  date: Date,
  serviceDurationMinutes: number,
  existingBookings: BookingSlot[],
  blockedSlots: BlockedSlot[],
  workingHours: WorkingHours[],
): Date[] {
  const dayOfWeek = getDayOfWeek(date);
  const wh = workingHours.find((w) => Number(w.day_of_week) === dayOfWeek);

  if (!wh || wh.is_closed) return [];

  const openMinutes = parseTimeToMinutes(wh.open_time);
  const closeMinutes = parseTimeToMinutes(wh.close_time);

  const slots: Date[] = [];
  const slotInterval = 30;

  for (let m = openMinutes; m + serviceDurationMinutes <= closeMinutes; m += slotInterval) {
    const slotStart = new Date(date);
    slotStart.setHours(Math.floor(m / 60), m % 60, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + serviceDurationMinutes * 60 * 1000);

    // Skip past slots
    if (slotStart <= new Date()) continue;

    // Check against existing bookings
    const conflictsBooking = existingBookings.some((b) => {
      const bs = new Date(b.start_time);
      const be = new Date(b.end_time);
      return slotStart < be && slotEnd > bs;
    });

    // Check against blocked slots
    const conflictsBlocked = blockedSlots.some((b) => {
      const bs = new Date(b.start_time);
      const be = new Date(b.end_time);
      return slotStart < be && slotEnd > bs;
    });

    if (!conflictsBooking && !conflictsBlocked) {
      slots.push(slotStart);
    }
  }

  return slots;
}
