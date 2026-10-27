// Writes apps/mobile/src/features/measurement/fixtures/eyeCrop.json from the app's own crop
// code (#21). Run from the repository root: npx tsx scripts/make_eye_crop_fixture.ts
import { writeFileSync } from "node:fs";
import { eyeRegions } from "../apps/mobile/src/features/vision/eyeCrops";
import { cropPixels } from "../apps/mobile/src/features/vision/pixels";
import {
  fixtureFrame,
  irisLandmarks,
  SAMPLE_POINTS,
} from "../apps/mobile/src/features/measurement/eyeCropFixture";

const FRAME = { width: 640, height: 480 };
const iris = (x: number, y: number, r: number) => [
  { x, y },
  { x: x + r, y },
  { x, y: y + r },
  { x: x - r, y },
  { x, y: y - r },
];
const CASES = [
  { name: "both_eyes", irises: [iris(250.3, 200.7, 40.2), iris(390.6, 205.2, 37.9)] },
  { name: "half_pixel_rounding", irises: [iris(300.5, 240.5, 25.1), iris(420.5, 241.5, 24.9)] },
  { name: "crop_leaves_frame", irises: [iris(20.2, 15.8, 30), iris(610.4, 470.1, 28.3)] },
];
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

const frame = fixtureFrame(FRAME.width, FRAME.height);
const cases = CASES.map(({ name, irises }) => {
  const regions = eyeRegions(irisLandmarks(irises));
  if (!regions) throw new Error(`no regions for ${name}`);
  return {
    name,
    irises,
    expected: regions.map((region) => {
      const pixels = cropPixels(frame, region);
      const mean = [0, 1, 2].map((c) => {
        let sum = 0;
        for (let i = c; i < pixels.length; i += 3) sum += pixels[i]!;
        return round6(sum / (pixels.length / 3));
      });
      return {
        side: region.side,
        crop: { x: region.x, y: region.y, size: region.size },
        samples: SAMPLE_POINTS.map(([row, col]) => {
          const i = (row * 128 + col) * 3;
          return [row, col, ...[0, 1, 2].map((c) => round6(pixels[i + c]!))];
        }),
        mean,
      };
    }),
  };
});

writeFileSync(
  "apps/mobile/src/features/measurement/fixtures/eyeCrop.json",
  JSON.stringify({ frame: FRAME, outputSize: 128, cases }, null, 2) + "\n",
);
console.log(`wrote ${cases.length} cases`);
