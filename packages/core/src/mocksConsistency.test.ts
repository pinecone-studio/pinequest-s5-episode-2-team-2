import { magnitude } from "./geometry";
import { mockFrameAnalysis, mockScanResult } from "./mocks";
import { decide } from "./policy";
import type { Outcome, PolicyConfig } from "./types";

// The screens are tested with these mocks, so every mock result must be one the real policy
// could produce; otherwise a screen test would pass on a result that cannot happen.

const OUTCOMES: Outcome[] = ["REFER", "RETAKE", "NOT_ASSESSED", "NO_VISIBLE_SIGN"];

// A config under which each mock's summary leads to the mock's own outcome. Test values.
const CONFIG: PolicyConfig = {
  referAsymmetry: 0.2,
  minFramesUsed: 5,
  maxSpread: 0.1,
  validated: false,
};

test.each(OUTCOMES)("the %s mock has a valid, storable summary", (outcome) => {
  const { summary, durationMs } = mockScanResult(outcome);
  expect(Number.isInteger(summary.framesTotal) && summary.framesTotal >= 0).toBe(true);
  expect(Number.isInteger(summary.framesUsed)).toBe(true);
  expect(summary.framesUsed).toBeGreaterThanOrEqual(0);
  expect(summary.framesUsed).toBeLessThanOrEqual(summary.framesTotal);
  for (const v of [summary.asymmetryScore, summary.spread]) {
    if (v !== null) expect(Number.isFinite(v) && v >= 0).toBe(true);
  }
  expect(durationMs).toBeGreaterThan(0);
});

test.each(OUTCOMES)("the %s mock is what the policy decides for its summary", (outcome) => {
  const result = mockScanResult(outcome);
  const failure = result.reasons.find(
    (r): r is "MODEL_UNAVAILABLE" | "MODEL_ERROR" | "TIMEOUT" =>
      r === "MODEL_UNAVAILABLE" || r === "MODEL_ERROR" || r === "TIMEOUT",
  );
  const qualityReasons = result.reasons.filter(
    (r) => r !== "TOO_FEW_FRAMES" && r !== "ASYMMETRY_ABOVE_THRESHOLD" && r !== "LOW_CONSISTENCY",
  ) as Parameters<typeof decide>[0]["qualityReasons"];
  const decision = decide(
    {
      summary: result.summary,
      qualityReasons: failure ? [] : qualityReasons,
      failure: failure ?? null,
    },
    CONFIG,
  );
  expect(decision.outcome).toBe(outcome);
  expect(decision.reasons).toEqual(result.reasons);
});

test("the mock frame's asymmetry is the deviation it was made with", () => {
  for (const d of [0, 0.05, 0.1, 0.4]) {
    expect(magnitude(mockFrameAnalysis(d).asymmetry!)).toBeCloseTo(d, 12);
  }
});
