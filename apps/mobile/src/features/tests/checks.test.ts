import { mockScanResult } from "@app/core";
import { outcomeCopy } from "../scan/resultCopy";
import { CHECKS, latestScanLine } from "./checks";
import { testsCopy as copy } from "./copy";

test("offers the strabismus scan and the vision check, in that order", () => {
  expect(CHECKS.map((c) => c.id)).toEqual(["strabismus", "vision"]);
  expect(CHECKS.map((c) => c.route)).toEqual(["/scan", "/acuity"]);
});

test("describes the most recent scan with its outcome and age", () => {
  const now = new Date(2026, 9, 27, 15);
  const today = { ...mockScanResult("REFER"), createdAt: new Date(2026, 9, 27, 9).toISOString() };
  const older = { ...mockScanResult("RETAKE"), createdAt: new Date(2026, 9, 24, 9).toISOString() };
  expect(latestScanLine([today, older], now)).toBe(copy.lastResult(outcomeCopy.REFER.title, 0));
  expect(latestScanLine([older], now)).toBe(copy.lastResult(outcomeCopy.RETAKE.title, 3));
});

test("says so when there is no scan or the date is unreadable", () => {
  expect(latestScanLine([])).toBe(copy.notYet);
  expect(latestScanLine([{ ...mockScanResult("REFER"), createdAt: "not a date" }])).toBe(
    copy.notYet,
  );
});
