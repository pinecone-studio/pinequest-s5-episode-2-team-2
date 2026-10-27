import { magnitude, mirroredAsymmetry, reflexOffset } from "./geometry";
import type { Point } from "./types";

// Properties of the reflex geometry over random inputs; ml/tests/test_geometry_properties.py
// checks the same for the Python reference.

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const random = lcg(42);
const between = (lo: number, hi: number) => lo + random() * (hi - lo);
const CASES = Array.from({ length: 300 }, () => ({
  center: { x: between(0, 4000), y: between(0, 4000) },
  radius: between(5, 120),
  offset: { x: between(-3, 3), y: between(-3, 3) },
}));
const reflexAt = (c: Point, r: number, o: Point) => ({ x: c.x + o.x * r, y: c.y + o.y * r });

test("offsets round-trip through pixels", () => {
  for (const { center, radius, offset } of CASES) {
    const back = reflexOffset(center, radius, reflexAt(center, radius, offset));
    expect(back.x).toBeCloseTo(offset.x, 9);
    expect(back.y).toBeCloseTo(offset.y, 9);
  }
});

test("offsets do not depend on where the eye is or how large it is", () => {
  for (const { center, radius, offset } of CASES) {
    const reflex = reflexAt(center, radius, offset);
    const base = reflexOffset(center, radius, reflex);
    const moved = reflexOffset({ x: center.x + 37, y: center.y - 11 }, radius, {
      x: reflex.x + 37,
      y: reflex.y - 11,
    });
    const scaled = reflexOffset({ x: center.x * 2, y: center.y * 2 }, radius * 2, {
      x: reflex.x * 2,
      y: reflex.y * 2,
    });
    for (const other of [moved, scaled]) {
      expect(other.x).toBeCloseTo(base.x, 9);
      expect(other.y).toBeCloseTo(base.y, 9);
    }
  }
});

test("mirror-symmetric reflexes give zero asymmetry", () => {
  for (const { offset } of CASES) {
    const a = mirroredAsymmetry(offset, { x: -offset.x, y: offset.y });
    expect(magnitude(a)).toBeCloseTo(0, 12);
  }
});

test("looking away with both eyes doubles the horizontal asymmetry", () => {
  // Why frames where the child looks away must be rejected (NOT_LOOKING).
  for (const { offset } of CASES) {
    const a = mirroredAsymmetry(offset, offset);
    expect(a.x).toBeCloseTo(2 * offset.x, 12);
    expect(a.y).toBeCloseTo(0, 12);
  }
});

test("swapping the eyes keeps the magnitude", () => {
  for (const { offset } of CASES) {
    const other = { x: between(-3, 3), y: between(-3, 3) };
    expect(magnitude(mirroredAsymmetry(other, offset))).toBeCloseTo(
      magnitude(mirroredAsymmetry(offset, other)),
      12,
    );
  }
});

test.each([0, -1, NaN])("rejects an iris radius of %p", (radius) => {
  expect(() => reflexOffset({ x: 0, y: 0 }, radius, { x: 1, y: 1 })).toThrow(RangeError);
});
