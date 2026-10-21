import { magnitude } from "./geometry";
import { mockChild, mockEyeMeasure, mockFrameAnalysis, mockScanResult } from "./mocks";
import type { Outcome } from "./types";

const OUTCOMES: Outcome[] = ["REFER", "RETAKE", "NOT_ASSESSED", "NO_VISIBLE_SIGN"];

describe("mockEyeMeasure", () => {
  it("keeps reflex and reflexOffset consistent", () => {
    const eye = mockEyeMeasure("imageLeft", { x: 0.25, y: -0.5 });
    expect(eye.reflexOffset!.x).toBeCloseTo(0.25);
    expect(eye.reflexOffset!.y).toBeCloseTo(-0.5);
  });

  it("supports a missing reflex", () => {
    const eye = mockEyeMeasure("imageRight", null);
    expect(eye.reflex).toBeNull();
    expect(eye.reflexOffset).toBeNull();
  });
});

describe("mockFrameAnalysis", () => {
  it("is symmetric without deviation", () => {
    expect(magnitude(mockFrameAnalysis().asymmetry!)).toBeCloseTo(0);
  });

  it("reflects the requested deviation", () => {
    expect(magnitude(mockFrameAnalysis(0.3).asymmetry!)).toBeCloseTo(0.3);
  });
});

describe("mockScanResult", () => {
  it.each(OUTCOMES)("builds a consistent %s result", (outcome) => {
    const r = mockScanResult(outcome);
    expect(r.outcome).toBe(outcome);
    expect(r.summary.framesUsed).toBeLessThanOrEqual(r.summary.framesTotal);
    // Only judged outcomes carry a score.
    const judged = outcome === "REFER" || outcome === "NO_VISIBLE_SIGN";
    expect(r.summary.asymmetryScore !== null).toBe(judged);
  });

  it("explains every outcome except no visible sign", () => {
    for (const outcome of OUTCOMES) {
      const r = mockScanResult(outcome);
      expect(r.reasons.length > 0).toBe(outcome !== "NO_VISIBLE_SIGN");
    }
  });

  it("applies overrides", () => {
    expect(mockScanResult("REFER", { childId: null }).childId).toBeNull();
  });
});

describe("mockChild", () => {
  it("applies overrides", () => {
    expect(mockChild({ nickname: "A" }).nickname).toBe("A");
  });
});
