import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import TipsScreen from "./TipsScreen";
import { tipSections, tipsCopy } from "./content";

const mockOpen = jest.fn(async () => true);
jest.mock("react-native", () => ({
  Linking: { openURL: (...args: unknown[]) => mockOpen(...(args as [])) },
  Pressable: "Pressable",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock("../../components/ui", () => ({ Card: "Card", Screen: "Screen", Text: "Text" }));

let renderer: ReactTestRenderer;
const text = () => JSON.stringify(renderer.toJSON());

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockOpen.mockClear();
  await act(async () => {
    renderer = create(<TipsScreen />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

test("shows every section, tip and source, and the no-diagnosis notice", () => {
  for (const section of tipSections) {
    expect(text()).toContain(section.title);
    for (const tip of section.tips) {
      expect(text()).toContain(tip.text);
      expect(text()).toContain(tip.source.label);
    }
  }
  expect(text()).toContain(tipsCopy.notice);
});

test("tapping a source opens its page", async () => {
  const links = renderer.root.findAll((node) => node.props.accessibilityRole === "link");
  const first = tipSections[0]!.tips[0]!;
  await act(async () => links[0]!.props.onPress());
  expect(mockOpen).toHaveBeenCalledWith(first.source.url);
});
