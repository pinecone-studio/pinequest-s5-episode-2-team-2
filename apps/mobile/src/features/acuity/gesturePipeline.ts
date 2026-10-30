import type { FaceRegion } from "../vision/faceMath";
import {
  cropPoint,
  decodeFaces,
  FACE_INPUT_SIZE,
  faceRegion,
  sampleCrop,
  unletterbox,
} from "../vision/faceMath";
import type { InferenceModel } from "../vision/facePipeline";

export interface GesturePoint {
  x: number;
  y: number;
  visibility?: number;
}
type Detection = {
  x: number;
  y: number;
  width: number;
  height: number;
  points: GesturePoint[];
  score: number;
};

// MediaPipe CPU graphs: pose_detection_cpu.pbtxt / palm_detection_cpu.pbtxt.
// Fixed-size SSD anchors have two predictions per layer/cell, combining repeated strides.
const anchors = (grids: number[], counts: number[]) =>
  grids.flatMap((grid, layer) =>
    Array.from({ length: grid * grid * counts[layer]! }, (_, i) => ({
      x: ((Math.floor(i / counts[layer]!) % grid) + 0.5) / grid,
      y: (Math.floor(Math.floor(i / counts[layer]!) / grid) + 0.5) / grid,
    })),
  );
const POSE = anchors([28, 14, 7], [2, 2, 6]);
const PALM = anchors([24, 12], [2, 6]);
const sigmoid = (x: number) => {
  "worklet";
  return 1 / (1 + Math.exp(-Math.max(-100, Math.min(100, x))));
};

function tensors(output: ArrayBuffer[], sizes: number[]) {
  "worklet";
  if (
    output.length !== sizes.length ||
    output.some((buffer, i) => buffer.byteLength !== sizes[i]! * 4)
  )
    throw new Error("Unexpected gesture model tensors");
  return output.map((buffer) => new Float32Array(buffer));
}
function iou(a: Detection, b: Detection) {
  "worklet";
  const area =
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return area / (a.width * a.height + b.width * b.height - area);
}
/** The best `limit` detections, each its NMS cluster's score-weighted mean, best first. */
function detect(
  rgb: Float32Array,
  source: number,
  model: InferenceModel,
  pose: boolean,
  limit = 1,
): Detection[] {
  "worklet";
  const size = pose ? 224 : 192,
    grid = pose ? POSE : PALM,
    coords = pose ? 12 : 18;
  const input = sampleCrop(
    rgb,
    source,
    { x: source / 2, y: source / 2, size: source, rotation: 0 },
    size,
  );
  if (pose) for (let i = 0; i < input.length; i++) input[i] = input[i]! * 2 - 1;
  const [boxes, logits] = tensors(model.runSync([input.buffer]), [
    grid.length * coords,
    grid.length,
  ]);
  const candidates: Detection[] = [];
  for (let i = 0; i < grid.length; i++) {
    const logit = logits![i]!;
    if (!Number.isFinite(logit) || logit < 0) continue; // upstream min score = 0.5
    const values = boxes!.subarray(i * coords, (i + 1) * coords),
      anchor = grid[i]!;
    if (!values.every(Number.isFinite) || values[2]! <= 0 || values[3]! <= 0) continue;
    candidates.push({
      x: ((values[0]! - values[2]! / 2) / size + anchor.x) * source,
      y: ((values[1]! - values[3]! / 2) / size + anchor.y) * source,
      width: (values[2]! / size) * source,
      height: (values[3]! / size) * source,
      points: Array.from({ length: (coords - 4) / 2 }, (_, j) => ({
        x: (values[4 + j * 2]! / size + anchor.x) * source,
        y: (values[5 + j * 2]! / size + anchor.y) * source,
      })),
      score: sigmoid(logit),
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  // One answering person/hand, or up to two hands on the face crop for the cover check.
  const found: Detection[] = [];
  let left = candidates;
  while (left.length && found.length < limit) {
    const best = left[0]!;
    const group = left.filter((candidate) => iou(best, candidate) > 0.3);
    left = left.filter((candidate) => iou(best, candidate) <= 0.3);
    const total = group.reduce((sum, d) => sum + d.score, 0);
    const mean = (value: (d: Detection) => number) =>
      group.reduce((sum, d) => sum + value(d) * d.score, 0) / total;
    found.push({
      x: mean((d) => d.x),
      y: mean((d) => d.y),
      width: mean((d) => d.width),
      height: mean((d) => d.height),
      score: best.score,
      points: best.points.map((_, i) => ({
        x: mean((d) => d.points[i]!.x),
        y: mean((d) => d.points[i]!.y),
      })),
    });
  }
  return found;
}

function region(d: Detection, pose: boolean): FaceRegion | null {
  "worklet";
  const start = d.points[0]!,
    end = d.points[pose ? 1 : 2]!;
  const rotation = Math.PI / 2 + Math.atan2(end.y - start.y, end.x - start.x);
  const size = pose
    ? 2.5 * Math.hypot(end.x - start.x, end.y - start.y)
    : 2.6 * Math.max(d.width, d.height);
  if (!Number.isFinite(size) || size <= 0) return null;
  return pose
    ? { x: start.x, y: start.y, size, rotation }
    : {
        x: d.x + d.width / 2 + (Math.sin(rotation) * d.height) / 2,
        y: d.y + d.height / 2 - (Math.cos(rotation) * d.height) / 2,
        size,
        rotation,
      };
}

/** RGB [0,1], square 512 letterbox; output is normalised to the upright full frame. */
export function inferPose(
  rgb: Float32Array,
  detector: InferenceModel,
  model: InferenceModel,
  width: number,
  height: number,
): GesturePoint[] {
  "worklet";
  if (![width, height].every((n) => Number.isInteger(n) && n > 0))
    throw new Error("Invalid frame dimensions");
  const detection = detect(rgb, 512, detector, true)[0];
  if (!detection) return [];
  const roi = region(detection, true);
  if (!roi) return [];
  const crop = sampleCrop(rgb, 512, roi, 256);
  const [points, presence] = tensors(model.runSync([crop.buffer]), [195, 1, 65536, 159744, 117]);
  if (!Number.isFinite(presence![0]) || !points!.every(Number.isFinite))
    throw new Error("Invalid pose output");
  if (presence![0]! < 0.5) return [];
  return Array.from({ length: 33 }, (_, i) => {
    const p = unletterbox(
      cropPoint({ x: points![i * 5]!, y: points![i * 5 + 1]! }, roi, 256),
      width,
      height,
    );
    return {
      x: p.x / width,
      y: p.y / height,
      // As MediaPipe's PoseLandmarker reports it to the web demo: the visibility output alone.
      // Also taking the presence output made distant wrists read as hidden.
      visibility: sigmoid(points![i * 5 + 3]!),
    };
  });
}

/** RGB [0,1], square 256 hand crop; output is normalised to that same crop, unmirrored. */
export interface HandDiagnostics {
  palmFound: boolean;
  handPresent: boolean;
}
export function inferHand(
  rgb: Float32Array,
  detector: InferenceModel,
  model: InferenceModel,
  diagnostics?: HandDiagnostics,
): GesturePoint[] {
  "worklet";
  const detection = detect(rgb, 256, detector, false)[0];
  if (diagnostics) {
    diagnostics.palmFound = !!detection;
    diagnostics.handPresent = false;
  }
  if (!detection) return [];
  const points = handPoints(rgb, detection, model);
  if (diagnostics) diagnostics.handPresent = points.length > 0;
  return points;
}

/** Up to two hands, as the web demo's cover hand detector (numHands: 2). */
export function inferHands(
  rgb: Float32Array,
  detector: InferenceModel,
  model: InferenceModel,
): GesturePoint[][] {
  "worklet";
  return detect(rgb, 256, detector, false, 2)
    .map((detection) => handPoints(rgb, detection, model))
    .filter((points) => points.length > 0);
}

function handPoints(rgb: Float32Array, detection: Detection, model: InferenceModel) {
  "worklet";
  const roi = region(detection, false);
  if (!roi) return [];
  const crop = sampleCrop(rgb, 256, roi, 224);
  const [points, presence] = tensors(model.runSync([crop.buffer]), [63, 1, 1, 63]);
  if (!Number.isFinite(presence![0]) || !points!.every(Number.isFinite))
    throw new Error("Invalid hand output");
  if (presence![0]! < 0.5) return [];
  return Array.from({ length: 21 }, (_, i) => {
    const p = cropPoint({ x: points![i * 3]!, y: points![i * 3 + 1]! }, roi, 224);
    return { x: p.x / 256, y: p.y / 256 };
  });
}

/**
 * Both iris centres in a square RGB [0,1] crop, in its pixels, as the web demo's FaceLandmarker
 * finds them on the face crop: the scan's short-range detector and face mesh, best face first.
 */
export function inferIrises(
  rgb: Float32Array,
  size: number,
  detector: InferenceModel,
  mesh: InferenceModel,
): [GesturePoint, GesturePoint] | null {
  "worklet";
  const input = sampleCrop(rgb, size, { x: size / 2, y: size / 2, size, rotation: 0 }, 128);
  for (let i = 0; i < input.length; i++) input[i] = input[i]! * 2 - 1;
  const detection = detector.runSync([input.buffer]);
  if (detection.length !== 2) throw new Error("Unexpected detector outputs");
  const face = decodeFaces(new Float32Array(detection[0]!), new Float32Array(detection[1]!))[0];
  if (!face) return null;
  // faceRegion works in the scan's 512 square; this crop is `size` pixels.
  const scaled = faceRegion(face),
    k = size / FACE_INPUT_SIZE;
  const roi = {
    x: scaled.x * k,
    y: scaled.y * k,
    size: scaled.size * k,
    rotation: scaled.rotation,
  };
  const output = mesh.runSync([sampleCrop(rgb, size, roi, 256).buffer]);
  if (
    output.length !== 3 ||
    output[0]?.byteLength !== 1434 * 4 ||
    output[1]?.byteLength !== 4 ||
    output[2]?.byteLength !== 4
  )
    throw new Error("Unexpected landmark outputs");
  const presence = new Float32Array(output[1])[0]!;
  if (!Number.isFinite(presence)) throw new Error("Invalid face presence");
  if (presence < 0) return null;
  const points = new Float32Array(output[0]);
  const iris = (i: number) => {
    const p = cropPoint({ x: points[i * 3]!, y: points[i * 3 + 1]! }, roi, 256);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error("Invalid landmarks");
    return p;
  };
  return [iris(468), iris(473)];
}
