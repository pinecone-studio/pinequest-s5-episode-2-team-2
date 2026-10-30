import { inferHand, inferPose } from "./gesturePipeline";

function detector(pose: boolean, found = true) {
  const count = pose ? 2254 : 2016,
    coords = pose ? 12 : 18,
    input = pose ? 224 : 192;
  const source = pose ? 512 : 256,
    grid = pose ? 28 : 24;
  const boxes = new Float32Array(count * coords),
    logits = new Float32Array(count).fill(-100);
  const xy = (x: number, y: number) => [
    (x / source - 0.5 / grid) * input,
    (y / source - 0.5 / grid) * input,
  ];
  boxes.set([...xy(source / 2, source / 2), input / 4, input / 4]);
  const points = pose
    ? [
        [256, 256],
        [256, 128],
        [256, 128],
        [256, 64],
      ]
    : [
        [128, 144],
        [112, 128],
        [128, 112],
        [144, 128],
        [160, 128],
        [128, 160],
        [96, 128],
      ];
  points.forEach(([x, y], i) => boxes.set(xy(x!, y!), 4 + i * 2));
  if (found) logits[0] = 10;
  return {
    boxes,
    logits,
    runSync: jest.fn((_input: ArrayBuffer[]) => [boxes.buffer, logits.buffer]),
  };
}
function landmarks(pose: boolean) {
  const sizes = pose ? [195, 1, 65536, 159744, 117] : [63, 1, 1, 63];
  const output = sizes.map((size) => new Float32Array(size));
  const stride = pose ? 5 : 3,
    centre = pose ? 128 : 112;
  for (let i = 0; i < (pose ? 39 : 21); i++) {
    output[0]![i * stride] = centre;
    output[0]![i * stride + 1] = centre;
    if (pose) {
      output[0]![i * stride + 3] = 2;
      output[0]![i * stride + 4] = 2;
    }
  }
  output[1]![0] = 0.9;
  return {
    output,
    runSync: jest.fn((_input: ArrayBuffer[]) => output.map((values) => values.buffer)),
  };
}

test("pose uses [-1,1] detector input and maps the ROI out of a portrait letterbox", () => {
  const d = detector(true),
    m = landmarks(true);
  m.output[0]![0] = 192; // 1/4 ROI width to the image's right.
  m.output[0]![3] = -2;
  m.output[0]![4] = -6; // presence does not lower visibility, as in MediaPipe's PoseLandmarker
  const points = inferPose(new Float32Array(512 * 512 * 3).fill(0.75), d, m, 320, 640);
  expect(points).toHaveLength(33);
  expect(points[0]!.x).toBeCloseTo(0.8125);
  expect(points[0]!.y).toBeCloseTo(0.5);
  expect(points[0]!.visibility).toBeCloseTo(1 / (1 + Math.exp(2)));
  expect(new Float32Array(d.runSync.mock.calls[0]![0]![0]!)[0]).toBeCloseTo(0.5);
});

test("palm/hand use [0,1] input and project 21 points without mirroring", () => {
  const d = detector(false),
    m = landmarks(false);
  m.output[0]![0] = 224;
  const points = inferHand(new Float32Array(256 * 256 * 3).fill(0.75), d, m);
  expect(points).toHaveLength(21);
  expect(points[0]!.x).toBeCloseTo(0.825);
  expect(points[0]!.y).toBeCloseTo(0.375);
  expect(new Float32Array(d.runSync.mock.calls[0]![0]![0]!)[0]).toBeCloseTo(0.75);
});

test("a sideways palm rotates the hand ROI before projecting its points", () => {
  const d = detector(false),
    m = landmarks(false);
  // First anchor is at 1/48 of the 256-square image; palm input is 192.
  d.boxes.set([(112 / 256 - 1 / 48) * 192, (128 / 256 - 1 / 48) * 192], 4);
  d.boxes.set([(144 / 256 - 1 / 48) * 192, (128 / 256 - 1 / 48) * 192], 8);
  m.output[0]![0] = 224;
  const points = inferHand(new Float32Array(256 * 256 * 3), d, m);
  expect(points[0]!.x).toBeCloseTo(0.625);
  expect(points[0]!.y).toBeCloseTo(0.825);
});

test("missing detections skip the landmark model; low presence yields no gesture points", () => {
  const hand = landmarks(false),
    pose = landmarks(true);
  expect(inferHand(new Float32Array(256 * 256 * 3), detector(false, false), hand)).toEqual([]);
  expect(hand.runSync).not.toHaveBeenCalled();
  expect(inferPose(new Float32Array(512 * 512 * 3), detector(true, false), pose, 320, 640)).toEqual(
    [],
  );
  expect(pose.runSync).not.toHaveBeenCalled();
  hand.output[1]![0] = 0.1;
  pose.output[1]![0] = 0.1;
  expect(inferHand(new Float32Array(256 * 256 * 3), detector(false), hand)).toEqual([]);
  expect(inferPose(new Float32Array(512 * 512 * 3), detector(true), pose, 320, 640)).toEqual([]);
});

test("tensor contract errors, non-finite predictions and invalid frames fail explicitly", () => {
  const d = detector(false),
    m = landmarks(false),
    rgb = new Float32Array(256 * 256 * 3);
  d.runSync.mockReturnValueOnce([new ArrayBuffer(4)]);
  expect(() => inferHand(rgb, d, m)).toThrow("tensors");
  m.output[0]![8] = NaN;
  expect(() => inferHand(rgb, d, m)).toThrow("Invalid hand output");
  expect(() => inferHand(new Float32Array(3), d, m)).toThrow("RGB crop");
  expect(() =>
    inferPose(new Float32Array(512 * 512 * 3), detector(true), landmarks(true), 0, 640),
  ).toThrow("dimensions");
});
