import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { HeaderHeightContext } from "expo-router/react-navigation";
import { Screen } from "./ui";

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
