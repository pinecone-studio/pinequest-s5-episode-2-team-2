import fixture from "./fixtures/eyeCrop.json";
import { eyeRegions } from "../vision/eyeCrops";
import { cropPixels } from "../vision/pixels";
import { fixtureFrame, irisLandmarks, SAMPLE_POINTS } from "./eyeCropFixture";

// Python reads the same file in ml/tests/test_eye_crop_parity.py (see docs/shared-fixtures.md).
const frame = fixtureFrame(fixture.frame.width, fixture.frame.height);

test.each(fixture.cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
  const regions = eyeRegions(irisLandmarks(c.irises))!;
  expect(regions.map((r) => ({ side: r.side, crop: { x: r.x, y: r.y, size: r.size } }))).toEqual(
    c.expected.map((e) => ({ side: e.side, crop: e.crop })),
  );
  regions.forEach((region, eye) => {
    const pixels = cropPixels(frame, region, fixture.outputSize);
    const expected = c.expected[eye]!;
    expect(SAMPLE_POINTS.map(([row, col]) => [row, col])).toEqual(
      expected.samples.map(([row, col]) => [row, col]),
    );
    expected.samples.forEach(([row, col, ...rgb]) => {
      const i = (row! * fixture.outputSize + col!) * 3;
      rgb.forEach((v, ch) => expect(pixels[i + ch]).toBeCloseTo(v!, 6));
    });
  });
});
