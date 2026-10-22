import { decide } from "./policy";
import type { PolicyConfig, PolicyInput, QualityReason, ScanSummary } from "./types";

// Test-only thresholds. They are not the app's values.
const CONFIG: PolicyConfig = {
  referAsymmetry: 0.2,
  minFramesUsed: 10,
  maxSpread: 0.05,
  validated: false,
};

function input(summary: Partial<ScanSummary> = {}, rest: Partial<PolicyInput> = {}): PolicyInput {
  return {
    summary: { framesTotal: 30, framesUsed: 24, asymmetryScore: 0.05, spread: 0.01, ...summary },
    qualityReasons: [],
    failure: null,
    ...rest,
  };
}

describe("decide", () => {
  it("gives NO_VISIBLE_SIGN only for adequate quality below the threshold", () => {
    expect(decide(input(), CONFIG)).toEqual({ outcome: "NO_VISIBLE_SIGN", reasons: [] });
  });

  describe("asymmetry threshold", () => {
    it("refers at the threshold", () => {
      expect(decide(input({ asymmetryScore: 0.2 }), CONFIG)).toEqual({
        outcome: "REFER",
        reasons: ["ASYMMETRY_ABOVE_THRESHOLD"],
      });
    });

    it("does not refer just below the threshold", () => {
      expect(decide(input({ asymmetryScore: 0.199 }), CONFIG).outcome).toBe("NO_VISIBLE_SIGN");
    });
  });

  describe("poor quality", () => {
    const reasons: QualityReason[] = [
      "NO_FACE",
      "EYE_NOT_FOUND",
      "BLUR",
      "OVEREXPOSED",
      "EYES_CLOSED",
    ];

    it.each(reasons)("asks for a retake when %s leaves too few frames", (reason) => {
      expect(decide(input({ framesUsed: 3 }, { qualityReasons: [reason] }), CONFIG)).toEqual({
        outcome: "RETAKE",
        reasons: [reason, "TOO_FEW_FRAMES"],
      });
    });

    it("needs at least minFramesUsed frames", () => {
      expect(decide(input({ framesUsed: 10 }), CONFIG).outcome).toBe("NO_VISIBLE_SIGN");
      expect(decide(input({ framesUsed: 9 }), CONFIG)).toEqual({
        outcome: "RETAKE",
        reasons: ["TOO_FEW_FRAMES"],
      });
    });

    it("lists each quality reason once", () => {
      const result = decide(input({ framesUsed: 0 }, { qualityReasons: ["BLUR", "BLUR"] }), CONFIG);
      expect(result.reasons).toEqual(["BLUR", "TOO_FEW_FRAMES"]);
    });

    it("never gives NO_VISIBLE_SIGN with too few frames, even with zero asymmetry", () => {
      for (let framesUsed = 0; framesUsed < CONFIG.minFramesUsed; framesUsed++) {
        const result = decide(
          input({ framesUsed, asymmetryScore: 0, spread: 0 }, { qualityReasons: ["BLUR"] }),
          CONFIG,
        );
        expect(result.outcome).not.toBe("NO_VISIBLE_SIGN");
      }
    });

    it("never refers on too few frames", () => {
      expect(decide(input({ framesUsed: 3, asymmetryScore: 0.9 }), CONFIG).outcome).toBe("RETAKE");
    });
  });

  describe("frame consistency", () => {
    it("asks for a retake when frames disagree too much", () => {
      expect(decide(input({ spread: 0.051, asymmetryScore: 0.9 }), CONFIG)).toEqual({
        outcome: "RETAKE",
        reasons: ["LOW_CONSISTENCY"],
      });
    });

    it("accepts a spread at the limit", () => {
      expect(decide(input({ spread: 0.05 }), CONFIG).outcome).toBe("NO_VISIBLE_SIGN");
    });
  });

  describe("model failures", () => {
    it.each(["MODEL_UNAVAILABLE", "MODEL_ERROR", "TIMEOUT"] as const)(
      "is NOT_ASSESSED on %s",
      (failure) => {
        expect(decide(input({}, { failure }), CONFIG)).toEqual({
          outcome: "NOT_ASSESSED",
          reasons: [failure],
        });
      },
    );

    it.each([
      ["asymmetryScore", { asymmetryScore: NaN }],
      ["spread", { spread: Infinity }],
      ["framesUsed", { framesUsed: NaN }],
      ["missing asymmetryScore", { asymmetryScore: null }],
      ["missing spread", { spread: null }],
    ] as const)("is NOT_ASSESSED on an invalid %s", (_, summary) => {
      expect(decide(input(summary), CONFIG)).toEqual({
        outcome: "NOT_ASSESSED",
        reasons: ["MODEL_ERROR"],
      });
    });
  });

  it("gives a reason with every outcome except NO_VISIBLE_SIGN", () => {
    const cases = [
      input({ asymmetryScore: 0.5 }),
      input({ framesUsed: 0 }),
      input({ spread: 1 }),
      input({}, { failure: "TIMEOUT" }),
      input({ asymmetryScore: NaN }),
    ];
    for (const c of cases) {
      expect(decide(c, CONFIG).reasons.length).toBeGreaterThan(0);
    }
  });

  it.each([
    ["referAsymmetry", { referAsymmetry: NaN }],
    ["referAsymmetry", { referAsymmetry: 0 }],
    ["maxSpread", { maxSpread: -1 }],
    ["minFramesUsed", { minFramesUsed: 0 }],
    ["minFramesUsed", { minFramesUsed: 2.5 }],
  ])("rejects an invalid %s", (_, override) => {
    expect(() => decide(input(), { ...CONFIG, ...override })).toThrow(RangeError);
  });
});
