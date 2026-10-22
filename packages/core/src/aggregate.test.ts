import { summarizeFrames } from "./aggregate";
import { mockFrameAnalysis, mockFrameQuality } from "./mocks";

describe("summarizeFrames", () => {
  it("uses the median asymmetry of good frames", () => {
    const frames = [0, 0.1, 0.2, 0.3, 0.4].map((d) => mockFrameAnalysis(d));
    const { summary, qualityReasons } = summarizeFrames(frames);
    expect(summary.framesTotal).toBe(5);
    expect(summary.framesUsed).toBe(5);
    expect(summary.asymmetryScore).toBeCloseTo(0.2);
    expect(summary.spread).toBeCloseTo(0.1);
    expect(qualityReasons).toEqual([]);
  });

  it("averages the middle pair for an even count", () => {
    const { summary } = summarizeFrames([0.1, 0.2, 0.3, 0.4].map((d) => mockFrameAnalysis(d)));
    expect(summary.asymmetryScore).toBeCloseTo(0.25);
  });

  it("drops poor frames and keeps their reasons once, in order", () => {
    const blur = mockFrameAnalysis(0, {
      quality: mockFrameQuality({ ok: false, reasons: ["BLUR"] }),
    });
    const closed = mockFrameAnalysis(0, {
      quality: mockFrameQuality({ ok: false, reasons: ["EYES_CLOSED", "BLUR"] }),
    });
    const { summary, qualityReasons } = summarizeFrames([blur, mockFrameAnalysis(0.2), closed]);
    expect(summary.framesUsed).toBe(1);
    expect(summary.asymmetryScore).toBeCloseTo(0.2);
    expect(summary.spread).toBe(0);
    expect(qualityReasons).toEqual(["BLUR", "EYES_CLOSED"]);
  });

  it("names a reason when a frame has none", () => {
    const noEyes = mockFrameAnalysis(0, { eyes: null, asymmetry: null });
    const noReflex = mockFrameAnalysis(0, { asymmetry: null });
    expect(summarizeFrames([noEyes, noReflex]).qualityReasons).toEqual([
      "EYE_NOT_FOUND",
      "REFLEX_NOT_FOUND",
    ]);
  });

  it("ignores non-finite asymmetry", () => {
    const bad = mockFrameAnalysis(0, { asymmetry: { x: NaN, y: 0 } });
    expect(summarizeFrames([bad]).summary.framesUsed).toBe(0);
  });

  it("has no score without usable frames", () => {
    expect(summarizeFrames([]).summary).toEqual({
      framesTotal: 0,
      framesUsed: 0,
      asymmetryScore: null,
      spread: null,
    });
  });
});
