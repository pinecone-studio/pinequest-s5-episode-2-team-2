import { CLIP_LEVEL, cropStats, lumaFromRgb } from "./pixels";

// Properties of the crop statistics over generated crops, so the blur and exposure checks
// respond to light and focus the way they should.

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** A random crop in 0.1..0.6, so scaling it by up to 1.5 never reaches the clip level. */
function crop(seed: number, width = 12, height = 9) {
  const random = lcg(seed);
  return {
    width,
    height,
    luma: Array.from({ length: width * height }, () => 0.1 + random() * 0.5),
  };
}

const CROPS = Array.from({ length: 100 }, (_, i) => crop(i + 1, 6 + (i % 10), 4 + (i % 7)));

test("brighter light scales exposure linearly and sharpness by the square", () => {
  for (const c of CROPS) {
    const base = cropStats(c)!;
    for (const k of [0.5, 1.5]) {
      const scaled = cropStats({ ...c, luma: c.luma.map((v) => v * k) })!;
      expect(scaled.exposure).toBeCloseTo(base.exposure * k, 9);
      expect(scaled.sharpness).toBeCloseTo(base.sharpness * k * k, 9);
    }
  }
});

test("an even brightness offset leaves sharpness unchanged", () => {
  for (const c of CROPS) {
    const base = cropStats(c)!;
    const shifted = cropStats({ ...c, luma: c.luma.map((v) => v + 0.2) })!;
    expect(shifted.sharpness).toBeCloseTo(base.sharpness, 9);
    expect(shifted.exposure).toBeCloseTo(base.exposure + 0.2, 9);
  }
});

test("flipping or transposing the crop does not change the statistics", () => {
  for (const c of CROPS) {
    const base = cropStats(c)!;
    const at = (x: number, y: number) => c.luma[y * c.width + x]!;
    const flipped = Array.from({ length: c.luma.length }, (_, i) =>
      at(c.width - 1 - (i % c.width), Math.floor(i / c.width)),
    );
    const transposed = Array.from({ length: c.luma.length }, (_, i) =>
      at(Math.floor(i / c.height), i % c.height),
    );
    for (const stats of [
      cropStats({ ...c, luma: flipped })!,
      cropStats({ width: c.height, height: c.width, luma: transposed })!,
    ]) {
      expect(stats.sharpness).toBeCloseTo(base.sharpness, 9);
      expect(stats.exposure).toBeCloseTo(base.exposure, 9);
      expect(stats.clipped).toBe(base.clipped);
    }
  }
});

test("smoothing never makes a crop sharper", () => {
  for (const c of CROPS) {
    const at = (x: number, y: number) =>
      c.luma[
        Math.min(c.height - 1, Math.max(0, y)) * c.width + Math.min(c.width - 1, Math.max(0, x))
      ]!;
    const smooth = Array.from({ length: c.luma.length }, (_, i) => {
      const x = i % c.width;
      const y = Math.floor(i / c.width);
      return (at(x, y) * 4 + at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1)) / 8;
    });
    expect(cropStats({ ...c, luma: smooth })!.sharpness).toBeLessThanOrEqual(
      cropStats(c)!.sharpness + 1e-12,
    );
  }
});

test("clipped fraction counts only pixels at or above the clip level", () => {
  for (const c of CROPS) {
    const n = Math.floor(c.luma.length / 3);
    const luma = c.luma.map((v, i) => (i < n ? CLIP_LEVEL : Math.min(v, CLIP_LEVEL - 0.01)));
    expect(cropStats({ ...c, luma })!.clipped).toBeCloseTo(n / c.luma.length, 12);
  }
});

test("grey RGB keeps its value as luminance", () => {
  const random = lcg(5);
  const values = Array.from({ length: 50 }, () => random());
  const rgb = values.flatMap((v) => [v, v, v]);
  Array.from(lumaFromRgb(rgb)).forEach((l, i) => expect(l).toBeCloseTo(values[i]!, 6));
});
