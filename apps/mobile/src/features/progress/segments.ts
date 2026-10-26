import type { ChartPoint } from "./series";

export type Segment = {
  /** Centre of the line, where a rotated view of `length` is placed. */
  cx: number;
  cy: number;
  length: number;
  angleDeg: number;
};

/** Lines between consecutive points, drawn as rotated views (no SVG dependency). */
export function segments(points: readonly ChartPoint[]): Segment[] {
  return points.slice(1).map((b, i) => {
    const a = points[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return {
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      length: Math.hypot(dx, dy),
      angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
    };
  });
}
