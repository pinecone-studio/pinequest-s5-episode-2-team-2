import { eyeRegions, heuristicEyes, inferEyes } from "./eyeCrops";
import { cropPixels } from "./pixels";
import type { PixelSource } from "./pixels";

function landmarks(radius = 40) {
  const points = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  for (const [index, x] of [
    [468, 2000],
    [473, 1000],
  ]) {
    points[index!] = { x: x!, y: 1000 };
    points[index! + 1] = { x: x! + radius, y: 1000 };
    points[index! + 2] = { x: x!, y: 1000 + radius };
    points[index! + 3] = { x: x! - radius, y: 1000 };
    points[index! + 4] = { x: x!, y: 1000 - radius };
  }
  return points;
}

test("iris ordering, radius and crop rounding match the training pipeline", () => {
  expect(eyeRegions(landmarks())).toEqual([
    { side: "imageLeft", x: 900, y: 900, size: 200 },
    { side: "imageRight", x: 1900, y: 900, size: 200 },
  ]);
  expect(eyeRegions(landmarks(0.5))![0].size).toBe(2);
  expect(eyeRegions([])).toBeNull();
  expect(eyeRegions(landmarks(0))).toBeNull();
});

test("RGB crops handle row padding and replicated edges without swapping channels", () => {
  const source: PixelSource = {
    format: "rgb",
    width: 2,
    height: 2,
    stride: 8,
    rgb: new Uint8Array([255, 0, 0, 0, 255, 0, 99, 99, 0, 0, 255, 255, 255, 255, 99, 99]),
  };
  expect(Array.from(cropPixels(source, { x: 0, y: 0, size: 2 }, 2))).toEqual([
    1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1,
  ]);
  expect(Array.from(cropPixels(source, { x: -4, y: -4, size: 1 }, 1))).toEqual([1, 0, 0]);
  expect(Array.from(cropPixels(source, { x: -4, y: -4, size: 1 }, 1, true))).toEqual([0, 0, 0]);
  expect(() =>
    cropPixels({ ...source, rgb: new Uint8Array(1) }, { x: 0, y: 0, size: 2 }),
  ).toThrow();
});

test("full-range NV12 crops respect plane strides and reject truncated buffers", () => {
  const source: PixelSource = {
    format: "nv12",
    width: 4,
    height: 4,
    yStride: 6,
    uvStride: 6,
    y: new Uint8Array(24).fill(128),
    uv: new Uint8Array(12).fill(128),
  };
  const crop = cropPixels(source, { x: 0, y: 0, size: 4 }, 2);
  expect(crop[0]).toBeCloseTo(0.5047098, 6);
  expect(crop[1]).toBeCloseTo(0.4998857, 6);
  expect(crop[2]).toBeCloseTo(0.5054353, 6);
  source.uv.fill(255);
  const warm = cropPixels(source, { x: 0, y: 0, size: 4 }, 2);
  expect(warm[0]).toBe(1);
  expect(warm[2]).toBe(1);
  expect(warm[1]).toBeLessThan(0.1);
  expect(() => cropPixels({ ...source, uv: new Uint8Array(2) }, { x: 0, y: 0, size: 4 })).toThrow();
});

test("both eye tensors come from full 4K RGB and predictions map back to frame pixels", () => {
  const source: PixelSource = {
    format: "rgb",
    width: 3840,
    height: 2160,
    stride: 3840 * 3,
    rgb: new Uint8Array(3840 * 2160 * 3),
  };
  source.rgb.fill(128);
  const runSync = jest.fn<ArrayBuffer[], [ArrayBuffer[]]>(() => [
    new Float32Array([0.5, 0.5, 0.2, 0.6, 0.5, 0.9]).buffer,
  ]);
  const eyes = inferEyes(source, landmarks(), { runSync })!;
  expect(runSync).toHaveBeenCalledTimes(2);
  expect(runSync.mock.calls[0]![0][0]!.byteLength).toBe(128 * 128 * 3 * 4);
  expect(new Float32Array(runSync.mock.calls[0]![0][0]!)[0]).toBeCloseTo(128 / 255);
  expect(eyes[0].irisCenter).toEqual({ x: 1000, y: 1000 });
  expect(eyes[1].irisCenter).toEqual({ x: 2000, y: 1000 });
  expect(eyes[0].irisRadius).toBeCloseTo(40);
  expect(eyes[0].reflex!.x).toBeCloseTo(1020);
  for (const eye of eyes) {
    expect(eye.cropStats?.exposure).toBeCloseTo(128 / 255, 6);
    expect(eye.cropStats?.sharpness).toBe(0);
    expect(eye.cropStats?.clipped).toBe(0);
    // The result screen gets the same crop as bytes.
    expect(eye.photo).toEqual(new Uint8Array(128 * 128 * 3).fill(128));
  }
  runSync.mockReturnValueOnce([new Float32Array([0.5, 0.5, 0.2, -8, -8, 0.1]).buffer]);
  expect(inferEyes(source, landmarks(), { runSync })![0].reflex).toBeNull();
  runSync.mockReturnValueOnce([new Float32Array([NaN, 0.5, 0.2, 0.6, 0.5, 0.9]).buffer]);
  expect(() => inferEyes(source, landmarks(), { runSync })).toThrow("Invalid eye model output");
});

test("without a model the heuristic finds the iris and reflex in frame pixels (#274)", () => {
  const width = 2200,
    height = 1200;
  const source: PixelSource = {
    format: "rgb",
    width,
    height,
    stride: width * 3,
    rgb: new Uint8Array(width * height * 3).fill(190),
  };
  const disc = (cx: number, cy: number, r: number, value: number) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        // Pixel x covers x .. x + 1, so its centre is x + 0.5.
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r)
          source.rgb.fill(value, (y * width + x) * 3, (y * width + x) * 3 + 3);
      }
    }
  };
  disc(1000, 1000, 40, 60);
  disc(2000, 1000, 40, 60);
  disc(1012, 994, 5, 255);
  disc(2000, 1000, 5, 255);
  const eyes = heuristicEyes(source, landmarks())!;
  expect(eyes.map((eye) => eye.side)).toEqual(["imageLeft", "imageRight"]);
  const expected = [
    { iris: { x: 1000, y: 1000 }, reflex: { x: 1012, y: 994 } },
    { iris: { x: 2000, y: 1000 }, reflex: { x: 2000, y: 1000 } },
  ];
  // One crop pixel is 200 / 128 frame pixels.
  eyes.forEach((eye, i) => {
    expect(Math.abs(eye.irisCenter.x - expected[i]!.iris.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(eye.irisCenter.y - expected[i]!.iris.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(eye.irisRadius - 40)).toBeLessThanOrEqual(2);
    expect(Math.abs(eye.reflex!.x - expected[i]!.reflex.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(eye.reflex!.y - expected[i]!.reflex.y)).toBeLessThanOrEqual(2);
    expect(eye.reflexVisibleProbability).toBe(1);
    expect(eye.cropStats).toBeDefined();
  });
  // The photo is the measured crop: background at the corner, the dark iris at the centre.
  const photo = eyes[0].photo!;
  expect(photo).toHaveLength(128 * 128 * 3);
  expect([...photo.subarray(0, 3)]).toEqual([190, 190, 190]);
  expect([...photo.subarray((64 * 128 + 64) * 3, (64 * 128 + 64) * 3 + 3)]).toEqual([60, 60, 60]);
  expect(heuristicEyes(source, [])).toBeNull();
});
