import type { ScanResult } from "@app/core";
import type { AcuityResult } from "../../storage/acuity";
import { daysSince } from "../history/daysSince";
import { outcomeCopy } from "../scan/resultCopy";
import { testsCopy as copy } from "./copy";

export type CheckId = keyof typeof copy.checks;

export interface Check {
  id: CheckId;
  /** Where the check starts; null for a check that is not in the app. */
  route: "/scan" | "/acuity" | null;
}

/** The checks the Tests screen offers, in display order (#140). */
export const CHECKS: readonly Check[] = [
  { id: "strabismus", route: "/scan" },
  { id: "vision", route: "/acuity" },
];

/** One line about the selected child's most recent scan, newest first in `sessions`. */
export function latestScanLine(sessions: readonly ScanResult[], now = new Date()): string {
  const latest = sessions[0];
  const days = latest && daysSince(latest.createdAt, now);
  if (!latest || days === null || days === undefined) return copy.notYet;
  return copy.lastResult(outcomeCopy[latest.outcome].title, days);
}

/** One line about the selected child's most recent vision check, newest first in `results`. */
export function latestAcuityLine(results: readonly AcuityResult[], now = new Date()): string {
  const latest = results[0];
  const days = latest && daysSince(latest.createdAt, now);
  if (!latest || days === null || days === undefined) return copy.notYet;
  const outcome = latest.refer ? outcomeCopy.REFER : outcomeCopy.NO_VISIBLE_SIGN;
  return copy.lastResult(outcome.title, days);
}
