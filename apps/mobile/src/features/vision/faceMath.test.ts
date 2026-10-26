import { cropPoint, decodeFaces, faceRegion, sampleCrop, unletterbox } from "./faceMath";

function detector() {
  const boxes = new Float32Array(896 * 16);
  const scores = new Float32Array(896).fill(-100);
  const face = (index: number, logit = 4) => {
    scores[index] = logit;
    boxes.set([60, 60, 40, 40, 50, 55, 70, 55], index * 16);
  };
  return { boxes, scores, face };
}

test("rejects missing tensors and ignores low confidence / non-finite boxes", () => {
  expect(() => decodeFaces(new Float32Array(), new Float32Array())).toThrow();
  const { boxes, scores, face } = detector();
  expect(decodeFaces(boxes, scores)).toEqual([]);
  face(0);
  boxes[0] = NaN;
  expect(decodeFaces(boxes, scores)).toEqual([]);
});

test("decodes the two anchor grids and merges overlapping detections with weighted NMS", () => {
  const { boxes, scores, face } = detector();
  face(0);
  face(1, 2);
  face(895);
  const faces = decodeFaces(boxes, scores);
  expect(faces).toHaveLength(2);
  expect(faces[0]!.x).toBeCloseTo(40 / 128 + 0.5 / 16);
  expect(faces[0]!.width).toBeCloseTo(40 / 128);
  expect(faces[1]!.x).toBeCloseTo(40 / 128 + 7.5 / 8);
  expect(faces[0]!.score).toBeCloseTo(1 / (1 + Math.exp(-4)));
});

test("eye ordering cannot rotate the face crop upside down", () => {
  const { boxes, scores, face } = detector();
  face(0);
  const detection = decodeFaces(boxes, scores)[0]!;
  const first = faceRegion(detection);
  detection.eyes.reverse();
  expect(faceRegion(detection)).toEqual(first);
  expect(first.rotation).toBe(0);
  expect(first.size).toBeCloseTo((40 / 128) * 512 * 1.5);
});

test("rotated crop points map back to their centre and axes", () => {
  const region = { x: 100, y: 200, size: 80, rotation: Math.PI / 2 };
  expect(cropPoint({ x: 128, y: 128 }, region, 256)).toEqual({ x: 100, y: 200 });
  const point = cropPoint({ x: 256, y: 128 }, region, 256);
  expect(point.x).toBeCloseTo(100);
  expect(point.y).toBeCloseTo(240);
});

test.each([
  [3840, 2160],
  [2160, 3840],
])("letterbox maps back to %i × %i pixels", (width, height) => {
  expect(unletterbox({ x: 256, y: 256 }, width, height)).toEqual({ x: width / 2, y: height / 2 });
  const scale = 512 / Math.max(width, height);
  expect(
    unletterbox({ x: (512 - width * scale) / 2, y: (512 - height * scale) / 2 }, width, height),
  ).toEqual({ x: 0, y: 0 });
});

test("crop preserves RGB channels, interpolates, rotates and black-pads", () => {
  const pixels = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1]);
  const region = { x: 1, y: 1, size: 2, rotation: 0 };
  expect(sampleCrop(pixels, 2, region, 2)).toEqual(pixels);
  expect(Array.from(sampleCrop(pixels, 2, region, 1))).toEqual([0.5, 0.5, 0.5]);
  const rotated = sampleCrop(pixels, 2, { ...region, rotation: Math.PI }, 2);
  Array.from(pixels)
    .slice(9)
    .concat(
      Array.from(pixels).slice(6, 9),
      Array.from(pixels).slice(3, 6),
      Array.from(pixels).slice(0, 3),
    )
    .forEach((value, index) => expect(rotated[index]).toBeCloseTo(value));
  expect(sampleCrop(pixels, 2, { ...region, x: -10 }, 2)).toEqual(new Float32Array(12));
  expect(() => sampleCrop(pixels, 2, { ...region, size: NaN }, 2)).toThrow();
});
