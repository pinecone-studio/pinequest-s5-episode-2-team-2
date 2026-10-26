export type HabitKind = "outdoor" | "screen_break";
export type ReminderKind = HabitKind | "rescan";

/** "YYYY-MM-DD" for the local day containing `date` (the phone's time zone). */
export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses "HH:MM" (24-hour); null if invalid. */
export function parseTimeOfDay(text: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** Next local occurrence of `timeOfDay` strictly after `now` (today or tomorrow). */
export function nextDailyAt(timeOfDay: string, now: Date): Date | null {
  const time = parseTimeOfDay(timeOfDay);
  if (!time) return null;
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), time.hour, time.minute);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

/**
 * When to remind the parent to scan again: `intervalDays` after the last scan, at 10:00 local
 * time. With no scan yet, or if that moment has passed, remind tomorrow at 10:00.
 */
export function nextRescanAt(lastScanAt: string | null, intervalDays: number, now: Date): Date {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0);
  if (lastScanAt === null) return tomorrow;
  const last = new Date(lastScanAt);
  const due = new Date(last.getFullYear(), last.getMonth(), last.getDate() + intervalDays, 10, 0);
  return due.getTime() > now.getTime() ? due : tomorrow;
}
