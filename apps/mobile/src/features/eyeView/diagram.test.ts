import { mockEyeMeasure } from "@app/core";
import { CROP_RADII, eyeDiagram, eyeDiagrams } from "./diagram";

test("centres the iris and scales it to the crop width", () => {
  const d = eyeDiagram(mockEyeMeasure("imageLeft", { x: 0, y: 0 }), 100);
  expect(d.irisRadius).toBe(100 / CROP_RADII);
  expect(d.center).toEqual({ x: 50, y: 50 });
  expect(d.reflex).toEqual({ x: 50, y: 50 });
});

test("places the reflex by its offset in iris radii", () => {
  const d = eyeDiagram(mockEyeMeasure("imageRight", { x: 0.5, y: -0.25 }), 100);
  expect(d.reflex!.x).toBeCloseTo(60);
  expect(d.reflex!.y).toBeCloseTo(45);
  expect(d.offset!.x).toBeCloseTo(0.5);
});

test("keeps a far reflex inside the box and handles a missing one", () => {
  expect(eyeDiagram(mockEyeMeasure("imageLeft", { x: 4, y: -4 }), 100).reflex).toEqual({
    x: 100,
    y: 0,
  });
  const none = eyeDiagram(mockEyeMeasure("imageLeft", null), 100);
  expect(none.reflex).toBeNull();
  expect(none.offset).toBeNull();
});

test("keeps the image order of both eyes", () => {
  const [a, b] = eyeDiagrams(
    [mockEyeMeasure("imageLeft", { x: 0, y: 0 }), mockEyeMeasure("imageRight", { x: 0, y: 0 })],
    80,
  );
  expect([a.side, b.side]).toEqual(["imageLeft", "imageRight"]);
});
