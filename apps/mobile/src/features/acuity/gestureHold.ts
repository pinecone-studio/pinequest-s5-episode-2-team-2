import type { Direction } from "./acuity";

export type Gesture = Direction | "cant" | "ready" | "fist" | "none" | "noBody" | "other";
export type GestureAnswer = Direction | "cant" | "ready";
export interface Hold {
  armed: boolean;
  candidate: GestureAnswer | null;
  since: number;
  absentSince: number | null;
  last: number;
}
export const emptyHold = (): Hold => ({
  armed: false,
  candidate: null,
  since: 0,
  absentSince: null,
  last: -1,
});

/** Web demo timings: 600 ms answer, 800 ms readiness, 400 ms lowered-hand rearm. */
export function holdGesture(
  previous: Hold,
  gesture: Gesture,
  now: number,
  cover: boolean,
): { hold: Hold; answer: GestureAnswer | null } {
  if (!Number.isFinite(now) || now <= previous.last) return { hold: previous, answer: null };
  // Allow the observed ~1.1 s native cadence; a gap over 2 s breaks a hold (TODO(tune)).
  const base = now - previous.last > 2000 ? emptyHold() : previous;
  const hold = { ...base, last: now };
  if (gesture === "noBody") return { hold: { ...emptyHold(), last: now }, answer: null };
  hold.absentSince = gesture === "none" ? (hold.absentSince ?? now) : null;
  if (
    cover
      ? gesture !== "ready"
      : gesture === "fist" || (hold.absentSince !== null && now - hold.absentSince >= 400)
  )
    hold.armed = true;
  const candidate =
    hold.armed && (cover ? gesture === "ready" : typeof gesture === "number" || gesture === "cant")
      ? (gesture as GestureAnswer)
      : null;
  if (candidate !== hold.candidate) {
    hold.candidate = candidate;
    hold.since = now;
  }
  if (candidate !== null && now - hold.since >= (cover ? 800 : 600)) {
    return { hold: { ...emptyHold(), last: now }, answer: candidate };
  }
  return { hold, answer: null };
}
