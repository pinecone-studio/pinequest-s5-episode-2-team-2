import type { Point } from "@app/core";
import type { Frame, FramePlane } from "react-native-vision-camera";
import { inferEyes } from "./eyeCrops";
import type { EyePrediction } from "./eyeCrops";
import type { InferenceModel } from "./facePipeline";
import type { PixelSource } from "./pixels";

export interface EyeFrameResult {
  eyes: [EyePrediction, EyePrediction] | null;
  eyeFailure: "MODEL_UNAVAILABLE" | "MODEL_ERROR" | "EYE_NOT_FOUND" | null;
}
type PixelFrame = Pick<Frame, "width" | "height" | "pixelFormat"> & {
  getPlanes(): Pick<FramePlane, "width" | "height" | "bytesPerRow" | "getPixelBuffer">[];
};

export function analyzeEyePixels(
  source: PixelSource,
  landmarks: Point[],
  model: InferenceModel | undefined,
): EyeFrameResult {
  "worklet";
  if (!landmarks.length) return { eyes: null, eyeFailure: "EYE_NOT_FOUND" };
  if (!model) return { eyes: null, eyeFailure: "MODEL_UNAVAILABLE" };
  try {
    const eyes = inferEyes(source, landmarks, model);
    return { eyes, eyeFailure: eyes ? null : "EYE_NOT_FOUND" };
  } catch {
    return { eyes: null, eyeFailure: "MODEL_ERROR" };
  }
}

export function analyzeEyes(
  frame: PixelFrame,
  landmarks: Point[],
  model: InferenceModel | undefined,
): EyeFrameResult {
  "worklet";
  if (!landmarks.length) return { eyes: null, eyeFailure: "EYE_NOT_FOUND" };
  if (!model) return { eyes: null, eyeFailure: "MODEL_UNAVAILABLE" };
  try {
    if (frame.pixelFormat !== "yuv-420-8-bit-full") throw new Error("Expected full-range NV12");
    const planes = frame.getPlanes();
    const [y, uv] = planes;
    if (
      planes.length !== 2 ||
      !y ||
      !uv ||
      y.width !== frame.width ||
      y.height !== frame.height ||
      uv.width !== frame.width / 2 ||
      uv.height !== frame.height / 2
    )
      throw new Error("Unsupported plane layout");
    return analyzeEyePixels(
      {
        format: "nv12",
        width: frame.width,
        height: frame.height,
        y: new Uint8Array(y.getPixelBuffer()),
        uv: new Uint8Array(uv.getPixelBuffer()),
        yStride: y.bytesPerRow,
        uvStride: uv.bytesPerRow,
      },
      landmarks,
      model,
    );
  } catch {
    return { eyes: null, eyeFailure: "MODEL_ERROR" };
  }
}
