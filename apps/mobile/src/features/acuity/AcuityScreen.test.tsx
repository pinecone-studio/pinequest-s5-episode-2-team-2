import { act, type ReactNode } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import AcuityScreen from "./AcuityScreen";
import { acuityCopy as copy } from "./copy";
import { Optotype } from "./Optotype";
import type { GestureAnswer } from "./gestureHold";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({ router: { back: () => mockBack() } }));
jest.mock("./SaveAcuityButton", () => ({ SaveAcuityButton: "SaveAcuityButton" }));
jest.mock("./AcuityGestureInput", () => ({
  AcuityGestureInput: ({ manual, ...props }: { manual: ReactNode }) =>
    jest.requireActual("react").createElement("GestureInput", props, manual),
}));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
const mockSay = jest.fn();
jest.mock("../voice/useVoice", () => ({
  useVoice: () => ({ say: (...keys: string[]) => mockSay(...keys), stop: jest.fn() }),
}));
/** Every key spoken so far, flattened. */
const spoken = () => mockSay.mock.calls.flat() as string[];
// The test may only give cues that do not depend on the answer.
const NEUTRAL = [
  "acuity-next",
  "acuity-cover-left",
  "acuity-cover-right",
  "acuity-thumb",
  "acuity-done",
];
jest.mock("../../components/ui", () => ({
  Button: "Button",
  Card: "Card",
  Screen: "Screen",
  Text: "Text",
  Verdict: "Verdict",
  Notice: "Notice",
}));
jest.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  PixelRatio: { get: () => 3 },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  StyleSheet: { create: (styles: unknown) => styles },
}));

let renderer: ReactTestRenderer;
const all = (type: string) => renderer.root.findAll((n) => n.type === type);
// Buttons by label; the age-group choices are Pressables with an accessibility label.
const press = (label: string) =>
  act(() =>
    renderer.root
      .find(
        (n) =>
          (n.type === ("Button" as never) && n.props.label === label) ||
          (n.type === ("Pressable" as never) && n.props.accessibilityLabel === label),
      )
      .props.onPress(),
  );
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockSay.mockReset();
});
afterEach(() => act(() => renderer?.unmount()));

test("the E has four strokes, plus four bars when crowded, and turns with direction", () => {
  act(() => {
    renderer = create(<Optotype size={50} direction={90} crowded={false} />);
  });
  const box = renderer.root.findAll((n) => (n.type as unknown) === "View")[0]!;
  expect(box.props.style).toMatchObject({
    width: 50,
    height: 50,
    transform: [{ rotate: "90deg" }],
  });
  expect(all("View")).toHaveLength(1 + 4);
  act(() => renderer.update(<Optotype size={50} direction={0} crowded />));
  expect(all("View")).toHaveLength(1 + 8);
  // Crowded box is 12 strokes wide: 120 points for a 50-point letter.
  expect(all("View")[0]!.props.style.width).toBe(120);
});

test("runs both eyes from age group to result", () => {
  act(() => {
    renderer = create(<AcuityScreen />);
  });
  // Four age-group choices.
  expect(all("Pressable")).toHaveLength(4);
  press(copy.groups.adult);
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.practice.intro);
  press(copy.practice.skip);
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.cover("right"));
  press(copy.ready);
  // Four arrows and "can't see"; two misses finish the right eye.
  expect(all("Pressable")).toHaveLength(4);
  press(copy.cantSee);
  press(copy.cantSee);
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.cover("left"));
  press(copy.ready);
  press(copy.cantSee);
  press(copy.cantSee);
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain(copy.belowChart);
  expect(text).toContain(copy.refer.title);
  expect(text).toContain(copy.minusBelow);
  expect(text).toContain(copy.notice);
  expect(all("SaveAcuityButton")[0]!.props.check).toEqual({
    group: "adult",
    right: null,
    left: null,
    refer: true,
  });
  press(copy.done);
  expect(mockBack).toHaveBeenCalled();
});

const labels = { 0: copy.right, 90: copy.down, 180: copy.left, 270: copy.up } as const;
const shown = () => renderer.root.findByType(Optotype).props.direction as keyof typeof labels;
const wrongOf = (d: keyof typeof labels) => ([0, 90, 180, 270] as const).find((x) => x !== d)!;

test("practice says Зөв! when right and Дахин оролдоорой when wrong, then starts", () => {
  jest.useFakeTimers();
  act(() => {
    renderer = create(<AcuityScreen />);
  });
  press(copy.groups.child4);
  expect(mockSay).toHaveBeenCalledWith("acuity-practice", "acuity-intro");
  press(labels[wrongOf(shown())]);
  expect(mockSay).toHaveBeenLastCalledWith("acuity-wrong");
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.practice.wrong);
  press(labels[shown()]);
  expect(mockSay).toHaveBeenLastCalledWith("acuity-correct");
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.practice.correct);
  press(labels[shown()]);
  expect(mockSay).toHaveBeenLastCalledWith("acuity-great");
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.practice.great);
  act(() => jest.advanceTimersByTime(1500));
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.cover("right"));
  // Testing the right eye: the voice asks to cover the LEFT eye, matching the text.
  expect(mockSay).toHaveBeenLastCalledWith("acuity-cover-left");
  jest.useRealTimers();
});

test("the test itself only gives neutral cues, so it does not reveal correct answers", () => {
  act(() => {
    renderer = create(<AcuityScreen />);
  });
  press(copy.groups.adult);
  press(copy.practice.skip);
  press(copy.ready);
  mockSay.mockClear();
  press(labels[shown()]);
  press(labels[wrongOf(shown())]);
  press(copy.cantSee);
  for (const key of spoken()) expect(NEUTRAL).toContain(key);
});

test("camera answers share practice feedback, thumbs-up readiness and silent test decisions", () => {
  jest.useFakeTimers();
  act(() => {
    renderer = create(<AcuityScreen />);
  });
  press(copy.groups.adult);
  const gesture = (value: GestureAnswer) =>
    act(() => all("GestureInput")[0]!.props.onAnswer(value));
  gesture(shown());
  expect(mockSay).toHaveBeenLastCalledWith("acuity-correct");
  gesture(shown());
  act(() => jest.advanceTimersByTime(1500));
  expect(all("GestureInput")[0]!.props.cover).toBe(true);
  gesture("ready");
  mockSay.mockClear();
  gesture(wrongOf(shown()));
  gesture(wrongOf(shown()));
  for (const key of spoken()) expect(NEUTRAL).toContain(key);
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.cover("left"));
  jest.useRealTimers();
});
