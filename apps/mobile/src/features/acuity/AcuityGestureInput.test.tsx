import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { AcuityGestureInput } from "./AcuityGestureInput";
import { acuityCopy as copy } from "./copy";
import type { GestureFrame } from "./useGestureFrames";
const mockAnswer = jest.fn(),
  mockRequest = jest.fn();
let mockPalm = false;
let mockPermission = true,
  mockCanRequest = true,
  mockFocused = true,
  round = "practice-1";
let mockStateListener: (state: string) => void, mockReport: (frame: GestureFrame) => void;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (value: unknown) => value },
  AppState: {
    currentState: "active",
    addEventListener: (_: string, listener: typeof mockStateListener) => {
      mockStateListener = listener;
      return { remove: jest.fn() };
    },
  },
  Linking: { openSettings: jest.fn() },
}));
jest.mock("../../components/ui", () => ({ Button: "Button", Text: "Text" }));
jest.mock("react-native-vision-camera", () => ({
  Camera: "Camera",
  useCameraDevice: () => ({ id: "front" }),
  useCameraPermission: () => ({
    hasPermission: mockPermission,
    canRequestPermission: mockCanRequest,
    requestPermission: mockRequest,
  }),
}));
jest.mock("./useGestureFrames", () => ({
  useGestureFrames: (_: string, listener: typeof mockReport) => {
    mockReport = listener;
    return { output: {}, ready: true };
  },
}));
jest.mock("./gestures", () => ({
  openPalm: () => mockPalm,
  pointing: () => 0,
  thumbsUp: () => false,
}));
let renderer: ReactTestRenderer;
function Harness() {
  return (
    <AcuityGestureInput
      round={round}
      cover={false}
      onAnswer={mockAnswer}
      manual={"touch controls"}
    />
  );
}
const cameras = () => renderer.root.findAll((n) => n.type === ("Camera" as never));
const press = async (label: string) =>
  act(async () => {
    await renderer.root
      .find((n) => n.type === ("Button" as never) && n.props.label === label)
      .props.onPress();
  });
const frame = (timestampMs: number, hand = true): GestureFrame => ({
  timestampMs,
  hand: hand ? [{ x: 0.5, y: 0.5 }] : [],
  body: true,
  latencyMs: 20,
});
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockAnswer.mockReset();
  mockRequest.mockReset();
  mockPermission = true;
  mockCanRequest = true;
  mockPalm = false;
  mockFocused = true;
  round = "practice-1";
  await act(async () => {
    renderer = create(<Harness />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});
const text = () => JSON.stringify(renderer.toJSON());
test("the camera answers from the start, with no touch controls or toggle", async () => {
  expect(cameras()).toHaveLength(1);
  expect(text()).not.toContain("touch controls");
  expect(text()).not.toContain(copy.gesture.unavailable);
  expect(renderer.root.findAll((n) => n.type === ("Button" as never))).toHaveLength(0);
  expect(mockRequest).not.toHaveBeenCalled();
});
test("without permission it asks once; denial leaves touch controls and a retry", async () => {
  await act(async () => renderer.unmount());
  mockPermission = false;
  await act(async () => {
    renderer = create(<Harness />);
  });
  expect(mockRequest).toHaveBeenCalledTimes(1);
  await act(async () => renderer.update(<Harness />));
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(cameras()).toHaveLength(0);
  expect(text()).toContain("touch controls");
  expect(text()).toContain(copy.gesture.unavailable);
  await press(copy.gesture.retry);
  expect(mockRequest).toHaveBeenCalledTimes(2);
});
test("a permanent denial shows touch controls without asking", async () => {
  await act(async () => renderer.unmount());
  mockPermission = false;
  mockCanRequest = false;
  await act(async () => {
    renderer = create(<Harness />);
  });
  expect(mockRequest).not.toHaveBeenCalled();
  expect(text()).toContain("touch controls");
  expect(text()).toContain(copy.gesture.unavailable);
});
test("backgrounding and navigation tear down capture and suppress old callbacks", async () => {
  expect(cameras()).toHaveLength(1);
  const oldReport = mockReport;
  await act(async () => mockStateListener("background"));
  expect(cameras()).toHaveLength(0);
  act(() => {
    oldReport(frame(0, false));
    oldReport(frame(400, false));
    oldReport(frame(500));
    oldReport(frame(1100));
  });
  expect(mockAnswer).not.toHaveBeenCalled();
  await act(async () => mockStateListener("active"));
  expect(cameras()).toHaveLength(1);
  mockFocused = false;
  await act(async () => renderer.update(<Harness />));
  expect(cameras()).toHaveLength(0);
});
test("preview-ready observations submit once, then a new round needs a fresh release", async () => {
  await act(async () => {
    cameras()[0]!.props.onStarted();
    cameras()[0]!.props.onPreviewStarted();
  });
  await act(async () => {
    mockReport(frame(0, false));
    mockReport(frame(400, false));
    mockReport(frame(500));
    mockReport(frame(1100));
    mockReport(frame(1700));
  });
  expect(mockAnswer).toHaveBeenCalledTimes(1);
  expect(mockAnswer).toHaveBeenCalledWith(0);
  round = "practice-2";
  await act(async () => renderer.update(<Harness />));
  await act(async () => {
    mockReport(frame(1800));
    mockReport(frame(2400));
  });
  expect(mockAnswer).toHaveBeenCalledTimes(1);
  await act(async () => cameras()[0]!.props.onInterruptionStarted());
  expect(cameras()).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).toContain("touch controls");
});

test("an open palm rearms without answering; only the preview is mirrored", async () => {
  const camera = cameras()[0]!;
  expect(camera.props.mirrorMode).toBe("off");
  expect(camera.props.style).toEqual(expect.arrayContaining([{ transform: [{ scaleX: -1 }] }]));
  await act(async () => {
    camera.props.onStarted();
    camera.props.onPreviewStarted();
  });
  mockPalm = true;
  await act(async () => {
    mockReport(frame(0));
    mockReport(frame(600));
  });
  expect(mockAnswer).not.toHaveBeenCalled();
  mockPalm = false;
  await act(async () => {
    mockReport(frame(700));
    mockReport(frame(1400));
  });
  expect(mockAnswer).toHaveBeenCalledWith(0);
  expect(mockAnswer).toHaveBeenCalledTimes(1);
});

test("30 seconds without progressing pauses capture, while a new round renews the limit", async () => {
  jest.useFakeTimers();
  const oldReport = mockReport;
  await act(async () => jest.advanceTimersByTime(29_000));
  round = "practice-2";
  await act(async () => renderer.update(<Harness />));
  await act(async () => jest.advanceTimersByTime(29_999));
  expect(cameras()).toHaveLength(1);
  await act(async () => jest.advanceTimersByTime(1));
  expect(cameras()).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).toContain("touch controls");
  act(() => {
    oldReport(frame(0, false));
    oldReport(frame(400, false));
    oldReport(frame(500));
    oldReport(frame(1100));
  });
  expect(mockAnswer).not.toHaveBeenCalled();
  jest.useRealTimers();
});
