import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import HomeScreen from "./HomeScreen";
import { adviceCards } from "../tips/advice";

const mockNavigate = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { navigate: (to: string) => mockNavigate(to), push: (to: unknown) => mockPush(to) },
}));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("../tips/AdviceCarousel", () => ({ AdviceCarousel: "AdviceCarousel" }));
jest.mock("../tips/DailyAdviceCard", () => ({ DailyAdviceCard: "DailyAdviceCard" }));
jest.mock("../tips/useDailyAdvice", () => ({
  useDailyAdvice: () => jest.requireActual("../tips/advice").adviceCards[2],
}));
jest.mock("../../components/ui", () => ({ Button: "Button", Text: "Text" }));
jest.mock("../../components/Mascot", () => ({ Mascot: "Mascot" }));
jest.mock("react-native", () => ({
  Image: "Image",
  View: "View",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles },
}));
let renderer: ReactTestRenderer;
const nodes = (type: string) => renderer.root.findAll((n) => n.type === (type as never));
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockNavigate.mockReset();
  mockPush.mockReset();
  act(() => {
    renderer = create(<HomeScreen />);
  });
});
afterEach(() => act(() => renderer.unmount()));

test("Home keeps the brand and one check action while advice opens the selected source topic", () => {
  expect(nodes("Button")).toHaveLength(1);
  act(() => nodes("Button")[0]!.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith("/tests");
  expect(nodes("DailyAdviceCard")[0]!.props.advice).toBe(adviceCards[2]);
  act(() => nodes("DailyAdviceCard")[0]!.props.onOpen("outdoor-time"));
  for (const card of adviceCards) {
    act(() => nodes("AdviceCarousel")[0]!.props.onOpen(card.id));
  }
  expect(mockPush.mock.calls).toEqual([
    [{ pathname: "/tips", params: { topic: "outdoor-time" } }],
    ...adviceCards.map((card) => [{ pathname: "/tips", params: { topic: card.id } }]),
  ]);
  expect(nodes("Mascot")[0]!.props.variant).toBe("wave");
  expect(JSON.stringify(renderer.toJSON())).toContain("Нүдхэн");
  expect(JSON.stringify(renderer.toJSON())).toContain("Зураг утаснаас гарахгүй · Онош биш");
  expect(nodes("LatestScanCard")).toHaveLength(0);
});
