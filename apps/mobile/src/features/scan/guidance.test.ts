import { mockFrameQuality } from "@app/core";
import type { QualityReason } from "@app/core";
import { GUIDANCE, guidanceForFrame } from "./guidance";
import type { LandmarkFrame } from "../vision/facePipeline";

const frame: LandmarkFrame = {
  faceCount: 1,
  landmarks: [],
  latencyMs: 10,
  timestampMs: 0,
  frameSize: { width: 3840, height: 2160 },
};

test.each(Object.keys(GUIDANCE) as QualityReason[])(
  "renders Mongolian TODO copy for %s",
  (reason) => {
    const text = guidanceForFrame({
      ...frame,
      quality: mockFrameQuality({ ok: false, reasons: [reason] }),
    });
    expect(text).toBe(GUIDANCE[reason]);
    expect(text).toMatch(/^TODO\(copy\): /);
  },
);

test("face availability takes priority over other quality reasons", () => {
  const quality = mockFrameQuality({ ok: false, reasons: ["TOO_DARK", "EYES_CLOSED"] });
  expect(guidanceForFrame({ ...frame, faceCount: 0, quality })).toBe(GUIDANCE.NO_FACE);
  expect(guidanceForFrame({ ...frame, faceCount: 2, quality })).toBe(GUIDANCE.MULTIPLE_FACES);
  expect(guidanceForFrame({ ...frame, quality })).toBe(GUIDANCE.EYES_CLOSED);
});

test("missing quality or models never implies that the eyes are healthy", () => {
  expect(guidanceForFrame(null)).toContain("Камер бэлдэж");
  expect(guidanceForFrame(frame)).toContain("хөдөлгөөнгүй");
  expect(guidanceForFrame({ ...frame, eyeFailure: "MODEL_UNAVAILABLE" })).toContain("бэлэн биш");
  expect(guidanceForFrame({ ...frame, eyeFailure: "EYE_NOT_FOUND" })).toBe(GUIDANCE.EYE_NOT_FOUND);
});
