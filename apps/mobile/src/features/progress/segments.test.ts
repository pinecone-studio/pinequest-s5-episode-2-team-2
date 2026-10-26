import { segments } from "./segments";
import type { ChartPoint } from "./series";

const point = (x: number, y: number): ChartPoint => ({
  id: `${x}`,
  time: x,
  score: y,
  outcome: "NO_VISIBLE_SIGN",
  x,
  y,
});

test("joins consecutive points with centred, rotated lines", () => {
  const [flat, rising] = segments([point(0, 50), point(100, 50), point(200, 0)]);
  expect(flat).toEqual({ cx: 50, cy: 50, length: 100, angleDeg: 0 });
  expect(rising!.cx).toBe(150);
  expect(rising!.cy).toBe(25);
  expect(rising!.length).toBeCloseTo(Math.hypot(100, 50));
  expect(rising!.angleDeg).toBeCloseTo(-26.565, 3);
});

test("has no lines for fewer than two points", () => {
  expect(segments([])).toEqual([]);
  expect(segments([point(0, 0)])).toEqual([]);
});
