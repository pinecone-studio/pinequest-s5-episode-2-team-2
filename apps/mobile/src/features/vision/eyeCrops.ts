import type { EyeSide, Point } from "@app/core";
import { cropPixels } from "./pixels";
import type { PixelCrop, PixelSource } from "./pixels";
import type { InferenceModel } from "./facePipeline";

export interface EyeRegion extends PixelCrop {
  side: EyeSide;
}
export interface EyePrediction {
  side: EyeSide;
  irisCenter: Point;
  irisRadius: number;
  reflex: Point | null;
  reflexVisibleProbability: number;
  crop: EyeRegion;
}

function roundEven(value: number) {
  "worklet";
  const rounded = Math.round(value);
  return Math.abs(value % 1) === 0.5 && rounded % 2 !== 0 ? rounded - 1 : rounded;
}

/** Match the training crop: a square five iris radii wide, without rotating the eye. */
export function eyeRegions(landmarks: Point[]): [EyeRegion, EyeRegion] | null {
  "worklet";
  if (landmarks.length !== 478) return null;
  const regions: PixelCrop[] = [];
  for (const start of [468, 473]) {
    const iris = landmarks.slice(start, start + 5);
    if (!iris.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
    const center = iris[0]!;
    const radius =
      iris.slice(1).reduce((sum, p) => sum + Math.hypot(p.x - center.x, p.y - center.y), 0) / 4;
    if (!(radius > 0)) return null;
    const size = roundEven(radius * 5);
    if (size < 1) return null;
    regions.push({
      x: roundEven(center.x) - Math.floor(size / 2),
      y: roundEven(center.y) - Math.floor(size / 2),
      size,
    });
  }
  regions.sort((a, b) => a.x + a.size / 2 - (b.x + b.size / 2));
  return [
    { ...regions[0]!, side: "imageLeft" },
    { ...regions[1]!, side: "imageRight" },
  ];
}

export function inferEyes(
  source: PixelSource,
  landmarks: Point[],
  model: InferenceModel,
): [EyePrediction, EyePrediction] | null {
  "worklet";
  const regions = eyeRegions(landmarks);
  if (!regions) return null;
  const eyes = regions.map((region): EyePrediction => {
    const rgb = cropPixels(source, region);
    const output = model.runSync([rgb.buffer]);
    if (output.length !== 1 || output[0]?.byteLength !== 24)
      throw new Error("Unexpected eye model output");
    const values = new Float32Array(output[0]);
    const [x, y, radius, rx, ry, visible] = Array.from(values) as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    if (
      !values.every(Number.isFinite) ||
      x < 0 ||
      x > 1 ||
      y < 0 ||
      y > 1 ||
      radius <= 0 ||
      radius > 0.5 ||
      visible < 0 ||
      visible > 1 ||
      (visible >= 0.5 && (rx < 0 || rx > 1 || ry < 0 || ry > 1))
    )
      throw new Error("Invalid eye model output");
    return {
      side: region.side,
      crop: region,
      irisCenter: { x: region.x + x * region.size, y: region.y + y * region.size },
      irisRadius: radius * region.size,
      reflex:
        visible >= 0.5 ? { x: region.x + rx * region.size, y: region.y + ry * region.size } : null,
      reflexVisibleProbability: visible,
    };
  });
  return [eyes[0]!, eyes[1]!];
}
