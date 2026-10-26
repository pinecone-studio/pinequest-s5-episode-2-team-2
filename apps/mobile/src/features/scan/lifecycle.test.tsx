import { act } from "react";
import type * as ReactModule from "react";
import { create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import type { ScanResult } from "@app/core";
import ScanScreen from "./ScanScreen";
import { ScanResultProvider } from "./ScanResultContext";

const mockListeners = new Set<(state: string) => void>();
const mockPush = jest.fn();
const mockCloseCamera = jest.fn();
const mockSettings = jest.fn();
const mockRequestPermission = jest.fn();
const mockAnalyze = jest.fn<ScanResult | Promise<ScanResult>, unknown[]>();
let mockFocused = true;
let mockModelsReady = true;
jest.mock("../vision/useLandmarks", () => ({
  useLandmarks: () => ({ output: {}, ready: mockModelsReady }),
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
jest.mock("@app/core", () => ({
  ...jest.requireActual("@app/core"),
  mockScanResult: (...args: unknown[]) => mockAnalyze(...args),
}));

let renderer: ReactTestRenderer;
const screen = () => (
  <ScanResultProvider>
    <ScanScreen />
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

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
  jest.resetAllMocks();
  mockFocused = true;
  mockModelsReady = true;
  mockPermission.hasPermission = true;
  mockPermission.canRequestPermission = false;
  mockAnalyze.mockImplementation(jest.requireActual("@app/core").mockScanResult);
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
  expect(mockAnalyze).not.toHaveBeenCalled();
  await advance(101);
  expect(mockAnalyze).toHaveBeenCalledTimes(1);
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

test("leaving the tab cancels a delayed analysis result", async () => {
  let complete!: (result: ScanResult) => void;
  mockAnalyze.mockImplementation(
    () =>
      new Promise<ScanResult>((resolve) => {
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
    complete(jest.requireActual("@app/core").mockScanResult("RETAKE"));
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
  expect(mockAnalyze).not.toHaveBeenCalled();
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
  await advance(100);
  clock.mockRestore();
  expect(mockAnalyze).toHaveBeenCalledTimes(1);
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
