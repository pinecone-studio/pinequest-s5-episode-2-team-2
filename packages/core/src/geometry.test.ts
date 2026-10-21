import { magnitude, mirroredAsymmetry, reflexOffset } from "./geometry";

describe("reflexOffset", () => {
  it("normalizes by the iris radius", () => {
    expect(reflexOffset({ x: 100, y: 100 }, 50, { x: 110, y: 95 })).toEqual({ x: 0.2, y: -0.1 });
  });

  it("rejects a non-positive radius", () => {
    expect(() => reflexOffset({ x: 0, y: 0 }, 0, { x: 1, y: 1 })).toThrow(RangeError);
    expect(() => reflexOffset({ x: 0, y: 0 }, NaN, { x: 1, y: 1 })).toThrow(RangeError);
  });
});

describe("mirroredAsymmetry", () => {
  it("is zero for mirror-symmetric reflexes", () => {
    // Both reflexes slightly nasal: right of centre in the left eye, left of centre in the right.
    expect(mirroredAsymmetry({ x: 0.05, y: 0.02 }, { x: -0.05, y: 0.02 })).toEqual({ x: 0, y: 0 });
  });

  it("is non-zero when only one eye deviates", () => {
    const a = mirroredAsymmetry({ x: 0.05, y: 0 }, { x: 0.3, y: 0 });
    expect(a.x).toBeCloseTo(0.35);
    expect(a.y).toBe(0);
  });
});

describe("magnitude", () => {
  it("is the euclidean length", () => {
    expect(magnitude({ x: 3, y: 4 })).toBe(5);
  });
});
