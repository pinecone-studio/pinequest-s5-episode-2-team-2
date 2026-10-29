import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { QuizGame } from "./QuizGame";
import { quizCopy, quizQuestions } from "./quiz";

const mockPlay = jest.fn();
jest.mock("expo-audio", () => ({
  useAudioPlayer: (sound: number) => ({ play: () => mockPlay(sound), seekTo: jest.fn() }),
}));
jest.mock("../../../assets/sounds/correct.wav", () => 3, { virtual: true });
jest.mock("../../../assets/sounds/wrong.wav", () => 4, { virtual: true });
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("react-native", () => ({
  Linking: { openURL: jest.fn() },
  Pressable: "Pressable",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock("../../components/ui", () => ({ Button: "Button", Text: "Text" }));

let renderer: ReactTestRenderer;
const onFinish = jest.fn();
const onExit = jest.fn();
const text = () => JSON.stringify(renderer.toJSON());
const choice = (label: string) =>
  renderer.root.find(
    (node) => String(node.type) === "Pressable" && node.props.accessibilityLabel === label,
  );
const button = (label: string) =>
  renderer.root.find((node) => String(node.type) === "Button" && node.props.label === label);

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.clearAllMocks();
  await act(async () => {
    renderer = create(<QuizGame onFinish={onFinish} onExit={onExit} />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});

test("a wrong pick plays the wrong sound and lets the child try again", async () => {
  const bad = quizQuestions[0]!.choices.find((c) => !c.good)!;
  await act(async () => choice(bad.text).props.onPress());
  expect(mockPlay).toHaveBeenCalledWith(4);
  expect(text()).toContain(quizCopy.wrong);
  expect(text()).not.toContain(quizCopy.next);
});

test("answering every question right finishes once with a star", async () => {
  for (const question of quizQuestions) {
    const good = question.choices.find((c) => c.good)!;
    await act(async () => choice(good.text).props.onPress());
    expect(mockPlay).toHaveBeenLastCalledWith(3);
    expect(text()).toContain(question.why);
    expect(text()).toContain(question.source.label);
    await act(async () => button(quizCopy.next).props.onPress());
  }
  expect(text()).toContain(quizCopy.done);
  expect(onFinish).toHaveBeenCalledTimes(1);

  await act(async () => button(quizCopy.again).props.onPress());
  expect(text()).toContain(quizCopy.question(1, quizQuestions.length));
});

test("every question has one good and one other choice, each with a source", () => {
  for (const question of quizQuestions) {
    expect(question.choices.filter((c) => c.good)).toHaveLength(1);
    expect(question.source.url).toMatch(/^https:\/\//);
  }
});
