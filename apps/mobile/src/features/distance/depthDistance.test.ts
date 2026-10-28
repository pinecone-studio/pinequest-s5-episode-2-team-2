import type { Depth } from "react-native-vision-camera";
import { personMetres, sampleMetres, singleFace } from "./depthDistance";

function map(value = 2.4) {
  const buffer = new ArrayBuffer(28 * 5),
    view = new DataView(buffer);
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) view.setFloat32(y * 28 + x * 4, value, true);
  return { buffer, view };
}
function frame() {
  const data = map();
  return {
    ...data,
    isValid: true,
    depthDataAccuracy: "absolute",
    depthDataQuality: "high",
    pixelFormat: "depth-32-bit",
    width: 5,
    height: 5,
    bytesPerRow: 28,
    availableDepthPixelFormats: ["depth-32-bit"],
    getDepthData: () => data.buffer,
    convertCameraPointToDepthPoint: jest.fn((p: { x: number; y: number }) => ({
      x: p.x * 4,
      y: p.y * 4,
    })),
    convert: jest.fn(),
    dispose: jest.fn(),
  };
}
const target = { x: 0.5, y: 0.5, halfWidth: 0.4, halfHeight: 0.4, at: 1000 };
test("median reads float32 metres through padded rows and rejects a single outlier", () => {
  const { buffer, view } = map();
  view.setFloat32(2 * 28 + 2 * 4, 100, true);
  expect(sampleMetres(buffer, 5, 5, 28, 2, 2)).toBeCloseTo(2.4);
  expect(sampleMetres(buffer, 5, 5, 28, 0, 0)).toBeNull();
  expect(sampleMetres(buffer, 5, 5, 16, 2, 2)).toBeNull();
  expect(sampleMetres(new ArrayBuffer(4), 5, 5, 28, 2, 2)).toBeNull();
});
test("too few valid samples cannot become zero metres or a misleading distance", () => {
  const { buffer, view } = map(NaN);
  view.setFloat32(2 * 28 + 2 * 4, 3, true);
  expect(sampleMetres(buffer, 5, 5, 28, 2, 2)).toBeNull();
  expect(sampleMetres(map(0).buffer, 5, 5, 28, 2, 2)).toBeNull();
  expect(sampleMetres(map(Infinity).buffer, 5, 5, 28, 2, 2)).toBeNull();
});
test("only current absolute high-quality depth can be displayed as metres", () => {
  const depth = frame();
  expect(personMetres(depth as unknown as Depth, target, 1200)).toBeCloseTo(2.4);
  expect(depth.convertCameraPointToDepthPoint).toHaveBeenCalledWith({ x: 0.5, y: 0.5 });
  for (const change of [
    { isValid: false },
    { depthDataAccuracy: "relative" },
    { depthDataQuality: "low" },
  ])
    expect(personMetres({ ...depth, ...change } as unknown as Depth, target, 1200)).toBeNull();
  expect(personMetres(depth as unknown as Depth, null, 1200)).toBeNull();
  expect(personMetres(depth as unknown as Depth, target, 1751)).toBeNull();
  expect(personMetres(depth as unknown as Depth, target, 900)).toBeNull();
});
test("native disparity conversion is released without disposing the caller's raw frame", () => {
  const raw = frame(),
    converted = frame();
  raw.pixelFormat = "disparity-16-bit";
  raw.convert.mockReturnValue(converted);
  expect(personMetres(raw as unknown as Depth, target, 1200)).toBeCloseTo(2.4);
  expect(converted.dispose).toHaveBeenCalledTimes(1);
  expect(raw.dispose).not.toHaveBeenCalled();
  raw.availableDepthPixelFormats = [];
  expect(personMetres(raw as unknown as Depth, target, 1200)).toBeNull();
});
test("exactly one valid face supplies a target, never an ambiguous scene", () => {
  const face = { type: "face" as const, boundingBox: { x: 0.2, y: 0.1, width: 0.4, height: 0.6 } };
  expect(singleFace([face], 1000)).toEqual({
    x: 0.4,
    y: 0.4,
    halfWidth: 0.2,
    halfHeight: 0.3,
    at: 1000,
  });
  expect(singleFace([], 1000)).toBeNull();
  expect(singleFace([face, face], 1000)).toBeNull();
  expect(singleFace([{ ...face, boundingBox: { ...face.boundingBox, x: -1 } }], 1000)).toBeNull();
});

test("a face smaller than the sampling patch cannot measure the background instead", () => {
  expect(
    personMetres(frame() as unknown as Depth, { ...target, halfWidth: 0.1, halfHeight: 0.1 }, 1200),
  ).toBeNull();
});

test("sub-display-resolution depth cannot appear as a valid zero metres", () => {
  const tiny = frame();
  tiny.buffer = map(0.01).buffer;
  tiny.getDepthData = () => tiny.buffer;
  expect(personMetres(tiny as unknown as Depth, target, 1200)).toBeNull();
});
