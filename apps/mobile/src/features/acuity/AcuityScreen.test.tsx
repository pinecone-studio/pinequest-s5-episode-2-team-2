import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { HeaderHeightContext } from "expo-router/react-navigation";
import AcuityScreen from "./AcuityScreen";
import { acuityCopy as copy } from "./copy";
import { Optotype } from "./Optotype";
import type { GestureAnswer } from "./gestureHold";

const mockBack = jest.fn();
jest.mock("../../components/Mascot", () => ({ Mascot: "Mascot" }));
jest.mock("expo-router", () => ({ router: { back: () => mockBack() } }));
jest.mock("./SaveAcuityButton", () => ({ SaveAcuityButton: "SaveAcuityButton" }));
jest.mock("./AcuityGestureInput", () => ({
  AcuityGestureInput: (props: object) =>
    jest.requireActual("react").createElement("GestureInput", props),
}));
jest.mock("expo-router/react-navigation", () => ({
  HeaderHeightContext: jest.requireActual("react").createContext(undefined),
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
  ScrollView: "ScrollView",
  PixelRatio: { get: () => 3 },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  StyleSheet: { create: (styles: unknown) => styles },
}));

let renderer: ReactTestRenderer;
// As in the web demo, the ready button shows the thumbs-up that also answers it.
const READY = `${copy.ready} 👍`;
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
  press(READY);
  // Four arrows and "can't see"; two misses finish the right eye.
  expect(all("Pressable")).toHaveLength(4);
  press(copy.cantSee);
  press(copy.cantSee);
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.cover("left"));
  press(READY);
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
  // Testing the right eye: the voice asks to cover the LEFT eye, matching the text, then for
  // a thumbs-up, since the camera answers by default.
  expect(mockSay).toHaveBeenLastCalledWith("acuity-cover-left", "acuity-thumb");
  jest.useRealTimers();
});

test("the test itself only gives neutral cues, so it does not reveal correct answers", () => {
  act(() => {
    renderer = create(<AcuityScreen />);
  });
  press(copy.groups.adult);
  press(copy.practice.skip);
  press(READY);
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

test("every test letter and its crowding bars fit one fixed space above the controls", () => {
  act(() => {
    renderer = create(<AcuityScreen />);
  });
  press(copy.groups.adult);
  press(copy.practice.skip);
  const letters = () => renderer.root.findAllByType(Optotype);
  const has = (label: string) =>
    renderer.root.findAll((n) => n.type === ("Button" as never) && n.props.label === label).length;
  // 390 × 844 points: the square is min(390 - 40, 844 / 2) = 350 points; the largest letter
  // shown is the crowded 0.7 line, 2.4 × 132 = 317 points, so the space is that tall.
  const heights = new Set<number>();
  let checked = 0;
  for (let i = 0; i < 80; i++) {
    if (letters().length) {
      const { size, crowded } = letters()[0]!.props;
      const box = letters()[0]!.parent!;
      const height = box.props.style[1].height;
      heights.add(height);
      expect(crowded ? (size * 12) / 5 : size).toBeLessThanOrEqual(height + 1e-9);
      expect(height).toBeLessThanOrEqual(350);
      // The answers sit in a scroll view after the letter's space, never inside it.
      expect(all("ScrollView")).toHaveLength(1);
      expect(box.findAll((n) => n.type === ("GestureInput" as never))).toHaveLength(0);
      checked += 1;
      // Right answers walk down every level to the smallest, crowded letters.
      press(labels[shown()]);
    } else if (has(READY)) press(READY);
    else break;
  }
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.resultTitle);
  expect(checked).toBe(2 * 8);
  expect([...heights]).toHaveLength(1);
  expect([...heights][0]).toBeCloseTo(317, 0);
});

test("the practice letter fits the space the controls leave", () => {
  act(() => {
    renderer = create(<AcuityScreen />);
  });
  press(copy.groups.adult);
  expect(renderer.root.findByType(Optotype).props.size).toBeCloseTo(844 * 0.3, 5);
  const area = renderer.root.find((n) => n.props.testID === "practice-letter");
  act(() =>
    area.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 350, height: 120 } } }),
  );
  expect(renderer.root.findByType(Optotype).props.size).toBe(120);
});

test("as on the web, arrows and can't see sit below the camera; below a header the top inset is the header's", () => {
  const edges = () => all("SafeAreaView")[0]!.props.edges;
  act(() => {
    renderer = create(<AcuityScreen />);
  });
  press(copy.groups.adult);
  expect(edges()).toEqual(["top", "bottom"]);
  // Practice: the camera, then the four arrows, both always on screen.
  expect(all("GestureInput")[0]!.props.eye).toBeNull();
  expect(all("Pressable")).toHaveLength(4);
  press(copy.practice.skip);
  expect(all("GestureInput")[0]!.props.eye).toBe("right");
  press(READY);
  const controls = all("ScrollView")[0]!.children.map((child) =>
    typeof child === "string"
      ? child
      : (child.props.label ?? child.props.children ?? (child.type as { name?: string }).name),
  );
  expect(controls[0]).toBe("AcuityGestureInput");
  expect(controls.at(-1)).toBe(copy.cantSee);
  expect(controls).toContain(copy.gestureHint);
  act(() => renderer.unmount());
  act(() => {
    renderer = create(
      <HeaderHeightContext.Provider value={100}>
        <AcuityScreen />
      </HeaderHeightContext.Provider>,
    );
  });
  press(copy.groups.adult);
  expect(edges()).toEqual(["bottom"]);
});

test("the camera's cover reading, pause and held answer show as on the web", () => {
  jest.useFakeTimers();
  act(() => {
    renderer = create(<AcuityScreen />);
  });
  const text = () => JSON.stringify(renderer.toJSON());
  const status = (value: object | null) => act(() => all("GestureInput")[0]!.props.onStatus(value));
  press(copy.groups.adult);
  expect(text()).toContain(copy.steps.fist);
  press(copy.practice.skip);
  status({ cover: "wrongEye", paused: false, detected: null });
  expect(text()).toContain(copy.coverStatus.wrongEye);
  status({ cover: "covered", paused: false, detected: "ready" });
  expect(text()).toContain(copy.coverStatus.covered);
  act(() => all("GestureInput")[0]!.props.onAnswer("ready"));
  status(null);
  const arrow = (d: 0 | 90 | 180 | 270) =>
    renderer.root.find(
      (n) => n.type === ("Pressable" as never) && n.props.accessibilityLabel === labels[d],
    );
  // Past the base and position styles come the highlight and the pressed/taken flash.
  const lit = (d: 0 | 90 | 180 | 270) =>
    (arrow(d).props.style({ pressed: false }) as unknown[]).slice(2).some(Boolean);
  expect(lit(0)).toBe(false);
  status({ cover: "covered", paused: false, detected: 0 });
  expect(lit(0)).toBe(true);
  expect(lit(90)).toBe(false);
  expect(text()).not.toContain(copy.coverPaused);
  // Paused: the note shows above the letter and nothing is highlighted.
  status({ cover: "open", paused: true, detected: null });
  expect(text()).toContain(copy.coverPaused);
  expect(lit(0)).toBe(false);
  status({ cover: "covered", paused: false, detected: "cant" });
  const cant = renderer.root.find(
    (n) => n.type === ("Button" as never) && n.props.label === copy.cantSee,
  );
  expect(cant.props.variant).toBe("primary");
  // A direction the camera takes flashes for a moment.
  status(null);
  act(() => all("GestureInput")[0]!.props.onAnswer(90));
  expect(lit(90)).toBe(true);
  act(() => jest.advanceTimersByTime(250));
  expect(lit(90)).toBe(false);
  jest.useRealTimers();
});

test("an open palm from the camera answers can't see, like the button", () => {
  act(() => {
    renderer = create(<AcuityScreen />);
  });
  press(copy.groups.adult);
  press(copy.practice.skip);
  press(READY);
  const gesture = (value: GestureAnswer) =>
    act(() => all("GestureInput")[0]!.props.onAnswer(value));
  // Two misses finish the right eye at the first level, as with the button.
  gesture("cant");
  gesture("cant");
  expect(JSON.stringify(renderer.toJSON())).toContain(copy.cover("left"));
});
