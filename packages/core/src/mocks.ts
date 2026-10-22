import { magnitude, mirroredAsymmetry, reflexOffset } from "./geometry";
import type {
  Child,
  EyeMeasure,
  EyeSide,
  FrameAnalysis,
  FrameQuality,
  Outcome,
  Point,
  ScanResult,
} from "./types";

// Deterministic mock data so UI and logic can be built before the camera and model exist.

const FRAME = { width: 3840, height: 2160 };
const IRIS_RADIUS = 48;
const CREATED_AT = "2026-10-22T09:00:00.000Z";

export function mockEyeMeasure(
  side: EyeSide,
  offset: Point | null = { x: 0, y: 0 },
  overrides: Partial<EyeMeasure> = {},
): EyeMeasure {
  const irisCenter = side === "imageLeft" ? { x: 1720, y: 1080 } : { x: 2120, y: 1080 };
  const reflex = offset && {
    x: irisCenter.x + offset.x * IRIS_RADIUS,
    y: irisCenter.y + offset.y * IRIS_RADIUS,
  };
  return {
    side,
    irisCenter,
    irisRadius: IRIS_RADIUS,
    reflex,
    reflexOffset: reflex && reflexOffset(irisCenter, IRIS_RADIUS, reflex),
    confidence: 0.9,
    ...overrides,
  };
}

export function mockFrameQuality(overrides: Partial<FrameQuality> = {}): FrameQuality {
  return {
    ok: true,
    reasons: [],
    sharpness: 0.8,
    exposure: 0.5,
    headPose: { yaw: 0, pitch: 0, roll: 0 },
    ...overrides,
  };
}

/** A frame whose image-right reflex is shifted by `deviation` (unitless) relative to symmetry. */
export function mockFrameAnalysis(
  deviation = 0,
  overrides: Partial<FrameAnalysis> = {},
): FrameAnalysis {
  const left = mockEyeMeasure("imageLeft", { x: 0.05, y: 0 });
  const right = mockEyeMeasure("imageRight", { x: -0.05 + deviation, y: 0 });
  return {
    timestampMs: 0,
    frameSize: FRAME,
    quality: mockFrameQuality(),
    eyes: [left, right],
    asymmetry: mirroredAsymmetry(left.reflexOffset!, right.reflexOffset!),
    ...overrides,
  };
}

const SCAN_BY_OUTCOME: Record<Outcome, Pick<ScanResult, "reasons" | "summary">> = {
  NO_VISIBLE_SIGN: {
    reasons: [],
    summary: { framesTotal: 30, framesUsed: 24, asymmetryScore: 0.03, spread: 0.01 },
  },
  REFER: {
    reasons: ["ASYMMETRY_ABOVE_THRESHOLD"],
    summary: {
      framesTotal: 30,
      framesUsed: 22,
      asymmetryScore: magnitude(mockFrameAnalysis(0.4).asymmetry!),
      spread: 0.02,
    },
  },
  RETAKE: {
    reasons: ["BLUR", "TOO_FEW_FRAMES"],
    summary: { framesTotal: 30, framesUsed: 3, asymmetryScore: null, spread: null },
  },
  NOT_ASSESSED: {
    reasons: ["MODEL_UNAVAILABLE"],
    summary: { framesTotal: 30, framesUsed: 0, asymmetryScore: null, spread: null },
  },
};

export function mockScanResult(
  outcome: Outcome = "NO_VISIBLE_SIGN",
  overrides: Partial<ScanResult> = {},
): ScanResult {
  return {
    id: `scan-${outcome.toLowerCase()}`,
    createdAt: CREATED_AT,
    childId: "child-1",
    outcome,
    ...SCAN_BY_OUTCOME[outcome],
    modelVersion: "mock",
    policyVersion: "mock",
    durationMs: 3200,
    ...overrides,
  };
}

export function mockChild(overrides: Partial<Child> = {}): Child {
  return {
    id: "child-1",
    nickname: "Child 1",
    birthYear: 2021,
    createdAt: CREATED_AT,
    ...overrides,
  };
}
