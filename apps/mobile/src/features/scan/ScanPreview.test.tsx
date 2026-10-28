import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { View } from "react-native";
import { ScanPreview } from "./ScanPreview";

jest.mock("react-native", () => ({
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
let renderer: ReactTestRenderer;
beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test("keeps guidance outside the clipped camera/guide region so wrapped text cannot cross it", async () => {
  await act(async () => {
    renderer = create(
      <ScanPreview guidance={<View testID="guidance" />}>
        <View testID="camera" />
      </ScanPreview>,
    );
  });
  const camera = renderer.root.findByProps({ testID: "camera" });
  const guidance = renderer.root.findByProps({ testID: "guidance" });
  const guide = renderer.root.findByProps({
    accessibilityLabel: "Нүүрээ хүрээнд байрлуулна уу",
  });
  const cameraRegion = camera.parent!;
  expect(guide.parent).toBe(cameraRegion);
  expect(cameraRegion.findAllByProps({ testID: "guidance" })).toHaveLength(0);
  expect(guidance.parent).toBe(cameraRegion.parent);
  expect(guidance.parent!.children.indexOf(guidance)).toBeGreaterThan(
    guidance.parent!.children.indexOf(cameraRegion),
  );
});
