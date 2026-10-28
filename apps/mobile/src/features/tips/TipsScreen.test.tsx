import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import TipsScreen from "./TipsScreen";
import { eyeRestCopy } from "../eyeRest/content";
import { tipSections, tipsCopy } from "./content";

const mockOpen = jest.fn(async () => true);
const mockPush = jest.fn();
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...(args as [])) },
}));
jest.mock("react-native", () => ({
  Linking: { openURL: (...args: unknown[]) => mockOpen(...(args as [])) },
  Pressable: "Pressable",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock("../../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Screen: "Screen",
  Text: "Text",
}));

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

const header = (title: string) =>
  renderer.root.find(
    (node) => node.props.accessibilityRole === "button" && node.props.accessibilityLabel === title,
  );
const [first, ...rest] = tipSections;

test("every section title shows, with only the first section open", () => {
  for (const section of tipSections) expect(text()).toContain(section.title);
  for (const tip of first!.tips) expect(text()).toContain(tip.text);
  for (const section of rest) {
    for (const tip of section.tips) expect(text()).not.toContain(tip.text);
  }
  expect(header(first!.title).props.accessibilityState).toEqual({ expanded: true });
  for (const section of rest) {
    expect(header(section.title).props.accessibilityState).toEqual({ expanded: false });
  }
  expect(text()).toContain(tipsCopy.notice);
});

test("tapping a section opens and closes it", async () => {
  const second = rest[0]!;
  await act(async () => header(second.title).props.onPress());
  expect(header(second.title).props.accessibilityState).toEqual({ expanded: true });
  expect(text()).toContain(second.tips[0]!.text);

  await act(async () => header(second.title).props.onPress());
  expect(header(second.title).props.accessibilityState).toEqual({ expanded: false });
  expect(text()).not.toContain(second.tips[0]!.text);
});

test("every tip still shows its source once its section is open", async () => {
  for (const section of rest) await act(async () => header(section.title).props.onPress());
  for (const section of tipSections) {
    for (const tip of section.tips) {
      expect(text()).toContain(tip.text);
      expect(text()).toContain(tip.source.label);
    }
  }
});

test("tapping a source opens its page", async () => {
  const links = renderer.root.findAll((node) => node.props.accessibilityRole === "link");
  await act(async () => links[0]!.props.onPress());
  expect(mockOpen).toHaveBeenCalledWith(first!.tips[0]!.source.url);
});

test("the eye-rest button opens the exercises", async () => {
  const button = renderer.root.find(
    (node) => String(node.type) === "Button" && node.props.label === eyeRestCopy.openFromTips,
  );
  await act(async () => button.props.onPress());
  expect(mockPush).toHaveBeenCalledWith("/eye-rest");
});
