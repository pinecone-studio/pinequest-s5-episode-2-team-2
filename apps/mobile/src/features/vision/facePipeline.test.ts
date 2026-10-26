import { inferLandmarks } from "./facePipeline";

const rgb = new Float32Array(512 * 512 * 3).fill(0.5);
function models() {
  const boxes = new Float32Array(896 * 16);
  boxes.set([60, 60, 40, 40, 50, 55, 70, 55]);
  const scores = new Float32Array(896).fill(-100);
  scores[0] = 4;
  const points = new Float32Array(1434);
  for (let i = 0; i < 478; i++) points.set([128, 128, 0], i * 3);
  const presence = new Float32Array([8]);
  const detector = {
    runSync: jest.fn<ArrayBuffer[], [ArrayBuffer[]]>(() => [boxes.buffer, scores.buffer]),
  };
  const mesh = {
    runSync: jest.fn<ArrayBuffer[], [ArrayBuffer[]]>(() => [
      points.buffer,
      presence.buffer,
      new Float32Array([0]).buffer,
    ]),
  };
  return { detector, mesh, boxes, scores, presence, points };
}

test("normalizes RGB separately for each model and maps all 478 points back to 4K", () => {
  const { detector, mesh } = models();
  const result = inferLandmarks(rgb, detector, mesh, 3840, 2160);
  expect(new Float32Array(detector.runSync.mock.calls[0]![0]![0]!)[0]).toBe(0);
  expect(new Float32Array(mesh.runSync.mock.calls[0]![0]![0]!)[0]).toBeCloseTo(0.5);
  expect(result.faceCount).toBe(1);
  expect(result.landmarks).toHaveLength(478);
  expect(result.landmarks[0]!.x).toBeCloseTo((60 / 128 + 0.5 / 16) * 3840);
  expect(result.landmarks[0]!.y).toBeCloseTo((60 / 128 + 0.5 / 16) * 3840 - 840);
});

test("no face and multiple faces do not run the landmark model", () => {
  const { detector, mesh, boxes, scores } = models();
  scores.fill(-100);
  expect(inferLandmarks(rgb, detector, mesh, 3840, 2160).landmarks).toEqual([]);
  expect(mesh.runSync).not.toHaveBeenCalled();
  scores[0] = 4;
  scores[895] = 4;
  boxes.set([60, 60, 40, 40, 50, 55, 70, 55], 895 * 16);
  expect(inferLandmarks(rgb, detector, mesh, 3840, 2160).faceCount).toBe(2);
  expect(mesh.runSync).not.toHaveBeenCalled();
});

test("low presence and invalid model data never produce usable landmarks", () => {
  const { detector, mesh, presence, points } = models();
  presence[0] = -1;
  expect(inferLandmarks(rgb, detector, mesh, 3840, 2160).faceCount).toBe(0);
  presence[0] = 8;
  points[0] = NaN;
  expect(() => inferLandmarks(rgb, detector, mesh, 3840, 2160)).toThrow("Invalid landmarks");
  mesh.runSync.mockReturnValue([]);
  expect(() => inferLandmarks(rgb, detector, mesh, 3840, 2160)).toThrow(
    "Unexpected landmark outputs",
  );
});
