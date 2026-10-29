import { assessQuality, magnitude } from "@app/core";
import type { EyeMeasure, FrameQuality, QualityReason } from "@app/core";
import { toEyeMeasures } from "../measurement/eyeMeasure";
import type { LandmarkFrame } from "./facePipeline";

// TODO(tune): a fixating eye's reflex sits near its iris centre (angle kappa is about 0.05-0.1
// iris radii); 0.25 radii, about 1.5 mm, leaves room for measurement noise.
export const MAX_FIXATION_OFFSET = 0.25;

/**
 * True when both eyes show a reflex but neither is near its iris centre: neither eye looks at
 * the light, e.g. crossed eyes or looking past the phone. The mirrored asymmetry cannot tell
 * crossed eyes from straight ones, because both reflexes move out together (#274). With a real
 * squint one eye still fixates, so such frames keep counting.
 */
export function notFixating(eyes: readonly EyeMeasure[] | null): boolean {
  return (
    !!eyes &&
    eyes.every((eye) => eye.reflexOffset && magnitude(eye.reflexOffset) > MAX_FIXATION_OFFSET)
  );
}

function withFixation(quality: FrameQuality, eyes: readonly EyeMeasure[] | null): FrameQuality {
  if (!notFixating(eyes) || quality.reasons.includes("NOT_LOOKING")) return quality;
  return { ...quality, ok: false, reasons: [...quality.reasons, "NOT_LOOKING"] };
}

/** Run on the RN thread after camera/replay inference, not in a worklet. */
export function withFrameQuality(frame: LandmarkFrame): LandmarkFrame {
  const [left, right] = frame.eyes ?? [];
  const eyes = toEyeMeasures(frame);
  const quality = assessQuality({
    ...frame,
    eyes,
    crops: left?.cropStats && right?.cropStats ? [left.cropStats, right.cropStats] : null,
  });
  return { ...frame, quality: withFixation(quality, eyes) };
}

/**
 * The web demo's checks (demo/web-poc `scanner.ts`): one face, both eyes measured and a reflex
 * in each, plus one the demo lacked: at least one eye looks at the light. Scans measured with
 * its heuristic count frames by these (#274); the head pose, gaze, distance and pixel limits
 * were set for the keypoint model and only drive the live guidance.
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
            : notFixating(eyes)
              ? ["NOT_LOOKING"]
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
