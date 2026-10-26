import { mockEyeMeasure } from "./mocks";
import { analyzeFrame, assessQuality, eyeOpenness, headPose } from "./quality";
import type { QualityInput } from "./quality";
import type { CropStats } from "./pixels";
import type { EyeMeasure, Point } from "./types";

/** A level, frontal face: open eyes, nose centred between the cheeks. */
function frontalFace(overrides: Record<number, Point> = {}): Point[] {
  const lm: Point[] = Array.from({ length: 478 }, () => ({ x: 500, y: 550 }));
  const set: Record<number, Point> = {
    33: { x: 400, y: 500 },
    133: { x: 460, y: 500 },
    159: { x: 430, y: 488 },
    145: { x: 430, y: 512 },
    263: { x: 600, y: 500 },
    362: { x: 540, y: 500 },
    386: { x: 570, y: 488 },
    374: { x: 570, y: 512 },
    234: { x: 350, y: 560 },
    454: { x: 650, y: 560 },
    1: { x: 500, y: 590 },
    152: { x: 500, y: 700 },
    ...overrides,
  };
  for (const [i, p] of Object.entries(set)) lm[Number(i)] = p;
  return lm;
}

const eyes = (overrides: Partial<EyeMeasure> = {}): [EyeMeasure, EyeMeasure] => [
  mockEyeMeasure("imageLeft", { x: 0.05, y: 0 }, overrides),
  mockEyeMeasure("imageRight", { x: -0.05, y: 0 }, overrides),
];

function input(overrides: Partial<QualityInput> = {}): QualityInput {
  return {
    timestampMs: 0,
    frameSize: { width: 3840, height: 2160 },
    faceCount: 1,
    landmarks: frontalFace(),
    eyes: eyes(),
    ...overrides,
  };
}

describe("assessQuality", () => {
  it("passes a frontal face with open eyes at a good distance", () => {
    const q = assessQuality(input());
    expect(q).toMatchObject({ ok: true, reasons: [], sharpness: null, exposure: null });
    expect(q.headPose!.roll).toBeCloseTo(0);
    expect(q.headPose!.yaw).toBeCloseTo(0);
    expect(q.headPose!.pitch).toBeCloseTo(0);
  });

  it("rejects no face and several faces without a pose", () => {
    expect(assessQuality(input({ faceCount: 0, landmarks: [] }))).toMatchObject({
      ok: false,
      reasons: ["NO_FACE"],
      headPose: null,
    });
    expect(assessQuality(input({ faceCount: 2 })).reasons).toEqual(["MULTIPLE_FACES"]);
  });

  it("rejects incomplete or invalid landmarks", () => {
    expect(assessQuality(input({ landmarks: frontalFace().slice(0, 468) })).reasons).toEqual([
      "EYE_NOT_FOUND",
    ]);
    const lm = frontalFace({ 1: { x: NaN, y: 590 } });
    expect(assessQuality(input({ landmarks: lm })).reasons).toEqual(["EYE_NOT_FOUND"]);
  });

  it("flags a tilted, turned or nodding head", () => {
    const tilted = frontalFace({ 263: { x: 600, y: 500 + 200 * Math.tan(Math.PI / 9) } });
    expect(assessQuality(input({ landmarks: tilted })).reasons).toContain("HEAD_TURNED");
    const turned = frontalFace({ 1: { x: 600, y: 590 } });
    expect(assessQuality(input({ landmarks: turned })).reasons).toContain("HEAD_TURNED");
    const nodding = frontalFace({ 1: { x: 500, y: 660 } });
    expect(assessQuality(input({ landmarks: nodding })).reasons).toContain("HEAD_TURNED");
  });

  it("allows small head movement", () => {
    const slight = frontalFace({ 1: { x: 510, y: 595 } });
    expect(assessQuality(input({ landmarks: slight })).ok).toBe(true);
  });

  it("flags a closed eye", () => {
    const blink = frontalFace({ 159: { x: 430, y: 498 }, 145: { x: 430, y: 502 } });
    expect(assessQuality(input({ landmarks: blink })).reasons).toEqual(["EYES_CLOSED"]);
  });

  it("flags a face too far from or too close to the camera", () => {
    expect(assessQuality(input({ eyes: eyes({ irisRadius: 20 }) })).reasons).toEqual(["TOO_FAR"]);
    expect(assessQuality(input({ eyes: eyes({ irisRadius: 100 }) })).reasons).toEqual([
      "TOO_CLOSE",
    ]);
  });

  it("flags unmeasured eyes and a missing reflex", () => {
    expect(assessQuality(input({ eyes: null })).reasons).toEqual(["EYE_NOT_FOUND"]);
    const noReflex: [EyeMeasure, EyeMeasure] = [
      mockEyeMeasure("imageLeft", null),
      mockEyeMeasure("imageRight", { x: 0, y: 0 }),
    ];
    expect(assessQuality(input({ eyes: noReflex })).reasons).toEqual(["REFLEX_NOT_FOUND"]);
  });

  it("collects several reasons for one frame", () => {
    const lm = frontalFace({
      1: { x: 600, y: 590 },
      159: { x: 430, y: 498 },
      145: { x: 430, y: 502 },
    });
    expect(assessQuality(input({ landmarks: lm, eyes: eyes({ irisRadius: 20 }) })).reasons).toEqual(
      ["HEAD_TURNED", "EYES_CLOSED", "TOO_FAR"],
    );
  });
});

describe("assessQuality pixel checks", () => {
  const crop = (overrides: Partial<CropStats> = {}): CropStats => ({
    sharpness: 0.01,
    exposure: 0.4,
    clipped: 0.02,
    ...overrides,
  });
  const withCrops = (a: CropStats, b: CropStats = crop()) => input({ crops: [a, b] });

  it("passes sharp, well-lit crops and reports their statistics", () => {
    const q = assessQuality(withCrops(crop({ sharpness: 0.02 }), crop({ exposure: 0.6 })));
    expect(q).toMatchObject({ ok: true, reasons: [], sharpness: 0.01 });
    expect(q.exposure).toBeCloseTo(0.5);
  });

  it("flags a blurred crop", () => {
    expect(assessQuality(withCrops(crop({ sharpness: 0.0001 }))).reasons).toEqual(["BLUR"]);
  });

  it("flags a dark or overexposed crop", () => {
    expect(assessQuality(withCrops(crop({ exposure: 0.05 }))).reasons).toEqual(["TOO_DARK"]);
    expect(assessQuality(withCrops(crop({ exposure: 0.95 }))).reasons).toEqual(["OVEREXPOSED"]);
    expect(assessQuality(withCrops(crop({ clipped: 0.3 }))).reasons).toEqual(["OVEREXPOSED"]);
  });

  it("skips the pixel checks without crops or without a face", () => {
    expect(assessQuality(input({ crops: null }))).toMatchObject({
      sharpness: null,
      exposure: null,
    });
    const q = assessQuality(input({ faceCount: 0, landmarks: [], crops: [crop(), crop()] }));
    expect(q).toMatchObject({ reasons: ["NO_FACE"], sharpness: null, exposure: null });
  });
});

describe("headPose and eyeOpenness", () => {
  it("do not depend on which eye is drawn first", () => {
    const lm = frontalFace({ 33: { x: 600, y: 500 }, 263: { x: 400, y: 500 } });
    expect(headPose(lm).roll).toBeCloseTo(0);
  });

  it("stay finite when the points collapse", () => {
    const flat: Point[] = Array.from({ length: 478 }, () => ({ x: 500, y: 500 }));
    expect(headPose(flat)).toEqual({ yaw: 0, pitch: 0, roll: 0 });
    expect(eyeOpenness(flat)).toEqual([0, 0]);
    expect(assessQuality(input({ landmarks: flat })).reasons).toEqual(["EYES_CLOSED"]);
  });

  it("measure the lid gap over the eye width", () => {
    const [a, b] = eyeOpenness(frontalFace());
    expect(a).toBeCloseTo(0.4);
    expect(b).toBeCloseTo(0.4);
  });
});

describe("analyzeFrame", () => {
  it("adds the mirrored asymmetry to a good frame", () => {
    const frame = analyzeFrame(input());
    expect(frame.quality.ok).toBe(true);
    expect(frame.asymmetry!.x).toBeCloseTo(0);
    expect(frame.asymmetry!.y).toBeCloseTo(0);
  });

  it("has no asymmetry without both reflexes", () => {
    expect(analyzeFrame(input({ eyes: null })).asymmetry).toBeNull();
    const noReflex: [EyeMeasure, EyeMeasure] = [
      mockEyeMeasure("imageLeft", null),
      mockEyeMeasure("imageRight", { x: 0, y: 0 }),
    ];
    expect(analyzeFrame(input({ eyes: noReflex })).asymmetry).toBeNull();
  });
});
