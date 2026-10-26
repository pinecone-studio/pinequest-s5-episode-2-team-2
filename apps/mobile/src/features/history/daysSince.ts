/** Whole local calendar days from `iso` to `now`: 0 today, 1 yesterday. Never negative. */
export function daysSince(iso: string, now: Date = new Date()): number | null {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  // Round so a daylight-saving day of 23 or 25 hours still counts as one day.
  return Math.max(0, Math.round((start(now) - start(then)) / 86_400_000));
}
