import { assessQuality } from "@app/core";
import { toEyeMeasures } from "../measurement/eyeMeasure";
import type { LandmarkFrame } from "./facePipeline";

/** Run on the RN thread after camera/replay inference, not in a worklet. */
export function withFrameQuality(frame: LandmarkFrame): LandmarkFrame {
  return {
    ...frame,
    quality: assessQuality({ ...frame, eyes: toEyeMeasures(frame) }),
  };
}
