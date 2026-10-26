import type { PolicyConfig, Point } from "@app/core";
import { mockFrameQuality } from "@app/core";
import type { EyePrediction } from "../vision/eyeCrops";
import type { LandmarkFrame } from "../vision/facePipeline";
import { emptyRecording, finishScan, recordFrame, toFrameAnalysis } from "./recorder";

// Test values only; the real thresholds come from validated data.
const config: PolicyConfig = {
  referAsymmetry: 0.2,
  minFramesUsed: 3,
  maxSpread: 0.1,
  validated: false,
};
const meta = {
  id: "scan-1",
  childId: "child-1",
  createdAt: "2026-10-26T03:00:00.000Z",
  durationMs: 3000,
  modelVersion: "keypoints-test",
  policyVersion: "policy-test",
};

function frontalFace(): Point[] {
  const points = Array.from({ length: 478 }, () => ({ x: 500, y: 550 }));
  const positions: Record<number, Point> = {
    33: { x: 400, y: 500 },
    133: { x: 460, y: 500 },
    159: { x: 430, y: 488 },
    145: { x: 430, y: 512 },
    263: { x: 600, y: 500 },
    362: { x: 540, y: 500 },
    386: { x: 570, y: 488 },
    374: { x: 570, y: 512 },
    234: { x: 350, y: 560 },
    454: { x: 650, y: 560 },
    1: { x: 500, y: 590 },
    152: { x: 500, y: 700 },
  };
  for (const [index, point] of Object.entries(positions)) points[Number(index)] = point;
  return points;
}

/** Image-left reflex offset 0.05; image-right `rightX` (mirrored asymmetry = 0.05 + rightX). */
function eye(side: EyePrediction["side"], x: number, offsetX: number): EyePrediction {
  return {
    side,
    irisCenter: { x, y: 500 },
    irisRadius: 40,
    reflex: { x: x + offsetX * 40, y: 500 },
    reflexVisibleProbability: 0.9,
    crop: { x: x - 100, y: 400, size: 200, side },
  };
}

function frame(rightX: number | null, overrides: Partial<LandmarkFrame> = {}): LandmarkFrame {
  return {
    faceCount: 1,
    landmarks: frontalFace(),
    frameSize: { width: 3840, height: 2160 },
    timestampMs: 0,
    latencyMs: 10,
    eyes: rightX === null ? null : [eye("imageLeft", 430, 0.05), eye("imageRight", 570, rightX)],
    eyeFailure: rightX === null ? "EYE_NOT_FOUND" : null,
    ...overrides,
  };
}

const record = (frames: LandmarkFrame[]) => frames.reduce(recordFrame, emptyRecording());

test("analyzes a frame and keeps the producer's quality when it has one", () => {
  const analysis = toFrameAnalysis(frame(-0.05));
  expect(analysis.quality.ok).toBe(true);
  expect(analysis.asymmetry!.x).toBeCloseTo(0);
  const quality = mockFrameQuality({ ok: false, reasons: ["BLUR"] });
  expect(toFrameAnalysis(frame(-0.05, { quality })).quality).toBe(quality);
});

test("a good scan gives a result and the eyes of a representative frame", () => {
  const { result, eyes } = finishScan(
    record([frame(-0.05), frame(-0.04), frame(-0.06)]),
    meta,
    config,
  );
  expect(result).toMatchObject({ id: "scan-1", outcome: "NO_VISIBLE_SIGN", reasons: [] });
  expect(result.summary.framesUsed).toBe(3);
  expect(eyes?.map((e) => e.side)).toEqual(["imageLeft", "imageRight"]);
});

test("too few usable frames asks for a retake", () => {
  const { result } = finishScan(record([frame(null), frame(null), frame(-0.05)]), meta, config);
  expect(result).toMatchObject({ outcome: "RETAKE", reasons: ["EYE_NOT_FOUND", "TOO_FEW_FRAMES"] });
});

test("a model failure is not assessed and shows no eyes", () => {
  const failing = frame(null, { eyeFailure: "MODEL_UNAVAILABLE" });
  const recording = record([frame(-0.05), failing, frame(-0.05), frame(-0.05)]);
  expect(recording.failure).toBe("MODEL_UNAVAILABLE");
  const { result, eyes } = finishScan(recording, meta, config);
  expect(result).toMatchObject({ outcome: "NOT_ASSESSED", reasons: ["MODEL_UNAVAILABLE"] });
  expect(eyes).toBeNull();
});

test("keeps the first failure", () => {
  const recording = record([
    frame(null, { eyeFailure: "MODEL_ERROR" }),
    frame(null, { eyeFailure: "MODEL_UNAVAILABLE" }),
  ]);
  expect(recording.failure).toBe("MODEL_ERROR");
});
