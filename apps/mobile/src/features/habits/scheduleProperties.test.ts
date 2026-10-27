import { nextDailyAt, nextRescanAt, parseTimeOfDay } from "./schedule";

// Properties of the reminder times over many clock readings, so a reminder is never in the
// past and never more than a day (or the chosen interval) away.

process.env.TZ = "Asia/Ulaanbaatar";

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const DAY = 86_400_000;
const random = lcg(3);
const NOWS = Array.from(
  { length: 300 },
  () => new Date(Date.UTC(2026, 9, 1) + Math.floor(random() * 60 * DAY)),
);
const pad = (n: number) => String(n).padStart(2, "0");
const TIMES = Array.from(
  { length: 24 * 4 },
  (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`,
);

test("every HH:MM time parses back to itself", () => {
  for (const t of TIMES) {
    const parsed = parseTimeOfDay(t)!;
    expect(`${pad(parsed.hour)}:${pad(parsed.minute)}`).toBe(t);
  }
  for (const bad of ["24:00", "7:5", "12:60", "", "noon", "-1:00"]) {
    expect(parseTimeOfDay(bad)).toBeNull();
  }
});

test("the next daily reminder is after now, within a day, at the chosen time", () => {
  for (const now of NOWS) {
    for (const t of TIMES.filter((_, i) => i % 7 === 0)) {
      const next = nextDailyAt(t, now)!;
      expect(next.getTime()).toBeGreaterThan(now.getTime());
      expect(next.getTime() - now.getTime()).toBeLessThanOrEqual(DAY);
      expect(`${pad(next.getHours())}:${pad(next.getMinutes())}`).toBe(t);
    }
  }
});

test("the re-scan reminder is in the future and at most the interval after the last scan", () => {
  for (const now of NOWS) {
    for (const interval of [1, 7, 14, 30]) {
      const last = new Date(now.getTime() - Math.floor(random() * 40) * DAY).toISOString();
      const next = nextRescanAt(last, interval, now);
      expect(next.getTime()).toBeGreaterThan(now.getTime());
      expect(next.getHours()).toBe(10);
      const dueFromLast = next.getTime() - Date.parse(last);
      const overdue = Date.parse(last) + interval * DAY + DAY <= now.getTime();
      if (!overdue) expect(dueFromLast).toBeLessThanOrEqual((interval + 1) * DAY);
    }
    expect(nextRescanAt(null, 7, now).getTime() - now.getTime()).toBeLessThanOrEqual(2 * DAY);
  }
});
