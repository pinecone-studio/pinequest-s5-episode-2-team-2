import { goalProgress, minutesOnDay } from "./progress";

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
