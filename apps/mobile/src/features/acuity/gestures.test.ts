import { fist, handRegion, openPalm, pointing, thumbsUp, type Landmark } from "./gestures";

type Shape = "folded" | "up" | { dx: number; dy: number };
// A synthetic right hand in image coordinates (y down): wrist low, knuckles above it.
function hand({
  index = "folded",
  others = "folded",
  thumbUp = false,
}: {
  index?: Shape;
  others?: "folded" | "up";
  thumbUp?: boolean;
}): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7 }));
  lm[0] = { x: 0.5, y: 0.7 };
  lm[2] = { x: 0.44, y: 0.65 };
  lm[4] = thumbUp ? { x: 0.44, y: 0.53 } : { x: 0.4, y: 0.66 };
  const finger = (base: number, x: number, shape: Shape) => {
    const b = { x, y: 0.6 };
    lm[base] = b;
    const v = shape === "folded" ? null : shape === "up" ? { dx: 0, dy: -1 } : shape;
    if (!v) {
      lm[base + 1] = { x, y: 0.57 };
      lm[base + 3] = { x, y: 0.62 };
    } else {
      lm[base + 1] = { x: x + v.dx * 0.04, y: 0.6 + v.dy * 0.04 };
      lm[base + 2] = { x: x + v.dx * 0.07, y: 0.6 + v.dy * 0.07 };
      lm[base + 3] = { x: x + v.dx * 0.1, y: 0.6 + v.dy * 0.1 };
    }
  };
  finger(5, 0.47, index);
  finger(9, 0.49, others);
  finger(13, 0.51, others);
  finger(17, 0.53, others);
  return lm;
}
const W = 640,
  H = 640;

test("the index finger's direction is read from the person's point of view", () => {
  expect(pointing(hand({ index: { dx: 0, dy: -1 } }), W, H)).toBe(270);
  expect(pointing(hand({ index: { dx: 0, dy: 1 } }), W, H)).toBe(90);
  // Unmirrored front camera: pointing to the image's right is the person's left.
  expect(pointing(hand({ index: { dx: 1, dy: 0 } }), W, H)).toBe(180);
  expect(pointing(hand({ index: { dx: -1, dy: 0 } }), W, H)).toBe(0);
});

test("diagonal, open or missing hands are not an answer", () => {
  expect(pointing(hand({ index: { dx: 0.7, dy: -0.7 } }), W, H)).toBeNull();
  expect(pointing(hand({ index: "up", others: "up" }), W, H)).toBeNull();
  expect(pointing(hand({ index: "folded" }), W, H)).toBeNull();
  expect(pointing([], W, H)).toBeNull();
});

test("fist, open palm and thumbs-up are told apart", () => {
  expect(fist(hand({}), W, H)).toBe(true);
  expect(fist(hand({ index: { dx: 0, dy: -1 } }), W, H)).toBe(false);
  expect(openPalm(hand({ index: "up", others: "up" }), W, H)).toBe(true);
  expect(openPalm(hand({}), W, H)).toBe(false);
  expect(thumbsUp(hand({ thumbUp: true }), W, H)).toBe(true);
  expect(thumbsUp(hand({ thumbUp: false }), W, H)).toBe(false);
  expect(thumbsUp(hand({ thumbUp: true, index: "up", others: "up" }), W, H)).toBe(false);
});

test("incomplete, non-finite or dimensionless inputs cannot submit a gesture", () => {
  const straight = hand({ index: "up", others: "up" });
  const invalid = hand({ index: "up" });
  invalid[8] = { x: NaN, y: 0.2 };
  const sparse = [...straight];
  delete sparse[20];
  for (const [lm, w, h] of [
    [straight.slice(0, 13), W, H],
    [invalid, W, H],
    [sparse, W, H],
    [straight, 0, H],
    [straight, W, Infinity],
  ] as const) {
    expect(openPalm(lm, w, h)).toBe(false);
    expect(thumbsUp(lm, w, h)).toBe(false);
    expect(fist(lm, w, h)).toBe(false);
    expect(pointing(lm, w, h)).toBeNull();
  }
});

function pose(wrist: Landmark, index: Landmark): Landmark[] {
  const p: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  p[2] = { x: 0.47, y: 0.2 };
  p[5] = { x: 0.53, y: 0.2 };
  p[11] = { x: 0.4, y: 0.4 };
  p[12] = { x: 0.6, y: 0.4 };
  p[23] = { x: 0.42, y: 0.7 };
  p[24] = { x: 0.58, y: 0.7 };
  // The other arm hangs down.
  p[16] = { x: 0.62, y: 0.75, visibility: 1 };
  p[20] = { x: 0.62, y: 0.8 };
  p[15] = { ...wrist, visibility: 1 };
  p[19] = index;
  return p;
}

test("the hand crop follows the raised wrist and ignores hanging or eye-covering hands", () => {
  const region = handRegion(pose({ x: 0.3, y: 0.3 }, { x: 0.28, y: 0.28 }), W, H)!;
  // 1.4 shoulder widths (0.2 × 640 = 128 px), centred between the wrist and the index knuckle.
  expect(region.size).toBeCloseTo(179.2);
  expect(region.x + region.size / 2).toBeCloseTo(0.29 * W);
  expect(region.y + region.size / 2).toBeCloseTo(0.29 * H);
  expect(handRegion(pose({ x: 0.38, y: 0.75 }, { x: 0.38, y: 0.8 }), W, H)).toBeNull();
  expect(handRegion(pose({ x: 0.53, y: 0.22 }, { x: 0.53, y: 0.2 }), W, H)).toBeNull();
});

test("an occluded shoulder or wrist cannot locate an answering hand", () => {
  const p = pose({ x: 0.3, y: 0.3 }, { x: 0.28, y: 0.28 });
  p[11]!.visibility = 0;
  expect(handRegion(p, W, H)).toBeNull();
  p[11]!.visibility = 1;
  p[15]!.visibility = 0;
  expect(handRegion(p, W, H)).toBeNull();
});
