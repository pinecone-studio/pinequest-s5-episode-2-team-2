import { act } from "react";
import { create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import { useLandmarks } from "./useLandmarks";
import type { LandmarkFrame } from "./facePipeline";

const mockResult = jest.fn(),
  mockError = jest.fn(),
  mockDispose = jest.fn();
const mockResize = jest.fn();
const mockRun = jest.fn();
const mockInfer = jest.fn();
let mockPlatform = "ios";
jest.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mockPlatform;
    },
  },
}));
let handle!: (input: ReturnType<typeof frame>) => void;
jest.mock("../../../assets/models/face_detector.tflite", () => 1, { virtual: true });
jest.mock("../../../assets/models/face_landmarks_detector.tflite", () => 2, { virtual: true });
jest.mock("react-native-fast-tflite", () => ({
  useTensorflowModel: () => ({ model: {}, state: "loaded" }),
}));
jest.mock("react-native-vision-camera-resizer", () => ({
  useResizer: () => ({ resizer: { resize: mockResize } }),
}));
jest.mock("./facePipeline", () => ({ inferLandmarks: (...args: unknown[]) => mockInfer(...args) }));
jest.mock("react-native-vision-camera", () => ({
  useAsyncRunner: () => ({ runAsync: mockRun }),
  useFrameOutput: (props: { onFrame: typeof handle }) => {
    handle = props.onFrame;
    return {};
  },
}));
jest.mock("react-native-worklets", () => ({
  createSynchronizable: (initial: unknown) => {
    let value = initial;
    return {
      getBlocking: () => value,
      setBlocking: (next: unknown) => {
        value = next;
      },
    };
  },
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) => callback(...args),
}));

function frame(timestamp = 1) {
  return {
    timestamp,
    width: 3840,
    height: 2160,
    orientation: "up",
    isMirrored: false,
    dispose: jest.fn(),
  };
}
function Harness() {
  useLandmarks(mockResult, mockError);
  return null;
}
let renderer: ReactTestRenderer;
beforeEach(async () => {
  jest.resetAllMocks();
  mockPlatform = "ios";
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockResize.mockReturnValue({
    getPixelBuffer: () => new Float32Array(512 * 512 * 3).buffer,
    dispose: mockDispose,
  });
  mockInfer.mockReturnValue({ faceCount: 0, landmarks: [] });
  mockRun.mockImplementation((task: () => void) => {
    task();
    return true;
  });
  await act(async () => {
    renderer = create(<Harness />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

test("converts seconds to milliseconds, releases buffers and throttles subsequent frames", () => {
  const first = frame();
  handle(first);
  handle(frame(1.01));
  expect(first.dispose).toHaveBeenCalledTimes(1);
  expect(mockDispose).toHaveBeenCalledTimes(1);
  expect(mockInfer).toHaveBeenCalledTimes(1);
  const report = mockResult.mock.calls[0]![0] as LandmarkFrame;
  expect(report.timestampMs).toBe(1000);
  expect(report.frameSize).toEqual({ width: 3840, height: 2160 });
  expect(Object.keys(report).sort()).toEqual([
    "faceCount",
    "frameSize",
    "landmarks",
    "latencyMs",
    "timestampMs",
  ]);
});

test("converts Android nanoseconds to milliseconds", async () => {
  mockPlatform = "android";
  await act(async () => renderer.update(<Harness />));
  handle(frame(1_000_000_000));
  expect(mockResult.mock.calls[0]![0].timestampMs).toBe(1000);
});

test("busy or failed scheduling releases the frame without blocking capture", () => {
  mockRun.mockReturnValueOnce(false);
  const busy = frame();
  handle(busy);
  expect(busy.dispose).toHaveBeenCalledTimes(1);
  expect(mockResize).not.toHaveBeenCalled();
  mockRun.mockImplementationOnce(() => {
    throw new Error("scheduling failed");
  });
  const failed = frame(2);
  handle(failed);
  expect(failed.dispose).toHaveBeenCalledTimes(1);
  expect(mockError).toHaveBeenCalledTimes(1);
});

test("inference errors release resized buffers and camera frames", () => {
  mockInfer.mockImplementationOnce(() => {
    throw new Error("model failure");
  });
  const failed = frame();
  handle(failed);
  expect(failed.dispose).toHaveBeenCalledTimes(1);
  expect(mockDispose).toHaveBeenCalledTimes(1);
  expect(mockError).toHaveBeenCalledTimes(1);
});

test("a queued frame is disposed without analysis or a stale result after unmount", async () => {
  let pending!: () => void;
  mockRun.mockImplementationOnce((task: () => void) => {
    pending = task;
    return true;
  });
  const queued = frame();
  handle(queued);
  await act(async () => renderer.unmount());
  pending();
  expect(queued.dispose).toHaveBeenCalledTimes(1);
  expect(mockInfer).not.toHaveBeenCalled();
  expect(mockResult).not.toHaveBeenCalled();
});
