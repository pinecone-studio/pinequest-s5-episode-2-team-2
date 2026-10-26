/** Pixel coordinates in the full-resolution camera frame. */
export type Point = { x: number; y: number };

/**
 * Side of the eye in the image, not the anatomical side.
 * With the back camera, the image-left eye is the child's right eye.
 */
export type EyeSide = "imageLeft" | "imageRight";

export interface EyeMeasure {
  side: EyeSide;
  irisCenter: Point;
  /** Pixels. */
  irisRadius: number;
  /** Corneal light reflex; null when none was found. */
  reflex: Point | null;
  /** (reflex - irisCenter) / irisRadius. Unitless; null when there is no reflex. */
  reflexOffset: Point | null;
  /** 0..1 */
  confidence: number;
}

export type QualityReason =
  | "NO_FACE"
  | "MULTIPLE_FACES"
  | "EYE_NOT_FOUND"
  | "EYES_CLOSED"
  | "BLUR"
  | "TOO_DARK"
  | "OVEREXPOSED"
  | "TOO_FAR"
  | "TOO_CLOSE"
  | "HEAD_TURNED"
  | "NOT_LOOKING"
  | "REFLEX_NOT_FOUND"
  | "MULTIPLE_REFLEXES";

export interface HeadPose {
  /** Degrees. */
  yaw: number;
  pitch: number;
  roll: number;
}

export interface FrameQuality {
  ok: boolean;
  reasons: QualityReason[];
  /** Null until measured from the eye crop pixels. */
  sharpness: number | null;
  /** Null until measured from the eye crop pixels. */
  exposure: number | null;
  /** Null without a face. */
  headPose: HeadPose | null;
}

export interface FrameAnalysis {
  timestampMs: number;
  frameSize: { width: number; height: number };
  quality: FrameQuality;
  /** [imageLeft, imageRight]; null when the eyes were not found. */
  eyes: [EyeMeasure, EyeMeasure] | null;
  /** Mirrored difference of the two reflex offsets. Unitless. */
  asymmetry: Point | null;
}

export type Outcome = "REFER" | "RETAKE" | "NOT_ASSESSED" | "NO_VISIBLE_SIGN";

export type ReasonCode =
  | QualityReason
  | "ASYMMETRY_ABOVE_THRESHOLD"
  | "LOW_CONSISTENCY"
  | "TOO_FEW_FRAMES"
  | "MODEL_UNAVAILABLE"
  | "MODEL_ERROR"
  | "TIMEOUT";

export interface ScanSummary {
  framesTotal: number;
  framesUsed: number;
  /** Median asymmetry magnitude over the used frames. Unitless. */
  asymmetryScore: number | null;
  /** Variability of the asymmetry between used frames. Unitless. */
  spread: number | null;
}

/** One completed scan. Stored locally; never contains images. */
export interface ScanResult {
  id: string;
  /** ISO 8601. */
  createdAt: string;
  childId: string | null;
  outcome: Outcome;
  reasons: ReasonCode[];
  summary: ScanSummary;
  modelVersion: string;
  policyVersion: string;
  durationMs: number;
}

export interface Child {
  id: string;
  nickname: string;
  birthYear: number | null;
  /** ISO 8601. */
  createdAt: string;
}

export type ScanFailure = "MODEL_UNAVAILABLE" | "MODEL_ERROR" | "TIMEOUT";

export interface PolicyInput {
  summary: ScanSummary;
  /** Reasons the rejected frames were rejected, in order of first appearance. */
  qualityReasons: QualityReason[];
  /** Set when the scan could not be measured at all. */
  failure: ScanFailure | null;
}

export interface Decision {
  outcome: Outcome;
  /** Empty only for NO_VISIBLE_SIGN. */
  reasons: ReasonCode[];
}

export interface PolicyConfig {
  /** Asymmetry score at or above which the outcome is REFER. Unitless. */
  referAsymmetry: number;
  minFramesUsed: number;
  /** Spread above which the scan is too inconsistent to judge. */
  maxSpread: number;
  /** Stays false until the thresholds are validated on held-out data. */
  validated: false;
}
