import type { LandmarkFrame } from "../vision/facePipeline";
import { measurementOverlayProps } from "./debug";

const base: LandmarkFrame = {
  timestampMs: 0,
  frameSize: { width: 3840, height: 2160 },
  faceCount: 1,
  landmarks: [],
  latencyMs: 35,
};

test("passes frame size, latency and measured eyes to the overlay", () => {
  const eye = {
    irisCenter: { x: 1700, y: 1000 },
    irisRadius: 50,
    reflex: null,
    reflexVisibleProbability: 0.1,
    crop: { x: 1575, y: 875, size: 250 },
  };
  const props = measurementOverlayProps({
    ...base,
    eyes: [
      { ...eye, side: "imageLeft", crop: { ...eye.crop, side: "imageLeft" } },
      {
        ...eye,
        side: "imageRight",
        irisCenter: { x: 2100, y: 1000 },
        crop: { ...eye.crop, side: "imageRight" },
      },
    ],
    eyeFailure: null,
  });
  expect(props.frameSize).toEqual({ width: 3840, height: 2160 });
  expect(props.latencyMs).toBe(35);
  expect(props.eyes?.map((e) => e.irisCenter.x)).toEqual([1700, 2100]);
  expect(props.failure).toBeNull();
});

test("explains why there are no eyes", () => {
  expect(
    measurementOverlayProps({ ...base, eyes: null, eyeFailure: "MODEL_UNAVAILABLE" }),
  ).toMatchObject({ eyes: null, failure: "MODEL_UNAVAILABLE" });
  expect(measurementOverlayProps({ ...base, faceCount: 0 }).failure).toBe("NO_FACE");
});
