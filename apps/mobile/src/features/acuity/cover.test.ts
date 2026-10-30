import { coverFromFace, coverFromPose, coverOk, emptyCover, readCover } from "./cover";
import type { Landmark } from "./gestures";

// A 100 × 100 frame; the face crop is the whole frame, so crop pixels are 2.56 frame pixels.
const W = 100,
  H = 100;
const region = { x: 0, y: 0, size: 100 };
function person(): Landmark[] {
  const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.95, visibility: 0.9 }));
  p[2] = { x: 0.65, y: 0.4, visibility: 0.9 }; // the person's left eye, on the image's right
  p[5] = { x: 0.35, y: 0.4, visibility: 0.9 };
  p[11] = { x: 0.7, y: 0.7, visibility: 0.9 };
  p[12] = { x: 0.3, y: 0.7, visibility: 0.9 };
  return p;
}
const irises: [Landmark, Landmark] = [
  { x: 0.65 * 256, y: 0.4 * 256 },
  { x: 0.35 * 256, y: 0.4 * 256 },
];
const on = (eye: Landmark) => [{ x: eye.x + 5, y: eye.y + 5 }];

test("on the face crop, a hand within 0.6 eye spacings covers that eye", () => {
  const [left, right] = irises;
  expect(coverFromFace(person(), "right", W, H, region, irises, on(left))).toBe("covered");
  expect(coverFromFace(person(), "right", W, H, region, irises, on(right))).toBe("wrongEye");
  expect(coverFromFace(person(), "left", W, H, region, irises, on(right))).toBe("covered");
  expect(coverFromFace(person(), "right", W, H, region, irises, [...on(left), ...on(right)])).toBe(
    "both",
  );
  expect(coverFromFace(person(), "right", W, H, region, irises, [])).toBe("open");
});

test("the body model's fallback: a hand point near the eye, or a patch hiding it", () => {
  const pose = person();
  expect(coverFromPose(pose, "right", W, H)).toBe("open");
  pose[15] = { x: 0.65, y: 0.42 };
  expect(coverFromPose(pose, "right", W, H)).toBe("covered");
  expect(coverFromPose(pose, "left", W, H)).toBe("wrongEye");
  const patched = person();
  patched[2] = { ...patched[2]!, visibility: 0.2 };
  expect(coverFromPose(patched, "right", W, H)).toBe("covered");
});

test("the shown state changes after three equal readings, and only covered or no body is ok", () => {
  let state = emptyCover();
  state = readCover(state, "covered");
  state = readCover(state, "covered");
  expect(state.shown).toBe("noBody");
  state = readCover(state, "covered");
  expect(state.shown).toBe("covered");
  state = readCover(readCover(state, "open"), "covered");
  expect(state.shown).toBe("covered");
  expect(["covered", "noBody", "open", "wrongEye", "both"].map((s) => coverOk(s as never))).toEqual(
    [true, true, false, false, false],
  );
});
