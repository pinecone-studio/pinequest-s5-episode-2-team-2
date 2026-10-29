import type { Frame } from "react-native-vision-camera";
import { decodeFaces } from "../vision/faceMath";
import { singleFace, type FaceTarget } from "./depthDistance";
import type { InferenceModel } from "../vision/facePipeline";

/** Undo letterboxing, then use native frame → camera → depth conversion; never preview maths. */
export function fullRangeTarget(
  frame: Frame,
  rgb: Float32Array,
  model: InferenceModel,
  at: number,
): { target: FaceTarget | null; count: number } {
  "worklet";
  if (frame.orientation !== "up" || frame.isMirrored || rgb.length !== 192 * 192 * 3)
    throw new Error("Unsupported distance frame");
  const input = new Float32Array(rgb.length);
  for (let i = 0; i < input.length; i++) input[i] = rgb[i]! * 2 - 1;
  const output = model.runSync([input.buffer]);
  if (output.length !== 2) throw new Error("Unexpected full-range outputs");
  const faces = decodeFaces(new Float32Array(output[0]!), new Float32Array(output[1]!), true);
  if (faces.length !== 1) return { target: null, count: faces.length };
  const face = faces[0]!,
    scale = 192 / Math.max(frame.width, frame.height);
  const corners = [
    [face.x, face.y],
    [face.x + face.width, face.y],
    [face.x, face.y + face.height],
    [face.x + face.width, face.y + face.height],
  ];
  const points: { x: number; y: number }[] = [];
  for (const [x, y] of corners) {
    const point = {
      x: (x! * 192 - (192 - frame.width * scale) / 2) / scale,
      y: (y! * 192 - (192 - frame.height * scale) / 2) / scale,
    };
    if (point.x < 0 || point.x > frame.width || point.y < 0 || point.y > frame.height)
      return { target: null, count: faces.length };
    points.push(frame.convertFramePointToCameraPoint(point));
  }
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y));
  const target = singleFace(
    [
      {
        type: "face",
        boundingBox: {
          x,
          y,
          width: Math.max(...points.map((p) => p.x)) - x,
          height: Math.max(...points.map((p) => p.y)) - y,
        },
      },
    ],
    at,
  );
  return { target, count: faces.length };
}
