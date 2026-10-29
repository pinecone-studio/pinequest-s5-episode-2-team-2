import type { Point } from "@app/core";

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  eyes: [Point, Point];
  score: number;
}
export interface FaceRegion {
  x: number;
  y: number;
  size: number;
  rotation: number;
}
export const FACE_INPUT_SIZE = 512;
const anchors = [16, 8].flatMap((grid) =>
  Array.from({ length: grid * grid * (grid === 16 ? 2 : 6) }, (_, i) => {
    const cell = Math.floor(i / (grid === 16 ? 2 : 6));
    return { x: ((cell % grid) + 0.5) / grid, y: (Math.floor(cell / grid) + 0.5) / grid };
  }),
);
const fullAnchors = Array.from({ length: 48 * 48 }, (_, i) => ({
  x: ((i % 48) + 0.5) / 48,
  y: (Math.floor(i / 48) + 0.5) / 48,
}));

function overlap(a: FaceBox, b: FaceBox) {
  "worklet";
  const intersection =
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return intersection / (a.width * a.height + b.width * b.height - intersection);
}

/** BlazeFace short/full-range decoder and weighted NMS, in normalized letterboxed coordinates. */
export function decodeFaces(
  boxes: Float32Array,
  logits: Float32Array,
  fullRange = false,
): FaceBox[] {
  "worklet";
  const grid = fullRange ? fullAnchors : anchors;
  const size = fullRange ? 192 : 128;
  if (boxes.length !== grid.length * 16 || logits.length !== grid.length)
    throw new Error("Unexpected face detector tensors");
  let candidates: FaceBox[] = [];
  for (let i = 0; i < grid.length; i++) {
    const logit = logits[i]!;
    if (!Number.isFinite(logit) || logit < (fullRange ? Math.log(0.6 / 0.4) : 0)) continue;
    const anchor = grid[i]!;
    const offset = i * 16;
    const values = boxes.subarray(offset, offset + 8);
    if (!values.every(Number.isFinite) || values[2]! <= 0 || values[3]! <= 0) continue;
    candidates.push({
      x: (values[0]! - values[2]! / 2) / size + anchor.x,
      y: (values[1]! - values[3]! / 2) / size + anchor.y,
      width: values[2]! / size,
      height: values[3]! / size,
      eyes: [
        { x: values[4]! / size + anchor.x, y: values[5]! / size + anchor.y },
        { x: values[6]! / size + anchor.x, y: values[7]! / size + anchor.y },
      ],
      score: 1 / (1 + Math.exp(-Math.min(100, logit))),
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  const faces: FaceBox[] = [];
  while (candidates.length) {
    const best = candidates[0]!;
    const group = candidates.filter((face) => overlap(best, face) > 0.3);
    candidates = candidates.filter((face) => overlap(best, face) <= 0.3);
    const weight = group.reduce((sum, face) => sum + face.score, 0);
    const merged: FaceBox = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      eyes: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
      score: best.score,
    };
    for (const face of group) {
      const w = face.score / weight;
      merged.x += face.x * w;
      merged.y += face.y * w;
      merged.width += face.width * w;
      merged.height += face.height * w;
      for (let eye = 0; eye < 2; eye++) {
        merged.eyes[eye]!.x += face.eyes[eye]!.x * w;
        merged.eyes[eye]!.y += face.eyes[eye]!.y * w;
      }
    }
    faces.push(merged);
  }
  return faces;
}

export function faceRegion(face: FaceBox): FaceRegion {
  "worklet";
  const [first, second] = face.eyes;
  const [left, right] = first.x <= second.x ? [first, second] : [second, first];
  return {
    x: (face.x + face.width / 2) * FACE_INPUT_SIZE,
    y: (face.y + face.height / 2) * FACE_INPUT_SIZE,
    size: Math.max(face.width, face.height) * FACE_INPUT_SIZE * 1.5,
    rotation: Math.atan2(right!.y - left!.y, right!.x - left!.x),
  };
}

export function cropPoint(point: Point, region: FaceRegion, outputSize: number): Point {
  "worklet";
  const x = (point.x / outputSize - 0.5) * region.size;
  const y = (point.y / outputSize - 0.5) * region.size;
  const c = Math.cos(region.rotation),
    s = Math.sin(region.rotation);
  return { x: region.x + x * c - y * s, y: region.y + x * s + y * c };
}

/** RGB float32 bilinear sampling; pixels outside the image are black. */
export function sampleCrop(
  rgb: Float32Array,
  sourceSize: number,
  region: FaceRegion,
  outputSize: number,
): Float32Array<ArrayBuffer> {
  "worklet";
  if (
    rgb.length !== sourceSize * sourceSize * 3 ||
    !Number.isInteger(outputSize) ||
    outputSize <= 0 ||
    ![region.x, region.y, region.size, region.rotation].every(Number.isFinite) ||
    region.size <= 0
  ) {
    throw new Error("Invalid RGB crop");
  }
  const output = new Float32Array(outputSize * outputSize * 3);
  for (let y = 0; y < outputSize; y++)
    for (let x = 0; x < outputSize; x++) {
      const p = cropPoint({ x: x + 0.5, y: y + 0.5 }, region, outputSize);
      const sx = p.x - 0.5,
        sy = p.y - 0.5,
        x0 = Math.floor(sx),
        y0 = Math.floor(sy);
      const fx = sx - x0,
        fy = sy - y0;
      for (let dy = 0; dy <= 1; dy++)
        for (let dx = 0; dx <= 1; dx++) {
          const px = x0 + dx,
            py = y0 + dy;
          if (px < 0 || py < 0 || px >= sourceSize || py >= sourceSize) continue;
          const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
          for (let channel = 0; channel < 3; channel++) {
            const index = (y * outputSize + x) * 3 + channel;
            output[index] = output[index]! + rgb[(py * sourceSize + px) * 3 + channel]! * weight;
          }
        }
    }
  return output;
}

/** Undo the square resizer's contain/letterbox transform to full-resolution pixels. */
export function unletterbox(point: Point, width: number, height: number): Point {
  "worklet";
  const scale = FACE_INPUT_SIZE / Math.max(width, height);
  return {
    x: (point.x - (FACE_INPUT_SIZE - width * scale) / 2) / scale,
    y: (point.y - (FACE_INPUT_SIZE - height * scale) / 2) / scale,
  };
}
