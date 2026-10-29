import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import EyeRestScreen, { INTRO_MS } from "./EyeRestScreen";
import { exercises, eyeRestCopy } from "./content";
import { quizCopy } from "./quiz";

const mockOpen = jest.fn(async () => true);
const mockPlay = jest.fn();
jest.mock("expo-audio", () => ({
  useAudioPlayer: () => ({ play: mockPlay, seekTo: jest.fn() }),
}));
jest.mock("../../../assets/sounds/correct.wav", () => 3, { virtual: true });
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("../../components/Mascot", () => ({ Mascot: "Mascot" }));
jest.mock("./QuizGame", () => ({ QuizGame: "QuizGame" }));
const mockSay = jest.fn();
jest.mock("../voice/useVoice", () => ({
  useVoice: () => ({ say: (...keys: string[]) => mockSay(...keys), stop: jest.fn() }),
}));
const mockDb = {};
jest.mock("expo-sqlite", () => ({ useSQLiteContext: () => mockDb }));
let mockChildId: string | null = "c1";
jest.mock("../children/useActiveChildId", () => ({ useActiveChildId: () => mockChildId }));
const mockAddStar = jest.fn(async () => true);
let mockToday: string[] = [];
jest.mock("../../storage/play", () => ({
  addStar: (...args: unknown[]) => mockAddStar(...(args as [])),
  starSummary: async () => ({ total: 7, today: mockToday }),
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
const starts = () =>
  renderer.root.findAll(
    (node) =>
      String(node.type) === "Pressable" && node.props.accessibilityHint === eyeRestCopy.start,
  );
const startOf = (title: string) =>
  starts().find((node) => String(node.props.accessibilityLabel).startsWith(title))!;
const button = (label: string) =>
  renderer.root.findAll((node) => String(node.type) === "Button" && node.props.label === label);
const blink = exercises.find((exercise) => exercise.key === "blink")!;
const outside = exercises.find((exercise) => exercise.key === "outside")!;
/** Advance the clock a second at a time, so every step renders as it would on a phone. */
const tick = async (seconds: number) => {
  for (let i = 0; i < seconds; i++) await act(async () => jest.advanceTimersByTime(1000));
};
/** Blinking has a spoken intro before its first step. */
const startBlink = async () => {
  await act(async () => startOf(blink.title).props.onPress());
  await act(async () => jest.advanceTimersByTime(INTRO_MS));
};
const rest = exercises.find((exercise) => exercise.key === "20-20-20")!;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.useFakeTimers({ now: new Date("2026-10-27T10:00:00Z") });
  mockOpen.mockClear();
  mockPlay.mockClear();
  mockSay.mockClear();
  mockAddStar.mockClear();
  mockChildId = "c1";
  mockToday = [];
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
  expect(starts()).toHaveLength(exercises.length + 1);
});

test("start shows the first step, then counts through rounds to the end", async () => {
  await startBlink();
  expect(text()).toContain(blink.steps[0]!.text);
  expect(text()).toContain(eyeRestCopy.round(1, blink.rounds));

  await act(async () => jest.advanceTimersByTime(blink.steps[0]!.seconds * 1000));
  expect(text()).toContain(blink.steps[1]!.text);

  await act(async () => jest.advanceTimersByTime(60_000));
  expect(text()).toContain(eyeRestCopy.done);
  expect(button(eyeRestCopy.again)).toHaveLength(1);
});

test("a running exercise takes the whole screen with a big countdown and progress", async () => {
  await startBlink();
  // The other exercises, their start buttons and source links are hidden while it runs.
  expect(starts()).toHaveLength(0);
  for (const other of exercises.filter((exercise) => exercise !== blink)) {
    expect(text()).not.toContain(other.title);
  }
  expect(text()).toContain(blink.title);
  expect(text()).toContain(eyeRestCopy.secondsUnit);
  const bar = () => renderer.root.find((node) => node.props.accessibilityRole === "progressbar");
  expect(bar().props.accessibilityValue).toEqual({ min: 0, max: 100, now: 0 });

  await act(async () => jest.advanceTimersByTime(10_000));
  expect(bar().props.accessibilityValue.now).toBe(50);
  expect(button(eyeRestCopy.stop)).toHaveLength(1);
});

test("after the end, again restarts and back returns to the list", async () => {
  await act(async () => startOf(rest.title).props.onPress());
  await act(async () => jest.advanceTimersByTime(rest.steps[0]!.seconds * 1000));
  expect(text()).toContain(eyeRestCopy.done);

  await act(async () => button(eyeRestCopy.again)[0]!.props.onPress());
  expect(text()).toContain(rest.steps[0]!.text);

  await act(async () => jest.advanceTimersByTime(rest.steps[0]!.seconds * 1000));
  await act(async () => button(eyeRestCopy.back)[0]!.props.onPress());
  expect(starts()).toHaveLength(exercises.length + 1);
});

test("a chime plays on each new step and at the end, not at the start", async () => {
  await act(async () => startOf(outside.title).props.onPress());
  expect(mockPlay).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(outside.steps[0]!.seconds * 1000));
  expect(mockPlay).toHaveBeenCalledTimes(1);
  await tick(5 * 60);
  expect(text()).toContain(eyeRestCopy.done);
  expect(mockPlay).toHaveBeenCalledTimes(outside.steps.length);
});

test("blinking is voiced: intro, close/open for every step, then the end", async () => {
  await act(async () => startOf(blink.title).props.onPress());
  expect(text()).toContain(eyeRestCopy.getReady);
  expect(mockSay).toHaveBeenLastCalledWith("blink-start");
  await act(async () => jest.advanceTimersByTime(INTRO_MS));
  expect(mockSay).toHaveBeenLastCalledWith("blink-close");
  await act(async () => jest.advanceTimersByTime(blink.steps[0]!.seconds * 1000));
  expect(mockSay).toHaveBeenLastCalledWith("blink-open");
  await tick(30);
  expect(mockSay).toHaveBeenLastCalledWith("blink-done");
  const spoken = mockSay.mock.calls.flat();
  expect(spoken.filter((key) => key === "blink-close")).toHaveLength(blink.rounds);
  expect(spoken.filter((key) => key === "blink-open")).toHaveLength(blink.rounds);
  expect(mockPlay).not.toHaveBeenCalled();
});

test("each card shows its picture tile and tag", () => {
  for (const exercise of exercises) expect(text()).toContain(exercise.tag);
  const icons = renderer.root.findAll((node) => String(node.type) === "Ionicons");
  for (const exercise of exercises) {
    expect(icons.some((icon) => icon.props.name === exercise.icon)).toBe(true);
  }
});

test("stop goes back to the start buttons", async () => {
  await act(async () => starts()[0]!.props.onPress());
  await act(async () => button(eyeRestCopy.stop)[0]!.props.onPress());
  expect(starts()).toHaveLength(exercises.length + 1);
});

test("tapping a source opens its page", async () => {
  const links = renderer.root.findAll((node) => node.props.accessibilityRole === "link");
  await act(async () => links[0]!.props.onPress());
  expect(mockOpen).toHaveBeenCalledWith(exercises[0]!.source.url);
});

test("the header shows the child's stars and today's progress", async () => {
  expect(text()).toContain(eyeRestCopy.stars(7));
  expect(text()).toContain(eyeRestCopy.dailyTitle);
  const dots = renderer.root.find(
    (node) => node.props.accessibilityLabel === eyeRestCopy.dailyProgress(0, 3),
  );
  expect(dots).toBeTruthy();
});

test("finishing an exercise earns a star for that game", async () => {
  await act(async () => startOf(rest.title).props.onPress());
  await act(async () => jest.advanceTimersByTime(rest.steps[0]!.seconds * 1000));
  expect(mockAddStar).toHaveBeenCalledTimes(1);
  expect(mockAddStar.mock.calls[0]).toEqual(expect.arrayContaining(["c1", rest.key]));
  expect(text()).toContain(eyeRestCopy.starEarned);
});

test("the quiz card opens the quiz game", async () => {
  await act(async () => startOf(quizCopy.title).props.onPress());
  expect(renderer.root.findAll((node) => String(node.type) === "QuizGame")).toHaveLength(1);
});

test("without a child profile the games work but no star is saved", async () => {
  await act(async () => renderer.unmount());
  mockChildId = null;
  await act(async () => {
    renderer = create(<EyeRestScreen />);
  });
  expect(text()).toContain(eyeRestCopy.dailyNoChild);
  expect(text()).not.toContain(eyeRestCopy.stars(7));
  await act(async () => startOf(rest.title).props.onPress());
  await act(async () => jest.advanceTimersByTime(rest.steps[0]!.seconds * 1000));
  expect(mockAddStar).not.toHaveBeenCalled();
});

test("the hero shows the Нүдхэн mascot instead of the eye mark", () => {
  const mascots = renderer.root.findAll((node) => String(node.type) === "Mascot");
  expect(mascots).toHaveLength(1);
  expect(mascots[0]!.props.variant).toBe("idle_happy");
});
