/** A square or rectangular image patch as luminance values in 0..1, row by row. */
export interface LumaCrop {
  width: number;
  height: number;
  luma: ArrayLike<number>;
}

export interface CropStats {
  /** Variance of the 4-neighbour Laplacian over interior pixels. Higher is sharper. */
  sharpness: number;
  /** Mean luminance, 0..1. */
  exposure: number;
  /** Fraction of pixels at or above `CLIP_LEVEL`. */
  clipped: number;
}

/** Luminance at or above this counts as clipped (about 250 of 255). */
export const CLIP_LEVEL = 0.98;

/** Rec. 601 luminance from interleaved RGB in 0..1, the weights OpenCV uses for grayscale. */
export function lumaFromRgb(rgb: ArrayLike<number>): Float32Array {
  const luma = new Float32Array(Math.floor(rgb.length / 3));
  for (let i = 0; i < luma.length; i++) {
    luma[i] = 0.299 * rgb[i * 3]! + 0.587 * rgb[i * 3 + 1]! + 0.114 * rgb[i * 3 + 2]!;
  }
  return luma;
}

/** Sharpness and exposure of one eye crop; null when the crop is too small or invalid. */
export function cropStats({ width, height, luma }: LumaCrop): CropStats | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3) return null;
  if (luma.length !== width * height) return null;

  let sum = 0;
  let clipped = 0;
  for (let i = 0; i < luma.length; i++) {
    const v = luma[i]!;
    if (!Number.isFinite(v)) return null;
    sum += v;
    if (v >= CLIP_LEVEL) clipped++;
  }

  let lapSum = 0;
  let lapSq = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = luma[i - 1]! + luma[i + 1]! + luma[i - width]! + luma[i + width]! - 4 * luma[i]!;
      lapSum += lap;
      lapSq += lap * lap;
    }
  }
  const n = (width - 2) * (height - 2);
  const mean = lapSum / n;
  return {
    sharpness: Math.max(0, lapSq / n - mean * mean),
    exposure: sum / luma.length,
    clipped: clipped / luma.length,
  };
}
