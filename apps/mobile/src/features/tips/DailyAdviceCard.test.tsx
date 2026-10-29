import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { DailyAdviceCard } from "./DailyAdviceCard";
import { adviceCards } from "./advice";

let mockFontScale = 1;
const mockOpen = jest.fn();
jest.mock("react-native", () => ({
  Pressable: "Pressable",
  View: "View",
  useWindowDimensions: () => ({ fontScale: mockFontScale }),
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock("../../components/ui", () => ({ Text: "Text" }));
jest.mock("../../components/EmptyState", () => ({ EmptyState: "EmptyState" }));
jest.mock("./AdvicePicture", () => ({ AdvicePicture: "AdvicePicture" }));
jest.mock("./adviceImages", () => ({ adviceImages: { "early-checks": 1, "screen-time": 2 } }));
let renderer: ReactTestRenderer;
const nodes = (type: string) => renderer.root.findAll((n) => n.type === (type as never));
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockOpen.mockReset();
  mockFontScale = 1;
  act(() => {
    renderer = create(<DailyAdviceCard advice={adviceCards[0]} onOpen={mockOpen} />);
  });
});
afterEach(() => act(() => renderer.unmount()));

test("the daily card updates its topic, artwork and destination together", () => {
  act(() => renderer.update(<DailyAdviceCard advice={adviceCards[1]} onOpen={mockOpen} />));
  expect(nodes("AdvicePicture")[0]!.props.source).toBe(2);
  act(() => nodes("Pressable")[0]!.props.onPress());
  expect(mockOpen).toHaveBeenCalledWith("screen-time");
  expect(nodes("Pressable")[0]!.props.accessibilityLabel).toContain(adviceCards[1]!.title);
});

test("large text can wrap and missing advice has an explicit empty state", () => {
  mockFontScale = 2;
  act(() => renderer.update(<DailyAdviceCard advice={adviceCards[0]} onOpen={mockOpen} />));
  expect(nodes("Text").every((node) => node.props.numberOfLines === undefined)).toBe(true);
  act(() => renderer.update(<DailyAdviceCard advice={undefined} onOpen={mockOpen} />));
  expect(nodes("EmptyState")).toHaveLength(1);
  expect(nodes("Pressable")).toHaveLength(0);
});
