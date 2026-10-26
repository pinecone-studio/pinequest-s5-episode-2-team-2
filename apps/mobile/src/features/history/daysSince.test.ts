import { daysSince } from "./daysSince";

const now = new Date(2026, 9, 26, 9, 0);

test("counts local calendar days, not 24-hour periods", () => {
  expect(daysSince(new Date(2026, 9, 26, 0, 5).toISOString(), now)).toBe(0);
  expect(daysSince(new Date(2026, 9, 25, 23, 59).toISOString(), now)).toBe(1);
  expect(daysSince(new Date(2026, 9, 19, 12, 0).toISOString(), now)).toBe(7);
});

test("never goes negative and rejects invalid dates", () => {
  expect(daysSince(new Date(2026, 9, 27).toISOString(), now)).toBe(0);
  expect(daysSince("invalid", now)).toBeNull();
});
