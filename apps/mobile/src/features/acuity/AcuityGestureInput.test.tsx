import { act, useState } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { AcuityGestureInput } from "./AcuityGestureInput";
import { acuityCopy as copy } from "./copy";
import type { GestureFrame } from "./useGestureFrames";
const mockAnswer = jest.fn(),
  mockRequest = jest.fn();
let mockPermission = true,
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
    canRequestPermission: true,
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
  fist: () => false,
  openPalm: () => false,
  pointing: () => 0,
  thumbsUp: () => false,
}));
let renderer: ReactTestRenderer;
function Harness() {
  const [enabled, setEnabled] = useState(false);
  return (
    <AcuityGestureInput
      round={round}
      cover={false}
      enabled={enabled}
      setEnabled={setEnabled}
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
  mockFocused = true;
  round = "practice-1";
  await act(async () => {
    renderer = create(<Harness />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});
test("camera is opt-in; denial leaves touch controls and a retry", async () => {
  expect(cameras()).toHaveLength(0);
  mockPermission = false;
  await act(async () => renderer.update(<Harness />));
  await press(copy.gesture.enable);
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(cameras()).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).toContain("touch controls");
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.gesture.unavailable);
});
test("backgrounding and navigation tear down capture and suppress old callbacks", async () => {
  await press(copy.gesture.enable);
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
  await press(copy.gesture.enable);
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
