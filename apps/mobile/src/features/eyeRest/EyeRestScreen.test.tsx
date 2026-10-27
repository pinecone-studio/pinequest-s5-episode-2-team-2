import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import EyeRestScreen from "./EyeRestScreen";
import { exercises, eyeRestCopy } from "./content";

const mockOpen = jest.fn(async () => true);
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
const button = (label: string) =>
  renderer.root.findAll((node) => String(node.type) === "Button" && node.props.label === label);
const blink = exercises.find((exercise) => exercise.key === "blink")!;
const blinkIndex = exercises.indexOf(blink);

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.useFakeTimers({ now: new Date("2026-10-27T10:00:00Z") });
  mockOpen.mockClear();
  await act(async () => {
    renderer = create(<EyeRestScreen />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.useRealTimers();
});

test("lists every exercise with its source and the not-a-treatment notice", () => {
  for (const exercise of exercises) {
    expect(text()).toContain(exercise.title);
    expect(text()).toContain(exercise.source.label);
  }
  expect(text()).toContain(eyeRestCopy.notice);
  expect(button(eyeRestCopy.start)).toHaveLength(exercises.length);
});

test("start shows the first step, then counts through rounds to the end", async () => {
  await act(async () => button(eyeRestCopy.start)[blinkIndex]!.props.onPress());
  expect(text()).toContain(blink.steps[0]!.text);
  expect(text()).toContain(eyeRestCopy.round(1, blink.rounds));

  await act(async () => jest.advanceTimersByTime(blink.steps[0]!.seconds * 1000));
  expect(text()).toContain(blink.steps[1]!.text);

  await act(async () => jest.advanceTimersByTime(60_000));
  expect(text()).toContain(eyeRestCopy.done);
  expect(button(eyeRestCopy.again)).toHaveLength(1);
});

test("stop goes back to the start buttons", async () => {
  await act(async () => button(eyeRestCopy.start)[0]!.props.onPress());
  await act(async () => button(eyeRestCopy.stop)[0]!.props.onPress());
  expect(button(eyeRestCopy.start)).toHaveLength(exercises.length);
});

test("tapping a source opens its page", async () => {
  const links = renderer.root.findAll((node) => node.props.accessibilityRole === "link");
  await act(async () => links[0]!.props.onPress());
  expect(mockOpen).toHaveBeenCalledWith(exercises[0]!.source.url);
});
