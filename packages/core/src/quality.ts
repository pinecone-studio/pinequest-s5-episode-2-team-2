import { mirroredAsymmetry } from "./geometry";
import type { CropStats } from "./pixels";
import type {
  EyeMeasure,
  FrameAnalysis,
  FrameQuality,
  HeadPose,
  Point,
  QualityReason,
} from "./types";

/** What one camera frame gives the quality check. */
export interface QualityInput {
  timestampMs: number;
  frameSize: { width: number; height: number };
  faceCount: number;
  /** The 478 Face Landmarker points in frame pixels; empty without exactly one face. */
  landmarks: Point[];
  /** [imageLeft, imageRight]; null when the eyes were not measured. */
  eyes: [EyeMeasure, EyeMeasure] | null;
  /** `cropStats` of the [imageLeft, imageRight] eye crops; omit to skip the pixel checks. */
  crops?: [CropStats, CropStats] | null;
}

export interface QualityConfig {
  /** Eye opening (lid gap / eye width) below which the eye counts as closed. */
  minEyeOpen: number;
  maxRollDeg: number;
  maxYawDeg: number;
  maxPitchDeg: number;
  /** Iris radius as a fraction of the longer frame side: below is too far, above too close. */
  minIrisFraction: number;
  maxIrisFraction: number;
  /** Laplacian variance of an eye crop below which it counts as blurred. */
  minSharpness: number;
  /** Mean eye crop luminance (0..1) below which the frame is too dark. */
  minExposure: number;
  /** Mean eye crop luminance above which, or clipped fraction above which, it is overexposed. */
  maxExposure: number;
  maxClipped: number;
  /**
   * Horizontal iris shift from the middle of the eye, over the eye width, beyond which both
   * eyes shifting the same way means the child is looking away from the camera.
   */
  maxGazeShift: number;
}

// TODO(tune): first guesses, to be set from recorded scans. The iris limits correspond to
// roughly 50 cm and 20 cm on an iPhone main camera; the pose limits allow small head movement.
// The pixel limits assume 128 px crops in 0..1; the reflex itself clips only a few percent.
// The gaze limit is a small share of the eye width; looking away by only a few degrees
// already raises the mirrored asymmetry above the refer threshold (docs/calibration-sheet.md).
export const DEFAULT_QUALITY_CONFIG: QualityConfig = {
  minEyeOpen: 0.15,
  maxRollDeg: 10,
  maxYawDeg: 15,
  maxPitchDeg: 20,
  minIrisFraction: 0.008,
  maxIrisFraction: 0.02,
  minSharpness: 0.0005,
  minExposure: 0.15,
  maxExposure: 0.85,
  maxClipped: 0.1,
  maxGazeShift: 0.03,
};

// Face Landmarker indices: eye corners and lids for both eyes, cheek edges, nose tip, chin.
const EYES = [
  { corners: [33, 133], lids: [159, 145] },
  { corners: [263, 362], lids: [386, 374] },
] as const;
const CHEEKS = [234, 454] as const;
const IRIS_CENTERS = [468, 473] as const;
const NOSE_TIP = 1;
const CHIN = 152;
// TODO(tune): nose tip height between the eye line and the chin on a level, frontal face.
const FRONTAL_NOSE_RATIO = 0.45;

const DEG = 180 / Math.PI;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

/** Lid gap over eye width for both eyes. */
export function eyeOpenness(lm: Point[]): [number, number] {
  const [a, b] = EYES.map(({ corners, lids }) => {
    const width = dist(lm[corners[0]]!, lm[corners[1]]!);
    return width > 0 ? dist(lm[lids[0]]!, lm[lids[1]]!) / width : 0;
  });
  return [a!, b!];
}

/**
 * Horizontal iris position in each eye: the iris centre's distance from the middle of the
 * eye corners over the eye width, positive towards image right. [image-left eye, image-right
 * eye]; each iris is matched to the nearer eye, so the landmark order does not matter.
 */
export function gazeShift(lm: Point[]): [number, number] {
  const eyes = EYES.map(({ corners }) => {
    const [a, b] = [lm[corners[0]]!, lm[corners[1]]!];
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, width: dist(a, b) };
  }).sort((u, v) => u.mid.x - v.mid.x);
  const irises = IRIS_CENTERS.map((i) => lm[i]!);
  const shifts = eyes.map(({ mid, width }) => {
    const iris = irises.reduce((best, p) => (dist(p, mid) < dist(best, mid) ? p : best));
    return width > 0 ? (iris.x - mid.x) / width : 0;
  });
  return [shifts[0]!, shifts[1]!];
}

/** True when both irises sit off-centre to the same side: a sideways look, not a squint. */
export function lookingAway(lm: Point[], maxShift: number): boolean {
  const [a, b] = gazeShift(lm);
  return Math.sign(a) === Math.sign(b) && Math.min(Math.abs(a), Math.abs(b)) > maxShift;
}

/**
 * Rough head pose from 2D landmarks, in degrees: roll from the line between the outer eye
 * corners, yaw from where the nose tip sits between the cheeks, pitch from where it sits
 * between the eye line and the chin. Good enough to reject turned heads, not to measure them.
 */
export function headPose(lm: Point[]): HeadPose {
  const [p, q] = [lm[EYES[0].corners[0]]!, lm[EYES[1].corners[0]]!].sort((u, v) => u.x - v.x);
  const roll = Math.atan2(q!.y - p!.y, q!.x - p!.x) * DEG;

  const nose = lm[NOSE_TIP]!;
  const [left, right] = [lm[CHEEKS[0]]!, lm[CHEEKS[1]]!].sort((u, v) => u.x - v.x);
  const across = right!.x - left!.x;
  const yaw = across > 0 ? Math.asin(clamp(((nose.x - left!.x) / across - 0.5) * 2)) * DEG : 0;

  const eyeY =
    EYES.flatMap(({ corners }) => corners.map((i) => lm[i]!.y)).reduce((s, y) => s + y, 0) / 4;
  const down = lm[CHIN]!.y - eyeY;
  const ratio = down > 0 ? (nose.y - eyeY) / down : FRONTAL_NOSE_RATIO;
  const pitch = Math.asin(clamp((ratio - FRONTAL_NOSE_RATIO) / FRONTAL_NOSE_RATIO)) * DEG;

  return { yaw, pitch, roll };
}

/** Quality reasons for one frame. The pixel checks run only when `crops` is given. */
export function assessQuality(
  input: QualityInput,
  config: QualityConfig = DEFAULT_QUALITY_CONFIG,
): FrameQuality {
  const crops = input.crops ?? null;
  const result = (reasons: QualityReason[], pose: HeadPose | null): FrameQuality => ({
    ok: reasons.length === 0,
    reasons,
    sharpness: crops && pose ? Math.min(crops[0].sharpness, crops[1].sharpness) : null,
    exposure: crops && pose ? (crops[0].exposure + crops[1].exposure) / 2 : null,
    headPose: pose,
  });
  if (input.faceCount === 0) return result(["NO_FACE"], null);
  if (input.faceCount > 1) return result(["MULTIPLE_FACES"], null);
  const lm = input.landmarks;
  if (lm.length !== 478 || !lm.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
    return result(["EYE_NOT_FOUND"], null);
  }

  const reasons: QualityReason[] = [];
  const pose = headPose(lm);
  if (
    Math.abs(pose.roll) > config.maxRollDeg ||
    Math.abs(pose.yaw) > config.maxYawDeg ||
    Math.abs(pose.pitch) > config.maxPitchDeg
  ) {
    reasons.push("HEAD_TURNED");
  }
  if (eyeOpenness(lm).some((open) => open < config.minEyeOpen)) reasons.push("EYES_CLOSED");
  if (lookingAway(lm, config.maxGazeShift)) reasons.push("NOT_LOOKING");

  if (!input.eyes) {
    reasons.push("EYE_NOT_FOUND");
    return result(reasons, pose);
  }
  const side = Math.max(input.frameSize.width, input.frameSize.height);
  const iris = (input.eyes[0].irisRadius + input.eyes[1].irisRadius) / 2 / side;
  if (iris < config.minIrisFraction) reasons.push("TOO_FAR");
  if (iris > config.maxIrisFraction) reasons.push("TOO_CLOSE");
  if (crops) {
    if (crops.some((c) => c.sharpness < config.minSharpness)) reasons.push("BLUR");
    if (crops.some((c) => c.exposure < config.minExposure)) reasons.push("TOO_DARK");
    else if (crops.some((c) => c.exposure > config.maxExposure || c.clipped > config.maxClipped)) {
      reasons.push("OVEREXPOSED");
    }
  }
  if (input.eyes.some((e) => e.reflexOffset === null)) reasons.push("REFLEX_NOT_FOUND");
  return result(reasons, pose);
}

/** One frame ready for `summarizeFrames`: quality plus the asymmetry of good frames. */
export function analyzeFrame(
  input: QualityInput,
  config: QualityConfig = DEFAULT_QUALITY_CONFIG,
): FrameAnalysis {
  const quality = assessQuality(input, config);
  const [a, b] = input.eyes ?? [];
  return {
    timestampMs: input.timestampMs,
    frameSize: input.frameSize,
    quality,
    eyes: input.eyes,
    asymmetry:
      a?.reflexOffset && b?.reflexOffset ? mirroredAsymmetry(a.reflexOffset, b.reflexOffset) : null,
  };
}
