import { mockScanResult } from "@app/core";
import type { ScanResult } from "@app/core";
import { chartPoints, progressSeries } from "./series";

const scan = (id: string, day: number, score: number | null): ScanResult => {
  const base = mockScanResult(score === null ? "RETAKE" : "NO_VISIBLE_SIGN", {
    id,
    createdAt: `2026-10-${String(day).padStart(2, "0")}T03:00:00.000Z`,
  });
  return { ...base, summary: { ...base.summary, asymmetryScore: score } };
};

test("keeps measured sessions oldest first", () => {
  const series = progressSeries([scan("c", 26, 0.2), scan("b", 24, null), scan("a", 20, 0.1)]);
  expect(series.map((p) => [p.id, p.score])).toEqual([
    ["a", 0.1],
    ["c", 0.2],
  ]);
  expect(series[0]!.outcome).toBe("NO_VISIBLE_SIGN");
});

test("drops non-finite scores and invalid dates", () => {
  const bad = { ...scan("x", 20, 0.1), createdAt: "invalid" };
  expect(progressSeries([bad, scan("y", 21, NaN)])).toEqual([]);
});

test("scales time across the width and score from the bottom", () => {
  const { points, top } = chartPoints(
    progressSeries([scan("a", 20, 0), scan("b", 22, 0.1), scan("c", 24, 0.2)]),
    200,
    100,
  );
  expect(top).toBeCloseTo(0.2);
  expect(points.map((p) => [p.x, p.y])).toEqual([
    [0, 100],
    [100, 50],
    [200, 0],
  ]);
});

test("respects a minimum top and centres a single point", () => {
  const { points, top } = chartPoints(progressSeries([scan("a", 20, 0.1)]), 200, 100, 0.4);
  expect(top).toBe(0.4);
  expect(points[0]).toMatchObject({ x: 100, y: 75 });
});

test("avoids dividing by zero for all-zero scores or no points", () => {
  expect(chartPoints(progressSeries([scan("a", 20, 0)]), 10, 10).top).toBe(1);
  expect(chartPoints([], 10, 10)).toEqual({ points: [], top: 1 });
});
