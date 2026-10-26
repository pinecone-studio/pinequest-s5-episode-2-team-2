import type { EyeMeasure, Point } from "@app/core";

/** Crop width in iris radii, the same square the model sees (`eyeRegions`). */
export const CROP_RADII = 5;

export interface EyeDiagram {
  side: EyeMeasure["side"];
  /** Box points; the iris is centred in a size × size box. */
  irisRadius: number;
  center: Point;
  /** Null when the eye has no reflex. */
  reflex: Point | null;
  /** Reflex offset in iris radii, for the accessibility label. */
  offset: Point | null;
}

/**
 * Draws one measured eye in a size × size box, scaled so the box spans `CROP_RADII` iris
 * radii. The reflex is placed by its offset and kept inside the box.
 */
export function eyeDiagram(eye: EyeMeasure, size: number): EyeDiagram {
  const irisRadius = size / CROP_RADII;
  const center = { x: size / 2, y: size / 2 };
  const clamp = (v: number) => Math.max(0, Math.min(size, v));
  const offset = eye.reflexOffset && { ...eye.reflexOffset };
  return {
    side: eye.side,
    irisRadius,
    center,
    reflex: offset && {
      x: clamp(center.x + offset.x * irisRadius),
      y: clamp(center.y + offset.y * irisRadius),
    },
    offset,
  };
}

/** Both eyes in on-screen order. With the back camera the image-left eye is the child's right. */
export function eyeDiagrams(
  eyes: readonly [EyeMeasure, EyeMeasure],
  size: number,
): [EyeDiagram, EyeDiagram] {
  return [eyeDiagram(eyes[0], size), eyeDiagram(eyes[1], size)];
}
