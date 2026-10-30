import type { Eye } from "./acuity";
import type { Landmark } from "./gestures";

// The web demo's eye-cover check (demo/web-poc acuity.ts coverState and coverChecker): the eye
// that is not being tested must be covered by a hand before the thumbs-up starts it, and when it
// is uncovered during the test, answers pause. Pose points are normalised to the frame; face and
// hand points are pixels of the face crop.

export type CoverState = "covered" | "wrongEye" | "both" | "open" | "noBody";
type Pt = { x: number; y: number };

/** Side of the square face crop in pixels, as in the web demo. */
export const COVER_CROP_PX = 256;
// TODO(tune), as in the web demo: face crop size relative to shoulder width.
const FACE_CROP_SHOULDERS = 1.2;
// Pose landmarks use the person's own left and right.
const POSE_EYE: Record<Eye, number> = { left: 2, right: 5 };
// Wrist, pinky, index and thumb of both hands.
const HAND_POINTS = [15, 17, 19, 21, 16, 18, 20, 22] as const;
// TODO(tune), as in the web demo: how close a hand must be to an eye to count as covering it,
// in shoulder widths on the body model and in interpupillary distances on the face crop; how
// many equal readings change the shown state; how long an open eye may last before answers
// pause.
const COVER_REACH = 0.6;
const COVER_IPD = 0.6;
const COVER_STABLE = 3;
export const UNCOVERED_GRACE_MS = 1000;

const dist = (a: Pt, b: Pt) => {
  "worklet";
  return Math.hypot(a.x - b.x, a.y - b.y);
};

/** Square region around the face, centred on the pose nose, in frame pixels. */
export function faceCropRegion(pose: Landmark[], w: number, h: number) {
  "worklet";
  const nose = pose[0];
  const l = pose[11];
  const r = pose[12];
  if (!nose || !l || !r) return null;
  const size = FACE_CROP_SHOULDERS * Math.hypot((l.x - r.x) * w, (l.y - r.y) * h);
  if (!(size >= 10)) return null;
  return { x: nose.x * w - size / 2, y: nose.y * h - size / 2, size };
}

/** Whether the untested eye is covered by a hand (or hidden, e.g. by a patch), from the body model. */
export function coverFromPose(pose: Landmark[], tested: Eye, w: number, h: number): CoverState {
  "worklet";
  const ls = pose[11];
  const rs = pose[12];
  const target = pose[POSE_EYE[tested === "right" ? "left" : "right"]];
  const other = pose[POSE_EYE[tested]];
  if (!ls || !rs || !target || !other) return "noBody";
  const reach = COVER_REACH * Math.hypot((ls.x - rs.x) * w, (ls.y - rs.y) * h);
  const near = (eye: Landmark) =>
    HAND_POINTS.some((i) => {
      const p = pose[i];
      return p ? Math.hypot((p.x - eye.x) * w, (p.y - eye.y) * h) < reach : false;
    });
  // A patch hides one eye while the other stays clearly visible.
  const hidden = (eye: Landmark, open: Landmark) =>
    (eye.visibility ?? 1) < 0.5 && (open.visibility ?? 0) >= 0.8;
  const onTarget = near(target) || hidden(target, other);
  const onOther = near(other) || hidden(other, target);
  if (onTarget && onOther) return "both";
  if (onTarget) return "covered";
  if (onOther) return "wrongEye";
  return "open";
}

/**
 * The same check on the face crop: the face model places both eyes precisely and the hand
 * model finds a hand on the face, which the body model only places roughly. The body model
 * tells which of the two eyes is the person's left or right.
 */
export function coverFromFace(
  pose: Landmark[],
  tested: Eye,
  w: number,
  h: number,
  region: { x: number; y: number; size: number },
  irises: [Pt, Pt],
  hands: Pt[],
): CoverState {
  "worklet";
  const [eyeA, eyeB] = irises;
  const toCrop = (p: Landmark): Pt => ({
    x: (p.x * w - region.x) * (COVER_CROP_PX / region.size),
    y: (p.y * h - region.y) * (COVER_CROP_PX / region.size),
  });
  const poseTarget = pose[POSE_EYE[tested === "right" ? "left" : "right"]];
  const t0 = poseTarget ? toCrop(poseTarget) : eyeA;
  const [target, other] = dist(eyeA, t0) <= dist(eyeB, t0) ? [eyeA, eyeB] : [eyeB, eyeA];
  const reach = COVER_IPD * dist(eyeA, eyeB);
  const near = (eye: Pt) => hands.some((p) => dist(p, eye) < reach);
  const onTarget = near(target);
  const onOther = near(other);
  if (onTarget && onOther) return "both";
  if (onTarget) return "covered";
  if (onOther) return "wrongEye";
  return "open";
}

export interface CoverReading {
  shown: CoverState;
  pending: CoverState;
  count: number;
}
export const emptyCover = (): CoverReading => ({ shown: "noBody", pending: "noBody", count: 0 });

/** The shown state changes only after COVER_STABLE equal readings, to avoid flicker. */
export function readCover(previous: CoverReading, raw: CoverState): CoverReading {
  const count = raw === previous.pending ? previous.count + 1 : 1;
  return { shown: count >= COVER_STABLE ? raw : previous.shown, pending: raw, count };
}

/** Without a body in view the cover cannot be checked, so the person decides. */
export const coverOk = (state: CoverState) => state === "covered" || state === "noBody";
