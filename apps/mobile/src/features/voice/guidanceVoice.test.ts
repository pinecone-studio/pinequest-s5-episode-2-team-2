import { GUIDANCE } from "../scan/guidance";
import { GAP_MS, GUIDANCE_VOICE, nextVoice, REPEAT_MS, type VoiceGate } from "./guidanceVoice";

const start: VoiceGate = { key: null, atMs: 0 };

test("instructions with a recording are spoken; the others stay silent", () => {
  expect(nextVoice(start, GUIDANCE.NO_FACE, GAP_MS).speak).toBe("scan-no-face");
  expect(nextVoice(start, GUIDANCE.MULTIPLE_FACES, GAP_MS).speak).toBeNull();
  expect(nextVoice(start, null, GAP_MS).speak).toBeNull();
});

test("a new instruction waits for the gap, the same one for the longer repeat pause", () => {
  const first = nextVoice(start, GUIDANCE.TOO_FAR, 10_000);
  expect(first.speak).toBe("scan-too-far");
  expect(nextVoice(first.gate, GUIDANCE.BLUR, 10_000 + GAP_MS - 1).speak).toBeNull();
  expect(nextVoice(first.gate, GUIDANCE.BLUR, 10_000 + GAP_MS).speak).toBe("scan-blur");
  expect(nextVoice(first.gate, GUIDANCE.TOO_FAR, 10_000 + GAP_MS).speak).toBeNull();
  expect(nextVoice(first.gate, GUIDANCE.TOO_FAR, 10_000 + REPEAT_MS).speak).toBe("scan-too-far");
});

test("every voiced instruction maps to a distinct clip", () => {
  const keys = Object.values(GUIDANCE_VOICE);
  expect(new Set(keys).size).toBe(keys.length);
  for (const text of Object.keys(GUIDANCE_VOICE)) {
    expect(Object.values(GUIDANCE)).toContain(text);
  }
});
