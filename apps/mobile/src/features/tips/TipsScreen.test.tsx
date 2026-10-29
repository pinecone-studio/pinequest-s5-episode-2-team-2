import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import TipsScreen from "./TipsScreen";
import { eyeRestCopy } from "../eyeRest/content";
import { tipSections, tipsCopy } from "./content";
import { adviceCards } from "./advice";
import { adviceCopy } from "./adviceCopy";

const mockOpen = jest.fn(async () => true);
const mockDismissTo = jest.fn();
const mockReplace = jest.fn();
const mockParams: { topic?: string | string[] } = {};
jest.mock("expo-router", () => ({
  router: {
    dismissTo: (...args: unknown[]) => mockDismissTo(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("../../components/EmptyState", () => ({ EmptyState: "EmptyState" }));
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
  mockOpen.mockResolvedValue(true);
  mockReplace.mockClear();
  delete mockParams.topic;
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

test("the eye-rest button opens the exercises", async () => {
  const button = renderer.root.find(
    (node) => String(node.type) === "Button" && node.props.label === eyeRestCopy.openFromTips,
  );
  await act(async () => button.props.onPress());
  expect(mockDismissTo).toHaveBeenCalledWith("/eye-rest");
});

test("each topic link shows all of that topic's text and exact sources", async () => {
  for (const card of adviceCards) {
    mockParams.topic = card.id;
    await act(async () => renderer.update(<TipsScreen />));
    expect(text()).toContain(card.title);
    for (const tip of card.tips) {
      expect(text()).toContain(tip.text);
      expect(text()).toContain(tip.source.label);
    }
    const links = renderer.root.findAll((node) => node.props.accessibilityRole === "link");
    expect(links.map((link) => link.props.accessibilityHint)).toEqual(
      card.tips.map((tip) => tip.source.url),
    );
    expect(text()).toContain(tipsCopy.notice);
  }
});

test("invalid or repeated topic parameters offer a route back to all advice", async () => {
  for (const topic of ["missing", ["early-checks", "screen-time"]]) {
    mockParams.topic = topic;
    await act(async () => renderer.update(<TipsScreen />));
    const empty = renderer.root.findByType("EmptyState" as never);
    expect(empty.props.message).toBe(adviceCopy.missing);
    await act(async () => empty.props.action.onPress());
    expect(mockReplace).toHaveBeenLastCalledWith("/tips");
  }
});

test("offline source-link errors show feedback and allow another attempt", async () => {
  const firstLink = () =>
    renderer.root.findAll((node) => node.props.accessibilityRole === "link")[0]!;
  mockOpen.mockRejectedValueOnce(new Error("offline"));
  await act(async () => firstLink().props.onPress());
  expect(text()).toContain(adviceCopy.sourceFailed);
  await act(async () => firstLink().props.onPress());
  expect(text()).not.toContain(adviceCopy.sourceFailed);
});
