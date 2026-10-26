import { mockEyeMeasure } from "@app/core";
import { coverTransform, debugLines, eyeMarks, toView } from "./overlay";

test("cover transform fills the view and centres the cropped axis", () => {
  // 4K landscape frame in a portrait view: height decides the scale, width is cropped.
  const t = coverTransform({ width: 3840, height: 2160 }, { width: 390, height: 844 })!;
  expect(t.scale).toBeCloseTo(844 / 2160);
  expect(t.offsetY).toBeCloseTo(0);
  expect(t.offsetX).toBeCloseTo((390 - 3840 * t.scale) / 2);
  // The frame centre lands on the view centre.
  const centre = toView({ x: 1920, y: 1080 }, t);
  expect(centre.x).toBeCloseTo(195);
  expect(centre.y).toBeCloseTo(422);
});

test("no transform before layout or for an empty frame", () => {
  expect(coverTransform({ width: 3840, height: 2160 }, { width: 0, height: 0 })).toBeNull();
  expect(coverTransform({ width: 0, height: 0 }, { width: 390, height: 844 })).toBeNull();
});

test("eye marks scale the radius and keep a missing reflex missing", () => {
  const t = { scale: 0.5, offsetX: 10, offsetY: -20 };
  const eye = mockEyeMeasure("imageLeft", { x: 0.25, y: 0 });
  const marks = eyeMarks(eye, t);
  expect(marks.center).toEqual({ x: 1720 * 0.5 + 10, y: 1080 * 0.5 - 20 });
  expect(marks.radius).toBe(24);
  expect(marks.reflex).toEqual({ x: (1720 + 12) * 0.5 + 10, y: 1080 * 0.5 - 20 });
  expect(eyeMarks(mockEyeMeasure("imageRight", null), t).reflex).toBeNull();
});

test("debug lines show latency, failure and per-eye values", () => {
  expect(debugLines(null, null, "MODEL_UNAVAILABLE")).toEqual(["latency - · MODEL_UNAVAILABLE"]);
  const lines = debugLines(
    [mockEyeMeasure("imageLeft", { x: 0.05, y: -0.1 }), mockEyeMeasure("imageRight", null)],
    41.6,
    null,
  );
  expect(lines[0]).toBe("latency 42 ms");
  expect(lines[1]).toBe(
    "imageLeft: c (1720.0, 1080.0) r 48.0 · reflex (0.050, -0.100) · conf 0.90",
  );
  expect(lines[2]).toContain("imageRight: c (2120.0, 1080.0) r 48.0 · reflex none");
});
