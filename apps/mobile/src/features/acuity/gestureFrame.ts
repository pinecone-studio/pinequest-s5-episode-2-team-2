import type { Frame } from "react-native-vision-camera";
import type { InferenceModel } from "../vision/facePipeline";
import { cropPixels, type PixelSource } from "../vision/pixels";
import type { Eye } from "./acuity";
import {
  COVER_CROP_PX,
  coverFromFace,
  coverFromPose,
  faceCropRegion,
  type CoverState,
} from "./cover";
import {
  inferHand,
  inferHands,
  inferIrises,
  inferPose,
  type GesturePoint,
} from "./gesturePipeline";
import { handRegion } from "./gestures";

export interface GestureModels {
  poseDetector: InferenceModel;
  pose: InferenceModel;
  palm: InferenceModel;
  hand: InferenceModel;
  /** The scan's short-range face detector and face mesh, for the eye-cover check. */
  face: InferenceModel;
  mesh: InferenceModel;
}

/** The native NV12 planes, before the pose downsample. */
function nv12(frame: Frame): PixelSource {
  "worklet";
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
  return {
    format: "nv12",
    width: frame.width,
    height: frame.height,
    y: new Uint8Array(y.getPixelBuffer()),
    uv: new Uint8Array(uv.getPixelBuffer()),
    yStride: y.bytesPerRow,
    uvStride: uv.bytesPerRow,
  };
}

/**
 * The web demo's cover check: a 256 crop around the face, centred on the pose nose, where the
 * face model finds both irises and the hand model up to two hands. Without irises it falls back
 * to the body model, as in the web demo.
 */
function coverState(
  pose: GesturePoint[],
  eye: Eye,
  frame: Frame,
  pixels: () => PixelSource,
  models: GestureModels,
): CoverState {
  "worklet";
  const region = pose.length ? faceCropRegion(pose, frame.width, frame.height) : null;
  if (!region) return "noBody";
  const crop = cropPixels(pixels(), region, COVER_CROP_PX, true);
  const irises = inferIrises(crop, COVER_CROP_PX, models.face, models.mesh);
  if (!irises) return coverFromPose(pose, eye, frame.width, frame.height);
  const hands = inferHands(crop, models.palm, models.hand)
    .flat()
    .map((p) => ({ x: p.x * COVER_CROP_PX, y: p.y * COVER_CROP_PX }));
  return coverFromFace(pose, eye, frame.width, frame.height, region, irises, hands);
}

/** A square around the whole frame; the padding outside it is black. */
export function wholeFrame(width: number, height: number) {
  "worklet";
  const size = Math.max(width, height);
  return { x: (width - size) / 2, y: (height - size) / 2, size };
}

// Worklet helpers must be initialized before their callers capture them.
/**
 * The hand crop samples the native NV12 frame, before the pose downsample. As in the web demo,
 * a body without a raised, free hand has no answer, and with no body at all (close to the phone
 * the body model often finds none) the hand is looked for in the whole frame.
 */
export function analyzeGestureFrame(
  frame: Frame,
  rgb: Float32Array,
  models: GestureModels,
  coverEye: Eye | null = null,
) {
  "worklet";
  if (frame.orientation !== "up" || frame.isMirrored)
    throw new Error("Unsupported gesture orientation");
  const pose = inferPose(rgb, models.poseDetector, models.pose, frame.width, frame.height);
  const body = pose.length > 0;
  let source: PixelSource | null = null;
  const pixels = () => (source ??= nv12(frame));
  // While an eye is tested, whether the other eye is covered (null in practice).
  const cover = coverEye ? coverState(pose, coverEye, frame, pixels, models) : null;
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
  if (body && !raised) return { body, hand: [], diagnostics, cover };
  const region = raised ?? wholeFrame(frame.width, frame.height);
  const crop = cropPixels(pixels(), region, 256, true);
  const hand = inferHand(crop, models.palm, models.hand, diagnostics);
  return { body, hand, diagnostics, cover };
}
