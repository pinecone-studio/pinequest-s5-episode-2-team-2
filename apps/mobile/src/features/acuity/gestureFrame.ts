import type { Frame } from "react-native-vision-camera";
import type { InferenceModel } from "../vision/facePipeline";
import { cropPixels } from "../vision/pixels";
import { inferHand, inferPose } from "./gesturePipeline";
import { handRegion } from "./gestures";

export interface GestureModels {
  poseDetector: InferenceModel;
  pose: InferenceModel;
  palm: InferenceModel;
  hand: InferenceModel;
}

/**
 * The hand crop samples the native NV12 frame, before the pose downsample. As in the web demo,
 * a body without a raised, free hand has no answer, and with no body at all (close to the phone
 * the body model often finds none) the hand is looked for in the whole frame.
 */
export function analyzeGestureFrame(frame: Frame, rgb: Float32Array, models: GestureModels) {
  "worklet";
  if (frame.orientation !== "up" || frame.isMirrored)
    throw new Error("Unsupported gesture orientation");
  const pose = inferPose(rgb, models.poseDetector, models.pose, frame.width, frame.height);
  const body = pose.length > 0;
  const raised = body ? handRegion(pose, frame.width, frame.height) : null;
  const diagnostics = {
    cropFound: !!raised,
    cropSizePx: raised?.size ?? 0,
    visibleWrists: [15, 16].filter((i) => (pose[i]?.visibility ?? 0) >= 0.5).length,
    visibleIndices: [19, 20].filter((i) => (pose[i]?.visibility ?? 0) >= 0.5).length,
    fullFrame: !body,
    palmFound: false,
    handPresent: false,
  };
  if (body && !raised) return { body, hand: [], diagnostics };
  const region = raised ?? wholeFrame(frame.width, frame.height);
  const planes = frame.getPlanes(),
    [y, uv] = planes;
  if (
    frame.pixelFormat !== "yuv-420-8-bit-full" ||
    planes.length !== 2 ||
    !y ||
    !uv ||
    y.width !== frame.width ||
    y.height !== frame.height ||
    uv.width !== frame.width / 2 ||
    uv.height !== frame.height / 2
  )
    throw new Error("Unsupported gesture planes");
  const crop = cropPixels(
    {
      format: "nv12",
      width: frame.width,
      height: frame.height,
      y: new Uint8Array(y.getPixelBuffer()),
      uv: new Uint8Array(uv.getPixelBuffer()),
      yStride: y.bytesPerRow,
      uvStride: uv.bytesPerRow,
    },
    region,
    256,
    true,
  );
  const hand = inferHand(crop, models.palm, models.hand, diagnostics);
  return { body, hand, diagnostics };
}

/** A square around the whole frame; the padding outside it is black. */
export function wholeFrame(width: number, height: number) {
  "worklet";
  const size = Math.max(width, height);
  return { x: (width - size) / 2, y: (height - size) / 2, size };
}
