import { act } from "react";
import { create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { ClinicGame } from "./ClinicGame";
import { clinicCopy, eyeMovesCopy, photoCopy, rescueCopy, spaceCopy, worldCopy } from "./copy";
import { EyeMovesGame } from "./EyeMovesGame";
import { CLINIC_CASES, PHOTO_ROUNDS, eyeRoutine, type Direction } from "./logic";
import { PhotoGame } from "./PhotoGame";
import { RescueGame } from "./RescueGame";
import { SpaceGame } from "./SpaceGame";

jest.mock("react-native", () => jest.requireActual("./testMocks").reactNativeMock());
jest.mock("../../components/ui", () => jest.requireActual("./testMocks").uiMock());
jest.mock("../../components/mascots", () => jest.requireActual("./testMocks").mascotsMock());
jest.mock("../../components/Mascot", () => ({ Mascot: "Mascot" }));
jest.mock("../../components/useReduceMotion", () => ({ useReduceMotion: () => true }));
jest.mock("expo-audio", () => ({ useAudioPlayer: () => ({ play: mockPlay, seekTo: jest.fn() }) }));
jest.mock("../../../assets/sounds/correct.wav", () => 1, { virtual: true });
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "LinearGradient" }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

const mockPlay = jest.fn();
let renderer: ReactTestRenderer;
const onComplete = jest.fn(async () => worldCopy.starEarned);
const onExit = jest.fn();
const text = () => JSON.stringify(renderer.toJSON());
const byLabel = (label: string) =>
  renderer.root.find(
    (node) => String(node.type) === "Pressable" && node.props.accessibilityLabel === label,
  );
const buttonByLabel = (label: string) =>
  renderer.root.find((node) => String(node.type) === "Button" && node.props.label === label);
const press = (node: ReactTestInstance) => act(async () => node.props.onPress());

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.useFakeTimers();
  onComplete.mockClear();
  onExit.mockClear();
  mockPlay.mockReset();
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.useRealTimers();
});
async function render(element: React.ReactElement) {
  await act(async () => {
    renderer = create(element);
  });
}

test("rescue: three puzzles with hints, no failing, and one completion", async () => {
  await render(<RescueGame onComplete={onComplete} onExit={onExit} />);
  expect(text()).toContain(rescueCopy.intro);
  await press(buttonByLabel(rescueCopy.start));

  // The room is measured before it draws.
  const room = renderer.root.find((n) => typeof n.props.onLayout === "function");
  await act(async () =>
    room.props.onLayout({ nativeEvent: { layout: { width: 340, height: 320 } } }),
  );
  expect(text()).toContain(rescueCopy.phone.task);
  await press(byLabel(rescueCopy.phone.action));
  expect(text()).toContain(rescueCopy.phone.done);
  await act(async () => jest.advanceTimersByTime(1500));

  // Shutting the curtain fully is too dark; half is right.
  expect(text()).toContain(rescueCopy.glare.task);
  const chip = (label: string) =>
    renderer.root.find(
      (n) =>
        String(n.type) === "Pressable" &&
        n.findAll((t) => String(t.type) === "Text" && t.props.children === label).length > 0,
    );
  await press(chip(rescueCopy.glare.closed));
  expect(text()).toContain(rescueCopy.glare.tooDark);
  await press(chip(rescueCopy.glare.half));
  expect(text()).toContain(rescueCopy.glare.done);
  await act(async () => jest.advanceTimersByTime(1500));

  // A wrong choice only asks for another try.
  await press(byLabel(rescueCopy.rest.closer));
  expect(text()).toContain(rescueCopy.rest.tryOther);
  expect(onComplete).not.toHaveBeenCalled();
  await press(byLabel(rescueCopy.rest.takeBreak));
  await act(async () => jest.advanceTimersByTime(1500));
  expect(text()).toContain(rescueCopy.finished);
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(text()).toContain(worldCopy.starEarned);
});

test("space: a wrong arrow explains the open side; the game keeps no score", async () => {
  await render(<SpaceGame onComplete={onComplete} onExit={onExit} />);
  expect(text()).toContain(spaceCopy.note);
  await press(buttonByLabel(spaceCopy.start));
  const current = (): Direction => {
    const e = renderer.root.find((n) => n.props.testID === "playful-e");
    const rotate = JSON.stringify(e.props.style).match(/"rotate":"(\d+)deg"/)![1];
    return ({ "0": "right", "90": "down", "180": "left", "270": "up" } as const)[rotate as "0"];
  };
  const wrong = current() === "up" ? "down" : "up";
  await press(byLabel(spaceCopy.directions[wrong]));
  expect(text()).toContain(spaceCopy.explain(spaceCopy.directions[current()]));
  for (let round = 0; round < 5; round++) {
    await press(byLabel(spaceCopy.directions[current()]));
    await act(async () => jest.advanceTimersByTime(600));
  }
  expect(text()).toContain(spaceCopy.finished);
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test("photo: wrong pictures show the approved reason; good ones move on", async () => {
  await render(<PhotoGame onComplete={onComplete} onExit={onExit} />);
  await press(buttonByLabel(photoCopy.start));
  for (const round of PHOTO_ROUNDS) {
    const cards = () =>
      renderer.root.findAll(
        (n) =>
          String(n.type) === "Pressable" &&
          n.props.accessibilityRole === "button" &&
          n.props.accessibilityLabel !== worldCopy.exit,
      );
    const wrongIndex = round.findIndex((o) => !o.good);
    await press(cards()[wrongIndex]!);
    expect(text()).toContain(round[wrongIndex]!.label);
    await press(cards()[round.findIndex((o) => o.good)]!);
    expect(text()).toContain(photoCopy.good);
    const next = cards().at(-1)!;
    await press(next);
  }
  expect(text()).toContain(photoCopy.finished);
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test("clinic: every case teaches the safe next step and ends with a helper badge", async () => {
  await render(<ClinicGame onComplete={onComplete} onExit={onExit} />);
  await press(buttonByLabel(clinicCopy.start));
  for (const patient of CLINIC_CASES) {
    expect(text()).toContain(patient.says);
    const bad = patient.choices.find((c) => !c.good)!;
    await press(byLabel(bad.label));
    expect(text()).toContain(bad.why!);
    await press(byLabel(patient.choices.find((c) => c.good)!.label));
    expect(text()).toContain(clinicCopy.good);
    await press(byLabel(worldCopy.next));
  }
  expect(text()).toContain(clinicCopy.badge);
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test("the close button leaves any game at any time without a star", async () => {
  await render(<ClinicGame onComplete={onComplete} onExit={onExit} />);
  await press(byLabel(worldCopy.exit));
  expect(onExit).toHaveBeenCalledTimes(1);
  expect(onComplete).not.toHaveBeenCalled();
});

test("eye moves: choose who, follow every move, blink, rest and finish with a chime", async () => {
  await render(<EyeMovesGame onComplete={onComplete} onExit={onExit} />);
  expect(text()).toContain(eyeMovesCopy.story);
  expect(text()).toContain(eyeMovesCopy.note);
  expect(byLabel(eyeMovesCopy.child).props.accessibilityState).toEqual({ selected: true });
  await press(byLabel(eyeMovesCopy.adult));
  expect(byLabel(eyeMovesCopy.adult).props.accessibilityState).toEqual({ selected: true });
  await press(buttonByLabel(eyeMovesCopy.start));

  // The sky is measured before the butterfly flies.
  const sky = renderer.root.find((n) => typeof n.props.onLayout === "function");
  await act(async () =>
    sky.props.onLayout({ nativeEvent: { layout: { width: 340, height: 480 } } }),
  );
  const steps = eyeRoutine("adult");
  for (const [i, step] of steps.entries()) {
    expect(text()).toContain(eyeMovesCopy.step(i + 1, steps.length));
    if (step.kind === "move") {
      expect(text()).toContain(eyeMovesCopy.moves[step.move]);
      expect(text()).toContain(eyeMovesCopy.follow);
      expect(text()).toContain("🦋");
    }
    if (step.kind === "blink") expect(text()).toContain(eyeMovesCopy.blink);
    if (step.kind === "rest") {
      expect(text()).toContain(eyeMovesCopy.rest);
      expect(text()).toContain(eyeMovesCopy.seconds(step.seconds));
    }
    // A step lasts its time: nothing moves on a moment early.
    await act(async () => jest.advanceTimersByTime(step.seconds * 1000 - 1));
    expect(text()).toContain(eyeMovesCopy.step(i + 1, steps.length));
    expect(onComplete).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1));
  }
  // The chime calls closed eyes open, and the star is for taking part.
  expect(mockPlay).toHaveBeenCalledTimes(1);
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(text()).toContain(eyeMovesCopy.finished);
  expect(text()).toContain(worldCopy.starEarned);
  await press(buttonByLabel(worldCopy.again));
  expect(text()).toContain(eyeMovesCopy.story);
});

test("eye moves: children get the shorter routine, skip moves on and the rest counts down", async () => {
  await render(<EyeMovesGame onComplete={onComplete} onExit={onExit} />);
  await press(buttonByLabel(eyeMovesCopy.start));
  const steps = eyeRoutine("child");
  expect(text()).toContain(eyeMovesCopy.step(1, steps.length));
  for (let i = 0; i < steps.length - 1; i++) await press(buttonByLabel(worldCopy.skip));
  const rest = steps.at(-1)!;
  expect(text()).toContain(eyeMovesCopy.rest);
  expect(text()).toContain(eyeMovesCopy.seconds(rest.seconds));
  await act(async () => jest.advanceTimersByTime(3000));
  expect(text()).toContain(eyeMovesCopy.seconds(rest.seconds - 3));
  await act(async () => jest.advanceTimersByTime(rest.seconds * 1000));
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(text()).toContain(eyeMovesCopy.finished);
  await press(buttonByLabel(worldCopy.backToWorld));
  expect(onExit).toHaveBeenCalledTimes(1);
});
