import { mockScanResult } from "@app/core";
import { dayKey, formatDay, formatScanTime, groupByDay, summarizeHistory } from "./format";

// Built from local time so the tests pass in any time zone.
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).toISOString();

test("formats local days and times with zero padding", () => {
  expect(dayKey(at(5, 9))).toBe("2026-10-05");
  expect(formatScanTime(at(5, 9, 7))).toBe("2026.10.05 09:07");
  expect(formatDay(at(5, 9))).toBe("2026.10.05");
  expect(formatDay(Date.parse(at(5, 23, 59)))).toBe("2026.10.05");
});

test("groups newest-first sessions by local day", () => {
  const sessions = [
    mockScanResult("REFER", { id: "c", createdAt: at(26, 18) }),
    mockScanResult("RETAKE", { id: "b", createdAt: at(26, 8) }),
    mockScanResult("NO_VISIBLE_SIGN", { id: "a", createdAt: at(24, 23, 59) }),
  ];
  expect(groupByDay(sessions).map((s) => [s.day, s.sessions.map((x) => x.id)])).toEqual([
    ["2026-10-26", ["c", "b"]],
    ["2026-10-24", ["a"]],
  ]);
  expect(groupByDay([])).toEqual([]);
});

test("counts outcomes and finds the newest session", () => {
  const newest = mockScanResult("REFER", { id: "new", createdAt: at(26, 12) });
  const summary = summarizeHistory([
    mockScanResult("RETAKE", { id: "old", createdAt: at(20, 12) }),
    newest,
    mockScanResult("RETAKE", { id: "mid", createdAt: at(22, 12) }),
  ]);
  expect(summary).toEqual({
    total: 3,
    counts: { REFER: 1, RETAKE: 2, NOT_ASSESSED: 0, NO_VISIBLE_SIGN: 0 },
    latest: newest,
  });
  expect(summarizeHistory([]).latest).toBeNull();
});
