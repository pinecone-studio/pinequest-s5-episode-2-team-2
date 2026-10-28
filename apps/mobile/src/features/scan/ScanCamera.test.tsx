import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import type { CameraDevice } from "react-native-vision-camera";
import type { LandmarkFrame } from "../vision/facePipeline";
import { ScanCamera } from "./ScanCamera";

const mockReports: ((frame: LandmarkFrame) => void)[] = [];
jest.mock("../vision/useLandmarks", () => ({
  useLandmarks: (report: (frame: LandmarkFrame) => void) => {
    mockReports.push(report);
    return { output: {}, ready: true };
  },
}));
jest.mock("react-native-vision-camera", () => ({ Camera: "Camera" }));
jest.mock("react-native", () => ({
  View: "View",
  StyleSheet: { absoluteFill: {}, create: (styles: unknown) => styles },
}));
jest.mock("./LiveGuidance", () => ({ LiveGuidance: "LiveGuidance" }));
jest.mock("../vision/LandmarkOverlay", () => ({ LandmarkOverlay: "LandmarkOverlay" }));
jest.mock("../measurement/MeasurementOverlay", () => ({
  MeasurementOverlay: "MeasurementOverlay",
}));
jest.mock("../measurement/debug", () => ({
  measurementDebugEnabled: () => false,
  measurementOverlayProps: () => ({}),
}));

const frame: LandmarkFrame = {
  faceCount: 1,
  landmarks: [],
  frameSize: { width: 3840, height: 2160 },
  timestampMs: 100,
  latencyMs: 10,
};
const device = {} as CameraDevice;
let renderer: ReactTestRenderer;
const camera = (onFrame?: (f: LandmarkFrame) => void) => (
  <ScanCamera device={device} torchOn onReady={() => {}} onFailure={() => {}} onFrame={onFrame} />
);
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockReports.length = 0;
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("passes every analysed frame to the latest listener without restarting analysis", async () => {
  const first = jest.fn();
  const second = jest.fn();
  await act(async () => {
    renderer = create(camera(first));
  });
  await act(async () => mockReports.at(-1)!(frame));
  expect(first).toHaveBeenCalledWith(frame);

  await act(async () => renderer.update(camera(second)));
  expect(new Set(mockReports).size).toBe(1);
  await act(async () => mockReports.at(-1)!(frame));
  expect(second).toHaveBeenCalledWith(frame);
  expect(first).toHaveBeenCalledTimes(1);
});

test("works without a listener and ignores frames after unmount", async () => {
  const listener = jest.fn();
  await act(async () => {
    renderer = create(camera());
  });
  await act(async () => mockReports.at(-1)!(frame));
  await act(async () => renderer.update(camera(listener)));
  const report = mockReports.at(-1)!;
  await act(async () => renderer.unmount());
  report(frame);
  expect(listener).not.toHaveBeenCalled();
});
