import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import HomeScreen from "./HomeScreen";

const mockNavigate = jest.fn();
jest.mock("../../components/Mascot", () => ({ Mascot: "Mascot" }));
jest.mock("expo-router", () => ({ router: { navigate: (to: string) => mockNavigate(to) } }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("../history/LatestScanCard", () => ({ LatestScanCard: "LatestScanCard" }));
jest.mock("../../components/ui", () => ({ Button: "Button", Text: "Text" }));
jest.mock("react-native", () => ({
  Image: "Image",
  View: "View",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles },
}));

let renderer: ReactTestRenderer;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockNavigate.mockReset();
});
afterEach(() => act(() => renderer?.unmount()));

test("starts a check, opens the vision check and keeps the latest scan", () => {
  act(() => {
    renderer = create(<HomeScreen />);
  });
  const buttons = renderer.root.findAll((n) => n.type === ("Button" as never));
  expect(buttons.map((b) => b.props.variant ?? "primary")).toEqual([
    "primary",
    "secondary",
    "secondary",
  ]);
  act(() => buttons[0]!.props.onPress());
  act(() => buttons[1]!.props.onPress());
  act(() => buttons[2]!.props.onPress());
  expect(mockNavigate.mock.calls).toEqual([["/tests"], ["/acuity"], ["/tips"]]);
  expect(renderer.root.findAll((n) => n.type === ("LatestScanCard" as never))).toHaveLength(1);
  expect(JSON.stringify(renderer.toJSON())).toContain("Онош биш");
});
