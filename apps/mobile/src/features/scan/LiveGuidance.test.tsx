import { mockFrameQuality } from "@app/core";
import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import type { LandmarkFrame } from "../vision/facePipeline";
import { GUIDANCE } from "./guidance";
import { LiveGuidance } from "./LiveGuidance";

jest.mock("../../components/ui", () => ({ Card: "Card", Text: "Text" }));
jest.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

const frame = (faceCount: number, timestampMs: number): LandmarkFrame => ({
  faceCount,
  landmarks: [],
  frameSize: { width: 3840, height: 2160 },
  timestampMs,
  latencyMs: 10,
});
let renderer: ReactTestRenderer;
const shown = () => renderer.root.findByType("Text" as never).props.children as string;
beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("one stray frame does not replace the instruction", async () => {
  await act(async () => {
    renderer = create(<LiveGuidance frame={frame(0, 0)} />);
  });
  expect(shown()).toBe(GUIDANCE.NO_FACE);
  await act(async () => renderer.update(<LiveGuidance frame={frame(2, 1)} />));
  expect(shown()).toBe(GUIDANCE.NO_FACE);
  // Re-rendering with the same frame object must not count it again.
  const same = frame(2, 2);
  for (let i = 0; i < 5; i++) {
    await act(async () => renderer.update(<LiveGuidance frame={same} />));
  }
  expect(shown()).toBe(GUIDANCE.NO_FACE);
});

test("a lasting change replaces the instruction", async () => {
  await act(async () => {
    renderer = create(<LiveGuidance frame={frame(0, 0)} />);
  });
  for (let i = 1; i <= 5; i++) {
    await act(async () => renderer.update(<LiveGuidance frame={frame(2, i)} />));
  }
  expect(shown()).toBe(GUIDANCE.MULTIPLE_FACES);
});

test("still announces no face, head turned and closed eyes after moving below the preview", async () => {
  await act(async () => {
    renderer = create(<LiveGuidance frame={frame(0, 0)} />);
  });
  expect(shown()).toBe(GUIDANCE.NO_FACE);
  let timestampMs = 1;
  for (const reason of ["HEAD_TURNED", "EYES_CLOSED"] as const) {
    for (let i = 0; i < 5; i++) {
      const next = {
        ...frame(1, timestampMs++),
        quality: mockFrameQuality({ ok: false, reasons: [reason] }),
      };
      await act(async () => renderer.update(<LiveGuidance frame={next} />));
    }
    expect(shown()).toBe(GUIDANCE[reason]);
    const text = renderer.root.findByType("Text" as never);
    expect(text.props.accessibilityLiveRegion).toBe("polite");
    expect(text.props.numberOfLines).toBeUndefined();
  }
});
