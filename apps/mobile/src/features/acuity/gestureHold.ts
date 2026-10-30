import type { Direction } from "./acuity";

export type Gesture = Direction | "ready" | "palm" | "fist" | "none" | "noBody" | "other";
/** A direction, the open palm's "can't see", or the thumbs-up that starts an eye. */
export type GestureAnswer = Direction | "cant" | "ready";
export interface Hold {
  armed: boolean;
  candidate: GestureAnswer | null;
  since: number;
  /** When the hand was last lost; null while a hand is in view. */
  noHandSince: number | null;
  last: number;
}
export const emptyHold = (): Hold => ({
  armed: false,
  candidate: null,
  since: 0,
  noHandSince: null,
  last: -1,
});

// The web demo's timings (demo/web-poc acuity.ts): 600 ms to answer, 800 ms for readiness and
// 400 ms of a lowered hand to count as neutral. TODO(tune), like the web demo.
const HOLD_MS = 600;
const THUMB_HOLD_MS = 800;
const NEUTRAL_MS = 400;

/**
 * The web demo's answer loop. Close the hand (or lower it for 400 ms) to arm, then point with
 * the index finger, or show an open palm for "can't see", and hold it for 600 ms. After each
 * answer the hand closes again, so a hand that is already pointing, or that passes through
 * another direction, never answers. While covering an eye, a thumbs-up held 800 ms means ready.
 */
export function holdGesture(
  previous: Hold,
  gesture: Gesture,
  now: number,
  cover: boolean,
): { hold: Hold; answer: GestureAnswer | null } {
  if (!Number.isFinite(now) || now <= previous.last) return { hold: previous, answer: null };
  // A gap over 2 s (the app was paused) starts over (TODO(tune)).
  const base = now - previous.last > 2000 ? emptyHold() : previous;
  const hold = { ...base, last: now };
  const handInView = gesture !== "none" && gesture !== "noBody";
  hold.noHandSince = handInView ? null : (hold.noHandSince ?? now);
  if (cover) {
    if (gesture !== "ready") hold.armed = true;
  } else if (
    gesture === "fist" ||
    (hold.noHandSince !== null && now - hold.noHandSince >= NEUTRAL_MS)
  ) {
    hold.armed = true;
  }
  const candidate: GestureAnswer | null = !hold.armed
    ? null
    : cover
      ? gesture === "ready"
        ? "ready"
        : null
      : typeof gesture === "number"
        ? gesture
        : gesture === "palm"
          ? "cant"
          : null;
  if (candidate !== hold.candidate) {
    hold.candidate = candidate;
    hold.since = now;
  }
  if (candidate !== null && now - hold.since >= (cover ? THUMB_HOLD_MS : HOLD_MS)) {
    return { hold: { ...emptyHold(), last: now }, answer: candidate };
  }
  return { hold, answer: null };
}
