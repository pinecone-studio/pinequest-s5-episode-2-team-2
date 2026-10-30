import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { AcuityGestureInput } from "./AcuityGestureInput";
import type { Eye } from "./acuity";
import { acuityCopy as copy } from "./copy";
import type { CoverState } from "./cover";
import type { GestureFrame } from "./useGestureFrames";
const mockAnswer = jest.fn(),
  mockRequest = jest.fn(),
  mockStatus = jest.fn(),
  mockFramesEye = jest.fn();
let mockPalm = false,
  mockFist = false,
  mockThumb = false;
let mockPermission = true,
  mockCanRequest = true,
  mockFocused = true,
  round = "practice-1",
  cover = false,
  eye: Eye | null = null;
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
  useGestureFrames: (_: string, listener: typeof mockReport, __: unknown, tested: Eye | null) => {
    mockReport = listener;
    mockFramesEye(tested);
    return { output: {}, ready: true };
  },
}));
jest.mock("./gestures", () => ({
  openPalm: () => mockPalm,
  fist: () => mockFist,
  pointing: () => (mockPalm || mockFist ? null : 0),
  thumbsUp: () => mockThumb,
}));
let renderer: ReactTestRenderer;
function Harness() {
  return (
    <AcuityGestureInput
      round={round}
      cover={cover}
      eye={eye}
      onAnswer={mockAnswer}
      onStatus={mockStatus}
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
const frame = (
  timestampMs: number,
  hand = true,
  state: CoverState | null = null,
): GestureFrame => ({
  timestampMs,
  hand: hand ? [{ x: 0.5, y: 0.5 }] : [],
  body: true,
  cover: state,
  latencyMs: 20,
});
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockAnswer.mockReset();
  mockRequest.mockReset();
  mockStatus.mockReset();
  mockFramesEye.mockReset();
  mockThumb = false;
  cover = false;
  eye = null;
  mockPermission = true;
  mockCanRequest = true;
  mockPalm = false;
  mockFist = false;
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
test("the camera answers from the start, with no toggle; the screen keeps its own buttons", async () => {
  expect(cameras()).toHaveLength(1);
  expect(text()).not.toContain(copy.gesture.unavailable);
  // Practice has no cover check.
  expect(mockFramesEye).toHaveBeenLastCalledWith(null);
  expect(renderer.root.findAll((n) => n.type === ("Button" as never))).toHaveLength(0);
  expect(mockRequest).not.toHaveBeenCalled();
});
test("without permission it asks once; denial leaves a note and a retry", async () => {
  await act(async () => renderer.unmount());
  mockPermission = false;
  await act(async () => {
    renderer = create(<Harness />);
  });
  expect(mockRequest).toHaveBeenCalledTimes(1);
  await act(async () => renderer.update(<Harness />));
  expect(mockRequest).toHaveBeenCalledTimes(1);
  expect(cameras()).toHaveLength(0);
  expect(text()).toContain(copy.gesture.unavailable);
  await press(copy.gesture.retry);
  expect(mockRequest).toHaveBeenCalledTimes(2);
});
test("a permanent denial shows the note without asking", async () => {
  await act(async () => renderer.unmount());
  mockPermission = false;
  mockCanRequest = false;
  await act(async () => {
    renderer = create(<Harness />);
  });
  expect(mockRequest).not.toHaveBeenCalled();
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
  expect(text()).toContain(copy.gesture.unavailable);
  expect(mockStatus).toHaveBeenLastCalledWith(null);
});

test("as in the web demo, a fist arms and an open palm answers can't see; only the preview is mirrored", async () => {
  const camera = cameras()[0]!;
  expect(camera.props.mirrorMode).toBe("off");
  expect(camera.props.style).toEqual(expect.arrayContaining([{ transform: [{ scaleX: -1 }] }]));
  await act(async () => {
    camera.props.onStarted();
    camera.props.onPreviewStarted();
  });
  // An open palm before arming is not an answer; the hint asks for a fist.
  mockPalm = true;
  await act(async () => {
    mockReport(frame(0));
    mockReport(frame(600));
  });
  expect(mockAnswer).not.toHaveBeenCalled();
  expect(text()).toContain(copy.gesture.fist);
  mockPalm = false;
  mockFist = true;
  await act(async () => mockReport(frame(700)));
  expect(text()).toContain(copy.gesture.point);
  mockFist = false;
  mockPalm = true;
  await act(async () => mockReport(frame(800)));
  expect(text()).toContain(copy.gesture.cant);
  await act(async () => mockReport(frame(1400)));
  expect(mockAnswer).toHaveBeenCalledWith("cant");
  expect(text()).toContain(copy.gesture.done);
  // The next answer needs a fist (or a lowered hand) first.
  mockPalm = false;
  await act(async () => {
    mockReport(frame(1500));
    mockReport(frame(2100));
  });
  expect(mockAnswer).toHaveBeenCalledTimes(1);
});

test("pointing shows the hold hint; a hand out of view for 400 ms asks to point, as on the web", async () => {
  await act(async () => {
    cameras()[0]!.props.onStarted();
    cameras()[0]!.props.onPreviewStarted();
  });
  await act(async () => {
    mockReport({ ...frame(0, false), body: false });
  });
  expect(text()).toContain(copy.gesture.fist);
  await act(async () => mockReport({ ...frame(400, false), body: false }));
  expect(text()).toContain(copy.gesture.point);
  round = "practice-2";
  await act(async () => renderer.update(<Harness />));
  mockFist = true;
  await act(async () => mockReport(frame(100)));
  mockFist = false;
  await act(async () => mockReport(frame(200)));
  expect(text()).toContain(copy.gesture.hold);
  // A hand found without a body (close to the phone) still answers.
  await act(async () => mockReport({ ...frame(800), body: false }));
  expect(mockAnswer).toHaveBeenCalledWith(0);
  // The screen hears what is being held, to light up that arrow.
  expect(mockStatus).toHaveBeenCalledWith({ cover: "noBody", paused: false, detected: 0 });
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
  expect(text()).toContain(copy.gesture.unavailable);
  act(() => {
    oldReport(frame(0, false));
    oldReport(frame(400, false));
    oldReport(frame(500));
    oldReport(frame(1100));
  });
  expect(mockAnswer).not.toHaveBeenCalled();
  jest.useRealTimers();
});

async function start() {
  await act(async () => renderer.update(<Harness />));
  await act(async () => {
    cameras()[0]!.props.onStarted();
    cameras()[0]!.props.onPreviewStarted();
  });
}

test("on the cover screen the thumbs-up counts only once the other eye reads covered 3 times", async () => {
  cover = true;
  eye = "right";
  round = "cover-right";
  await start();
  expect(mockFramesEye).toHaveBeenLastCalledWith("right");
  mockThumb = true;
  // The eye is open: the thumbs-up is ignored however long it is held.
  await act(async () => {
    for (let t = 0; t <= 1200; t += 200) mockReport(frame(t, true, "open"));
  });
  expect(mockAnswer).not.toHaveBeenCalled();
  expect(mockStatus).toHaveBeenLastCalledWith({ cover: "open", paused: false, detected: null });
  await act(async () => {
    for (let t = 1400; t <= 2200; t += 200) mockReport(frame(t, true, "covered"));
  });
  expect(mockStatus).toHaveBeenCalledWith({ cover: "covered", paused: false, detected: "ready" });
  // Covered from the third reading (1800), held 800 ms from there.
  expect(mockAnswer).not.toHaveBeenCalled();
  await act(async () => mockReport(frame(2600, true, "covered")));
  expect(mockAnswer).toHaveBeenCalledWith("ready");
});

test("during the test an eye open for over a second pauses answers until it is covered again", async () => {
  eye = "left";
  round = "test-left-1";
  await start();
  mockFist = true;
  await act(async () => {
    for (let t = 0; t <= 400; t += 200) mockReport(frame(t, true, "covered"));
    // The eye opens: it reads open from the third reading (1000), and pauses a second later.
    for (let t = 600; t <= 2000; t += 200) mockReport(frame(t, true, "open"));
  });
  expect(mockStatus).toHaveBeenLastCalledWith({ cover: "open", paused: true, detected: null });
  mockFist = false;
  await act(async () => {
    for (let t = 2200; t <= 3000; t += 200) mockReport(frame(t, true, "open"));
  });
  expect(mockAnswer).not.toHaveBeenCalled();
  expect(text()).toContain(copy.gesture.cover);
  await act(async () => {
    for (let t = 3200; t <= 3600; t += 200) mockReport(frame(t, true, "covered"));
  });
  expect(text()).not.toContain(copy.gesture.cover);
  expect(mockAnswer).not.toHaveBeenCalled();
  await act(async () => mockReport(frame(4200, true, "covered")));
  expect(mockAnswer).toHaveBeenCalledWith(0);
});
