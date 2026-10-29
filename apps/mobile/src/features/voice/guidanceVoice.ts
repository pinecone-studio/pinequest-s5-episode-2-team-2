import { GUIDANCE } from "../scan/guidance";
import type { VoiceKey } from "./clips";

/** Live scan instructions that have a recording. Others stay text only. */
export const GUIDANCE_VOICE: Readonly<Record<string, VoiceKey>> = {
  [GUIDANCE.NO_FACE]: "scan-no-face",
  [GUIDANCE.EYES_CLOSED]: "scan-eyes-closed",
  [GUIDANCE.TOO_FAR]: "scan-too-far",
  [GUIDANCE.TOO_CLOSE]: "scan-too-close",
  [GUIDANCE.HEAD_TURNED]: "scan-head-turned",
  [GUIDANCE.NOT_LOOKING]: "scan-not-looking",
  [GUIDANCE.TOO_DARK]: "scan-too-dark",
  [GUIDANCE.BLUR]: "scan-blur",
};

export type VoiceGate = { key: VoiceKey | null; atMs: number };

/** Never talk over the last prompt; repeat the same one only after a longer pause. */
export const GAP_MS = 3500;
export const REPEAT_MS = 8000;

/**
 * Decides whether the shown instruction should be spoken now, and the gate to keep.
 * Pure, so the throttling is tested without audio.
 */
export function nextVoice(
  gate: VoiceGate,
  shown: string | null,
  nowMs: number,
): { speak: VoiceKey | null; gate: VoiceGate } {
  const key = shown ? GUIDANCE_VOICE[shown] : undefined;
  if (!key) return { speak: null, gate };
  const since = nowMs - gate.atMs;
  const due = key === gate.key ? since >= REPEAT_MS : since >= GAP_MS;
  return due ? { speak: key, gate: { key, atMs: nowMs } } : { speak: null, gate };
}
