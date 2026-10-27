import { decide } from "./policy";
import type { Outcome, PolicyConfig, PolicyInput, ScanFailure } from "./types";

// Safety properties of the policy, checked over a grid of inputs rather than single cases.
// Test-only thresholds; they are not the app's values.
const CONFIG: PolicyConfig = {
  referAsymmetry: 0.07,
  minFramesUsed: 5,
  maxSpread: 0.1,
  validated: false,
};

const SCORES = [0, 0.01, 0.03, 0.0699, 0.07, 0.0701, 0.1, 0.3, 1, 5];
const SPREADS = [0, 0.02, 0.0999, 0.1, 0.1001, 0.5];
const FRAMES = [0, 1, 4, 5, 6, 30];
const FAILURES: (ScanFailure | null)[] = [null, "MODEL_UNAVAILABLE", "MODEL_ERROR", "TIMEOUT"];

function input(score: number | null, spread: number | null, used: number): PolicyInput {
  return {
    summary: { framesTotal: 30, framesUsed: used, asymmetryScore: score, spread },
    qualityReasons: used < 30 ? ["BLUR"] : [],
    failure: null,
  };
}

const grid = SCORES.flatMap((score) =>
  SPREADS.flatMap((spread) => FRAMES.map((used) => ({ score, spread, used }))),
);

test("a model failure is never anything but NOT_ASSESSED", () => {
  for (const failure of FAILURES.filter((f) => f !== null)) {
    for (const { score, spread, used } of grid) {
      const decision = decide({ ...input(score, spread, used), failure }, CONFIG);
      expect(decision).toEqual({ outcome: "NOT_ASSESSED", reasons: [failure] });
    }
  }
});

test("NO_VISIBLE_SIGN needs enough frames, a consistent scan and a score below the threshold", () => {
  for (const { score, spread, used } of grid) {
    const { outcome } = decide(input(score, spread, used), CONFIG);
    if (outcome === "NO_VISIBLE_SIGN") {
      expect(used).toBeGreaterThanOrEqual(CONFIG.minFramesUsed);
      expect(spread).toBeLessThanOrEqual(CONFIG.maxSpread);
      expect(score).toBeLessThan(CONFIG.referAsymmetry);
    }
  }
});

test("too few frames always asks for a retake, whatever the score", () => {
  for (const { score, spread, used } of grid.filter((g) => g.used < CONFIG.minFramesUsed)) {
    const decision = decide(input(score, spread, used), CONFIG);
    expect(decision.outcome).toBe("RETAKE");
    expect(decision.reasons).toContain("TOO_FEW_FRAMES");
  }
});

test("a larger score never makes a consistent scan look safer", () => {
  // REFER is the most cautious outcome for a usable scan; it must not turn back into
  // NO_VISIBLE_SIGN as the asymmetry grows.
  const rank: Record<Outcome, number> = {
    NO_VISIBLE_SIGN: 0,
    REFER: 1,
    RETAKE: -1,
    NOT_ASSESSED: -1,
  };
  for (const spread of SPREADS.filter((s) => s <= CONFIG.maxSpread)) {
    for (const used of FRAMES.filter((f) => f >= CONFIG.minFramesUsed)) {
      const ranks = SCORES.map((score) => rank[decide(input(score, spread, used), CONFIG).outcome]);
      for (let i = 1; i < ranks.length; i++)
        expect(ranks[i]!).toBeGreaterThanOrEqual(ranks[i - 1]!);
    }
  }
});

test("every outcome except NO_VISIBLE_SIGN explains itself", () => {
  for (const { score, spread, used } of grid) {
    const decision = decide(input(score, spread, used), CONFIG);
    if (decision.outcome === "NO_VISIBLE_SIGN") expect(decision.reasons).toEqual([]);
    else expect(decision.reasons.length).toBeGreaterThan(0);
  }
});

test("missing or non-finite measurements never pass as NO_VISIBLE_SIGN or REFER", () => {
  for (const bad of [null, NaN, Infinity]) {
    for (const used of FRAMES.filter((f) => f >= CONFIG.minFramesUsed)) {
      for (const [score, spread] of [
        [bad, 0.01],
        [0.01, bad],
        [bad, bad],
      ] as const) {
        const { outcome } = decide(input(score, spread, used), CONFIG);
        expect(outcome).toBe("NOT_ASSESSED");
      }
    }
  }
});
