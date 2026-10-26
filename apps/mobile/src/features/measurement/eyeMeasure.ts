import { reflexOffset } from "@app/core";
import type { EyeMeasure, ScanFailure } from "@app/core";
import type { EyePrediction } from "../vision/eyeCrops";
import type { EyeFrameResult } from "../vision/eyeFrame";

/**
 * One keypoint-model prediction as the shared `EyeMeasure` contract, in frame pixels.
 * `confidence` is the model's reflex-visible probability, 0 when it reports no reflex,
 * matching the heuristic where confidence is 0 without a reflex. It is not calibrated.
 */
export function toEyeMeasure(eye: EyePrediction): EyeMeasure {
  const reflex = eye.reflex && { ...eye.reflex };
  return {
    side: eye.side,
    irisCenter: { ...eye.irisCenter },
    irisRadius: eye.irisRadius,
    reflex,
    reflexOffset: reflex && reflexOffset(eye.irisCenter, eye.irisRadius, reflex),
    confidence: reflex ? eye.reflexVisibleProbability : 0,
  };
}

/** Both eyes of a frame, [imageLeft, imageRight], or null when they were not measured. */
export function toEyeMeasures(result: Partial<EyeFrameResult>): [EyeMeasure, EyeMeasure] | null {
  return result.eyes ? [toEyeMeasure(result.eyes[0]), toEyeMeasure(result.eyes[1])] : null;
}

/**
 * A missing or failing keypoint model means the scan cannot be measured at all, which the
 * policy turns into NOT_ASSESSED. EYE_NOT_FOUND only rejects that frame.
 */
export function scanFailure(
  eyeFailure: EyeFrameResult["eyeFailure"] | undefined,
): ScanFailure | null {
  return eyeFailure === "MODEL_UNAVAILABLE" || eyeFailure === "MODEL_ERROR" ? eyeFailure : null;
}
