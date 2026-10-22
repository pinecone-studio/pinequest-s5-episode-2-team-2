import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { measureEye, mirroredAsymmetry } from "@app/core";
import type {
  EyeMeasure,
  EyeSide,
  FrameAnalysis,
  GrayImage,
  Point,
  QualityReason,
} from "@app/core";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
// Face Landmarker iris landmarks: centre followed by four boundary points.
const IRIS_LANDMARKS = [
  [468, 469, 470, 471, 472],
  [473, 474, 475, 476, 477],
] as const;

/** One eye's crop, kept in memory only to draw the result. */
export interface EyeCrop {
  canvas: HTMLCanvasElement;
  /** Measurement in crop coordinates. */
  eye: EyeMeasure;
}

export interface FrameResult {
  analysis: FrameAnalysis;
  crops: [EyeCrop, EyeCrop] | null;
}

const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let landmarker: Promise<FaceLandmarker> | null = null;
let hands: Promise<HandLandmarker> | null = null;
let poses: Promise<PoseLandmarker> | null = null;

let coverHands: Promise<HandLandmarker> | null = null;

/**
 * A second hand detector for checking which eye is covered. Image mode has no timestamp
 * order, so it can run on the face crop in the same frame as the pointing detector.
 */
export function loadCoverHandLandmarker(): Promise<HandLandmarker> {
  coverHands ??= FilesetResolver.forVisionTasks(WASM_URL).then((fileset) =>
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
      runningMode: "IMAGE",
      numHands: 2,
    }),
  );
  return coverHands;
}

/** Finds the body at a distance, so the hand can be cropped before hand detection. */
export function loadPoseLandmarker(): Promise<PoseLandmarker> {
  poses ??= FilesetResolver.forVisionTasks(WASM_URL).then((fileset) =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
    }),
  );
  return poses;
}

export function loadHandLandmarker(): Promise<HandLandmarker> {
  hands ??= FilesetResolver.forVisionTasks(WASM_URL).then((fileset) =>
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 1,
    }),
  );
  return hands;
}

export function loadLandmarker(): Promise<FaceLandmarker> {
  landmarker ??= FilesetResolver.forVisionTasks(WASM_URL).then((fileset) =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 2,
    }),
  );
  return landmarker;
}

export async function startCamera(
  video: HTMLVideoElement,
  facingMode: "environment" | "user" = "environment",
): Promise<{ torch: boolean }> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
  });
  video.srcObject = stream;
  await video.play();
  const track = stream.getVideoTracks()[0];
  let torch = false;
  if (facingMode === "user") return { torch };
  try {
    const caps = track?.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
    if (track && caps.torch) {
      await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] });
      torch = true;
    }
  } catch {
    torch = false;
  }
  return { torch };
}

export function stopCamera(video: HTMLVideoElement): void {
  const stream = video.srcObject as MediaStream | null;
  stream?.getTracks().forEach((track) => track.stop());
  video.srcObject = null;
}

function irisEstimates(landmarks: NormalizedLandmark[], w: number, h: number) {
  return IRIS_LANDMARKS.map(([c, ...edges]) => {
    const center = { x: (landmarks[c]?.x ?? 0) * w, y: (landmarks[c]?.y ?? 0) * h };
    const radius =
      edges.reduce((sum, i) => {
        const p = landmarks[i];
        return sum + (p ? Math.hypot(p.x * w - center.x, p.y * h - center.y) : 0);
      }, 0) / edges.length;
    return { center, radius };
  }).sort((a, b) => a.center.x - b.center.x);
}

function toGray(data: Uint8ClampedArray, width: number, height: number): GrayImage {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
  }
  return { width, height, data: gray };
}

function shift(p: Point, dx: number, dy: number): Point {
  return { x: p.x + dx, y: p.y + dy };
}

function emptyAnalysis(timestampMs: number, w: number, h: number, reasons: QualityReason[]) {
  return {
    timestampMs,
    frameSize: { width: w, height: h },
    // Sharpness, exposure and head pose come with the frame quality checks.
    quality: {
      ok: reasons.length === 0,
      reasons,
      sharpness: 0,
      exposure: 0,
      headPose: { yaw: 0, pitch: 0, roll: 0 },
    },
    eyes: null,
    asymmetry: null,
  } satisfies FrameAnalysis;
}

/** Detects the face and measures both eyes in the current video frame. */
export function analyzeFrame(
  video: HTMLVideoElement,
  frame: HTMLCanvasElement,
  faces: FaceLandmarker,
  timestampMs: number,
): FrameResult {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const result = faces.detectForVideo(video, timestampMs);
  const found = result.faceLandmarks;
  if (found.length === 0)
    return { analysis: emptyAnalysis(timestampMs, w, h, ["NO_FACE"]), crops: null };
  if (found.length > 1) {
    return { analysis: emptyAnalysis(timestampMs, w, h, ["MULTIPLE_FACES"]), crops: null };
  }

  frame.width = w;
  frame.height = h;
  const ctx = frame.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, w, h);

  const sides: EyeSide[] = ["imageLeft", "imageRight"];
  const crops: EyeCrop[] = [];
  const eyes: EyeMeasure[] = [];
  for (const [i, iris] of irisEstimates(found[0]!, w, h).entries()) {
    const half = Math.ceil(iris.radius * 2.2);
    const x0 = Math.max(0, Math.round(iris.center.x) - half);
    const y0 = Math.max(0, Math.round(iris.center.y) - half);
    const cw = Math.min(w - x0, half * 2 + 1);
    const ch = Math.min(h - y0, half * 2 + 1);
    if (iris.radius < 3 || cw <= 0 || ch <= 0) {
      return { analysis: emptyAnalysis(timestampMs, w, h, ["EYE_NOT_FOUND"]), crops: null };
    }
    const pixels = ctx.getImageData(x0, y0, cw, ch);
    const local = measureEye(
      toGray(pixels.data, cw, ch),
      sides[i]!,
      shift(iris.center, -x0, -y0),
      iris.radius,
    );
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    canvas.getContext("2d")!.putImageData(pixels, 0, 0);
    crops.push({ canvas, eye: local });
    eyes.push({
      ...local,
      irisCenter: shift(local.irisCenter, x0, y0),
      reflex: local.reflex && shift(local.reflex, x0, y0),
    });
  }

  const [left, right] = eyes as [EyeMeasure, EyeMeasure];
  const reasons: QualityReason[] =
    left.reflexOffset && right.reflexOffset ? [] : ["REFLEX_NOT_FOUND"];
  const analysis: FrameAnalysis = {
    ...emptyAnalysis(timestampMs, w, h, reasons),
    eyes: [left, right],
    asymmetry:
      left.reflexOffset && right.reflexOffset
        ? mirroredAsymmetry(left.reflexOffset, right.reflexOffset)
        : null,
  };
  return { analysis, crops: crops as [EyeCrop, EyeCrop] };
}
