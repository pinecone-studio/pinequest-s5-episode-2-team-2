import type { Point } from "@app/core";
import { findReflex, measureEye, refineIris } from "./heuristic";
import type { GrayImage } from "./heuristic";

// The web demo's synthetic-eye tests (demo/web-poc packages/core/src/measure.test.ts), #274.

/** Draws an anti-aliased filled circle by 4x4 supersampling. */
function circle(image: GrayImage & { data: Float64Array }, c: Point, r: number, value: number) {
  for (let y = Math.floor(c.y - r - 1); y <= Math.ceil(c.y + r + 1); y++) {
    for (let x = Math.floor(c.x - r - 1); x <= Math.ceil(c.x + r + 1); x++) {
      let covered = 0;
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const px = x - 0.375 + sx * 0.25;
          const py = y - 0.375 + sy * 0.25;
          if ((px - c.x) ** 2 + (py - c.y) ** 2 <= r * r) covered += 1;
        }
      }
      const i = y * image.width + x;
      const old = image.data[i] ?? 0;
      image.data[i] = old + ((value - old) * covered) / 16;
    }
  }
}

/** Light sclera, dark iris disc and an optional small bright reflex. */
function syntheticEye(iris: Point, radius: number, reflex: Point | null) {
  const image = { width: 240, height: 200, data: new Float64Array(240 * 200).fill(190) };
  circle(image, iris, radius, 60);
  if (reflex) circle(image, reflex, 3, 255);
  image.data.forEach((v, i) => (image.data[i] = Math.round(v)));
  return image;
}

const CASES: [Point, number, Point][] = [
  [{ x: 120, y: 100 }, 30, { x: 120, y: 100 }],
  [{ x: 120, y: 100 }, 30, { x: 128, y: 96 }],
  [{ x: 90, y: 110 }, 24, { x: 80, y: 115 }],
  [{ x: 150, y: 90 }, 36, { x: 170, y: 80 }],
];

describe("refineIris", () => {
  it.each(CASES)("finds the iris at %j within 1 px", (iris, radius, reflex) => {
    const image = syntheticEye(iris, radius, reflex);
    const fit = refineIris(image, { x: iris.x + 4, y: iris.y - 3 }, radius * 0.85);
    expect(fit).not.toBeNull();
    expect(Math.abs(fit!.center.x - iris.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(fit!.center.y - iris.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(fit!.radius - radius)).toBeLessThanOrEqual(1);
  });

  it("still finds the iris when the rough centre lands on the reflex", () => {
    const image = syntheticEye({ x: 120, y: 100 }, 30, { x: 126, y: 97 });
    const fit = refineIris(image, { x: 126, y: 97 }, 28);
    expect(Math.abs(fit!.center.x - 120)).toBeLessThanOrEqual(1);
    expect(Math.abs(fit!.center.y - 100)).toBeLessThanOrEqual(1);
  });

  it("returns null when the rough centre is on the sclera", () => {
    const image = syntheticEye({ x: 120, y: 100 }, 20, null);
    expect(refineIris(image, { x: 200, y: 30 }, 20)).toBeNull();
  });

  it("rejects a fit far from the expected radius", () => {
    const image = syntheticEye({ x: 120, y: 100 }, 30, null);
    expect(refineIris(image, { x: 120, y: 100 }, 80)).toBeNull();
  });

  it("returns null outside the image", () => {
    const image = syntheticEye({ x: 120, y: 100 }, 30, null);
    expect(refineIris(image, { x: -500, y: -500 }, 30)).toBeNull();
  });
});

describe("findReflex", () => {
  it.each(CASES)("finds the reflex for iris %j within 1 px", (iris, radius, reflex) => {
    const image = syntheticEye(iris, radius, reflex);
    const found = findReflex(image, iris, radius);
    expect(found.blobs).toBe(1);
    expect(Math.abs(found.reflex!.x - reflex.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(found.reflex!.y - reflex.y)).toBeLessThanOrEqual(1);
  });

  it("counts several bright blobs and keeps the largest", () => {
    const image = syntheticEye({ x: 120, y: 100 }, 30, { x: 112, y: 100 });
    circle(image, { x: 132, y: 104 }, 1.5, 255);
    const found = findReflex(image, { x: 120, y: 100 }, 30);
    expect(found.blobs).toBe(2);
    expect(Math.abs(found.reflex!.x - 112)).toBeLessThanOrEqual(1);
  });

  it("finds nothing without a reflex", () => {
    const image = syntheticEye({ x: 120, y: 100 }, 30, null);
    expect(findReflex(image, { x: 120, y: 100 }, 30)).toEqual({ reflex: null, blobs: 0 });
  });

  it("finds nothing outside the image", () => {
    const image = syntheticEye({ x: 120, y: 100 }, 30, null);
    expect(findReflex(image, { x: -500, y: -500 }, 30)).toEqual({ reflex: null, blobs: 0 });
  });
});

describe("measureEye", () => {
  it("refines the iris and finds the reflex with full confidence", () => {
    const image = syntheticEye({ x: 120, y: 100 }, 30, { x: 129, y: 94 });
    const eye = measureEye(image, { x: 123, y: 98 }, 27);
    expect(Math.abs(eye.center.x - 120)).toBeLessThanOrEqual(1);
    expect(Math.abs(eye.radius - 30)).toBeLessThanOrEqual(1);
    expect(Math.abs(eye.reflex!.x - 129)).toBeLessThanOrEqual(1);
    expect(Math.abs(eye.reflex!.y - 94)).toBeLessThanOrEqual(1);
    expect(eye.confidence).toBe(1);
  });

  it("has zero confidence without a reflex", () => {
    const image = syntheticEye({ x: 120, y: 100 }, 30, null);
    const eye = measureEye(image, { x: 120, y: 100 }, 30);
    expect(eye.reflex).toBeNull();
    expect(eye.confidence).toBe(0);
  });

  it("lowers confidence when the iris could not be refined", () => {
    const image = syntheticEye({ x: 120, y: 100 }, 30, { x: 124, y: 100 });
    const eye = measureEye(image, { x: 120, y: 100 }, 80);
    expect(eye.radius).toBe(80);
    expect(eye.confidence).toBeLessThan(1);
  });
});
