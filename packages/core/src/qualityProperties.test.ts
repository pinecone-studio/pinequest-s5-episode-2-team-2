import { mockEyeMeasure } from "./mocks";
import { assessQuality, eyeOpenness, headPose } from "./quality";
import type { QualityInput } from "./quality";
import type { Point } from "./types";

// Geometric properties of the landmark checks over many generated faces.

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** A face with random small head turns and lid gaps, around (cx, cy) at scale s. */
function face(random: () => number, cx = 500, cy = 550, s = 1): Point[] {
  const at = (x: number, y: number) => ({ x: cx + (x - 500) * s, y: cy + (y - 550) * s });
  const lm: Point[] = Array.from({ length: 478 }, () => at(500, 550));
  const lid = 4 + random() * 10;
  const nose = { x: 500 + (random() - 0.5) * 120, y: 590 + (random() - 0.5) * 80 };
  const tilt = (random() - 0.5) * 40;
  const set: Record<number, [number, number]> = {
    33: [400, 500 - tilt],
    133: [460, 500 - tilt / 3],
    159: [430, 500 - lid - tilt * 0.7],
    145: [430, 500 + lid - tilt * 0.7],
    263: [600, 500 + tilt],
    362: [540, 500 + tilt / 3],
    386: [570, 500 - lid + tilt * 0.7],
    374: [570, 500 + lid + tilt * 0.7],
    234: [350, 560],
    454: [650, 560],
    1: [nose.x, nose.y],
    152: [500, 700],
  };
  for (const [i, [x, y]] of Object.entries(set)) lm[Number(i)] = at(x, y);
  return lm;
}

function input(landmarks: Point[], irisRadius = 48): QualityInput {
  return {
    timestampMs: 0,
    frameSize: { width: 3840, height: 2160 },
    faceCount: 1,
    landmarks,
    eyes: [
      mockEyeMeasure("imageLeft", { x: 0.05, y: 0 }, { irisRadius }),
      mockEyeMeasure("imageRight", { x: -0.05, y: 0 }, { irisRadius }),
    ],
  };
}

const mirror = (lm: Point[]) => lm.map((p) => ({ x: 1000 - p.x, y: p.y }));
const FACES = Array.from({ length: 300 }, (_, i) => lcg(i + 7));

test("moving the face in the frame changes nothing", () => {
  for (const random of FACES) {
    const seed = random();
    const here = face(lcg(seed * 1e9), 500, 550);
    const there = face(lcg(seed * 1e9), 2900, 1400);
    expect(assessQuality(input(there)).reasons).toEqual(assessQuality(input(here)).reasons);
  }
});

test("scaling the landmarks keeps pose and openness; only the iris size decides distance", () => {
  for (const random of FACES) {
    const seed = random() * 1e9;
    const small = face(lcg(seed), 500, 550, 1);
    const large = face(lcg(seed), 500, 550, 2.5);
    const a = headPose(small);
    const b = headPose(large);
    expect(b.yaw).toBeCloseTo(a.yaw, 9);
    expect(b.pitch).toBeCloseTo(a.pitch, 9);
    expect(b.roll).toBeCloseTo(a.roll, 9);
    const [oa, ob] = [eyeOpenness(small), eyeOpenness(large)];
    expect(ob[0]).toBeCloseTo(oa[0], 9);
    expect(ob[1]).toBeCloseTo(oa[1], 9);
    const without = (reasons: string[]) =>
      reasons.filter((r) => r !== "TOO_FAR" && r !== "TOO_CLOSE");
    expect(without(assessQuality(input(large)).reasons)).toEqual(
      without(assessQuality(input(small)).reasons),
    );
  }
});

test("a mirrored face has the same openness, mirrored yaw and roll, same pitch", () => {
  for (const random of FACES) {
    const lm = face(random);
    const a = headPose(lm);
    const b = headPose(mirror(lm));
    expect(b.yaw).toBeCloseTo(-a.yaw, 9);
    expect(b.roll).toBeCloseTo(-a.roll, 9);
    expect(b.pitch).toBeCloseTo(a.pitch, 9);
    const [l, r] = eyeOpenness(lm);
    const [ml, mr] = eyeOpenness(mirror(lm));
    expect([ml, mr].sort()).toEqual([l, r].sort());
  }
});

test("the head pose stays finite and within ±90° for any generated face", () => {
  for (const random of FACES) {
    const pose = headPose(face(random));
    for (const v of [pose.yaw, pose.pitch, pose.roll]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThanOrEqual(90);
    }
  }
});
