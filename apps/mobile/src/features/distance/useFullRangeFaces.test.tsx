import { act } from "react";
import { create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import { useFullRangeFaces } from "./useFullRangeFaces";

const mockResult = jest.fn(),
  mockError = jest.fn(),
  mockDispose = jest.fn();
const mockResize = jest.fn();
const mockRun = jest.fn();
const mockInfer = jest.fn();
const mockSchedule = jest.fn();
const mockCreateOutput = jest.fn(() => ({}));
let handle!: (input: ReturnType<typeof frame>) => void;
const mockLoad = jest.fn();
jest.mock("./fullRangeModel", () => ({ loadFullRangeFace: () => mockLoad() }));
jest.mock("react-native-vision-camera-resizer", () => ({
  useResizer: () => ({ resizer: { resize: mockResize } }),
}));
jest.mock("./fullRangeFace", () => ({
  fullRangeTarget: (...args: unknown[]) => mockInfer(...args),
}));
jest.mock("react-native-vision-camera", () => ({
  useAsyncRunner: () => ({ runAsync: mockRun }),
  useFrameOutput: (props: { onFrame: typeof handle; targetResolution: object }) => {
    handle = props.onFrame;
    return jest.requireActual("react").useMemo(() => mockCreateOutput(), [props.targetResolution]);
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

function Harness() {
  useFullRangeFaces(mockResult, mockError);
  return null;
}
let renderer: ReactTestRenderer;
beforeEach(async () => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(1000);
  mockSchedule.mockImplementation((callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    callback(...args),
  );

  mockLoad.mockResolvedValue({});
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockResize.mockReturnValue({
    getPixelBuffer: () => new Float32Array(192 * 192 * 3).buffer,
    dispose: mockDispose,
  });
  mockInfer.mockImplementation((_f, _rgb, _m, at) => ({
    target: { x: 0.5, y: 0.5, halfWidth: 0.1, halfHeight: 0.1, at },
    count: 1,
  }));
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
  jest.useRealTimers();
});

test("uses capture time, releases buffers and throttles subsequent frames", () => {
  const first = frame();
  handle(first);
  handle(frame());
  expect(first.dispose).toHaveBeenCalledTimes(1);
  expect(mockDispose).toHaveBeenCalledTimes(1);
  expect(mockInfer).toHaveBeenCalledTimes(1);
  expect(mockResult.mock.calls[0]![0].at).toBe(1000);
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
  jest.advanceTimersByTime(1000);
  handle(failed);
  expect(failed.dispose).toHaveBeenCalledTimes(1);
  expect(mockError).toHaveBeenCalledTimes(1);
});

test("inference errors release resized buffers and camera frames", () => {
  mockInfer.mockImplementationOnce(() => {
    throw new Error("model failure");
  });
  const failed = frame();
  jest.advanceTimersByTime(1000);
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
  jest.advanceTimersByTime(1000);
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
  jest.advanceTimersByTime(1000);
  handle(frame(2));
  expect(mockRun).toHaveBeenCalledTimes(1);
});

test("an inference result queued past target expiry cannot revive a face", () => {
  const queued: (() => void)[] = [];
  mockSchedule.mockImplementation((callback: (...args: unknown[]) => void, ...args: unknown[]) =>
    queued.push(() => callback(...args)),
  );
  handle(frame());
  queued.shift()!();
  jest.advanceTimersByTime(800);
  while (queued.length) queued.shift()!();
  expect(mockResult).toHaveBeenCalledWith(null);
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

test("model-ready and round renders preserve one native frame output/thread", async () => {
  expect(mockCreateOutput).toHaveBeenCalledTimes(1);

  await act(async () => renderer.update(<Harness />));
  expect(mockCreateOutput).toHaveBeenCalledTimes(1);
});
