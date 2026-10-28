import { act } from "react";
import { create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import { useGestureFrames } from "./useGestureFrames";

const mockResult = jest.fn(),
  mockError = jest.fn(),
  mockDispose = jest.fn();
const mockResize = jest.fn();
const mockRun = jest.fn();
const mockInfer = jest.fn();
const mockSchedule = jest.fn();
let mockPlatform = "ios";
jest.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mockPlatform;
    },
  },
}));
let handle!: (input: ReturnType<typeof frame>) => void;
const mockLoad = jest.fn();
jest.mock("./gestureModels", () => ({ loadGestureModels: () => mockLoad() }));
jest.mock("react-native-vision-camera-resizer", () => ({
  useResizer: () => ({ resizer: { resize: mockResize } }),
}));
jest.mock("./gestureFrame", () => ({
  analyzeGestureFrame: (...args: unknown[]) => mockInfer(...args),
}));
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
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    mockSchedule(callback, ...args),
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
let round = "practice-1";
function Harness() {
  useGestureFrames(round, mockResult, mockError);
  return null;
}
let renderer: ReactTestRenderer;
beforeEach(async () => {
  jest.resetAllMocks();
  mockSchedule.mockImplementation((callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    callback(...args),
  );
  mockPlatform = "ios";
  round = "practice-1";
  mockLoad.mockResolvedValue({ poseDetector: {}, pose: {}, palm: {}, hand: {} });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockResize.mockReturnValue({
    getPixelBuffer: () => new Float32Array(512 * 512 * 3).buffer,
    dispose: mockDispose,
  });
  mockInfer.mockReturnValue({ body: true, hand: [] });
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
  const report = mockResult.mock.calls[0]![0];
  expect(report.timestampMs).toBe(1000);
  expect(report.body).toBe(true);
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

test("RN dispatch bounds the handoff queue before starting a worker", () => {
  const queued: (() => void)[] = [];
  mockSchedule.mockImplementation((callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    queued.push(() => callback(...args)),
  );
  const accepted = frame(1),
    dropped = frame(2);
  handle(accepted);
  handle(dropped);
  expect(mockRun).not.toHaveBeenCalled();
  expect(queued).toHaveLength(1);
  expect(accepted.dispose).not.toHaveBeenCalled();
  expect(dropped.dispose).toHaveBeenCalledTimes(1);
  queued.shift()!();
  expect(mockRun).toHaveBeenCalledTimes(1);
  expect(accepted.dispose).toHaveBeenCalledTimes(1);
  while (queued.length) queued.shift()!();
  expect(mockResult).toHaveBeenCalledTimes(1);
  handle(frame(3));
  expect(queued).toHaveLength(1);
  while (queued.length) queued.shift()!();
  expect(mockRun).toHaveBeenCalledTimes(2);
});

test("unmount before RN dispatch releases the native frame without starting inference", async () => {
  let dispatch!: () => void;
  mockSchedule.mockImplementationOnce(
    (callback: (...args: unknown[]) => void, ...args: unknown[]) => {
      dispatch = () => callback(...args);
    },
  );
  const queued = frame();
  handle(queued);
  await act(async () => renderer.unmount());
  dispatch();
  expect(queued.dispose).toHaveBeenCalledTimes(1);
  expect(mockRun).not.toHaveBeenCalled();
  expect(mockResult).not.toHaveBeenCalled();
});

test("failed RN dispatch releases the frame and allows another attempt", () => {
  mockSchedule.mockImplementationOnce(() => {
    throw new Error("RN dispatch failed");
  });
  const rejected = frame(1);
  handle(rejected);
  expect(rejected.dispose).toHaveBeenCalledTimes(1);
  expect(mockError).toHaveBeenCalledTimes(1);
  handle(frame(2));
  expect(mockRun).toHaveBeenCalledTimes(1);
});

test("a result queued for an old letter cannot answer the next letter", async () => {
  const queued: (() => void)[] = [];
  mockSchedule.mockImplementation((callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    queued.push(() => callback(...args)),
  );
  handle(frame());
  queued.shift()!(); // worker completed; result is still waiting on RN
  round = "practice-2";
  await act(async () => renderer.update(<Harness />));
  while (queued.length) queued.shift()!();
  expect(mockResult).not.toHaveBeenCalled();
});

test("a worker queued before a round change disposes its frame without analysis", async () => {
  let task!: () => void;
  mockRun.mockImplementationOnce((work: () => void) => {
    task = work;
    return true;
  });
  const input = frame();
  handle(input);
  round = "cover-right";
  await act(async () => renderer.update(<Harness />));
  task();
  expect(input.dispose).toHaveBeenCalledTimes(1);
  expect(mockInfer).not.toHaveBeenCalled();
  expect(mockResult).not.toHaveBeenCalled();
});

test("a remounted camera cannot use cached interpreters while an older worker is running", async () => {
  let work!: () => void;
  mockRun.mockImplementationOnce((task: () => void) => {
    work = task;
    return true;
  });
  handle(frame());
  let second!: ReactTestRenderer;
  await act(async () => {
    second = create(<Harness />);
  });
  const dropped = frame(2);
  handle(dropped);
  expect(dropped.dispose).toHaveBeenCalledTimes(1);
  expect(mockRun).toHaveBeenCalledTimes(1);
  work();
  await act(async () => second.unmount());
});
