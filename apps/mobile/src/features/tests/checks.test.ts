import { mockScanResult } from "@app/core";
import { outcomeCopy } from "../scan/resultCopy";
import { CHECKS, latestAcuityLine, latestScanLine } from "./checks";
import { testsCopy as copy } from "./copy";

test("offers the strabismus scan and the vision check, in that order", () => {
  expect(CHECKS.map((c) => c.id)).toEqual(["strabismus", "vision"]);
  expect(CHECKS.map((c) => c.route)).toEqual(["/prepare", "/acuity"]);
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

test("describes the most recent vision check by whether a doctor was recommended", () => {
  const now = new Date(2026, 9, 27, 15);
  const check = {
    id: "a1",
    childId: "c1",
    createdAt: new Date(2026, 9, 26, 9).toISOString(),
    group: "child4" as const,
    right: 0.3,
    left: 0.5,
    refer: true,
  };
  expect(latestAcuityLine([check], now)).toBe(copy.lastResult(outcomeCopy.REFER.title, 1));
  expect(latestAcuityLine([{ ...check, refer: false }], now)).toBe(
    copy.lastResult(outcomeCopy.NO_VISIBLE_SIGN.title, 1),
  );
  expect(latestAcuityLine([], now)).toBe(copy.notYet);
});
