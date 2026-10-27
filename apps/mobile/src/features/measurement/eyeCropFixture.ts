import type { Point } from "@app/core";
import type { PixelSource } from "../vision/pixels";

/**
 * Synthetic RGB frame shared by the TypeScript and Python eye-crop parity tests (#21).
 * Both sides build it from this formula, so no image is stored.
 */
export function fixtureFrame(width: number, height: number): PixelSource {
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      rgb[i] = (x * 3 + y) % 256;
      rgb[i + 1] = (x + y * 2 + 40) % 256;
      rgb[i + 2] = Math.round(127.5 + 127.5 * Math.sin(x / 9) * Math.cos(y / 7));
    }
  return { format: "rgb", width, height, rgb, stride: width * 3 };
}

/** A 478-point landmark list with only the ten iris points set (468–477). */
export function irisLandmarks(irises: readonly (readonly Point[])[]): Point[] {
  const landmarks: Point[] = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  irises.flat().forEach((p, i) => (landmarks[468 + i] = { ...p }));
  return landmarks;
}

/** Output pixels compared in the fixture (row, col) on the 128 × 128 model input. */
export const SAMPLE_POINTS = [0, 17, 64, 100, 127].flatMap((row) =>
  [0, 17, 64, 100, 127].map((col) => [row, col] as const),
);
