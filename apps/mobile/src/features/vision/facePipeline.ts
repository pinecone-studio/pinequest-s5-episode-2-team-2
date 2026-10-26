import type { FrameQuality, Point } from "@app/core";
import type { EyeFrameResult } from "./eyeFrame";
import {
  cropPoint,
  decodeFaces,
  FACE_INPUT_SIZE,
  faceRegion,
  sampleCrop,
  unletterbox,
} from "./faceMath";

export interface InferenceModel {
  runSync(input: ArrayBuffer[]): ArrayBuffer[];
}
export interface LandmarkFrame extends Partial<EyeFrameResult> {
  quality?: FrameQuality;
  timestampMs: number;
  frameSize: { width: number; height: number };
  faceCount: number;
  landmarks: Point[];
  latencyMs: number;
}

/** The two pinned MediaPipe models have fixed float32 tensor boundaries; see the #16 spike. */
export function inferLandmarks(
  rgb: Float32Array,
  detector: InferenceModel,
  mesh: InferenceModel,
  width: number,
  height: number,
): Pick<LandmarkFrame, "faceCount" | "landmarks"> {
  "worklet";
  if (![width, height].every((size) => Number.isInteger(size) && size > 0))
    throw new Error("Invalid frame dimensions");
  const input = sampleCrop(
    rgb,
    FACE_INPUT_SIZE,
    { x: 256, y: 256, size: FACE_INPUT_SIZE, rotation: 0 },
    128,
  );
  for (let i = 0; i < input.length; i++) input[i] = input[i]! * 2 - 1;
  const detection = detector.runSync([input.buffer]);
  if (detection.length !== 2) throw new Error("Unexpected detector outputs");
  const faces = decodeFaces(new Float32Array(detection[0]!), new Float32Array(detection[1]!));
  if (faces.length !== 1) return { faceCount: faces.length, landmarks: [] };
  const region = faceRegion(faces[0]!);
  const crop = sampleCrop(rgb, FACE_INPUT_SIZE, region, 256);
  const output = mesh.runSync([crop.buffer]);
  if (
    output.length !== 3 ||
    output[0]?.byteLength !== 1434 * 4 ||
    output[1]?.byteLength !== 4 ||
    output[2]?.byteLength !== 4
  ) {
    throw new Error("Unexpected landmark outputs");
  }
  const presence = new Float32Array(output[1])[0]!;
  if (!Number.isFinite(presence)) throw new Error("Invalid face presence");
  if (presence < 0) return { faceCount: 0, landmarks: [] };
  const points = new Float32Array(output[0]);
  if (!points.every(Number.isFinite)) throw new Error("Invalid landmarks");
  return {
    faceCount: 1,
    landmarks: Array.from({ length: 478 }, (_, i) =>
      unletterbox(
        cropPoint({ x: points[i * 3]!, y: points[i * 3 + 1]! }, region, 256),
        width,
        height,
      ),
    ),
  };
}
