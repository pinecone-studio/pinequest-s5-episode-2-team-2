import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { RETRY_PLAY_MS, useVoice } from "./useVoice";

const mockPlayer = { replace: jest.fn(), play: jest.fn(), pause: jest.fn() };
let mockStatus = { playing: false, isLoaded: false, isBuffering: false, didJustFinish: false };
jest.mock("expo-audio", () => ({
  useAudioPlayer: () => mockPlayer,
  useAudioPlayerStatus: () => mockStatus,
}));
jest.mock("./clips", () => ({ VOICE_CLIPS: { "blink-start": 1, "blink-done": 2 } }));

let voice: ReturnType<typeof useVoice>;
let renderer: ReactTestRenderer;
function Probe() {
  voice = useVoice();
  return null;
}
const setStatus = async (next: Partial<typeof mockStatus>) => {
  mockStatus = { ...mockStatus, ...next };
  await act(async () => renderer.update(<Probe />));
};

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.useFakeTimers();
  mockStatus = { playing: false, isLoaded: false, isBuffering: false, didJustFinish: false };
  Object.values(mockPlayer).forEach((fn) => fn.mockReset());
  await act(async () => {
    renderer = create(<Probe />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  jest.useRealTimers();
});

test("a clip that loads but stays silent is played again", async () => {
  await act(async () => voice.say("blink-start"));
  expect(mockPlayer.replace).toHaveBeenCalledWith(1);
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  // iOS dropped the first play: loaded, not playing.
  await setStatus({ isLoaded: true });
  expect(mockPlayer.play).toHaveBeenCalledTimes(2);
  // Once it plays there are no more retries.
  await setStatus({ playing: true });
  await act(async () => jest.advanceTimersByTime(RETRY_PLAY_MS * 2));
  expect(mockPlayer.play).toHaveBeenCalledTimes(2);
});

test("the timer tries again when no status change arrives", async () => {
  mockStatus = { ...mockStatus, isLoaded: true };
  await act(async () => renderer.update(<Probe />));
  await act(async () => voice.say("blink-done"));
  const before = mockPlayer.play.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(RETRY_PLAY_MS));
  expect(mockPlayer.play.mock.calls.length).toBe(before + 1);
});

test("stop cancels a pending retry", async () => {
  await act(async () => voice.say("blink-start"));
  await act(async () => voice.stop());
  await act(async () => jest.advanceTimersByTime(RETRY_PLAY_MS * 2));
  await setStatus({ isLoaded: true });
  expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  expect(mockPlayer.pause).toHaveBeenCalled();
});

test("a failing player never throws into the game", async () => {
  mockPlayer.replace.mockImplementation(() => {
    throw new Error("no audio");
  });
  await act(async () => expect(() => voice.say("blink-start")).not.toThrow());
});
