import type { Direction } from "./acuity";

// Hand gestures for answering the vision check alone at 3 m, ported from the web demo
// (demo/web-poc, apps/web-demo/src/acuity.ts). Landmarks are MediaPipe's 21 hand points (or 33
// pose points), normalised to the image that was analysed; `w` and `h` are its size in pixels.

export interface Landmark {
  x: number;
  y: number;
  /** Pose landmarks only: how likely the point is visible. */
  visibility?: number;
}

type Pt = { x: number; y: number };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const valid = (lm: Landmark[], count: number, w: number, h: number) => {
  "worklet";
  return (
    Number.isFinite(w) &&
    w > 0 &&
    Number.isFinite(h) &&
    h > 0 &&
    lm.length === count &&
    Array.from(lm).every(
      (p) =>
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        (p.visibility === undefined ||
          (Number.isFinite(p.visibility) && p.visibility >= 0 && p.visibility <= 1)),
    )
  );
};
// Fingertip and middle joint of the index, middle, ring and little fingers.
const FINGERS = [
  [8, 6],
  [12, 10],
  [16, 14],
  [20, 18],
] as const;

/** Fingertip closer to the wrist than the finger's middle joint. */
function folded(lm: Landmark[], tip: number, joint: number, w: number, h: number): boolean {
  const wr = lm[0];
  const a = lm[tip];
  const b = lm[joint];
  if (!wr || !a || !b) return false;
  const d = (p: Landmark) => Math.hypot((p.x - wr.x) * w, (p.y - wr.y) * h);
  return d(a) < d(b);
}

/** Thumb pointing up with the other four fingers folded, as in a "like". */
export function thumbsUp(lm: Landmark[], w: number, h: number): boolean {
  if (!valid(lm, 21, w, h)) return false;
  const p = (i: number): Pt | null => {
    const l = lm[i];
    return l ? { x: l.x * w, y: l.y * h } : null;
  };
  const wrist = p(0);
  const thumbBase = p(2);
  const thumbTip = p(4);
  const middleBase = p(9);
  if (!wrist || !thumbBase || !thumbTip || !middleBase) return false;
  const palm = dist(wrist, middleBase);
  const dx = thumbTip.x - thumbBase.x;
  const dy = thumbTip.y - thumbBase.y;
  if (!(dy < -0.4 * palm && Math.abs(dx) < Math.abs(dy))) return false;
  return FINGERS.every(([tip, joint]) => {
    const a = p(tip);
    const b = p(joint);
    return a !== null && b !== null && dist(a, wrist) < dist(b, wrist);
  });
}

/** All four fingers folded: the neutral pose between answers. */
export function fist(lm: Landmark[], w: number, h: number): boolean {
  if (!valid(lm, 21, w, h)) return false;
  return FINGERS.every(([tip, joint]) => folded(lm, tip, joint, w, h));
}

/** All four fingers straight and pointing up: the "I can't see it" answer. */
export function openPalm(lm: Landmark[], w: number, h: number): boolean {
  if (!valid(lm, 21, w, h)) return false;
  const wrist = lm[0];
  const middleBase = lm[9];
  const middleTip = lm[12];
  if (!wrist || !middleBase || !middleTip) return false;
  const palm = Math.hypot((middleBase.x - wrist.x) * w, (middleBase.y - wrist.y) * h);
  const up = (middleTip.y - middleBase.y) * h < -0.6 * palm;
  return up && FINGERS.every(([tip, joint]) => !folded(lm, tip, joint, w, h));
}

/**
 * Direction the index finger points, from the person's point of view. Raw front-camera frames
 * are not mirrored, so the person's right is the image's left.
 */
export function pointing(lm: Landmark[], w: number, h: number): Direction | null {
  if (!valid(lm, 21, w, h)) return null;
  const wrist = lm[0];
  const base = lm[5];
  const tip = lm[8];
  if (!wrist || !base || !tip) return null;
  // Only the index finger is out; a relaxed or open hand is not an answer.
  if (!folded(lm, 12, 10, w, h) || !folded(lm, 16, 14, w, h) || !folded(lm, 20, 18, w, h)) {
    return null;
  }
  const dx = (tip.x - base.x) * w;
  const dy = (tip.y - base.y) * h;
  const palm = Math.hypot((base.x - wrist.x) * w, (base.y - wrist.y) * h);
  if (Math.hypot(dx, dy) < 0.6 * palm) return null;
  if (Math.abs(dx) > 1.5 * Math.abs(dy)) return dx < 0 ? 0 : 180;
  if (Math.abs(dy) > 1.5 * Math.abs(dx)) return dy < 0 ? 270 : 90;
  return null;
}

// The hand detector shrinks the whole frame before searching, so at 3 m the hand is only a few
// pixels. The body is large enough to find, so the hand is cropped around the pose wrist first.
// TODO(tune): crop size relative to shoulder width (same first guess as the web demo).
const CROP_SHOULDERS = 1.4;
// TODO(tune): how close a hand must be to an eye to count as covering it, in shoulder widths.
const COVER_REACH = 0.6;
// Pose landmarks use the person's own left and right.
const POSE_EYES = [2, 5] as const;
// Shoulder, hip, wrist and index knuckle for each arm.
const ARMS = [
  { shoulder: 11, hip: 23, wrist: 15, index: 19 },
  { shoulder: 12, hip: 24, wrist: 16, index: 20 },
] as const;

/** Square region around the pointing hand, in image pixels; null when no hand is raised. */
export function handRegion(pose: Landmark[], w: number, h: number) {
  "worklet";
  if (!valid(pose, 33, w, h)) return null;
  const l = pose[11];
  const r = pose[12];
  if (!l || !r || (l.visibility ?? 1) < 0.5 || (r.visibility ?? 1) < 0.5) return null;
  const shoulders = Math.hypot((l.x - r.x) * w, (l.y - r.y) * h);
  // A hand covering an eye has its fingers up and must not be read as pointing or a thumbs-up.
  const onEye = (p: Landmark) =>
    POSE_EYES.some((i) => {
      const e = pose[i];
      return (
        e !== undefined && Math.hypot((p.x - e.x) * w, (p.y - e.y) * h) < COVER_REACH * shoulders
      );
    });
  let best: Pt | null = null;
  let bestReach = 0;
  for (const arm of ARMS) {
    const s = pose[arm.shoulder];
    const wr = pose[arm.wrist];
    const ix = pose[arm.index];
    const indexVisible = !!ix && (ix.visibility ?? 1) >= 0.5;
    if (!s || !wr || !ix || (wr.visibility ?? 1) < 0.5 || onEye(wr) || (indexVisible && onEye(ix)))
      continue;
    // Only a raised hand answers: a hanging hand has its fingers down and would read as "down".
    const hip = pose[arm.hip];
    const midTorso = hip ? (s.y + hip.y) / 2 : s.y + shoulders / h;
    if (wr.y > midTorso) continue;
    // Of the raised hands, the pointing one reaches furthest from its shoulder.
    const reach = Math.hypot((wr.x - s.x) * w, (wr.y - s.y) * h);
    if (reach > bestReach) {
      bestReach = reach;
      // Pose finger points become uncertain at distance; the visible wrist still locates a
      // hand-sized region. The palm/hand models must independently confirm a hand inside it.
      best = indexVisible
        ? { x: ((wr.x + ix.x) / 2) * w, y: ((wr.y + ix.y) / 2) * h }
        : { x: wr.x * w, y: wr.y * h };
    }
  }
  if (!best || shoulders < 10) return null;
  const size = shoulders * CROP_SHOULDERS;
  return { x: best.x - size / 2, y: best.y - size / 2, size };
}
