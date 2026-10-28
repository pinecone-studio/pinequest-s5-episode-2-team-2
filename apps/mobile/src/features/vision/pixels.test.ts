import { cropPixels, type PixelCrop, type PixelSource } from "./pixels";

// The per-pixel implementation from #64, kept as the reference: #252 only changed how the same
// arithmetic is organised, so every crop must stay bit-for-bit identical.
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

function referenceCrop(
  source: PixelSource,
  crop: PixelCrop,
  outputSize = 128,
  blackPadding = false,
): Float32Array<ArrayBuffer> {
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

// Small deterministic generator so failures can be reproduced.
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function frames(next: () => number): PixelSource[] {
  const bytes = (length: number) => Uint8Array.from({ length }, () => Math.floor(next() * 256));
  return [
    {
      format: "nv12",
      width: 64,
      height: 48,
      y: bytes(70 * 48),
      uv: bytes(72 * 24),
      yStride: 70,
      uvStride: 72,
    },
    {
      format: "nv12",
      width: 32,
      height: 32,
      y: bytes(32 * 32),
      uv: bytes(32 * 16),
      yStride: 32,
      uvStride: 32,
    },
    { format: "rgb", width: 40, height: 30, rgb: bytes(124 * 30), stride: 124 },
  ];
}

test.each([false, true])("matches per-pixel sampling exactly (black padding %s)", (padding) => {
  const next = random(252);
  for (const source of frames(next)) {
    for (let k = 0; k < 40; k++) {
      // Crops inside the frame, over every edge and larger than it, at fractional positions.
      const size = 1 + next() * source.width * 1.5;
      const crop: PixelCrop = {
        x: -size / 2 + next() * (source.width + size),
        y: -size / 2 + next() * (source.height + size),
        size,
      };
      const outputSize = 1 + Math.floor(next() * 40);
      expect(Array.from(cropPixels(source, crop, outputSize, padding))).toEqual(
        Array.from(referenceCrop(source, crop, outputSize, padding)),
      );
    }
  }
});
