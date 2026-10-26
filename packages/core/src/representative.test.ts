import { mockEyeMeasure, mockFrameAnalysis, mockFrameQuality } from "./mocks";
import { representativeFrame } from "./representative";

const at = (deviation: number, timestampMs: number) =>
  mockFrameAnalysis(deviation, { timestampMs });

test("picks the usable frame closest to the score", () => {
  const frames = [at(0.1, 0), at(0.2, 1), at(0.4, 2)];
  expect(representativeFrame(frames, 0.22)?.timestampMs).toBe(1);
});

test("skips rejected and unmeasured frames", () => {
  const rejected = mockFrameAnalysis(0.2, {
    timestampMs: 0,
    quality: mockFrameQuality({ ok: false, reasons: ["BLUR"] }),
  });
  const noEyes = mockFrameAnalysis(0.2, { timestampMs: 1, eyes: null });
  const noReflex = mockFrameAnalysis(0.2, { timestampMs: 2, asymmetry: null });
  const nan = mockFrameAnalysis(0.2, { timestampMs: 3, asymmetry: { x: NaN, y: 0 } });
  expect(representativeFrame([rejected, noEyes, noReflex, nan, at(0.5, 4)], 0.2)?.timestampMs).toBe(
    4,
  );
});

test("breaks ties by eye confidence, then by order", () => {
  const unsure = mockFrameAnalysis(0.2, {
    timestampMs: 0,
    eyes: [
      mockEyeMeasure("imageLeft", { x: 0.05, y: 0 }, { confidence: 0.3 }),
      mockEyeMeasure("imageRight", { x: 0.15, y: 0 }),
    ],
  });
  expect(representativeFrame([unsure, at(0.2, 1), at(0.2, 2)], 0.2)?.timestampMs).toBe(1);
});

test("is null without a score or usable frames", () => {
  expect(representativeFrame([at(0.1, 0)], null)).toBeNull();
  expect(representativeFrame([at(0.1, 0)], NaN)).toBeNull();
  expect(representativeFrame([], 0.1)).toBeNull();
});
