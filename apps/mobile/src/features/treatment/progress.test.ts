import { goalProgress, goalStreak, minutesOnDay, summaryStart, weekSummary } from "./progress";
import type { DaySummary } from "./progress";

// Day boundaries are local; pin the zone so the test means the same everywhere (UTC+8).
process.env.TZ = "Asia/Ulaanbaatar";
const at = (local: string) => new Date(`${local}+08:00`);
const period = (from: string, to: string | null) => ({
  startedAt: at(from).toISOString(),
  endedAt: to ? at(to).toISOString() : null,
});
const day = at("2026-10-26T12:00:00");
const evening = at("2026-10-26T21:00:00");

test("adds up closed periods on the day", () => {
  const periods = [
    period("2026-10-26T08:00:00", "2026-10-26T09:30:00"),
    period("2026-10-26T15:00:00", "2026-10-26T15:45:00"),
  ];
  expect(minutesOnDay(periods, day, evening)).toBe(135);
});

test("counts only the part of a period inside the day", () => {
  const overnight = [period("2026-10-25T23:00:00", "2026-10-26T01:00:00")];
  expect(minutesOnDay(overnight, day, evening)).toBe(60);
  expect(minutesOnDay(overnight, at("2026-10-25T12:00:00"), evening)).toBe(60);
});

test("a running timer counts up to now", () => {
  expect(minutesOnDay([period("2026-10-26T20:00:00", null)], day, evening)).toBe(60);
});

test("ignores other days and rounds down to whole minutes", () => {
  const periods = [
    period("2026-10-24T08:00:00", "2026-10-24T10:00:00"),
    period("2026-10-26T10:00:00", "2026-10-26T10:00:59"),
  ];
  expect(minutesOnDay(periods, day, evening)).toBe(0);
});

test("goal progress is capped at 1 and absent without a goal", () => {
  expect(goalProgress(60, 120)).toBe(0.5);
  expect(goalProgress(200, 120)).toBe(1);
  expect(goalProgress(60, null)).toBeNull();
});

describe("weekSummary", () => {
  const periods = [
    period("2026-10-20T08:00:00", "2026-10-20T10:00:00"),
    period("2026-10-24T23:00:00", "2026-10-25T01:00:00"),
    period("2026-10-26T20:00:00", null),
  ];

  test("covers the last seven local days ending today, oldest first", () => {
    const week = weekSummary(periods, 90, evening);
    expect(week).toHaveLength(7);
    expect(week[0]!.day).toEqual(at("2026-10-20T00:00:00"));
    expect(week[6]!.day).toEqual(at("2026-10-26T00:00:00"));
    expect(week.map((d) => d.minutes)).toEqual([120, 0, 0, 0, 60, 60, 60]);
    expect(week.map((d) => d.metGoal)).toEqual([true, false, false, false, false, false, false]);
    expect(summaryStart(evening)).toEqual(week[0]!.day);
  });

  test("has no goal status without a goal", () => {
    expect(weekSummary(periods, null, evening, 3).map((d) => d.metGoal)).toEqual([
      null,
      null,
      null,
    ]);
  });
});

describe("goalStreak", () => {
  const days = (...met: (boolean | null)[]): DaySummary[] =>
    met.map((metGoal, i) => ({ day: new Date(2026, 9, 20 + i), minutes: 0, metGoal }));

  test("counts back from today", () => {
    expect(goalStreak(days(false, true, true, true))).toBe(3);
  });

  test("an unfinished today does not break the streak", () => {
    expect(goalStreak(days(true, true, false))).toBe(2);
  });

  test("a missed earlier day ends it, and no goal means no streak", () => {
    expect(goalStreak(days(true, false, true, false))).toBe(1);
    expect(goalStreak(days(null, null))).toBe(0);
    expect(goalStreak([])).toBe(0);
  });
});
