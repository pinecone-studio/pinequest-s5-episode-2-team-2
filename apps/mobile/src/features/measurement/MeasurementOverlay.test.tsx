import { act } from "react";
import { create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import { mockEyeMeasure } from "@app/core";
import { MeasurementOverlay } from "./MeasurementOverlay";

jest.mock("react-native", () => ({
  View: "View",
  Text: "Text",
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
}));

function render(props: Parameters<typeof MeasurementOverlay>[0]) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<MeasurementOverlay {...props} />);
  });
  act(() => {
    renderer.root
      .findByProps({ pointerEvents: "none" })
      .props.onLayout({ nativeEvent: { layout: { width: 390, height: 844 } } });
  });
  return renderer.root;
}

test("draws iris circle, centre and reflex for each eye after layout", () => {
  const root = render({
    frameSize: { width: 3840, height: 2160 },
    eyes: [mockEyeMeasure("imageLeft"), mockEyeMeasure("imageRight", null)],
    latencyMs: 30,
    failure: null,
  });
  expect(root.findAllByProps({ testID: "iris-circle" })).toHaveLength(2);
  expect(root.findAllByProps({ testID: "iris-center" })).toHaveLength(2);
  // Only the image-left eye has a reflex.
  expect(root.findAllByProps({ testID: "reflex" })).toHaveLength(1);
  const ring = root.findAllByProps({ testID: "iris-circle" })[0]!;
  const scale = 844 / 2160;
  expect(ring.props.style[1].width).toBeCloseTo(48 * 2 * scale);
});

test("shows only the failure line when there are no eyes", () => {
  const root = render({
    frameSize: { width: 3840, height: 2160 },
    eyes: null,
    latencyMs: null,
    failure: "MODEL_UNAVAILABLE",
  });
  expect(root.findAllByProps({ testID: "iris-circle" })).toHaveLength(0);
  const lines = root.findAllByType("Text" as never).map((t) => t.props.children);
  expect(lines).toEqual(["latency - · MODEL_UNAVAILABLE"]);
});
