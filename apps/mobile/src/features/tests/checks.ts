import type { ScanResult } from "@app/core";
import { daysSince } from "../history/daysSince";
import { outcomeCopy } from "../scan/resultCopy";
import { testsCopy as copy } from "./copy";

export type CheckId = keyof typeof copy.checks;

export interface Check {
  id: CheckId;
  /** Where the check starts; null until it exists in the app (vision check: #139). */
  route: "/scan" | null;
}

/** The checks the Tests screen offers, in display order (#140). */
export const CHECKS: readonly Check[] = [
  { id: "strabismus", route: "/scan" },
  { id: "vision", route: null },
];

/** One line about the selected child's most recent scan, newest first in `sessions`. */
export function latestScanLine(sessions: readonly ScanResult[], now = new Date()): string {
  const latest = sessions[0];
  const days = latest && daysSince(latest.createdAt, now);
  if (!latest || days === null || days === undefined) return copy.notYet;
  return copy.lastResult(outcomeCopy[latest.outcome].title, days);
}
