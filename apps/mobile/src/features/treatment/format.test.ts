import { formatElapsed, newLogId, parseGoalMinutes } from "./format";

test("elapsed time shows minutes:seconds, and hours when needed", () => {
  expect(formatElapsed(0)).toBe("0:00");
  expect(formatElapsed(309_000)).toBe("5:09");
  expect(formatElapsed(3_909_999)).toBe("1:05:09");
  expect(formatElapsed(-5)).toBe("0:00");
});

test("the goal accepts whole minutes from 1 to 1440 only", () => {
  expect(parseGoalMinutes(" 120 ")).toBe(120);
  expect(parseGoalMinutes("1440")).toBe(1440);
  for (const bad of ["", "0", "1441", "1.5", "-3", "abc", "2h"]) {
    expect(parseGoalMinutes(bad)).toBeNull();
  }
});

test("log IDs differ for the same millisecond", () => {
  let n = 0;
  const random = () => (n++ % 10) / 10;
  const ids = new Set(Array.from({ length: 10 }, () => newLogId(1_000, random)));
  expect(ids.size).toBe(10);
});
