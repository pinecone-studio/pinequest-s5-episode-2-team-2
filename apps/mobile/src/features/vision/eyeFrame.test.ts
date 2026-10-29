import { analyzeEyes } from "./eyeFrame";

function setup() {
  const planes = [
    {
      width: 4,
      height: 4,
      bytesPerRow: 4,
      getPixelBuffer: () => new Uint8Array(16).fill(128).buffer,
    },
    {
      width: 2,
      height: 2,
      bytesPerRow: 4,
      getPixelBuffer: () => new Uint8Array(8).fill(128).buffer,
    },
  ];
  const frame = {
    width: 4,
    height: 4,
    pixelFormat: "yuv-420-8-bit-full" as const,
    getPlanes: jest.fn(() => planes),
  };
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  for (const [start, x] of [
    [468, 3],
    [473, 1],
  ]) {
    landmarks[start!] = { x: x!, y: 2 };
    landmarks[start! + 1] = { x: x! + 0.5, y: 2 };
    landmarks[start! + 2] = { x: x! - 0.5, y: 2 };
    landmarks[start! + 3] = { x: x!, y: 2.5 };
    landmarks[start! + 4] = { x: x!, y: 1.5 };
  }
  const model = {
    runSync: jest.fn(() => [new Float32Array([0.5, 0.5, 0.2, 0.5, 0.5, 0.9]).buffer]),
  };
  return { frame, landmarks, model, planes };
}

test("reads full-range two-plane frames and returns only eye predictions", () => {
  const { frame, landmarks, model } = setup();
  const result = analyzeEyes(frame, landmarks, model);
  expect(result.eyeFailure).toBeNull();
  expect(model.runSync).toHaveBeenCalledTimes(2);
  expect(result.eyes![0].irisCenter).toEqual({ x: 1, y: 2 });
  expect(result.eyes![1].irisCenter).toEqual({ x: 3, y: 2 });
});

test("missing landmarks do not read pixel buffers", () => {
  const { frame, model } = setup();
  expect(analyzeEyes(frame, [], model).eyeFailure).toBe("EYE_NOT_FOUND");
  expect(frame.getPlanes).not.toHaveBeenCalled();
});

test("without weights the heuristic measures the eyes from the frame (#274)", () => {
  const { frame, landmarks, model } = setup();
  const result = analyzeEyes(frame, landmarks, undefined);
  expect(result.eyeFailure).toBeNull();
  expect(frame.getPlanes).toHaveBeenCalled();
  expect(model.runSync).not.toHaveBeenCalled();
  // A flat grey frame has no reflex.
  expect(result.eyes!.map((eye) => eye.reflex)).toEqual([null, null]);
});

test("unsupported layouts and model failures are contained within the frame", () => {
  const { frame, landmarks, model, planes } = setup();
  expect(
    analyzeEyes({ ...frame, pixelFormat: "yuv-420-8-bit-video" }, landmarks, model).eyeFailure,
  ).toBe("MODEL_ERROR");
  planes[1]!.width = 1;
  expect(analyzeEyes(frame, landmarks, model).eyeFailure).toBe("MODEL_ERROR");
  planes[1]!.width = 2;
  model.runSync.mockImplementationOnce(() => {
    throw new Error("inference failed");
  });
  expect(analyzeEyes(frame, landmarks, model).eyeFailure).toBe("MODEL_ERROR");
});
