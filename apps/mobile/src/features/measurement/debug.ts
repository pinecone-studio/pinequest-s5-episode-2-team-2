import type { LandmarkFrame } from "../vision/facePipeline";
import type { MeasurementOverlayProps } from "./MeasurementOverlay";
import { toEyeMeasures } from "./eyeMeasure";

/** Development builds only, with EXPO_PUBLIC_MEASUREMENT_DEBUG=1 (see docs/face-pipeline.md). */
export function measurementDebugEnabled(): boolean {
  return (
    typeof __DEV__ !== "undefined" && __DEV__ && process.env.EXPO_PUBLIC_MEASUREMENT_DEBUG === "1"
  );
}

export function measurementOverlayProps(frame: LandmarkFrame): MeasurementOverlayProps {
  return {
    frameSize: frame.frameSize,
    eyes: toEyeMeasures(frame),
    latencyMs: frame.latencyMs,
    failure: frame.eyeFailure ?? (frame.faceCount === 0 ? "NO_FACE" : null),
  };
}
