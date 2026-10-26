export type TreatmentKind = "patch" | "glasses";

/** One timed period. `endedAt` is null while the timer is running. */
export type TreatmentPeriod = { startedAt: string; endedAt: string | null };

const MINUTE = 60_000;

/** Local midnight at the start of `day` and of the next day, in the phone's time zone. */
export function localDayBounds(day: Date): { start: Date; end: Date } {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  return { start, end };
}

/**
 * Whole minutes of treatment on the local day containing `day`. Periods crossing midnight
 * count only their part inside the day; a running period counts up to `now`.
 */
export function minutesOnDay(periods: TreatmentPeriod[], day: Date, now: Date): number {
  const { start, end } = localDayBounds(day);
  let total = 0;
  for (const period of periods) {
    const from = Math.max(Date.parse(period.startedAt), start.getTime());
    const to = Math.min(
      period.endedAt ? Date.parse(period.endedAt) : now.getTime(),
      end.getTime(),
      now.getTime(),
    );
    if (to > from) total += to - from;
  }
  return Math.floor(total / MINUTE);
}

/** 0..1 share of the daily goal; null when no goal is set. */
export function goalProgress(minutes: number, goalMinutes: number | null): number | null {
  if (goalMinutes === null || goalMinutes <= 0) return null;
  return Math.min(1, minutes / goalMinutes);
}
