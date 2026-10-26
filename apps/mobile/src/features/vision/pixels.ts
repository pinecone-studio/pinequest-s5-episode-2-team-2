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

function sample(
  bytes: Uint8Array,
  stride: number,
  width: number,
  height: number,
  x: number,
  y: number,
  channels: number,
  channel: number,
) {
  "worklet";
  const px = Math.max(0, Math.min(width - 1, x)),
    py = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(px),
    y0 = Math.floor(py),
    fx = px - x0,
    fy = py - y0;
  const x1 = Math.min(width - 1, x0 + 1),
    y1 = Math.min(height - 1, y0 + 1);
  const top =
    bytes[y0 * stride + x0 * channels + channel]! * (1 - fx) +
    bytes[y0 * stride + x1 * channels + channel]! * fx;
  const bottom =
    bytes[y1 * stride + x0 * channels + channel]! * (1 - fx) +
    bytes[y1 * stride + x1 * channels + channel]! * fx;
  return (top * (1 - fy) + bottom * fy) / 255;
}

/** Full-resolution sampling; replicate borders like ml/dataset/prelabel.py. */
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
  const result = new Float32Array(outputSize * outputSize * 3);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  for (let row = 0; row < outputSize; row++)
    for (let col = 0; col < outputSize; col++) {
      const x = crop.x + ((col + 0.5) * crop.size) / outputSize;
      const y = crop.y + ((row + 0.5) * crop.size) / outputSize;
      if (blackPadding && (x < 0 || y < 0 || x > source.width || y > source.height)) continue;
      const offset = (row * outputSize + col) * 3;
      if (source.format === "rgb") {
        for (let c = 0; c < 3; c++)
          result[offset + c] = sample(
            source.rgb,
            source.stride,
            source.width,
            source.height,
            x - 0.5,
            y - 0.5,
            3,
            c,
          );
      } else {
        const luma = sample(
          source.y,
          source.yStride,
          source.width,
          source.height,
          x - 0.5,
          y - 0.5,
          1,
          0,
        );
        const cb =
          sample(
            source.uv,
            source.uvStride,
            source.width / 2,
            source.height / 2,
            x / 2 - 0.5,
            y / 2 - 0.5,
            2,
            0,
          ) - 0.5;
        const cr =
          sample(
            source.uv,
            source.uvStride,
            source.width / 2,
            source.height / 2,
            x / 2 - 0.5,
            y / 2 - 0.5,
            2,
            1,
          ) - 0.5;
        // Match VisionCamera 5.2.3's full-range GPU resizer conversion.
        result[offset] = clamp(luma + 1.402 * cr);
        result[offset + 1] = clamp(luma - 0.344136 * cb - 0.714136 * cr);
        result[offset + 2] = clamp(luma + 1.772 * cb);
      }
    }
  return result;
}
