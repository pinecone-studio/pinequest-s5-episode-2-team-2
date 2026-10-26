import type { Outcome, ScanResult } from "@app/core";

export type ProgressPoint = { id: string; time: number; score: number; outcome: Outcome };

/** Measured sessions oldest first; scans without an asymmetry score are left out. */
export function progressSeries(sessions: readonly ScanResult[]): ProgressPoint[] {
  return sessions
    .flatMap((s) => {
      const time = Date.parse(s.createdAt);
      const score = s.summary.asymmetryScore;
      return score !== null && Number.isFinite(score) && Number.isFinite(time)
        ? [{ id: s.id, time, score, outcome: s.outcome }]
        : [];
    })
    .sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}

export type ChartPoint = ProgressPoint & { x: number; y: number };

/**
 * Places points in a width × height box: time left to right, score bottom to top from 0 to
 * the largest of `minTop` and the highest score. One point, or several at the same time, sit
 * in the middle horizontally.
 */
export function chartPoints(
  points: readonly ProgressPoint[],
  width: number,
  height: number,
  minTop = 0,
): { points: ChartPoint[]; top: number } {
  const top = Math.max(minTop, ...points.map((p) => p.score)) || 1;
  const first = points[0]?.time ?? 0;
  const span = (points.at(-1)?.time ?? 0) - first;
  return {
    top,
    points: points.map((p) => ({
      ...p,
      x: span > 0 ? ((p.time - first) / span) * width : width / 2,
      y: height - (p.score / top) * height,
    })),
  };
}
