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

/* ── Hebron wall-clock helpers ──
   All slot math must happen in salon time (Asia/Hebron), never in the
   device timezone, so a customer travelling abroad sees the same slots. */

interface HebronDateParts {
  year: number;
  month: number; // 1-12
  day: number;
}

const hebronClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: HEBRON_TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function getHebronClock(date: Date) {
  const parts: Record<string, number> = {};
  for (const p of hebronClockFormatter.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  if (parts.hour === 24) parts.hour = 0;
  return parts as {
    year: number; month: number; day: number;
    hour: number; minute: number; second: number;
  };
}

function getHebronOffsetMs(date: Date): number {
  const c = getHebronClock(date);
  const asUtc = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function getHebronDateParts(date: Date): HebronDateParts {
  const c = getHebronClock(date);
  return { year: c.year, month: c.month, day: c.day };
}

/** The exact instant of `minutesOfDay` (Hebron wall clock) on a Hebron calendar day. */
export function hebronWallTimeToDate(p: HebronDateParts, minutesOfDay: number): Date {
  const wallUtc = Date.UTC(p.year, p.month - 1, p.day) + minutesOfDay * 60000;
  let ts = wallUtc - getHebronOffsetMs(new Date(wallUtc));
  // Re-resolve once in case the first guess crossed a DST boundary.
  ts = wallUtc - getHebronOffsetMs(new Date(ts));
  return new Date(ts);
}

/** [start, end) instants of the Hebron calendar day containing `date`. */
export function getHebronDayBounds(date: Date): { start: Date; end: Date } {
  const p = getHebronDateParts(date);
  return {
    start: hebronWallTimeToDate(p, 0),
    end: hebronWallTimeToDate(p, 24 * 60),
  };
}

/* ── Formatting (always rendered in Hebron time) ── */

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

/** Minutes since Hebron midnight for the wall-clock time of `date`. */
export function getHebronMinutesOfDay(date: Date): number {
  const c = getHebronClock(date);
  return c.hour * 60 + c.minute;
}

/** Day-of-month number for the date card, in Hebron time. */
export function formatDayNumber(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: HEBRON_TZ }).format(date);
}

/** Next 14 Hebron calendar days, each as the instant of Hebron midnight. */
export function getNext14Days(): Date[] {
  const today = getHebronDateParts(new Date());
  const base = Date.UTC(today.year, today.month - 1, today.day);
  const days: Date[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(base + i * 86400000);
    days.push(hebronWallTimeToDate(
      { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() },
      0,
    ));
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

export function parseTimeToMinutes(timeStr: string): number {
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
  const dayParts = getHebronDateParts(date);

  const slots: Date[] = [];
  const slotInterval = 30;
  const now = new Date();

  for (let m = openMinutes; m + serviceDurationMinutes <= closeMinutes; m += slotInterval) {
    const slotStart = hebronWallTimeToDate(dayParts, m);
    const slotEnd = new Date(slotStart.getTime() + serviceDurationMinutes * 60 * 1000);

    // Skip past slots
    if (slotStart <= now) continue;

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
