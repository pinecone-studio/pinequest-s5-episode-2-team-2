import type { Point } from "@app/core";
import type { EyePrediction } from "./eyeCrops";
import type { LandmarkFrame } from "./facePipeline";
import { withFrameQuality } from "./frameQuality";

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
