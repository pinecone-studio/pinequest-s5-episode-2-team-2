import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { AdviceCarousel } from "./AdviceCarousel";
import { AdvicePicture } from "./AdvicePicture";
import { adviceCards } from "./advice";

const mockScrollTo = jest.fn();
const mockOpen = jest.fn();
let mockReduced = false;
let mockFontScale = 1;
jest.mock("./useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));
jest.mock("./adviceImages", () => ({
  adviceImages: {
    "early-checks": 1,
    "screen-time": 2,
    "outdoor-time": 3,
    "doctor-signs": 4,
  },
}));
jest.mock("react-native", () => ({
  View: "View",
  Image: "Image",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Animated: {
    ScrollView: "ScrollView",
    View: "AnimatedView",
    Value: class {
      interpolate() {
        return 1;
      }
    },
    event: () => jest.fn(),
  },
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {}, absoluteFillObject: {} },
  useWindowDimensions: () => ({ width: 375, height: 667, fontScale: mockFontScale }),
}));
jest.mock("../../components/ui", () => ({ Text: "Text" }));
jest.mock("../../components/EmptyState", () => ({ Loading: "Loading", EmptyState: "EmptyState" }));
let renderer: ReactTestRenderer;
const nodes = (type: string) => renderer.root.findAll((node) => node.type === (type as never));
const pages = () => nodes("Pressable").filter((node) => node.props.accessibilityState);
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockReduced = false;
  mockFontScale = 1;
  mockScrollTo.mockClear();
  mockOpen.mockClear();
  act(() => {
    renderer = create(<AdviceCarousel onOpen={mockOpen} />, {
      createNodeMock: (element) =>
        element.type === ("ScrollView" as never) ? { scrollTo: mockScrollTo } : null,
    });
  });
});
afterEach(() => act(() => renderer.unmount()));

test("portrait cards open their own topics and dot controls expose the selected page", () => {
  expect(nodes("Image")).toHaveLength(4);
  for (const image of nodes("Image")) {
    expect(image.props.resizeMode).toBe("contain");
    expect(image.props.accessible).toBe(false);
  }
  const cards = nodes("Pressable").filter((node) => node.props.accessibilityHint);
  act(() => cards[2]!.props.onPress());
  expect(mockOpen).toHaveBeenCalledWith(adviceCards[2]!.id);
  act(() => pages()[1]!.props.onPress());
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 335, animated: true });
  expect(pages()[1]!.props.accessibilityState.selected).toBe(true);
  expect(nodes("AnimatedView")[0]!.props.accessibilityElementsHidden).toBe(true);
});

test("swiping updates the active page and relayout preserves that page", () => {
  act(() =>
    nodes("ScrollView")[0]!.props.onMomentumScrollEnd({
      nativeEvent: { contentOffset: { x: 670 } },
    }),
  );
  expect(pages()[2]!.props.accessibilityState.selected).toBe(true);
  const layout = nodes("View").find((node) => node.props.onLayout)!;
  act(() => layout.props.onLayout({ nativeEvent: { layout: { width: 280 } } }));
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 560, animated: false });
});

test("reduced motion avoids animated paging and larger text is not truncated", () => {
  mockReduced = true;
  mockFontScale = 2;
  act(() => renderer.update(<AdviceCarousel onOpen={mockOpen} />));
  act(() => pages()[3]!.props.onPress());
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 1005, animated: false });
  expect(nodes("ScrollView")[0]!.props.onScroll).toBeUndefined();
  expect(nodes("Text").every((node) => node.props.numberOfLines === undefined)).toBe(true);
});

test("missing cards and image failures show useful states without hiding the advice", () => {
  act(() => nodes("Image")[0]!.props.onError());
  expect(nodes("EmptyState")).toHaveLength(1);
  expect(nodes("Pressable").filter((node) => node.props.accessibilityHint)).toHaveLength(4);
  act(() => renderer.update(<AdviceCarousel cards={[]} onOpen={mockOpen} />));
  expect(nodes("EmptyState")).toHaveLength(1);
  expect(nodes("ScrollView")).toHaveLength(0);
});

test("a portrait loads without cropping and removes its loading indicator", () => {
  act(() => renderer.update(<AdvicePicture source={1} />));
  expect(nodes("Loading")).toHaveLength(1);
  act(() => nodes("Image")[0]!.props.onLoad());
  expect(nodes("Loading")).toHaveLength(0);
});
