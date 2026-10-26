import { summarizeFrames } from "./aggregate";
import { mockFrameAnalysis, mockFrameQuality } from "./mocks";
import type { QualityReason } from "./types";

// Shared with ml/tests/test_aggregate.py so the Python reference and the app agree.
interface Fixtures {
  cases: {
    name: string;
    frames: {
      ok: boolean;
      reasons: QualityReason[];
      eyesFound: boolean;
      /** A null component stands for a non-finite measurement (JSON has no NaN). */
      asymmetry: [number | null, number | null] | null;
    }[];
    expected: {
      framesTotal: number;
      framesUsed: number;
      asymmetryScore: number | null;
      spread: number | null;
      qualityReasons: QualityReason[];
    };
  }[];
}

const fixtures = jest.requireActual<Fixtures>("../fixtures/aggregate.json");

describe.each(fixtures.cases)("aggregate fixture: $name", (c) => {
  it("matches the expected summary", () => {
    const frames = c.frames.map((f) =>
      mockFrameAnalysis(0, {
        quality: mockFrameQuality({ ok: f.ok, reasons: f.reasons }),
        ...(f.eyesFound ? {} : { eyes: null }),
        asymmetry: f.asymmetry && { x: f.asymmetry[0] ?? NaN, y: f.asymmetry[1] ?? NaN },
      }),
    );
    const { summary, qualityReasons } = summarizeFrames(frames);
    expect(qualityReasons).toEqual(c.expected.qualityReasons);
    expect(summary.framesTotal).toBe(c.expected.framesTotal);
    expect(summary.framesUsed).toBe(c.expected.framesUsed);
    for (const key of ["asymmetryScore", "spread"] as const) {
      const want = c.expected[key];
      if (want === null) expect(summary[key]).toBeNull();
      else expect(summary[key]).toBeCloseTo(want, 6);
    }
  });
});
