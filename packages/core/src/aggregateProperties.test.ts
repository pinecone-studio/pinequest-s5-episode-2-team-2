import { summarizeFrames } from "./aggregate";
import { mockFrameAnalysis, mockFrameQuality } from "./mocks";
import type { FrameAnalysis } from "./types";

// Properties of the per-scan summary over many generated scans, not single cases.

/** Small deterministic generator so the cases are the same on every run. */
function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const blurred = (deviation: number) =>
  mockFrameAnalysis(deviation, { quality: mockFrameQuality({ ok: false, reasons: ["BLUR"] }) });

function scan(random: () => number, size: number): FrameAnalysis[] {
  return Array.from({ length: size }, () => {
    const deviation = random() * 0.3;
    return random() < 0.3 ? blurred(deviation) : mockFrameAnalysis(deviation);
  });
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const SCANS = Array.from({ length: 200 }, (_, i) => scan(lcg(i + 1), 1 + (i % 40)));

test("the score and spread do not depend on frame order", () => {
  const random = lcg(99);
  for (const frames of SCANS) {
    const a = summarizeFrames(frames).summary;
    const b = summarizeFrames(shuffled(frames, random)).summary;
    expect(b.framesUsed).toBe(a.framesUsed);
    if (a.asymmetryScore === null) expect(b.asymmetryScore).toBeNull();
    else {
      expect(b.asymmetryScore).toBeCloseTo(a.asymmetryScore, 12);
      expect(b.spread).toBeCloseTo(a.spread!, 12);
    }
  }
});

test("rejected frames never change the score, whatever their asymmetry", () => {
  for (const frames of SCANS) {
    const usable = frames.filter((f) => f.quality.ok);
    const withExtreme = [...frames, blurred(5), blurred(-5)];
    const a = summarizeFrames(usable).summary;
    const b = summarizeFrames(withExtreme).summary;
    expect(b.asymmetryScore).toEqual(a.asymmetryScore);
    expect(b.framesTotal).toBe(frames.length + 2);
    expect(b.framesUsed).toBe(usable.length);
  }
});

test("the score stays between the smallest and largest usable asymmetry", () => {
  for (const frames of SCANS) {
    const values = frames
      .filter((f) => f.quality.ok)
      .map((f) => Math.hypot(f.asymmetry!.x, f.asymmetry!.y));
    const { asymmetryScore, spread } = summarizeFrames(frames).summary;
    if (!values.length) {
      expect(asymmetryScore).toBeNull();
      continue;
    }
    expect(asymmetryScore!).toBeGreaterThanOrEqual(Math.min(...values) - 1e-12);
    expect(asymmetryScore!).toBeLessThanOrEqual(Math.max(...values) + 1e-12);
    expect(spread!).toBeGreaterThanOrEqual(0);
  }
});

test("fewer than half of the frames as outliers cannot move the score past the rest", () => {
  // Eleven steady frames near 0.05 and up to five wild ones: the median stays among the steady.
  for (let outliers = 0; outliers <= 5; outliers++) {
    const steady = Array.from({ length: 11 }, (_, i) => mockFrameAnalysis(0.04 + i * 0.002));
    const wild = Array.from({ length: outliers }, () => mockFrameAnalysis(1.5));
    const { asymmetryScore } = summarizeFrames([...steady, ...wild]).summary;
    expect(asymmetryScore!).toBeGreaterThanOrEqual(0.04 - 1e-9);
    expect(asymmetryScore!).toBeLessThanOrEqual(0.06 + 1e-9);
  }
});
