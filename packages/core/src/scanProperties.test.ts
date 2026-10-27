import { summarizeFrames } from "./aggregate";
import { magnitude } from "./geometry";
import { mockFrameAnalysis, mockFrameQuality } from "./mocks";
import { decide } from "./policy";
import { representativeFrame } from "./representative";
import { completeScan, type ScanContext } from "./scan";
import type { FrameAnalysis, PolicyConfig } from "./types";

// Properties of finishing a scan over generated scans, not single cases.
// Test-only thresholds; they are not the app's values.
const CONFIG: PolicyConfig = {
  referAsymmetry: 0.07,
  minFramesUsed: 5,
  maxSpread: 0.1,
  validated: false,
};
const CONTEXT: ScanContext = {
  id: "scan-1",
  childId: "child-1",
  createdAt: "2026-10-27T03:00:00.000Z",
  durationMs: 3000,
  modelVersion: "model-test",
  policyVersion: "policy-test",
  failure: null,
};

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function scan(seed: number): FrameAnalysis[] {
  const random = lcg(seed);
  const size = 1 + Math.floor(random() * 40);
  const level = random() * 0.2;
  return Array.from({ length: size }, (_, i) => {
    const frame = mockFrameAnalysis(level + (random() - 0.5) * 0.04, { timestampMs: i * 33 });
    return random() < 0.25
      ? { ...frame, quality: mockFrameQuality({ ok: false, reasons: ["BLUR"] }) }
      : frame;
  });
}

const SCANS = Array.from({ length: 200 }, (_, i) => scan(i + 1));

test("completeScan agrees with summarizing and deciding separately", () => {
  for (const frames of SCANS) {
    const result = completeScan(frames, CONTEXT, CONFIG);
    const { summary, qualityReasons } = summarizeFrames(frames);
    expect(result.summary).toEqual(summary);
    expect({ outcome: result.outcome, reasons: result.reasons }).toEqual(
      decide({ summary, qualityReasons, failure: null }, CONFIG),
    );
    expect(result).toMatchObject({
      id: "scan-1",
      childId: "child-1",
      policyVersion: "policy-test",
    });
  }
});

test("the representative frame is usable and no other usable frame is closer to the score", () => {
  for (const frames of SCANS) {
    const { asymmetryScore } = summarizeFrames(frames).summary;
    const chosen = representativeFrame(frames, asymmetryScore);
    const usable = frames.filter((f) => f.quality.ok && f.eyes && f.asymmetry);
    if (asymmetryScore === null) {
      expect(chosen).toBeNull();
      continue;
    }
    expect(chosen).not.toBeNull();
    expect(chosen!.quality.ok).toBe(true);
    const distance = (f: FrameAnalysis) => Math.abs(magnitude(f.asymmetry!) - asymmetryScore);
    const best = Math.min(...usable.map(distance));
    expect(distance(chosen!)).toBeCloseTo(best, 12);
  }
});

test("a model failure is NOT_ASSESSED for every generated scan", () => {
  for (const frames of SCANS) {
    const result = completeScan(frames, { ...CONTEXT, failure: "MODEL_ERROR" }, CONFIG);
    expect(result.outcome).toBe("NOT_ASSESSED");
    expect(result.reasons).toEqual(["MODEL_ERROR"]);
  }
});
