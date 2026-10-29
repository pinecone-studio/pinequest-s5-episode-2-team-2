import { act } from "react";
import { create } from "react-test-renderer";
import type { ReactTestRenderer } from "react-test-renderer";
import ProfileScreen from "../../../app/(tabs)/profile";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock("../dashboard/ProfileDashboard", () => ({ ProfileDashboard: "ProfileDashboard" }));
jest.mock("../../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Screen: "Screen",
  Text: "Text",
}));

test.each([false, true])(
  "preserves the existing Settings entry with developer mode %s",
  async (development) => {
    Object.assign(globalThis, { __DEV__: development, IS_REACT_ACT_ENVIRONMENT: true });
    mockPush.mockClear();
    let renderer!: ReactTestRenderer;
    try {
      await act(async () => {
        renderer = create(<ProfileScreen />);
      });
      const settings = renderer.root.findAllByProps({ label: "Тохиргоо" });
      expect(settings).toHaveLength(1);
      settings[0]!.props.onPress();
      expect(mockPush).toHaveBeenCalledWith("/settings");
    } finally {
      await act(async () => renderer.unmount());
      Object.assign(globalThis, { __DEV__: false });
    }
  },
);

test("History opens from Profile now that the exercises have its tab", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockPush.mockClear();
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<ProfileScreen />);
  });
  const history = renderer.root.findAllByProps({ label: "Шалгалтын түүх" });
  expect(history).toHaveLength(1);
  history[0]!.props.onPress();
  expect(mockPush).toHaveBeenCalledWith("/history");
  await act(async () => renderer.unmount());
});
