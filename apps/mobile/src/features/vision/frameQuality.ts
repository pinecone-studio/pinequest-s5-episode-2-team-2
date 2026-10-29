import { assessQuality } from "@app/core";
import type { QualityReason } from "@app/core";
import { toEyeMeasures } from "../measurement/eyeMeasure";
import type { LandmarkFrame } from "./facePipeline";

/** Run on the RN thread after camera/replay inference, not in a worklet. */
export function withFrameQuality(frame: LandmarkFrame): LandmarkFrame {
  const [left, right] = frame.eyes ?? [];
  return {
    ...frame,
    quality: assessQuality({
      ...frame,
      eyes: toEyeMeasures(frame),
      crops: left?.cropStats && right?.cropStats ? [left.cropStats, right.cropStats] : null,
    }),
  };
}

/**
 * The web demo's checks (demo/web-poc `scanner.ts`): one face, both eyes measured and a reflex
 * in each. Scans measured with its heuristic count frames by these (#274); the head pose, gaze,
 * distance and pixel limits were set for the keypoint model and only drive the live guidance.
 */
export function withWebDemoQuality(frame: LandmarkFrame): LandmarkFrame {
  const eyes = toEyeMeasures(frame);
  const reasons: QualityReason[] =
    frame.faceCount === 0
      ? ["NO_FACE"]
      : frame.faceCount > 1
        ? ["MULTIPLE_FACES"]
        : !eyes
          ? ["EYE_NOT_FOUND"]
          : eyes.some((eye) => eye.reflexOffset === null)
            ? ["REFLEX_NOT_FOUND"]
            : [];
  return {
    ...frame,
    quality: {
      sharpness: frame.quality?.sharpness ?? null,
      exposure: frame.quality?.exposure ?? null,
      headPose: frame.quality?.headPose ?? null,
      ok: reasons.length === 0,
      reasons,
    },
  };
}
