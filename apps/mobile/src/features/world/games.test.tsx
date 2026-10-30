import { act } from "react";
import { create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { ClinicGame } from "./ClinicGame";
import { clinicCopy, eyeMovesCopy, photoCopy, rescueCopy, spaceCopy, worldCopy } from "./copy";
import { EyeMovesGame } from "./EyeMovesGame";
import {
  CLINIC_CASES,
  PHOTO_ROUNDS,
  eyeCueTimes,
  eyeRoutine,
  stepSeconds,
  type Direction,
  type EyeStep,
} from "./logic";
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
const mockSay = jest.fn();
jest.mock("../voice/useVoice", () => ({
  useVoice: () => ({ say: (...keys: string[]) => mockSay(...keys), stop: jest.fn() }),
}));

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
  mockSay.mockReset();
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

test("eye moves: follow every move, blink, rest and finish with a chime", async () => {
  await render(<EyeMovesGame onComplete={onComplete} onExit={onExit} />);
  expect(text()).toContain(eyeMovesCopy.story);
  expect(text()).toContain(eyeMovesCopy.note);
  // One routine for everyone: no choice to make before starting.
  expect(renderer.root.findAll((n) => String(n.type) === "Pressable")).toHaveLength(1);
  await press(buttonByLabel(eyeMovesCopy.start));

  // The sky is measured before the butterfly flies.
  const sky = renderer.root.find((n) => typeof n.props.onLayout === "function");
  await act(async () =>
    sky.props.onLayout({ nativeEvent: { layout: { width: 340, height: 480 } } }),
  );
  const steps = eyeRoutine();
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
    // A step lasts its time (a move adds its short spoken lead): nothing moves on early.
    await act(async () => jest.advanceTimersByTime(Math.round(stepSeconds(step) * 1000) - 1));
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

test("eye moves: skip moves on and the rest counts down", async () => {
  await render(<EyeMovesGame onComplete={onComplete} onExit={onExit} />);
  await press(buttonByLabel(eyeMovesCopy.start));
  const steps = eyeRoutine();
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

type MoveStep = Extract<EyeStep, { kind: "move" }>;
const eyeVoice = { up: "eyes-up", down: "eyes-down", left: "eyes-left", right: "eyes-right" };

async function startEyeMoves() {
  await render(<EyeMovesGame onComplete={onComplete} onExit={onExit} />);
  await press(buttonByLabel(eyeMovesCopy.start));
  const sky = renderer.root.find((n) => typeof n.props.onLayout === "function");
  await act(async () =>
    sky.props.onLayout({ nativeEvent: { layout: { width: 340, height: 480 } } }),
  );
}

test("eye moves voice: hello, 'follow me', then each direction as the butterfly gets there", async () => {
  await render(<EyeMovesGame onComplete={onComplete} onExit={onExit} />);
  expect(mockSay).toHaveBeenLastCalledWith("eyes-start");
  await press(buttonByLabel(eyeMovesCopy.start));
  const first = eyeRoutine()[0] as MoveStep;
  expect(mockSay).toHaveBeenLastCalledWith("eyes-follow");

  let now = 0;
  for (const cue of eyeCueTimes(first)) {
    mockSay.mockClear();
    await act(async () => jest.advanceTimersByTime(Math.round(cue.at * 1000) - now - 1));
    expect(mockSay).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1));
    expect(mockSay).toHaveBeenLastCalledWith(eyeVoice[cue.direction]);
    now = Math.round(cue.at * 1000);
  }
  // The second round is quiet; the next move starts with "follow me" again.
  mockSay.mockClear();
  await act(async () => jest.advanceTimersByTime(Math.round(stepSeconds(first) * 1000) - now - 1));
  expect(mockSay).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(1));
  expect(mockSay).toHaveBeenLastCalledWith("eyes-follow");
});

test("eye moves voice: skip drops waiting words; blink, rest and done have their lines", async () => {
  await startEyeMoves();
  const [first, second] = eyeRoutine() as MoveStep[];
  await press(buttonByLabel(worldCopy.skip));
  expect(mockSay).toHaveBeenLastCalledWith("eyes-follow");
  mockSay.mockClear();
  // Only the new move's words are said, never the skipped one's.
  await act(async () => jest.advanceTimersByTime(Math.round(stepSeconds(second!) * 1000) - 1));
  const said = mockSay.mock.calls.map(([key]) => key);
  expect(said).toEqual(eyeCueTimes(second!).map((c) => eyeVoice[c.direction]));
  for (const cue of eyeCueTimes(first!)) {
    if (!eyeCueTimes(second!).some((c) => c.direction === cue.direction)) {
      expect(said).not.toContain(eyeVoice[cue.direction]);
    }
  }

  const steps = eyeRoutine();
  // Skip to the blinks, then to the rest.
  for (let i = 1; i < steps.length - 2; i++) await press(buttonByLabel(worldCopy.skip));
  expect(mockSay).toHaveBeenLastCalledWith("eyes-blink");
  await press(buttonByLabel(worldCopy.skip));
  expect(mockSay).toHaveBeenLastCalledWith("eyes-rest");
  await act(async () => jest.advanceTimersByTime(steps.at(-1)!.seconds * 1000));
  expect(text()).toContain(eyeMovesCopy.finished);
  // "Done" waits for the chime that opens the eyes.
  expect(mockSay).toHaveBeenLastCalledWith("eyes-rest");
  await act(async () => jest.advanceTimersByTime(700));
  expect(mockSay).toHaveBeenLastCalledWith("eyes-done");
});

test("eye moves voice: leaving mid-move cancels the words still waiting", async () => {
  await startEyeMoves();
  mockSay.mockClear();
  await act(async () => renderer.unmount());
  await act(async () => jest.advanceTimersByTime(20_000));
  expect(mockSay).not.toHaveBeenCalled();
  // afterEach unmounts again; render a fresh tree so that is safe.
  await render(<EyeMovesGame onComplete={onComplete} onExit={onExit} />);
});
