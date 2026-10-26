import { mockFrameAnalysis, mockFrameQuality } from "./mocks";
import { completeScan } from "./scan";
import type { ScanContext } from "./scan";
import type { PolicyConfig } from "./types";

// Test values only; the real thresholds come from validated data.
const config: PolicyConfig = {
  referAsymmetry: 0.2,
  minFramesUsed: 3,
  maxSpread: 0.1,
  validated: false,
};
const context: ScanContext = {
  id: "scan-1",
  childId: "child-1",
  createdAt: "2026-10-26T03:00:00.000Z",
  durationMs: 3000,
  modelVersion: "keypoints-test",
  policyVersion: "policy-test",
  failure: null,
};
const blurred = mockFrameAnalysis(0, {
  quality: mockFrameQuality({ ok: false, reasons: ["BLUR"] }),
});

test("a good scan keeps its context and summary", () => {
  const frames = [0, 0.01, 0.02, 0.01].map((d) => mockFrameAnalysis(d));
  const result = completeScan(frames, context, config);
  expect(result).toMatchObject({
    id: "scan-1",
    childId: "child-1",
    createdAt: context.createdAt,
    durationMs: 3000,
    modelVersion: "keypoints-test",
    policyVersion: "policy-test",
    outcome: "NO_VISIBLE_SIGN",
    reasons: [],
  });
  expect(result.summary.framesUsed).toBe(4);
  expect(result).not.toHaveProperty("failure");
});

test("a large consistent asymmetry refers", () => {
  const frames = [0.4, 0.41, 0.39].map((d) => mockFrameAnalysis(d));
  expect(completeScan(frames, context, config)).toMatchObject({
    outcome: "REFER",
    reasons: ["ASYMMETRY_ABOVE_THRESHOLD"],
  });
});

test("too few usable frames asks for a retake with the quality reasons", () => {
  const frames = [blurred, blurred, mockFrameAnalysis(0)];
  expect(completeScan(frames, context, config)).toMatchObject({
    outcome: "RETAKE",
    reasons: ["BLUR", "TOO_FEW_FRAMES"],
    summary: { framesTotal: 3, framesUsed: 1 },
  });
});

test("a model failure is not assessed whatever the frames say", () => {
  const frames = [0.4, 0.4, 0.4].map((d) => mockFrameAnalysis(d));
  expect(completeScan(frames, { ...context, failure: "MODEL_UNAVAILABLE" }, config)).toMatchObject({
    outcome: "NOT_ASSESSED",
    reasons: ["MODEL_UNAVAILABLE"],
  });
});

test("no frames at all asks for a retake", () => {
  expect(completeScan([], context, config)).toMatchObject({
    outcome: "RETAKE",
    reasons: ["TOO_FEW_FRAMES"],
    summary: { framesTotal: 0, framesUsed: 0, asymmetryScore: null, spread: null },
  });
});
