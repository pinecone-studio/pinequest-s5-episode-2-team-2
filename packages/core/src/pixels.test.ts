import { CLIP_LEVEL, cropStats, lumaFromRgb } from "./pixels";

const flat = (size: number, value: number) => ({
  width: size,
  height: size,
  luma: new Float32Array(size * size).fill(value),
});

/** Alternating rows of 0.2 and 0.6: every interior Laplacian is ±0.8. */
function stripes(size: number) {
  const luma = new Float32Array(size * size);
  for (let y = 0; y < size; y++) luma.fill(y % 2 ? 0.6 : 0.2, y * size, (y + 1) * size);
  return { width: size, height: size, luma };
}

describe("cropStats", () => {
  it("gives no sharpness for a flat crop", () => {
    expect(cropStats(flat(8, 0.4))).toEqual({
      sharpness: 0,
      exposure: expect.closeTo(0.4),
      clipped: 0,
    });
  });

  it("measures the Laplacian variance over interior pixels", () => {
    const stats = cropStats(stripes(6))!;
    expect(stats.sharpness).toBeCloseTo(0.64);
    expect(stats.exposure).toBeCloseTo(0.4);
  });

  it("counts clipped pixels", () => {
    const crop = flat(4, 0.5);
    crop.luma.fill(CLIP_LEVEL, 0, 4);
    expect(cropStats(crop)!.clipped).toBeCloseTo(0.25);
  });

  it("rejects crops it cannot measure", () => {
    expect(cropStats(flat(2, 0.5))).toBeNull();
    expect(cropStats({ width: 4, height: 4, luma: new Float32Array(15) })).toBeNull();
    const crop = flat(4, 0.5);
    crop.luma[5] = NaN;
    expect(cropStats(crop)).toBeNull();
  });
});

describe("lumaFromRgb", () => {
  it("uses the Rec. 601 weights", () => {
    const luma = lumaFromRgb([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1]);
    expect(Array.from(luma)).toEqual([
      expect.closeTo(0.299),
      expect.closeTo(0.587),
      expect.closeTo(0.114),
      expect.closeTo(1),
    ]);
  });
});
