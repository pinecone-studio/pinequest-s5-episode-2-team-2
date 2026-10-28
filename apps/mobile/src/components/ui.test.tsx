import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { HeaderHeightContext } from "expo-router/react-navigation";
import { Screen, Text } from "./ui";

jest.mock("expo-router/react-navigation", () => ({
  HeaderHeightContext: jest.requireActual("react").createContext(undefined),
}));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("react-native", () => ({
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));

function edges(headerHeight?: number) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <HeaderHeightContext.Provider value={headerHeight}>
        <Screen />
      </HeaderHeightContext.Provider>,
    );
  });
  return renderer.root.findByType("SafeAreaView" as never).props.edges;
}

describe("Screen", () => {
  it("keeps clear of the status bar when there is no header", () => {
    expect(edges()).toEqual(["top", "left", "right"]);
    expect(edges(0)).toEqual(["top", "left", "right"]);
  });

  it("leaves the top inset to the stack header (#163)", () => {
    expect(edges(116)).toEqual(["left", "right"]);
  });
});

describe("Text", () => {
  function maxScale(element: React.ReactElement) {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(element);
    });
    return renderer.root.findByType("Text" as never).props.maxFontSizeMultiplier;
  }

  it("caps how far the iOS text size grows it, less for titles (#238)", () => {
    expect(maxScale(<Text>Нүд</Text>)).toBe(2);
    expect(maxScale(<Text variant="caption">Нүд</Text>)).toBe(2);
    expect(maxScale(<Text variant="title">Нүд</Text>)).toBe(1.4);
  });

  it("lets a screen fix the size of text inside a fixed box", () => {
    expect(maxScale(<Text maxFontSizeMultiplier={1}>!</Text>)).toBe(1);
  });
});
