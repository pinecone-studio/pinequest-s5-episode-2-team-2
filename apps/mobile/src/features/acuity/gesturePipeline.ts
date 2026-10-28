import type { FaceRegion } from "../vision/faceMath";
import { cropPoint, sampleCrop, unletterbox } from "../vision/faceMath";
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
function detect(
  rgb: Float32Array,
  source: number,
  model: InferenceModel,
  pose: boolean,
): Detection | null {
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
  const best = candidates[0];
  if (!best) return null;
  // Only one answering person/hand is used; merge the highest-score NMS cluster.
  const group = candidates.filter((candidate) => iou(best, candidate) > 0.3);
  const total = group.reduce((sum, d) => sum + d.score, 0);
  const mean = (value: (d: Detection) => number) =>
    group.reduce((sum, d) => sum + value(d) * d.score, 0) / total;
  return {
    x: mean((d) => d.x),
    y: mean((d) => d.y),
    width: mean((d) => d.width),
    height: mean((d) => d.height),
    score: best.score,
    points: best.points.map((_, i) => ({
      x: mean((d) => d.points[i]!.x),
      y: mean((d) => d.points[i]!.y),
    })),
  };
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
  const detection = detect(rgb, 512, detector, true);
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
      visibility: Math.min(sigmoid(points![i * 5 + 3]!), sigmoid(points![i * 5 + 4]!)),
    };
  });
}

/** RGB [0,1], square 256 hand crop; output is normalised to that same crop, unmirrored. */
export function inferHand(
  rgb: Float32Array,
  detector: InferenceModel,
  model: InferenceModel,
): GesturePoint[] {
  "worklet";
  const detection = detect(rgb, 256, detector, false);
  if (!detection) return [];
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
