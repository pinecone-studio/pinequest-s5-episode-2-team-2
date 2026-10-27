import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import type { AcuityResult } from "../../storage/acuity";
import { VisionCard } from "./VisionCard";
import { dashboardCopy as copy } from "./copy";
import { resultCopy } from "../scan/resultCopy";
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock("../../components/ui", () => ({ Text: "Text", Card: "Card" }));
jest.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: (s: unknown) => s },
}));
let renderer: ReactTestRenderer;
const result: AcuityResult = {
  id: "v",
  childId: "b",
  createdAt: "2026-10-27T00:00:00Z",
  group: "child5",
  right: null,
  left: 0,
  refer: true,
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockPush.mockClear();
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});
test.each([null, result, { ...result, refer: false }])(
  "opens the correct child-scoped destination",
  async (latestVision) => {
    await act(async () => {
      renderer = create(<VisionCard details={{ childId: "b", latestVision }} />);
    });
    const text = JSON.stringify(renderer.toJSON());
    if (latestVision) {
      expect(text).toContain(copy.belowChart);
      if (latestVision.refer) expect(text).toContain(copy.visionRefer);
      else expect(text).not.toContain(copy.visionRefer);
      expect(text).toContain("1.0");
      expect(text).toContain(resultCopy.notice);
    } else expect(text).toContain(copy.noVision);
    renderer.root
      .findByProps({ accessibilityLabel: `${copy.vision}: ${copy.open}` })
      .props.onPress();
    expect(mockPush).toHaveBeenCalledWith(
      latestVision
        ? { pathname: "/vision-result", params: { id: "v", childId: "b" } }
        : { pathname: "/acuity", params: { childId: "b" } },
    );
  },
);
