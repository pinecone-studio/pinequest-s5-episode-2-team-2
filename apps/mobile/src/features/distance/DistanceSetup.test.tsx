import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import type { Depth, ScannedObject } from "react-native-vision-camera";
import { DistanceSetup } from "./DistanceSetup";
import { distanceCopy as copy } from "./copy";

let mockPermission = true,
  mockSupported = true;
let mockDepth: (depth: Depth) => void,
  mockFaces: (faces: ScannedObject[]) => void,
  mockState: (state: string) => void;
const mockRequest = jest.fn(),
  mockContinue = jest.fn(),
  mockCreateDepth = jest.fn(() => ({})),
  mockCreateFaces = jest.fn(() => ({}));
const mockDevices = [
  { id: "front", type: "true-depth", position: "front", supportsOutput: () => mockSupported },
];
jest.mock("expo-router", () => ({ useIsFocused: () => true }));
jest.mock("../../components/ui", () => ({
  Button: "Button",
  Text: "Text",
  Screen: "Screen",
  Notice: "Notice",
}));
jest.mock("react-native", () => ({
  View: "View",
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
  useObjectOutput: (props: { onObjectsScanned: typeof mockFaces; types: string[] }) => {
    mockFaces = props.onObjectsScanned;
    return jest.requireActual("react").useMemo(() => mockCreateFaces(), [props.types]);
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
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));
function depth() {
  const values = new Float32Array(25).fill(2.4);
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
function face() {
  return {
    type: "face",
    boundingBox: { x: 0, y: 0, width: 1, height: 1 },
    dispose: jest.fn(),
  };
}
let renderer: ReactTestRenderer;
const cameras = () => renderer.root.findAll((n) => n.type === ("Camera" as never));
const text = () => JSON.stringify(renderer.toJSON());
const press = (label: string) =>
  act(async () => {
    await renderer.root
      .find((n) => n.type === ("Button" as never) && n.props.label === label)
      .props.onPress();
  });
beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(1000);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockPermission = true;
  mockSupported = true;
  jest.clearAllMocks();
  await act(async () => {
    renderer = create(<DistanceSetup onContinue={mockContinue} />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.useRealTimers();
});
test("opt-in reads one face's depth, releases frames and preserves native output identity", async () => {
  expect(cameras()).toHaveLength(0);
  await press(copy.open);
  const target = face(),
    frame = depth();
  await act(async () => {
    mockFaces([target as unknown as ScannedObject]);
    mockDepth(frame as unknown as Depth);
  });
  expect(text()).toContain("≈ 2.4 м");
  expect(frame.dispose).toHaveBeenCalledTimes(1);
  expect(target.dispose).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(400));
  expect(mockCreateDepth).toHaveBeenCalledTimes(1);
  expect(mockCreateFaces).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(400));
  expect(text()).not.toContain("≈ 2.4 м");
});
test("backgrounding clears readings and stale callbacks cannot restore them", async () => {
  await press(copy.open);
  const oldDepth = mockDepth,
    target = face();
  await act(async () => {
    mockFaces([target as unknown as ScannedObject]);
    mockDepth(depth() as unknown as Depth);
  });
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
  await press(copy.open);
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
  await press(copy.open);
  await act(async () => jest.advanceTimersByTime(30_000));
  expect(cameras()).toHaveLength(0);
  expect(text()).toContain(copy.unavailable);
});
