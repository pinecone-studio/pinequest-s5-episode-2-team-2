import {
  goalProgress,
  goalStreak,
  minutesOnDay,
  weekSummary,
  type DaySummary,
  type TreatmentPeriod,
} from "./progress";

// Day boundaries are local; pin the zone like progress.test.ts (UTC+8).
process.env.TZ = "Asia/Ulaanbaatar";

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const NOW = new Date("2026-10-27T21:00:00+08:00");
const WEEK_START = new Date("2026-10-21T00:00:00+08:00").getTime();
const MINUTE = 60_000;

/** Non-overlapping periods inside the week, some crossing midnight, sorted by start. */
function periods(seed: number): TreatmentPeriod[] {
  const random = lcg(seed);
  const out: TreatmentPeriod[] = [];
  let t = WEEK_START + random() * 6 * 3_600_000;
  while (t < NOW.getTime() - MINUTE) {
    const length = (5 + random() * 240) * MINUTE;
    const end = Math.min(t + length, NOW.getTime());
    out.push({ startedAt: new Date(t).toISOString(), endedAt: new Date(end).toISOString() });
    t = end + (30 + random() * 600) * MINUTE;
  }
  return out;
}

const totalMinutes = (ps: TreatmentPeriod[]) =>
  ps.reduce((sum, p) => sum + (Date.parse(p.endedAt!) - Date.parse(p.startedAt)) / MINUTE, 0);

const SETS = Array.from({ length: 100 }, (_, i) => periods(i + 1));

test("the days of the week add up to the time recorded, within rounding", () => {
  for (const ps of SETS) {
    const days = weekSummary(ps, null, NOW).map((d) => d.minutes);
    const sum = days.reduce((a, b) => a + b, 0);
    const total = totalMinutes(ps);
    // Each day is floored to whole minutes, so the sum loses less than a minute per day.
    expect(sum).toBeLessThanOrEqual(total + 1e-9);
    expect(sum).toBeGreaterThan(total - days.length);
  }
});

test("a day never counts more than 24 hours, nor time after now", () => {
  for (const ps of SETS) {
    for (const d of weekSummary(ps, 60, NOW)) {
      expect(d.minutes).toBeGreaterThanOrEqual(0);
      expect(d.minutes).toBeLessThanOrEqual(24 * 60);
    }
    const running = [
      ...ps,
      { startedAt: new Date(NOW.getTime() - 30 * MINUTE).toISOString(), endedAt: null },
    ];
    expect(minutesOnDay(running, NOW, NOW)).toBeGreaterThanOrEqual(minutesOnDay(ps, NOW, NOW));
  }
});

test("minutes only grow as time passes", () => {
  const running: TreatmentPeriod[] = [
    { startedAt: new Date(NOW.getTime() - 3 * 3_600_000).toISOString(), endedAt: null },
  ];
  let previous = -1;
  for (let m = 0; m <= 180; m += 7) {
    const later = new Date(NOW.getTime() - 3 * 3_600_000 + m * MINUTE);
    const minutes = minutesOnDay(running, later, later);
    expect(minutes).toBeGreaterThanOrEqual(previous);
    previous = minutes;
  }
});

test("goal progress is always between 0 and 1, and null without a goal", () => {
  const random = lcg(9);
  for (let i = 0; i < 500; i++) {
    const minutes = Math.floor(random() * 2000);
    const goal = 1 + Math.floor(random() * 1440);
    const p = goalProgress(minutes, goal)!;
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
    expect(p === 1).toBe(minutes >= goal);
  }
  expect(goalProgress(100, null)).toBeNull();
  expect(goalProgress(100, 0)).toBeNull();
});

test("the streak is the run of met days ending today or yesterday", () => {
  const random = lcg(11);
  for (let i = 0; i < 300; i++) {
    const met = Array.from({ length: 7 }, () => random() < 0.6);
    const summary: DaySummary[] = met.map((m, d) => ({
      day: new Date(2026, 9, 21 + d),
      minutes: 0,
      metGoal: m,
    }));
    const from = met[6] ? 6 : 5;
    let expected = 0;
    for (let d = from; d >= 0 && met[d]; d--) expected++;
    expect(goalStreak(summary)).toBe(expected);
  }
});
