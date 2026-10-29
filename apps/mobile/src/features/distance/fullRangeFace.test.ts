import type { Frame } from "react-native-vision-camera";
import { fullRangeTarget } from "./fullRangeFace";
import { decodeFaces } from "../vision/faceMath";
function outputs(faces: { i: number; x: number; y: number; size: number; score?: number }[]) {
  const boxes = new Float32Array(2304 * 16),
    scores = new Float32Array(2304).fill(-100);
  for (const f of faces) {
    const ax = ((f.i % 48) + 0.5) / 48,
      ay = (Math.floor(f.i / 48) + 0.5) / 48;
    boxes.set(
      [(f.x - ax) * 192, (f.y - ay) * 192, f.size * 192, f.size * 192, 0, 0, 0, 0],
      f.i * 16,
    );
    scores[f.i] = f.score ?? 10;
  }
  return [boxes.buffer, scores.buffer];
}
function frame(rotated = false) {
  return {
    width: 960,
    height: 1280,
    orientation: "up",
    isMirrored: false,
    convertFramePointToCameraPoint: jest.fn((p: { x: number; y: number }) =>
      rotated ? { x: p.y / 1280, y: 1 - p.x / 960 } : { x: p.x / 960, y: p.y / 1280 },
    ),
  };
}
const rgb = new Float32Array(192 * 192 * 3);
test("full-range stride-4 anchors, 192 scaling and native camera conversion locate a small face", () => {
  const model = {
    runSync: jest.fn((_input: ArrayBuffer[]) => outputs([{ i: 1176, x: 0.5, y: 0.5, size: 0.08 }])),
  };
  for (const rotated of [false, true]) {
    const f = frame(rotated),
      result = fullRangeTarget(f as unknown as Frame, rgb, model, 1000);
    expect(result.count).toBe(1);
    expect(result.target?.x).toBeCloseTo(0.5);
    expect(result.target?.y).toBeCloseTo(0.5);
    expect(result.target?.halfWidth).toBeCloseTo(rotated ? 0.04 : 0.053333);
    expect(result.target?.halfHeight).toBeCloseTo(rotated ? 0.053333 : 0.04);
    expect(f.convertFramePointToCameraPoint).toHaveBeenCalledTimes(4);
  }
  expect(new Float32Array(model.runSync.mock.calls[0]![0]![0]!)[0]).toBe(-1);
});
test("NMS merges duplicates without turning two faces into one target", () => {
  const faces = [
    { i: 1176, x: 0.5, y: 0.3, size: 0.08 },
    { i: 1177, x: 0.5, y: 0.3, size: 0.08 },
  ];
  const model = { runSync: () => outputs(faces) };
  expect(fullRangeTarget(frame() as unknown as Frame, rgb, model, 1).count).toBe(1);
  faces.push({ i: 2000, x: 0.5, y: 0.8, size: 0.08 });
  expect(fullRangeTarget(frame() as unknown as Frame, rgb, model, 1)).toEqual({
    target: null,
    count: 2,
  });
});
test("no face, below graph confidence, cropped face or wrong tensors cannot supply a target", () => {
  for (const faces of [
    [],
    [{ i: 1176, x: 0.5, y: 0.5, size: 0.08, score: 0 }],
    [{ i: 0, x: 0.01, y: 0.5, size: 0.08 }],
  ])
    expect(
      fullRangeTarget(frame() as unknown as Frame, rgb, { runSync: () => outputs(faces) }, 1)
        .target,
    ).toBeNull();
  expect(() => decodeFaces(new Float32Array(896 * 16), new Float32Array(896), true)).toThrow(
    "tensors",
  );
  expect(() =>
    fullRangeTarget(
      { ...frame(), isMirrored: true } as unknown as Frame,
      rgb,
      { runSync: () => [] },
      1,
    ),
  ).toThrow("distance frame");
});
