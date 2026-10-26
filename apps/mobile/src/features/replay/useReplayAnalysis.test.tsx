import { act } from "react";
import { create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import { useReplayAnalysis } from "./useReplayAnalysis";
import type { PixelSource } from "../vision/pixels";

const mockRun = jest.fn(),
  mockAnalyze = jest.fn();
let mockReady = true;
jest.mock("../../../assets/models/face_detector.tflite", () => 1, { virtual: true });
jest.mock("../../../assets/models/face_landmarks_detector.tflite", () => 2, { virtual: true });
jest.mock("react-native-fast-tflite", () => ({
  useTensorflowModel: () => ({ model: mockReady ? {} : undefined, state: "loaded" }),
}));
jest.mock("../vision/useEyeModel", () => ({
  useEyeModel: () => ({ model: undefined, error: false }),
}));
jest.mock("react-native-vision-camera", () => ({
  useAsyncRunner: () => ({ runAsync: mockRun, isBusy: () => false }),
}));
jest.mock("react-native-worklets", () => ({
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));
jest.mock("./replay", () => ({
  analyzeRecordedPixels: (...args: unknown[]) => mockAnalyze(...args),
}));
let latest: ReturnType<typeof useReplayAnalysis>, renderer: ReactTestRenderer;
function Harness() {
  latest = useReplayAnalysis();
  return null;
}
const source: PixelSource = {
  format: "rgb",
  width: 2,
  height: 2,
  stride: 6,
  rgb: new Uint8Array(12),
};
beforeEach(async () => {
  jest.resetAllMocks();
  mockReady = true;
  mockRun.mockImplementation((task: () => void) => {
    task();
    return true;
  });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await act(async () => {
    renderer = create(<Harness />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

test("returns the shared pipeline result from the worker", async () => {
  const result = {
    faceCount: 0,
    landmarks: [],
    timestampMs: 0,
    latencyMs: 1,
    frameSize: { width: 2, height: 2 },
  };
  mockAnalyze.mockReturnValue(result);
  expect(latest.ready).toBe(true);
  await expect(latest.analyze(source, 0)).resolves.toEqual(result);
  expect(mockAnalyze).toHaveBeenCalledTimes(1);
});

test("busy workers, scheduling errors and inference errors reject instead of hanging", async () => {
  mockRun.mockReturnValueOnce(false);
  await expect(latest.analyze(source, 0)).rejects.toThrow("busy");
  mockRun.mockImplementationOnce(() => {
    throw new Error("native");
  });
  await expect(latest.analyze(source, 0)).rejects.toThrow("scheduling");
  mockAnalyze.mockImplementationOnce(() => {
    throw new Error("model");
  });
  await expect(latest.analyze(source, 0)).rejects.toBe("MODEL_ERROR");
});

test("mandatory face models must be ready", async () => {
  mockReady = false;
  await act(async () => renderer.update(<Harness />));
  expect(latest.ready).toBe(false);
  await expect(latest.analyze(source, 0)).rejects.toThrow("not ready");
  expect(mockRun).not.toHaveBeenCalled();
});
