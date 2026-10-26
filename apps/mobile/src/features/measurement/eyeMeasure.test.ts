import { decide } from "@app/core";
import type { PolicyConfig } from "@app/core";
import type { EyePrediction } from "../vision/eyeCrops";
import { scanFailure, toEyeMeasure, toEyeMeasures } from "./eyeMeasure";

function prediction(overrides: Partial<EyePrediction> = {}): EyePrediction {
  return {
    side: "imageLeft",
    irisCenter: { x: 1000, y: 800 },
    irisRadius: 40,
    reflex: { x: 1010, y: 796 },
    reflexVisibleProbability: 0.9,
    crop: { x: 900, y: 700, size: 200, side: "imageLeft" },
    ...overrides,
  };
}

const config: PolicyConfig = {
  referAsymmetry: 0.2,
  minFramesUsed: 5,
  maxSpread: 0.1,
  validated: false,
};

test("keeps frame coordinates and adds the radius-normalized reflex offset", () => {
  const eye = toEyeMeasure(prediction());
  expect(eye).toEqual({
    side: "imageLeft",
    irisCenter: { x: 1000, y: 800 },
    irisRadius: 40,
    reflex: { x: 1010, y: 796 },
    reflexOffset: { x: 0.25, y: -0.1 },
    confidence: 0.9,
  });
});

test("no reflex means no offset and zero confidence", () => {
  const eye = toEyeMeasure(prediction({ reflex: null, reflexVisibleProbability: 0.3 }));
  expect(eye.reflex).toBeNull();
  expect(eye.reflexOffset).toBeNull();
  expect(eye.confidence).toBe(0);
});

test("converts both eyes in order, or nothing when they were not measured", () => {
  const right = prediction({ side: "imageRight", irisCenter: { x: 1400, y: 800 } });
  const eyes = toEyeMeasures({ eyes: [prediction(), right], eyeFailure: null })!;
  expect(eyes.map((e) => e.side)).toEqual(["imageLeft", "imageRight"]);
  expect(toEyeMeasures({ eyes: null, eyeFailure: "EYE_NOT_FOUND" })).toBeNull();
  expect(toEyeMeasures({})).toBeNull();
});

test("a missing or failing model makes the scan NOT_ASSESSED", () => {
  const summary = { framesTotal: 30, framesUsed: 30, asymmetryScore: 0, spread: 0 };
  for (const failure of ["MODEL_UNAVAILABLE", "MODEL_ERROR"] as const) {
    const decision = decide({ summary, qualityReasons: [], failure: scanFailure(failure) }, config);
    expect(decision).toEqual({ outcome: "NOT_ASSESSED", reasons: [failure] });
  }
});

test("an eye not found in one frame is not a scan failure", () => {
  expect(scanFailure("EYE_NOT_FOUND")).toBeNull();
  expect(scanFailure(null)).toBeNull();
  expect(scanFailure(undefined)).toBeNull();
});
