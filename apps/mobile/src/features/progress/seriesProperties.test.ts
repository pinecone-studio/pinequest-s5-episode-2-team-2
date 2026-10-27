import { mockScanResult, type ScanResult } from "@app/core";
import { segments } from "./segments";
import { chartPoints, progressSeries } from "./series";

// Properties of the progress chart's data over generated histories.

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function history(seed: number): ScanResult[] {
  const random = lcg(seed);
  const size = Math.floor(random() * 30);
  return Array.from({ length: size }, (_, i) => {
    const measured = random() > 0.3;
    const base = mockScanResult(measured ? "NO_VISIBLE_SIGN" : "RETAKE", {
      id: `s${i}`,
      createdAt: new Date(
        Date.UTC(2026, 9, 1) + Math.floor(random() * 26 * 86_400_000),
      ).toISOString(),
    });
    return {
      ...base,
      summary: { ...base.summary, asymmetryScore: measured ? random() * 0.3 : null },
    };
  });
}

const HISTORIES = Array.from({ length: 150 }, (_, i) => history(i + 1));

test("the series keeps every measured scan once, oldest first", () => {
  for (const sessions of HISTORIES) {
    const series = progressSeries(sessions);
    const measured = sessions.filter((s) => s.summary.asymmetryScore !== null);
    expect(series).toHaveLength(measured.length);
    expect(new Set(series.map((p) => p.id)).size).toBe(series.length);
    for (let i = 1; i < series.length; i++) {
      expect(series[i]!.time).toBeGreaterThanOrEqual(series[i - 1]!.time);
    }
  }
});

test("the series does not depend on the order sessions arrive in", () => {
  for (const sessions of HISTORIES) {
    const reversed = progressSeries([...sessions].reverse());
    expect(reversed.map((p) => p.id)).toEqual(progressSeries(sessions).map((p) => p.id));
  }
});

test("chart points stay inside the box and keep time and score order", () => {
  for (const sessions of HISTORIES) {
    const series = progressSeries(sessions);
    const { points, top } = chartPoints(series, 300, 120);
    expect(top).toBeGreaterThan(0);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(300 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(-1e-9);
      expect(p.y).toBeLessThanOrEqual(120);
    }
    for (let i = 1; i < points.length; i++) {
      expect(points[i]!.x).toBeGreaterThanOrEqual(points[i - 1]!.x);
    }
    for (const a of points) {
      for (const b of points) {
        if (a.score > b.score) expect(a.y).toBeLessThan(b.y);
      }
    }
  }
});

test("one line joins each pair of neighbours with the right length", () => {
  for (const sessions of HISTORIES) {
    const { points } = chartPoints(progressSeries(sessions), 300, 120);
    const lines = segments(points);
    expect(lines).toHaveLength(Math.max(0, points.length - 1));
    lines.forEach((line, i) => {
      const [a, b] = [points[i]!, points[i + 1]!];
      expect(line.length).toBeCloseTo(Math.hypot(b.x - a.x, b.y - a.y), 9);
      expect(line.cx).toBeCloseTo((a.x + b.x) / 2, 9);
    });
  }
});
