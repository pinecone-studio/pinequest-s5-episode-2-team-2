// Tumbling-E distance vision check (#139), ported from the web demo (demo/web-poc,
// apps/web-demo/src/acuity.ts) so both give the same letter sizes and the same result.
// The letter is 5 strokes tall and subtends 5 × 10^logMAR arcminutes at the test distance.

export type AgeGroup = "child3" | "child4" | "child5" | "adult";
export type Eye = "right" | "left";
/** Which way the E's open side points, in degrees clockwise from right. */
export type Direction = 0 | 90 | 180 | 270;

/** AAPOS screening distance (10 ft). */
export const TEST_DISTANCE_MM = 3000;
/** Largest letter first; 0.0 is normal adult acuity (decimal 1.0). */
export const LEVELS = [1.0, 0.7, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0] as const;
/** Letters per level. A level passes on a correct first letter; after a miss, 2 of 3. */
export const PER_LEVEL = 3;
/** Line to pass, in logMAR: AAPOS screening lines for children, WHO ICD-11 mild impairment for adults. */
export const PASS_LINE: Record<AgeGroup, number> = {
  child3: 0.4,
  child4: 0.3,
  child5: 0.2,
  adult: 0.3,
};
const DIRECTIONS: readonly Direction[] = [0, 90, 180, 270];

/**
 * Points per millimetre on an iPhone screen, from Apple's published densities (326 ppi on
 * @2x models, about 460 ppi on @3x models). Models differ by about ±4%, under 0.02 logMAR.
 * Display Zoom is not accounted for.
 */
export function iPhonePointsPerMm(pixelRatio: number): number {
  const ppi = pixelRatio >= 3 ? 460 : 326;
  return ppi / pixelRatio / 25.4;
}

/** Height of the E in screen points for a logMAR level at the test distance. */
export function optotypeSize(logMar: number, pointsPerMm: number): number {
  const arcmin = 5 * 10 ** logMar;
  return TEST_DISTANCE_MM * Math.tan((arcmin / 60) * (Math.PI / 180)) * pointsPerMm;
}

/**
 * Levels whose letter fits in `maxPoints`. Larger levels are skipped rather than shrunk,
 * because a scaled-down letter would give a wrong result.
 */
export function fittingLevels(maxPoints: number, pointsPerMm: number): number[] {
  const fitting = LEVELS.filter((l) => optotypeSize(l, pointsPerMm) <= maxPoints);
  return fitting.length ? fitting : [...LEVELS];
}

/** A new direction, never the same as the previous one. `random` returns [0, 1). */
export function nextDirection(previous: Direction | null, random: () => number): Direction {
  const d = DIRECTIONS[Math.floor(random() * 4)]!;
  if (d !== previous) return d;
  return DIRECTIONS[(DIRECTIONS.indexOf(d) + 1 + Math.floor(random() * 3)) % 4]!;
}

export interface EyeTest {
  /** Index into the levels in use. */
  level: number;
  /** Letters shown at the current level. */
  shown: number;
  correct: number;
  /** Smallest level passed so far, in logMAR; null until one passes. */
  passed: number | null;
  /** True when this eye is finished. */
  done: boolean;
}

export const START: EyeTest = { level: 0, shown: 0, correct: 0, passed: null, done: false };

/** One answer for the current letter; "can't see" counts as wrong. */
export function answer(test: EyeTest, isCorrect: boolean, levels: readonly number[]): EyeTest {
  if (test.done) return test;
  const shown = test.shown + 1;
  const correct = test.correct + (isCorrect ? 1 : 0);
  const majority = Math.floor(PER_LEVEL / 2) + 1;
  const pass = correct >= majority || (shown === 1 && correct === 1);
  if (!pass && shown - correct <= PER_LEVEL - majority) {
    return { ...test, shown, correct };
  }
  const passed = pass ? levels[test.level]! : test.passed;
  if (!pass || test.level === levels.length - 1) {
    return { level: test.level, shown, correct, passed, done: true };
  }
  return { level: test.level + 1, shown: 0, correct: 0, passed, done: false };
}

/**
 * Whether seeing an eye doctor is recommended: when either eye did not reach the pass line
 * for the age group, or no level was passed. It is a screening result, not a diagnosis.
 */
export function needsReferral(results: Record<Eye, number | null>, group: AgeGroup): boolean {
  const line = PASS_LINE[group];
  return (["right", "left"] as const).some((eye) => {
    const v = results[eye];
    return v === null || v > line + 1e-9;
  });
}

/** Decimal acuity for display, e.g. logMAR 0.3 → "0.5", 0.0 → "1.0". */
export function decimalAcuity(logMar: number): string {
  return (10 ** -logMar).toFixed(logMar >= 0.95 ? 1 : 2).replace(/0$/, "");
}

// TODO(verify): rough estimate from the web demo, no cited source. Myopic (minus) range per
// passed level, assuming poor distance vision comes from myopia alone. Not a prescription.
const MINUS_RANGE: Record<string, string> = {
  "0.1": "−0.25 … −0.5",
  "0.2": "−0.5 … −0.75",
  "0.3": "−0.5 … −1.0",
  "0.4": "−0.75 … −1.25",
  "0.5": "−1.0 … −1.5",
  "0.7": "−1.5 … −2.0",
  "1": "−2.0 … −3.0",
};

/**
 * Rough minus range for an eye's result: null at full acuity (logMAR 0.0), "below" when no
 * level was passed, otherwise the range for the passed level.
 */
export function minusRange(logMar: number | null): string | "below" | null {
  if (logMar === null) return "below";
  return MINUS_RANGE[String(Number(logMar.toFixed(1)))] ?? null;
}
