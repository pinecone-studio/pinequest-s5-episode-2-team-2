import type { CropStats, Point, QualityReason } from "@app/core";
import { GUIDANCE, guidanceForFrame } from "../scan/guidance";
import { toFrameAnalysis } from "../scan/recorder";
import type { EyePrediction } from "./eyeCrops";
import type { LandmarkFrame } from "./facePipeline";
import { emptyRecording, finishScan, recordFrame } from "../scan/recorder";
import { SCAN_POLICY } from "../scan/scanPolicy";
import { notFixating, withFrameQuality, withWebDemoQuality } from "./frameQuality";

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

const frame: LandmarkFrame = {
  faceCount: 1,
  landmarks: frontalFace(),
  frameSize: { width: 3840, height: 2160 },
  timestampMs: 250,
  latencyMs: 12,
};

test("attaches producer quality without changing frame metadata or the input", () => {
  const input = { ...frame, faceCount: 0, landmarks: [] };
  expect(withFrameQuality(input)).toEqual({
    ...input,
    quality: {
      ok: false,
      reasons: ["NO_FACE"],
      sharpness: null,
      exposure: null,
      headPose: null,
    },
  });
  expect(input).not.toHaveProperty("quality");
});

test("passes frame-pixel eye predictions through the shared EyeMeasure adapter", () => {
  const eyes = (["imageLeft", "imageRight"] as const).map((side, index): EyePrediction => ({
    side,
    irisCenter: { x: 430 + index * 140, y: 500 },
    irisRadius: 40,
    reflex: { x: 431 + index * 140, y: 500 },
    reflexVisibleProbability: 0.9,
    crop: { side, x: 330 + index * 140, y: 400, size: 200 },
  })) as [EyePrediction, EyePrediction];
  const result = withFrameQuality({ ...frame, eyes, eyeFailure: null });
  expect(result.eyes).toBe(eyes);
  expect(result.quality).toMatchObject({ ok: true, reasons: [], sharpness: null, exposure: null });
  expect(result.quality?.headPose).toEqual({ yaw: 0, pitch: 0, roll: 0 });
});

test("keeps missing-model failure and unavailable pixel checks while reporting closed eyes", () => {
  const landmarks = frontalFace();
  landmarks[159] = { x: 430, y: 498 };
  landmarks[145] = { x: 430, y: 502 };
  const result = withFrameQuality({
    ...frame,
    landmarks,
    eyes: null,
    eyeFailure: "MODEL_UNAVAILABLE",
  });
  expect(result.eyeFailure).toBe("MODEL_UNAVAILABLE");
  expect(result.quality).toMatchObject({
    ok: false,
    reasons: ["EYES_CLOSED", "EYE_NOT_FOUND"],
    sharpness: null,
    exposure: null,
  });
});

test.each<[CropStats, QualityReason]>([
  [{ sharpness: 0, exposure: 0.5, clipped: 0 }, "BLUR"],
  [{ sharpness: 0.01, exposure: 0.1, clipped: 0 }, "TOO_DARK"],
  [{ sharpness: 0.01, exposure: 0.9, clipped: 0 }, "OVEREXPOSED"],
  [{ sharpness: 0.01, exposure: 0.5, clipped: 0.2 }, "OVEREXPOSED"],
])("eye crop statistics %p reach guidance and recorded-frame quality as %s", (stats, reason) => {
  const eyes = (["imageLeft", "imageRight"] as const).map((side, index): EyePrediction => ({
    side,
    irisCenter: { x: 430 + index * 140, y: 500 },
    irisRadius: 40,
    reflex: { x: 431 + index * 140, y: 500 },
    reflexVisibleProbability: 0.9,
    crop: { side, x: 330 + index * 140, y: 400, size: 200 },
    cropStats: index === 0 ? stats : { sharpness: 0.01, exposure: 0.5, clipped: 0 },
  })) as [EyePrediction, EyePrediction];
  const result = withFrameQuality({ ...frame, eyes, eyeFailure: null });
  expect(result.quality).toMatchObject({
    ok: false,
    reasons: [reason],
    sharpness: Math.min(stats.sharpness, 0.01),
    exposure: (stats.exposure + 0.5) / 2,
  });
  expect(guidanceForFrame(result)).toBe(GUIDANCE[reason]);
  expect(toFrameAnalysis(result).quality).toBe(result.quality);
  delete eyes[1].cropStats;
  expect(withFrameQuality({ ...frame, eyes }).quality).toMatchObject({
    sharpness: null,
    exposure: null,
  });
});

function measuredEyes(reflex = true): [EyePrediction, EyePrediction] {
  return (["imageLeft", "imageRight"] as const).map((side, index): EyePrediction => ({
    side,
    irisCenter: { x: 430 + index * 140, y: 500 },
    irisRadius: 40,
    reflex: reflex || index === 0 ? { x: 431 + index * 140, y: 500 } : null,
    reflexVisibleProbability: 0.9,
    crop: { side, x: 330 + index * 140, y: 400, size: 200 },
    cropStats: { sharpness: 0, exposure: 0.9, clipped: 0.2 },
  })) as [EyePrediction, EyePrediction];
}

test("web demo checks pass a turned, blurred, sideways-looking frame with both reflexes", () => {
  const landmarks = frontalFace();
  // Nose tip far to the side and both irises off-centre: head turned and looking away.
  landmarks[1] = { x: 620, y: 590 };
  landmarks[468] = { x: 450, y: 500 };
  landmarks[473] = { x: 590, y: 500 };
  const measured = withFrameQuality({
    ...frame,
    landmarks,
    eyes: measuredEyes(),
    eyeFailure: null,
  });
  expect(measured.quality?.reasons).toEqual(
    expect.arrayContaining(["HEAD_TURNED", "NOT_LOOKING", "BLUR"]),
  );
  const result = withWebDemoQuality(measured);
  expect(result.quality).toEqual({ ...measured.quality, ok: true, reasons: [] });
  expect(toFrameAnalysis(result).quality.ok).toBe(true);
  expect(measured.quality?.ok).toBe(false);
});

test.each<[Partial<LandmarkFrame>, QualityReason]>([
  [{ faceCount: 0, landmarks: [] }, "NO_FACE"],
  [{ faceCount: 2, landmarks: [] }, "MULTIPLE_FACES"],
  [{ eyes: null, eyeFailure: "EYE_NOT_FOUND" }, "EYE_NOT_FOUND"],
  [{ eyes: measuredEyes(false), eyeFailure: null }, "REFLEX_NOT_FOUND"],
])("web demo checks reject %p as %s", (overrides, reason) => {
  expect(withWebDemoQuality({ ...frame, ...overrides }).quality).toEqual({
    ok: false,
    reasons: [reason],
    sharpness: null,
    exposure: null,
    headPose: null,
  });
});

/** Eyes whose reflexes sit `left` and `right` iris radii from the iris centre, horizontally. */
function reflexEyes(left: number, right: number): [EyePrediction, EyePrediction] {
  return (["imageLeft", "imageRight"] as const).map((side, index): EyePrediction => {
    const x = 430 + index * 140;
    return {
      side,
      irisCenter: { x, y: 500 },
      irisRadius: 40,
      reflex: { x: x + (index === 0 ? left : right) * 40, y: 500 },
      reflexVisibleProbability: 1,
      crop: { side, x: x - 100, y: 400, size: 200 },
    };
  }) as [EyePrediction, EyePrediction];
}

// Mirrored asymmetry x is left + right: straight eyes have both reflexes slightly nasal.
const STRAIGHT = reflexEyes(0.06, -0.06);
// Crossed eyes: both reflexes far out to the temple side, which mirrors to zero asymmetry.
const CROSSED = reflexEyes(-0.5, 0.5);
// A squint: the left eye fixates, the right one turns.
const SQUINT = reflexEyes(0.06, 0.4);

test("a frame counts when one eye looks at the light, even if the other is turned", () => {
  expect(notFixating(toFrameAnalysis({ ...frame, eyes: STRAIGHT }).eyes)).toBe(false);
  expect(notFixating(toFrameAnalysis({ ...frame, eyes: SQUINT }).eyes)).toBe(false);
  expect(notFixating(toFrameAnalysis({ ...frame, eyes: CROSSED }).eyes)).toBe(true);
  expect(notFixating(null)).toBe(false);
});

test("crossed eyes are not looking at the light, for the guidance and the scan", () => {
  const measured = withFrameQuality({ ...frame, eyes: CROSSED, eyeFailure: null });
  expect(measured.quality?.reasons).toContain("NOT_LOOKING");
  expect(guidanceForFrame(measured)).toBe(GUIDANCE.NOT_LOOKING);
  expect(withWebDemoQuality(measured).quality?.reasons).toEqual(["NOT_LOOKING"]);
  expect(withFrameQuality({ ...frame, eyes: SQUINT, eyeFailure: null }).quality?.ok).toBe(true);
});

test.each<[string, string, [EyePrediction, EyePrediction], string[]]>([
  ["straight eyes", "NO_VISIBLE_SIGN", STRAIGHT, []],
  ["a squint", "REFER", SQUINT, ["ASYMMETRY_ABOVE_THRESHOLD"]],
  // Without the fixation check this scored zero asymmetry and showed no visible sign.
  ["crossed eyes", "RETAKE", CROSSED, ["NOT_LOOKING", "TOO_FEW_FRAMES"]],
])("a heuristic scan of %s ends %s", (_, outcome, eyes, reasons) => {
  const frames = Array.from({ length: 8 }, (__, i) =>
    withWebDemoQuality({ ...frame, timestampMs: i * 300, eyes, eyeFailure: null }),
  );
  const { result } = finishScan(frames.reduce(recordFrame, emptyRecording()), meta, SCAN_POLICY);
  expect(result).toMatchObject({ outcome, reasons });
});

const meta = {
  id: "scan-1",
  childId: null,
  createdAt: "2026-10-29T08:00:00.000Z",
  durationMs: 3000,
  modelVersion: "heuristic-web-demo",
  policyVersion: "test",
};
