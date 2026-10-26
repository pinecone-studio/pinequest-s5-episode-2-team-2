import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { mockEyeMeasure } from "@app/core";
import { EyeDiagramView } from "./EyeDiagramView";
import { eyeViewCopy as copy } from "./copy";

jest.mock("../../components/ui", () => ({ Text: "Text" }));
jest.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

let renderer: ReactTestRenderer;
const labelled = () =>
  renderer.root
    .findAll((node) => typeof node.props.accessibilityLabel === "string")
    .map((node) => node.props.accessibilityLabel as string);
beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("labels each eye with its side and reflex position", async () => {
  await act(async () => {
    renderer = create(
      <EyeDiagramView
        eyes={[mockEyeMeasure("imageLeft", { x: 0.1, y: 0 }), mockEyeMeasure("imageRight", null)]}
      />,
    );
  });
  expect(labelled()).toEqual([
    `${copy.sides.imageLeft}: ${copy.reflexAt(0.1, 0)}`,
    `${copy.sides.imageRight}: ${copy.noReflex}`,
  ]);
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.legend);
});
