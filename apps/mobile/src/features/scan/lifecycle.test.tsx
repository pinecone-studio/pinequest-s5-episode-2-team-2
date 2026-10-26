import { act, createElement } from "react";
import type * as ReactModule from "react";
import { create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import type { ScanResult } from "@app/core";
import ScanScreen from "./ScanScreen";
import { ScanResultProvider, useScanResult } from "./ScanResultContext";
import { mockFrameQuality } from "@app/core";
import type { LandmarkFrame } from "../vision/facePipeline";
import type { EyePrediction } from "../vision/eyeCrops";
import { SCAN_POLICY_VERSION } from "./scanPolicy";

const mockListeners = new Set<(state: string) => void>();
const mockPush = jest.fn();
const mockCloseCamera = jest.fn();
const mockSettings = jest.fn();
const mockRequestPermission = jest.fn();
const mockSave = jest.fn<Promise<void>, [unknown, ScanResult]>();
const mockDb = {};
let mockChildId: string | null | undefined;
let mockReport: (frame: LandmarkFrame) => void;
let mockFocused = true;
let mockModelsReady = true;
jest.mock("../vision/useLandmarks", () => ({
  useLandmarks: (report: (frame: LandmarkFrame) => void) => {
    mockReport = report;
    return { output: {}, ready: mockModelsReady };
  },
}));
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
jest.mock("../children/useActiveChildId", () => ({ useActiveChildId: () => mockChildId }));
jest.mock("../../storage/sessions", () => ({
  saveSession: (db: unknown, result: ScanResult) => mockSave(db, result),
}));
const mockPermission = {
  hasPermission: true,
  canRequestPermission: false,
  requestPermission: mockRequestPermission,
};

jest.mock("../../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Screen: "Screen",
  Text: "Text",
}));
jest.mock("react-native", () => ({
  View: "View",
  ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
  Linking: { openSettings: () => mockSettings() },
  AppState: {
    currentState: "active",
    addEventListener: (_name: string, listener: (state: string) => void) => {
      mockListeners.add(listener);
      return { remove: () => mockListeners.delete(listener) };
    },
  },
}));
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useIsFocused: () => mockFocused,
  useFocusEffect: (effect: () => void) => {
    const React = jest.requireActual<typeof ReactModule>("react");
    React.useEffect(() => (mockFocused ? effect() : undefined), [effect, mockFocused]);
  },
}));
jest.mock("react-native-vision-camera", () => ({
  useCameraDevice: () => ({ hasTorch: true }),
  useCameraPermission: () => mockPermission,
  Camera: (props: Record<string, unknown>) => {
    const React = jest.requireActual<typeof ReactModule>("react");
    React.useEffect(() => () => mockCloseCamera(), []);
    return React.createElement("Camera", props);
  },
}));
let renderer: ReactTestRenderer;
function ResultProbe() {
  return createElement("ResultProbe", useScanResult());
}
const screen = () => (
  <ScanResultProvider>
    <ScanScreen />
    <ResultProbe />
  </ScanResultProvider>
);
const nodes = (type: string) => renderer.root.findAll((node) => node.type === type);
const camera = () => nodes("Camera")[0]!;
const button = (label: string) => nodes("Button").find((node) => node.props.label.includes(label))!;
const press = async (label: string) => {
  await act(async () => {
    button(label).props.onPress();
  });
};
const background = async (state = "background") => {
  await act(async () => {
    mockListeners.forEach((listener) => listener(state));
  });
};
const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
const start = async () => {
  await act(async () => {
    camera().props.onStarted();
    camera().props.onPreviewStarted();
  });
  await press("Бэлтгэх");
  await press("3 секунд");
};

function measuredFrame(asymmetry = 0, overrides: Partial<LandmarkFrame> = {}): LandmarkFrame {
  const eye = (side: EyePrediction["side"], x: number): EyePrediction => ({
    side,
    irisCenter: { x, y: 500 },
    irisRadius: 40,
    reflex: { x: x + asymmetry * 20, y: 500 },
    reflexVisibleProbability: 0.9,
    crop: { side, x: x - 100, y: 400, size: 200 },
  });
  return {
    timestampMs: 0,
    latencyMs: 10,
    frameSize: { width: 3840, height: 2160 },
    faceCount: 1,
    landmarks: [],
    quality: mockFrameQuality(),
    eyes: [eye("imageLeft", 430), eye("imageRight", 570)],
    eyeFailure: null,
    ...overrides,
  };
}
async function frames(...values: LandmarkFrame[]) {
  await act(async () => values.forEach((frame) => mockReport(frame)));
}

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
  jest.resetAllMocks();
  mockFocused = true;
  mockModelsReady = true;
  mockPermission.hasPermission = true;
  mockPermission.canRequestPermission = false;
  mockChildId = "child-1";
  mockSave.mockResolvedValue(undefined);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await act(async () => {
    renderer = create(screen());
  });
});

afterEach(async () => {
  await act(async () => {
    renderer.unmount();
  });
  expect(mockListeners.size).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});

test("double start taps keep one timer and produce only one result after three seconds", async () => {
  await act(async () => {
    camera().props.onStarted();
    camera().props.onPreviewStarted();
  });
  await press("Бэлтгэх");
  const begin = button("3 секунд").props.onPress;
  await act(async () => {
    begin();
    begin();
  });
  expect(camera().props.torchMode).toBe("on");
  await advance(2999);
  expect(mockSave).not.toHaveBeenCalled();
  await advance(101);
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(nodes("Camera")).toHaveLength(0);
  expect(mockCloseCamera).toHaveBeenCalledTimes(1);
});

test.each(["inactive", "background"])(
  "%s cancels capture and does not restart it on return",
  async (state) => {
    await start();
    await advance(1000);
    await background(state);
    expect(nodes("Camera")).toHaveLength(0);
    await background("active");
    await advance(5000);
    expect(camera().props.torchMode).toBe("off");
    expect(button("Бэлтгэх").props.disabled).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
  },
);

test("native callbacks from a closed preview cannot mark its replacement ready", async () => {
  const oldCamera = camera().props;
  await start();
  await background();
  await act(async () => {
    oldCamera.onStarted();
    oldCamera.onPreviewStarted();
    oldCamera.onError(new Error("late"));
  });
  await background("active");
  expect(button("Бэлтгэх").props.disabled).toBe(true);
  await act(async () => {
    camera().props.onStarted();
    camera().props.onPreviewStarted();
  });
  expect(button("Бэлтгэх").props.disabled).toBe(false);
});

test.each([
  "video-device-in-use-by-another-client",
  "video-device-not-available-due-to-system-pressure",
])("%s stops the camera; retry waits for a fresh session", async (reason) => {
  await start();
  await act(async () => {
    camera().props.onInterruptionStarted(reason);
  });
  expect(nodes("Camera")).toHaveLength(0);
  await press("Дахин оролдох");
  expect(button("3 секунд").props.disabled).toBe(true);
  await act(async () => {
    camera().props.onStarted();
    camera().props.onPreviewStarted();
  });
  await press("3 секунд");
  await advance(3100);
  expect(mockPush).toHaveBeenCalledTimes(1);
});

test.each(["onStopped", "onPreviewStopped", "onError"])(
  "%s stops an interrupted scan",
  async (event) => {
    await start();
    await act(async () => {
      camera().props[event]();
    });
    expect(nodes("Camera")).toHaveLength(0);
    expect(button("Дахин оролдох")).toBeDefined();
    await advance(5000);
    expect(mockPush).not.toHaveBeenCalled();
  },
);

test("permission denial offers Settings; duplicate permission taps issue one request", async () => {
  mockPermission.hasPermission = false;
  await act(async () => {
    renderer.update(screen());
  });
  expect(nodes("Camera")).toHaveLength(0);
  await press("Тохиргоо нээх");
  expect(mockSettings).toHaveBeenCalledTimes(1);
  mockPermission.canRequestPermission = true;
  let complete!: (granted: boolean) => void;
  mockRequestPermission.mockImplementation(
    () =>
      new Promise<boolean>((resolve) => {
        complete = resolve;
      }),
  );
  await act(async () => {
    renderer.update(screen());
  });
  const request = button("Камерын зөвшөөрөл өгөх").props.onPress;
  await act(async () => {
    request();
    request();
  });
  expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  await act(async () => {
    complete(false);
  });
});

test("leaving the tab suppresses navigation after a pending save completes", async () => {
  let complete!: () => void;
  mockSave.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  await start();
  await advance(3100);
  expect(nodes("Camera")).toHaveLength(0);
  mockFocused = false;
  await act(async () => {
    renderer.update(screen());
  });
  await act(async () => {
    complete();
  });
  expect(mockPush).not.toHaveBeenCalled();
});

test("revoked permission cancels capture and requires a fresh preview after restoration", async () => {
  await start();
  mockPermission.hasPermission = false;
  await act(async () => {
    renderer.update(screen());
  });
  expect(nodes("Camera")).toHaveLength(0);
  await advance(5000);
  expect(mockSave).not.toHaveBeenCalled();
  mockPermission.hasPermission = true;
  await act(async () => {
    renderer.update(screen());
  });
  expect(button("Бэлтгэх").props.disabled).toBe(true);
  expect(camera().props.torchMode).toBe("off");
});

test("failed permission requests release the tap guard so the user can retry", async () => {
  mockPermission.hasPermission = false;
  mockPermission.canRequestPermission = true;
  mockRequestPermission.mockRejectedValueOnce(new Error("unavailable"));
  mockRequestPermission.mockResolvedValueOnce(false);
  await act(async () => {
    renderer.update(screen());
  });
  await press("Камерын зөвшөөрөл өгөх");
  expect(button("Камерын зөвшөөрөл өгөх").props.disabled).toBe(false);
  expect(nodes("Text").some((node) => node.props.accessibilityRole === "alert")).toBe(true);
  await press("Камерын зөвшөөрөл өгөх");
  expect(mockRequestPermission).toHaveBeenCalledTimes(2);
});

test("a delayed JS tick completes once using elapsed time", async () => {
  await start();
  const clock = jest.spyOn(performance, "now").mockReturnValue(performance.now() + 10000);
  await frames(...Array.from({ length: 5 }, () => measuredFrame()));
  await advance(100);
  clock.mockRestore();
  expect(mockSave).toHaveBeenCalledTimes(1);
  expect(mockSave.mock.calls[0]![1].summary.framesTotal).toBe(0);
  expect(mockPush).toHaveBeenCalledTimes(1);
});

test("a started preview waits until the landmark models are ready", async () => {
  mockModelsReady = false;
  await act(async () => renderer.update(screen()));
  await act(async () => {
    camera().props.onStarted();
    camera().props.onPreviewStarted();
  });
  expect(button("Бэлтгэх").props.disabled).toBe(true);
  mockModelsReady = true;
  await act(async () => renderer.update(screen()));
  expect(button("Бэлтгэх").props.disabled).toBe(false);
});

test("session start alone cannot enable scanning before the preview starts", async () => {
  await act(async () => camera().props.onStarted());
  expect(button("Бэлтгэх").props.disabled).toBe(true);
  await act(async () => camera().props.onPreviewStarted());
  expect(button("Бэлтгэх").props.disabled).toBe(false);
});

test.each([
  ["NO_VISIBLE_SIGN", 0],
  ["REFER", 0.3],
] as const)(
  "measured frames produce and save %s with the child selected at start",
  async (outcome, asymmetry) => {
    await frames(measuredFrame()); // Preview/aligning frames do not belong to a scan.
    await start();
    await frames(...Array.from({ length: 5 }, () => measuredFrame(asymmetry)));
    mockChildId = "child-2";
    await act(async () => renderer.update(screen()));
    await advance(3100);
    const [db, result] = mockSave.mock.calls[0]!;
    expect(db).toBe(mockDb);
    expect(result).toMatchObject({
      outcome,
      childId: "child-1",
      policyVersion: SCAN_POLICY_VERSION,
      summary: { framesTotal: 5, framesUsed: 5 },
    });
    expect(result.id).not.toContain("mock");
    expect(nodes("ResultProbe")[0]!.props.result).toBe(result);
    expect(nodes("ResultProbe")[0]!.props.eyes).toHaveLength(2);
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  },
);

test("too few usable frames saves RETAKE rather than a successful assessment", async () => {
  await start();
  await frames(
    measuredFrame(),
    measuredFrame(0, {
      quality: mockFrameQuality({ ok: false, reasons: ["BLUR"] }),
    }),
  );
  await advance(3100);
  expect(mockSave.mock.calls[0]![1]).toMatchObject({
    outcome: "RETAKE",
    reasons: ["BLUR", "TOO_FEW_FRAMES"],
    summary: { framesTotal: 2, framesUsed: 1 },
  });
});

test("an aligning model failure does not contaminate the following scan", async () => {
  await act(async () => {
    camera().props.onStarted();
    camera().props.onPreviewStarted();
  });
  await press("Бэлтгэх");
  await frames(measuredFrame(0, { eyes: null, eyeFailure: "MODEL_UNAVAILABLE" }));
  await press("3 секунд");
  await frames(
    measuredFrame(0, {
      eyes: null,
      eyeFailure: "EYE_NOT_FOUND",
      quality: mockFrameQuality({ ok: false, reasons: ["NO_FACE"] }),
    }),
  );
  await advance(3100);
  expect(mockSave.mock.calls[0]![1]).toMatchObject({
    outcome: "RETAKE",
    reasons: ["NO_FACE", "TOO_FEW_FRAMES"],
    summary: { framesTotal: 1 },
    policyVersion: SCAN_POLICY_VERSION,
  });
});

test.each(["MODEL_UNAVAILABLE", "MODEL_ERROR"] as const)(
  "%s overrides good frames and hides measured eyes",
  async (eyeFailure) => {
    await start();
    await frames(
      measuredFrame(0, { eyeFailure, eyes: null }),
      ...Array.from({ length: 5 }, () => measuredFrame()),
    );
    await advance(3100);
    expect(mockSave.mock.calls[0]![1]).toMatchObject({
      outcome: "NOT_ASSESSED",
      reasons: [eyeFailure],
    });
    expect(nodes("ResultProbe")[0]!.props.eyes).toBeNull();
  },
);

test("cancelling discards frames and late callbacks before another scan", async () => {
  await start();
  await frames(...Array.from({ length: 5 }, () => measuredFrame()));
  const oldReport = mockReport;
  await background();
  await background("active");
  await start();
  await act(async () => oldReport(measuredFrame()));
  await advance(3100);
  expect(mockSave.mock.calls[0]![1]).toMatchObject({
    outcome: "RETAKE",
    summary: { framesTotal: 0 },
  });
});

test("waits for the selected child to load but permits unassigned scans", async () => {
  mockChildId = undefined;
  await act(async () => renderer.update(screen()));
  await start();
  expect(button("3 секунд").props.disabled).toBe(true);
  await advance(3100);
  expect(mockSave).not.toHaveBeenCalled();
  mockChildId = null;
  await act(async () => renderer.update(screen()));
  await press("3 секунд");
  await advance(3100);
  expect(mockSave.mock.calls[0]![1].childId).toBeNull();
});

test("a failed save keeps the result screen closed and lets the user retry", async () => {
  mockSave.mockRejectedValueOnce(new Error("disk full"));
  await start();
  await advance(3100);
  expect(mockPush).not.toHaveBeenCalled();
  expect(nodes("ResultProbe")[0]!.props.result).toBeNull();
  await press("Дахин оролдох");
  await act(async () => {
    camera().props.onStarted();
    camera().props.onPreviewStarted();
  });
  await press("3 секунд");
  await advance(3100);
  expect(mockSave).toHaveBeenCalledTimes(2);
  expect(mockSave.mock.calls[0]![1].id).not.toBe(mockSave.mock.calls[1]![1].id);
  expect(mockPush).toHaveBeenCalledTimes(1);
});
