import { mockEyeMeasure } from "./mocks";
import type { CropStats } from "./pixels";
import { cropStats } from "./pixels";
import { assessQuality } from "./quality";
import type { HeadPose, Point, QualityReason } from "./types";

// Shared with ml/tests/test_quality.py so the Python reference and the app agree.
interface Fixtures {
  cases: {
    name: string;
    faceCount: number;
    frameSize: [number, number];
    points: Record<string, [number, number]>;
    eyes: { irisRadius: number; reflexOffset: [number, number] | null }[] | null;
    crops: [CropStats, CropStats] | null;
    expected: {
      reasons: QualityReason[];
      sharpness: number | null;
      exposure: number | null;
      headPose: HeadPose | null;
    };
  }[];
  crops: {
    name: string;
    width: number;
    height: number;
    luma: number[];
    expected: CropStats | null;
  }[];
}

const fixtures = jest.requireActual<Fixtures>("../fixtures/quality.json");

const closeOrNull = (actual: number | null, expected: number | null) =>
  expected === null ? expect(actual).toBeNull() : expect(actual).toBeCloseTo(expected, 6);

describe.each(fixtures.cases)("quality fixture: $name", (c) => {
  it("matches the expected reasons and values", () => {
    const landmarks: Point[] = Array.from({ length: 478 }, () => ({ x: 500, y: 550 }));
    for (const [i, [x, y]] of Object.entries(c.points)) landmarks[Number(i)] = { x, y };
    const sides = ["imageLeft", "imageRight"] as const;
    const eyes = c.eyes?.map((e, i) =>
      mockEyeMeasure(sides[i]!, e.reflexOffset && { x: e.reflexOffset[0], y: e.reflexOffset[1] }, {
        irisRadius: e.irisRadius,
      }),
    );
    const q = assessQuality({
      timestampMs: 0,
      frameSize: { width: c.frameSize[0], height: c.frameSize[1] },
      faceCount: c.faceCount,
      landmarks: c.faceCount === 1 ? landmarks : [],
      eyes: eyes ? [eyes[0]!, eyes[1]!] : null,
      crops: c.crops,
    });
    expect(q.reasons).toEqual(c.expected.reasons);
    expect(q.ok).toBe(c.expected.reasons.length === 0);
    closeOrNull(q.sharpness, c.expected.sharpness);
    closeOrNull(q.exposure, c.expected.exposure);
    if (c.expected.headPose === null) expect(q.headPose).toBeNull();
    else {
      for (const key of ["yaw", "pitch", "roll"] as const) {
        expect(q.headPose![key]).toBeCloseTo(c.expected.headPose[key], 6);
      }
    }
  });
});

describe.each(fixtures.crops)("crop fixture: $name", (c) => {
  it("matches the expected statistics", () => {
    const stats = cropStats({ width: c.width, height: c.height, luma: c.luma });
    if (c.expected === null) expect(stats).toBeNull();
    else {
      for (const key of ["sharpness", "exposure", "clipped"] as const) {
        expect(stats![key]).toBeCloseTo(c.expected[key], 6);
      }
    }
  });
});
