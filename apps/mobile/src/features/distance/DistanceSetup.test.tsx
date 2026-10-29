import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import type { Depth } from "react-native-vision-camera";
import { DistanceSetup } from "./DistanceSetup";
import { type FaceTarget } from "./depthDistance";
import { distanceCopy as copy } from "./copy";

let mockPermission = true,
  mockSupported = true;
let mockDepth: (depth: Depth) => void,
  mockFace: (face: FaceTarget | null) => void,
  mockState: (state: string) => void;
const mockAudio = { seekTo: jest.fn(() => Promise.resolve()), play: jest.fn(), pause: jest.fn() };
jest.mock("expo-audio", () => ({ useAudioPlayer: () => mockAudio }));
jest.mock("../../../assets/sounds/correct.wav", () => 3, { virtual: true });
let mockQueue: (() => void)[] | null = null;
const mockRequest = jest.fn(),
  mockContinue = jest.fn(),
  mockCreateDepth = jest.fn(() => ({})),
  mockCreateFaces = jest.fn(() => ({}));
const mockDevices = [
  { id: "front", type: "true-depth", position: "front", supportsOutput: () => mockSupported },
];
jest.mock("expo-router", () => ({ useIsFocused: () => true, router: { back: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("../../components/ui", () => ({
  Button: "Button",
  Text: "Text",
  Screen: "Screen",
  Notice: "Notice",
}));
jest.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  StyleSheet: { create: (s: unknown) => s },
  Platform: { OS: "ios" },
  AppState: {
    currentState: "active",
    addEventListener: (_: string, cb: typeof mockState) => {
      mockState = cb;
      return { remove: jest.fn() };
    },
  },
  Linking: { openSettings: jest.fn() },
}));
jest.mock("./useFullRangeFaces", () => ({
  useFullRangeFaces: (onTarget: (target: FaceTarget | null) => void) => {
    mockFace = onTarget;
    return jest.requireActual("react").useMemo(() => mockCreateFaces(), []);
  },
}));
jest.mock("react-native-vision-camera", () => ({
  Camera: "Camera",
  useCameraDevices: () => mockDevices,
  useCameraPermission: () => ({
    hasPermission: mockPermission,
    canRequestPermission: true,
    requestPermission: mockRequest,
  }),
  useDepthOutput: (props: { onDepth: typeof mockDepth; targetResolution: object }) => {
    mockDepth = props.onDepth;
    return jest.requireActual("react").useMemo(() => mockCreateDepth(), [props.targetResolution]);
  },
}));
jest.mock("react-native-worklets", () => ({
  createSynchronizable: (initial: unknown) => {
    let value = initial;
    return {
      getBlocking: () => value,
      setBlocking: (v: unknown) => {
        value = v;
      },
    };
  },
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => {
    if (mockQueue) mockQueue.push(() => fn(...args));
    else fn(...args);
  },
}));
function depth(metres = 2.4) {
  const values = new Float32Array(25).fill(metres);
  return {
    isValid: true,
    depthDataAccuracy: "absolute",
    depthDataQuality: "high",
    pixelFormat: "depth-32-bit",
    width: 5,
    height: 5,
    bytesPerRow: 20,
    getDepthData: () => values.buffer,
    convertCameraPointToDepthPoint: (p: { x: number; y: number }) => ({ x: p.x * 4, y: p.y * 4 }),
    dispose: jest.fn(),
  };
}
function face(): FaceTarget {
  return { x: 0.5, y: 0.5, halfWidth: 0.5, halfHeight: 0.5, at: Date.now() };
}
let renderer: ReactTestRenderer;
const cameras = () => renderer.root.findAll((n) => n.type === ("Camera" as never));
const text = () => JSON.stringify(renderer.toJSON());
const press = (label: string) =>
  act(async () => {
    await renderer.root
      .find((n) => n.type === ("Pressable" as never) && n.props.accessibilityLabel === label)
      .props.onPress();
  });
beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(1000);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockPermission = true;
  mockSupported = true;
  mockQueue = null;
  jest.clearAllMocks();
  await act(async () => {
    renderer = create(<DistanceSetup onContinue={mockContinue} />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.useRealTimers();
});
test("setup reads one face's depth, releases frames and preserves native output identity", async () => {
  expect(cameras()).toHaveLength(1);
  const target = face(),
    frame = depth();
  await act(async () => {
    mockFace(target);
    mockDepth(frame as unknown as Depth);
  });
  expect(text()).not.toContain("≈ 2.4 м");
  await observe(2.4, 2);
  expect(text()).toContain("≈ 2.4 м");
  expect(text()).toContain(copy.farther);
  expect(
    renderer.root.findByProps({ testID: "distance-status" }).props.style[1].backgroundColor,
  ).toBe("#CA8A04");
  expect(frame.dispose).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(400));
  expect(mockCreateDepth).toHaveBeenCalledTimes(1);
  expect(mockCreateFaces).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(400));
  expect(text()).not.toContain("≈ 2.4 м");
});
test("backgrounding clears readings and stale callbacks cannot restore them", async () => {
  const oldDepth = mockDepth,
    target = face();
  await act(async () => {
    mockFace(target);
    mockDepth(depth() as unknown as Depth);
  });
  await observe(2.4, 2);
  expect(text()).toContain("≈ 2.4 м");
  await act(async () => mockState("background"));
  expect(cameras()).toHaveLength(0);
  const late = depth();
  act(() => oldDepth(late as unknown as Depth));
  expect(late.dispose).toHaveBeenCalledTimes(1);
  await act(async () => mockState("active"));
  expect(text()).not.toContain("≈ 2.4 м");
});
test("denial and unsupported hardware retain manual continuation without fake metres", async () => {
  mockPermission = false;
  await act(async () => renderer.update(<DistanceSetup onContinue={mockContinue} />));
  await press(copy.retry);
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(cameras()).toHaveLength(0);
  await press(copy.proceed);
  expect(mockContinue).toHaveBeenCalledTimes(1);
  mockPermission = true;
  mockSupported = false;
  await act(async () => renderer.update(<DistanceSetup onContinue={mockContinue} />));
  expect(cameras()).toHaveLength(0);
  expect(text()).toContain(copy.unavailable);
});
test("capture stops after thirty seconds rather than measuring unattended", async () => {
  expect(text()).toContain(copy.measuring);
  await act(async () => jest.advanceTimersByTime(3000));
  expect(text()).toContain(copy.notMeasured);
  expect(cameras()).toHaveLength(1);
  await act(async () => jest.advanceTimersByTime(27_000));
  expect(cameras()).toHaveLength(0);
  expect(text()).toContain(copy.unavailable);
});

test("three displayed metres has the ready card, while retry clears the old reading", async () => {
  await act(async () => {
    mockFace(face());
    mockDepth(depth(3) as unknown as Depth);
  });
  expect(text()).not.toContain(copy.ready);
  await observe(3, 5);
  expect(text()).toContain(copy.ready);
  expect(text()).toContain("≈ 3.0 м");
  expect(
    renderer.root.findByProps({ testID: "distance-status" }).props.style[1].backgroundColor,
  ).toBe("#16835E");
  await press(copy.retry);
  expect(text()).not.toContain("≈ 3.0 м");
  expect(text()).toContain(copy.measuring);
  expect(cameras()).toHaveLength(1);
});

async function observe(metres: number, count: number) {
  for (let i = 0; i < count; i++)
    await act(async () => {
      jest.advanceTimersByTime(200);
      mockFace(face());
      mockDepth(depth(metres) as unknown as Depth);
    });
}
test("face loss immediately clears the number and invalidates queued native reports", async () => {
  await observe(2.4, 3);
  expect(text()).toContain("≈ 2.4 м");
  mockQueue = [];
  await observe(2.4, 3);
  const queued = mockQueue;
  await act(async () => mockFace(null));
  expect(text()).not.toContain("≈ 2.4 м");
  await act(async () => queued.forEach((fn) => fn()));
  expect(text()).not.toContain("≈ 2.4 м");
  expect(mockAudio.play).not.toHaveBeenCalled();
  expect(text()).toContain(copy.measuring);
  await act(async () => jest.advanceTimersByTime(3000));
  expect(text()).toContain(copy.notMeasured);
});
test("stable target cues once per attempt, cancels on loss and can be explicitly retried", async () => {
  await observe(3, 6);
  expect(mockAudio.play).toHaveBeenCalledTimes(1);
  await observe(3, 3);
  expect(mockAudio.play).toHaveBeenCalledTimes(1);
  await act(async () => mockFace(null));
  expect(mockAudio.pause).toHaveBeenCalled();
  await observe(3, 6);
  expect(mockAudio.play).toHaveBeenCalledTimes(1);
  await press(copy.retry);
  await observe(3, 6);
  expect(mockAudio.play).toHaveBeenCalledTimes(2);
});
test("slow audio preparation cannot play after backgrounding", async () => {
  let finish!: () => void;
  mockAudio.seekTo.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await observe(3, 6);
  await act(async () => mockState("background"));
  await act(async () => finish());
  expect(mockAudio.play).not.toHaveBeenCalled();
});

test("audio failure preserves manual continuation", async () => {
  mockAudio.seekTo.mockRejectedValueOnce(new Error("audio unavailable"));
  await observe(3, 6);
  expect(text()).toContain(copy.ready);
  expect(mockAudio.play).not.toHaveBeenCalled();
  await press(copy.proceed);
  expect(mockContinue).toHaveBeenCalledTimes(1);
});
