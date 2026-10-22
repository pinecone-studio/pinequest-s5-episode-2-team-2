import type { Point } from "./types";

export function reflexOffset(irisCenter: Point, irisRadius: number, reflex: Point): Point {
  if (!(irisRadius > 0)) throw new RangeError("irisRadius must be positive");
  return {
    x: (reflex.x - irisCenter.x) / irisRadius,
    y: (reflex.y - irisCenter.y) / irisRadius,
  };
}

/**
 * Compares the two reflex offsets after mirroring the image-right eye horizontally,
 * so symmetric reflexes (both slightly nasal, for example) give zero.
 */
export function mirroredAsymmetry(imageLeft: Point, imageRight: Point): Point {
  return { x: imageLeft.x + imageRight.x, y: imageLeft.y - imageRight.y };
}

export function magnitude(p: Point): number {
  return Math.hypot(p.x, p.y);
}
