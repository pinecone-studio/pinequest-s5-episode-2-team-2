import { localDayKey, nextDailyAt, nextRescanAt, parseTimeOfDay } from "./schedule";

process.env.TZ = "Asia/Ulaanbaatar";
const at = (local: string) => new Date(`${local}+08:00`);

test("the day key uses the local date, not UTC", () => {
  // 07:00 in Ulaanbaatar is still the previous day in UTC.
  expect(localDayKey(at("2026-10-27T07:00:00"))).toBe("2026-10-27");
});

test("times must be 24-hour HH:MM", () => {
  expect(parseTimeOfDay("09:30")).toEqual({ hour: 9, minute: 30 });
  for (const bad of ["9:30", "24:00", "12:60", "noon", ""]) expect(parseTimeOfDay(bad)).toBeNull();
});

test("a daily reminder fires later today, or tomorrow once the time has passed", () => {
  expect(nextDailyAt("18:00", at("2026-10-27T09:00:00"))).toEqual(at("2026-10-27T18:00:00"));
  expect(nextDailyAt("18:00", at("2026-10-27T18:00:00"))).toEqual(at("2026-10-28T18:00:00"));
  expect(nextDailyAt("bad", at("2026-10-27T09:00:00"))).toBeNull();
});

test("re-scan is due the chosen number of days after the last scan", () => {
  const now = at("2026-10-27T12:00:00");
  const lastScan = at("2026-10-20T15:00:00").toISOString();
  expect(nextRescanAt(lastScan, 14, now)).toEqual(at("2026-11-03T10:00:00"));
  // Overdue or never scanned: remind tomorrow morning.
  expect(nextRescanAt(lastScan, 3, now)).toEqual(at("2026-10-28T10:00:00"));
  expect(nextRescanAt(null, 30, now)).toEqual(at("2026-10-28T10:00:00"));
});
