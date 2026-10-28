import { analyzeGestureFrame } from "./gestureFrame";
import type { Frame } from "react-native-vision-camera";

const mockPose = jest.fn(),
  mockRegion = jest.fn(),
  mockHand = jest.fn(),
  mockCrop = jest.fn();
jest.mock("./gesturePipeline", () => ({
  inferPose: (...args: unknown[]) => mockPose(...args),
  inferHand: (...args: unknown[]) => mockHand(...args),
}));
jest.mock("./gestures", () => ({ handRegion: (...args: unknown[]) => mockRegion(...args) }));
jest.mock("../vision/pixels", () => ({ cropPixels: (...args: unknown[]) => mockCrop(...args) }));
const models = {
  poseDetector: { runSync: jest.fn() },
  pose: { runSync: jest.fn() },
  palm: { runSync: jest.fn() },
  hand: { runSync: jest.fn() },
};
const rgb = new Float32Array(512 * 512 * 3);
function frame() {
  const y = new Uint8Array(84 * 100),
    uv = new Uint8Array(84 * 50);
  return {
    width: 80,
    height: 100,
    pixelFormat: "yuv-420-8-bit-full",
    orientation: "up",
    isMirrored: false,
    getPlanes: jest.fn(() => [
      { width: 80, height: 100, bytesPerRow: 84, getPixelBuffer: () => y.buffer },
      { width: 40, height: 50, bytesPerRow: 84, getPixelBuffer: () => uv.buffer },
    ]),
  };
}
beforeEach(() => {
  jest.resetAllMocks();
  mockPose.mockReturnValue([{ x: 0.5, y: 0.5 }]);
  mockRegion.mockReturnValue({ x: 10, y: 20, size: 32 });
  mockHand.mockReturnValue([{ x: 0.2, y: 0.3 }]);
  mockCrop.mockReturnValue(new Float32Array(256 * 256 * 3));
});
test("hand inference gets a 256 crop of native NV12 pixels with original row strides", () => {
  const input = frame();
  const result = analyzeGestureFrame(input as unknown as Frame, rgb, models);
  expect(result.body).toBe(true);
  expect(mockCrop).toHaveBeenCalledWith(
    expect.objectContaining({ width: 80, height: 100, yStride: 84, uvStride: 84 }),
    { x: 10, y: 20, size: 32 },
    256,
    true,
  );
  expect(mockHand).toHaveBeenCalledWith(mockCrop.mock.results[0]!.value, models.palm, models.hand);
});
test("no raised hand skips full-frame pixel reads and hand inference", () => {
  const input = frame();
  mockRegion.mockReturnValue(null);
  expect(analyzeGestureFrame(input as unknown as Frame, rgb, models)).toEqual({
    body: true,
    hand: [],
  });
  expect(input.getPlanes).not.toHaveBeenCalled();
  expect(mockHand).not.toHaveBeenCalled();
});
test("mirrored/rotated frames and invalid planes fail rather than reversing an answer", () => {
  expect(() =>
    analyzeGestureFrame({ ...frame(), isMirrored: true } as unknown as Frame, rgb, models),
  ).toThrow("orientation");
  const input = frame();
  input.getPlanes.mockReturnValue([]);
  expect(() => analyzeGestureFrame(input as unknown as Frame, rgb, models)).toThrow("planes");
});
