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

/** The hand crop samples the native NV12 frame, before the pose downsample. */
export function analyzeGestureFrame(frame: Frame, rgb: Float32Array, models: GestureModels) {
  "worklet";
  if (frame.orientation !== "up" || frame.isMirrored)
    throw new Error("Unsupported gesture orientation");
  const pose = inferPose(rgb, models.poseDetector, models.pose, frame.width, frame.height);
  const region = handRegion(pose, frame.width, frame.height);
  const diagnostics = {
    cropFound: !!region,
    cropSizePx: region?.size ?? 0,
    visibleWrists: [15, 16].filter((i) => (pose[i]?.visibility ?? 0) >= 0.5).length,
    visibleIndices: [19, 20].filter((i) => (pose[i]?.visibility ?? 0) >= 0.5).length,
    palmFound: false,
    handPresent: false,
  };
  if (!region) return { body: pose.length > 0, hand: [], diagnostics };
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
  return { body: true, hand, diagnostics };
}
