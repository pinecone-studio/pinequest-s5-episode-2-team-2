export type PixelSource = { width: number; height: number } & (
  | { format: "rgb"; rgb: Uint8Array; stride: number }
  | { format: "nv12"; y: Uint8Array; uv: Uint8Array; yStride: number; uvStride: number }
);
export interface PixelCrop {
  x: number;
  y: number;
  size: number;
}

export function validatePixels(source: PixelSource) {
  "worklet";
  const { width, height } = source;
  if (![width, height].every((v) => Number.isInteger(v) && v > 0 && v <= 8192))
    throw new Error("Invalid pixel dimensions");
  const validPlane = (bytes: Uint8Array, stride: number, rowSize: number, rows: number) =>
    Number.isInteger(stride) && stride >= rowSize && bytes.length >= stride * rows;
  if (source.format === "rgb") {
    if (!validPlane(source.rgb, source.stride, width * 3, height))
      throw new Error("Invalid RGB plane");
  } else if (
    width % 2 ||
    height % 2 ||
    !validPlane(source.y, source.yStride, width, height) ||
    !validPlane(source.uv, source.uvStride, width, height / 2)
  )
    throw new Error("Invalid NV12 planes");
}

/**
 * Bilinear taps along one output axis: lower and upper source index and the upper weight,
 * clamped to the plane, for output i at `start + ((i + 0.5) * size) / n` (halved for the
 * chroma plane), shifted to pixel centres. `outside` marks positions past the source edge.
 */
function axisTaps(start: number, size: number, n: number, length: number, half: boolean) {
  "worklet";
  const lo = new Int32Array(n),
    hi = new Int32Array(n),
    weight = new Float64Array(n),
    outside = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const at = start + ((i + 0.5) * size) / n;
    const p = Math.max(0, Math.min(length - 1, (half ? at / 2 : at) - 0.5));
    const a = Math.floor(p);
    lo[i] = a;
    hi[i] = Math.min(length - 1, a + 1);
    weight[i] = p - a;
    outside[i] = at < 0 || at > length ? 1 : 0;
  }
  return { lo, hi, weight, outside };
}

/**
 * Full-resolution sampling; replicate borders like ml/dataset/prelabel.py.
 *
 * Worklets run on Hermes without a JIT, so the per-column and per-row taps are computed once
 * per crop and the sampling is inlined (#252); the arithmetic matches per-pixel bilinear
 * sampling exactly, so crops stay the same as in the ml fixtures.
 */
export function cropPixels(
  source: PixelSource,
  crop: PixelCrop,
  outputSize = 128,
  blackPadding = false,
): Float32Array<ArrayBuffer> {
  "worklet";
  validatePixels(source);
  if (
    ![crop.x, crop.y, crop.size].every(Number.isFinite) ||
    crop.size <= 0 ||
    !Number.isInteger(outputSize) ||
    outputSize <= 0 ||
    outputSize > 512
  )
    throw new Error("Invalid pixel crop");
  const n = outputSize;
  const result = new Float32Array(n * n * 3);
  const xs = axisTaps(crop.x, crop.size, n, source.width, false);
  const ys = axisTaps(crop.y, crop.size, n, source.height, false);
  if (source.format === "rgb") {
    const { rgb, stride } = source;
    for (let row = 0; row < n; row++) {
      if (blackPadding && ys.outside[row]) continue;
      const r0 = ys.lo[row]! * stride,
        r1 = ys.hi[row]! * stride,
        fy = ys.weight[row]!;
      for (let col = 0; col < n; col++) {
        if (blackPadding && xs.outside[col]) continue;
        const a = xs.lo[col]! * 3,
          b = xs.hi[col]! * 3,
          fx = xs.weight[col]!;
        const offset = (row * n + col) * 3;
        for (let c = 0; c < 3; c++) {
          const top = rgb[r0 + a + c]! * (1 - fx) + rgb[r0 + b + c]! * fx;
          const bottom = rgb[r1 + a + c]! * (1 - fx) + rgb[r1 + b + c]! * fx;
          result[offset + c] = (top * (1 - fy) + bottom * fy) / 255;
        }
      }
    }
    return result;
  }
  const { y: luma, uv, yStride, uvStride } = source;
  const cxs = axisTaps(crop.x, crop.size, n, source.width / 2, true);
  const cys = axisTaps(crop.y, crop.size, n, source.height / 2, true);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  for (let row = 0; row < n; row++) {
    if (blackPadding && ys.outside[row]) continue;
    const l0 = ys.lo[row]! * yStride,
      l1 = ys.hi[row]! * yStride,
      fy = ys.weight[row]!;
    const c0 = cys.lo[row]! * uvStride,
      c1 = cys.hi[row]! * uvStride,
      gy = cys.weight[row]!;
    for (let col = 0; col < n; col++) {
      if (blackPadding && xs.outside[col]) continue;
      const a = xs.lo[col]!,
        b = xs.hi[col]!,
        fx = xs.weight[col]!;
      const top = luma[l0 + a]! * (1 - fx) + luma[l0 + b]! * fx;
      const bottom = luma[l1 + a]! * (1 - fx) + luma[l1 + b]! * fx;
      const yValue = (top * (1 - fy) + bottom * fy) / 255;
      const u0 = cxs.lo[col]! * 2,
        u1 = cxs.hi[col]! * 2,
        gx = cxs.weight[col]!;
      const cbTop = uv[c0 + u0]! * (1 - gx) + uv[c0 + u1]! * gx;
      const cbBottom = uv[c1 + u0]! * (1 - gx) + uv[c1 + u1]! * gx;
      const cb = (cbTop * (1 - gy) + cbBottom * gy) / 255 - 0.5;
      const crTop = uv[c0 + u0 + 1]! * (1 - gx) + uv[c0 + u1 + 1]! * gx;
      const crBottom = uv[c1 + u0 + 1]! * (1 - gx) + uv[c1 + u1 + 1]! * gx;
      const cr = (crTop * (1 - gy) + crBottom * gy) / 255 - 0.5;
      // Match VisionCamera 5.2.3's full-range GPU resizer conversion.
      const offset = (row * n + col) * 3;
      result[offset] = clamp(yValue + 1.402 * cr);
      result[offset + 1] = clamp(yValue - 0.344136 * cb - 0.714136 * cr);
      result[offset + 2] = clamp(yValue + 1.772 * cb);
    }
  }
  return result;
}
