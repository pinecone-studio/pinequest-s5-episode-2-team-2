import type {
  FaceLandmarker,
  HandLandmarker,
  NormalizedLandmark,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import {
  loadCoverHandLandmarker,
  loadHandLandmarker,
  loadLandmarker,
  loadPoseLandmarker,
  startCamera,
  stopCamera,
} from "./scanner";
import { t } from "./strings";

// Tumbling-E distance acuity check. Optotype size follows the logMAR definition: the letter
// is 5 strokes tall and subtends 5 × 10^logMAR arcminutes at the test distance.

export interface Screens {
  app: HTMLDivElement;
  show: (screen: () => void) => void;
  setCleanup: (fn: () => void) => void;
  home: () => void;
  icon: Record<string, string>;
}

type Group = "child3" | "child4" | "child5" | "adult";
type Eye = "right" | "left";
type Direction = 0 | 90 | 180 | 270;

const TEST_DISTANCE_MM = 3000; // AAPOS screening distance (10 ft)
// ISO/IEC 7810 ID-1 bank card, drawn upright so it fits a phone screen.
const CARD_MM = { short: 53.98, long: 85.6 };
const LEVELS = [1.0, 0.7, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0];
const PER_LEVEL = 3;
/** Line to pass, in logMAR: AAPOS screening lines for children; WHO ICD-11 mild impairment for adults. */
const PASS_LINE: Record<Group, number> = { child3: 0.4, child4: 0.3, child5: 0.2, adult: 0.3 };
// TODO(tune): rough distance guide only. Assumed front-camera field of view and an adult
// interpupillary distance (about 63 mm, Dodgson 2004); children read closer than they are.
const ASSUMED_HFOV_DEG = 60;
const ADULT_IPD_MM = 63;

const STORAGE_KEY = "acuity.pxPerMm";

function storedPxPerMm(): number | null {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

/**
 * CSS pixels per mm on an iPhone, from Apple's published screen densities (326 ppi on @2x
 * models, about 460 ppi on @3x models; support.apple.com/specs). Models differ by about ±4%,
 * which changes the letter size by under 0.02 logMAR. Display Zoom is not accounted for.
 * Other devices return null and use the card calibration.
 */
function iPhonePxPerMm(): number | null {
  if (!/iPhone/.test(navigator.userAgent)) return null;
  const ppi = window.devicePixelRatio >= 3 ? 460 : 326;
  return ppi / window.devicePixelRatio / 25.4;
}

function storePxPerMm(v: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    // Calibration then lasts for this visit only.
  }
}

function optotypePx(logMar: number, pxPerMm: number): number {
  const arcmin = 5 * 10 ** logMar;
  return TEST_DISTANCE_MM * Math.tan((arcmin / 60) * (Math.PI / 180)) * pxPerMm;
}

function decimal(logMar: number): string {
  return (10 ** -logMar).toFixed(logMar >= 0.95 ? 1 : 2).replace(/0$/, "");
}

// TODO(tune): how long a pointing direction or a thumbs-up must hold, and how straight the
// finger must be.
const HOLD_MS = 600;
const THUMB_HOLD_MS = 800;

type Pt = { x: number; y: number };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Thumb pointing up with the other four fingers folded, as in a "like". */
function thumbsUp(lm: NormalizedLandmark[], w: number, h: number): boolean {
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
  // Folded fingers: each tip is closer to the wrist than its middle joint.
  for (const [tip, joint] of [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ] as const) {
    const a = p(tip);
    const b = p(joint);
    if (!a || !b || dist(a, wrist) >= dist(b, wrist)) return false;
  }
  return true;
}

/** Fingertip closer to the wrist than the finger's middle joint. */
function folded(lm: NormalizedLandmark[], tip: number, joint: number, w: number, h: number) {
  const wr = lm[0];
  const a = lm[tip];
  const b = lm[joint];
  if (!wr || !a || !b) return false;
  const d = (p: NormalizedLandmark) => Math.hypot((p.x - wr.x) * w, (p.y - wr.y) * h);
  return d(a) < d(b);
}

/** All four fingers folded: the neutral pose between answers. */
function fist(lm: NormalizedLandmark[], w: number, h: number): boolean {
  return [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ].every(([tip, joint]) => folded(lm, tip!, joint!, w, h));
}

/** All four fingers straight and pointing up: the "I can't see it" answer. */
function openPalm(lm: NormalizedLandmark[], w: number, h: number): boolean {
  const wrist = lm[0];
  const middleBase = lm[9];
  const middleTip = lm[12];
  if (!wrist || !middleBase || !middleTip) return false;
  const palm = Math.hypot((middleBase.x - wrist.x) * w, (middleBase.y - wrist.y) * h);
  const up = (middleTip.y - middleBase.y) * h < -0.6 * palm;
  const straight = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ].every(([tip, joint]) => !folded(lm, tip!, joint!, w, h));
  return up && straight;
}

/** Direction the index finger points, from the person's point of view. */
function pointing(lm: NormalizedLandmark[], w: number, h: number): Direction | null {
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
  // Raw front-camera frames are not mirrored: the person's right is the image's left.
  if (Math.abs(dx) > 1.5 * Math.abs(dy)) return dx < 0 ? 0 : 180;
  if (Math.abs(dy) > 1.5 * Math.abs(dx)) return dy < 0 ? 270 : 90;
  return null;
}

// The hand detector shrinks the whole frame before searching, so at 3 m the hand is only a few
// pixels. The body is large enough to find, so the hand is cropped around the pose wrist first.
// TODO(tune): crop size relative to shoulder width, and the analysis rate.
const CROP_SHOULDERS = 1.4;
const CROP_PX = 256;
const ANALYSE_EVERY_MS = 66;
// Pose landmarks: shoulder, hip, wrist and index knuckle for each arm.
const ARMS = [
  { shoulder: 11, hip: 23, wrist: 15, index: 19 },
  { shoulder: 12, hip: 24, wrist: 16, index: 20 },
] as const;

/** Square region around the pointing hand, in video pixels. */
function handRegion(pose: NormalizedLandmark[], w: number, h: number) {
  const l = pose[11];
  const r = pose[12];
  if (!l || !r) return null;
  const shoulders = Math.hypot((l.x - r.x) * w, (l.y - r.y) * h);
  const eyes = [pose[POSE_EYE.left], pose[POSE_EYE.right]];
  // A hand covering an eye has its fingers up and must not be read as pointing or a thumbs-up.
  const onEye = (p: NormalizedLandmark) =>
    eyes.some((e) => e && Math.hypot((p.x - e.x) * w, (p.y - e.y) * h) < COVER_REACH * shoulders);
  let best: { x: number; y: number } | null = null;
  let bestReach = 0;
  for (const arm of ARMS) {
    const s = pose[arm.shoulder];
    const wr = pose[arm.wrist];
    const ix = pose[arm.index];
    if (!s || !wr || !ix || (wr.visibility ?? 1) < 0.5 || onEye(wr) || onEye(ix)) continue;
    // Only a raised hand answers: a hanging hand has its fingers down and would read as "down".
    const hip = pose[arm.hip];
    const midTorso = hip ? (s.y + hip.y) / 2 : s.y + shoulders / h;
    if (wr.y > midTorso) continue;
    // Of the raised hands, the pointing one reaches furthest from its shoulder.
    const reach = Math.hypot((wr.x - s.x) * w, (wr.y - s.y) * h);
    if (reach > bestReach) {
      bestReach = reach;
      best = { x: ((wr.x + ix.x) / 2) * w, y: ((wr.y + ix.y) / 2) * h };
    }
  }
  if (!best || shoulders < 10) return null;
  const size = shoulders * CROP_SHOULDERS;
  return { x: best.x - size / 2, y: best.y - size / 2, size };
}

// TODO(tune): face crop size relative to shoulder width.
const FACE_CROP_SHOULDERS = 1.2;

/** Square region around the face, centred on the pose nose, in video pixels. */
function faceRegion(pose: NormalizedLandmark[], w: number, h: number) {
  const nose = pose[0];
  const l = pose[11];
  const r = pose[12];
  if (!nose || !l || !r) return null;
  const size = FACE_CROP_SHOULDERS * Math.hypot((l.x - r.x) * w, (l.y - r.y) * h);
  if (size < 10) return null;
  return { x: nose.x * w - size / 2, y: nose.y * h - size / 2, size };
}

type Pose = NormalizedLandmark[];
type CoverState = "covered" | "wrongEye" | "both" | "open" | "noBody";

// Pose landmarks use the person's own left and right.
const POSE_EYE: Record<Eye, number> = { left: 2, right: 5 };
// Wrist, pinky, index and thumb of both hands.
const HAND_POINTS = [15, 17, 19, 21, 16, 18, 20, 22];
// TODO(tune): how close a hand must be to an eye to count as covering it, in shoulder widths.
const COVER_REACH = 0.6;

/** Whether the eye that is not being tested is covered by a hand (or hidden, e.g. by a patch). */
function coverState(pose: Pose | null, tested: Eye, w: number, h: number): CoverState {
  if (!pose) return "noBody";
  const ls = pose[11];
  const rs = pose[12];
  const target = pose[POSE_EYE[tested === "right" ? "left" : "right"]];
  const other = pose[POSE_EYE[tested]];
  if (!ls || !rs || !target || !other) return "noBody";
  const reach = COVER_REACH * Math.hypot((ls.x - rs.x) * w, (ls.y - rs.y) * h);
  const near = (eye: NormalizedLandmark) =>
    HAND_POINTS.some((i) => {
      const p = pose[i];
      return p ? Math.hypot((p.x - eye.x) * w, (p.y - eye.y) * h) < reach : false;
    });
  // A patch hides one eye while the other stays clearly visible.
  const hidden = (eye: NormalizedLandmark, open: NormalizedLandmark) =>
    (eye.visibility ?? 1) < 0.5 && (open.visibility ?? 0) >= 0.8;
  const onTarget = near(target) || hidden(target, other);
  const onOther = near(other) || hidden(other, target);
  if (onTarget && onOther) return "both";
  if (onTarget) return "covered";
  if (onOther) return "wrongEye";
  return "open";
}

// TODO(tune): hand-to-eye distance that counts as covering, in interpupillary distances; how
// often the cover is checked; and how many equal readings change the shown state.
const COVER_IPD = 0.6;
const COVER_EVERY_MS = 200;
const COVER_STABLE = 3;

/**
 * Checks the cover on a crop of the face: the face model gives both eyes precisely and a hand
 * model finds the hand on the face, which the body model only places roughly. Falls back to the
 * body model when no face is found in the crop. Readings are debounced to avoid flicker.
 */
function coverChecker(video: HTMLVideoElement, debug: HTMLCanvasElement | null) {
  const crop = document.createElement("canvas");
  crop.width = CROP_PX;
  crop.height = CROP_PX;
  const ctx = crop.getContext("2d")!;
  let last = 0;
  let shown: CoverState = "noBody";
  let pending: CoverState = "noBody";
  let count = 0;

  const draw = (eyes: Pt[], hands: Pt[]) => {
    const d = debug?.getContext("2d");
    if (!debug || !d) return;
    const k = debug.width / CROP_PX;
    d.drawImage(crop, 0, 0, debug.width, debug.height);
    d.fillStyle = "#F59E0B";
    for (const p of eyes) d.fillRect(p.x * k - 2, p.y * k - 2, 4, 4);
    d.fillStyle = "#14B8A6";
    for (const p of hands) d.fillRect(p.x * k - 1.5, p.y * k - 1.5, 3, 3);
  };

  const read = (
    faces: FaceLandmarker,
    hands: HandLandmarker,
    pose: Pose | null,
    tested: Eye,
    w: number,
    h: number,
  ): CoverState => {
    const region = pose ? faceRegion(pose, w, h) : null;
    if (!pose || !region) return "noBody";
    ctx.clearRect(0, 0, CROP_PX, CROP_PX);
    ctx.drawImage(video, region.x, region.y, region.size, region.size, 0, 0, CROP_PX, CROP_PX);
    const face = faces.detectForVideo(crop, performance.now()).faceLandmarks[0];
    const handPts = hands
      .detect(crop)
      .landmarks.flat()
      .map((p) => ({ x: p.x * CROP_PX, y: p.y * CROP_PX }));
    const a = face?.[468];
    const b = face?.[473];
    if (!a || !b) {
      draw([], handPts);
      return coverState(pose, tested, w, h);
    }
    // Match the face's eyes to the person's left and right using the body model.
    const toCrop = (p: NormalizedLandmark): Pt => ({
      x: (p.x * w - region.x) * (CROP_PX / region.size),
      y: (p.y * h - region.y) * (CROP_PX / region.size),
    });
    const poseTarget = pose[POSE_EYE[tested === "right" ? "left" : "right"]];
    const eyeA = { x: a.x * CROP_PX, y: a.y * CROP_PX };
    const eyeB = { x: b.x * CROP_PX, y: b.y * CROP_PX };
    const t0 = poseTarget ? toCrop(poseTarget) : eyeA;
    const [target, other] = dist(eyeA, t0) <= dist(eyeB, t0) ? [eyeA, eyeB] : [eyeB, eyeA];
    draw([target, other], handPts);
    const reach = COVER_IPD * dist(eyeA, eyeB);
    const near = (eye: Pt) => handPts.some((p) => dist(p, eye) < reach);
    const onTarget = near(target);
    const onOther = near(other);
    if (onTarget && onOther) return "both";
    if (onTarget) return "covered";
    if (onOther) return "wrongEye";
    return "open";
  };

  return (
    faces: FaceLandmarker,
    hands: HandLandmarker,
    pose: Pose | null,
    tested: Eye,
    w: number,
    h: number,
  ): CoverState => {
    const now = performance.now();
    if (now - last < COVER_EVERY_MS) return shown;
    last = now;
    const raw = read(faces, hands, pose, tested, w, h);
    count = raw === pending ? count + 1 : 1;
    pending = raw;
    if (count >= COVER_STABLE) shown = raw;
    return shown;
  };
}

/** Body pose plus hand landmarks, cropped around the pose wrist when a body is found. */
function handFinder(video: HTMLVideoElement, debug: HTMLCanvasElement | null = null) {
  const crop = document.createElement("canvas");
  crop.width = CROP_PX;
  crop.height = CROP_PX;
  const ctx = crop.getContext("2d")!;

  /** Shows what the hand detector looked at and the landmarks it found. */
  const draw = (source: CanvasImageSource | null, lm: NormalizedLandmark[] | undefined) => {
    const d = debug?.getContext("2d");
    if (!debug || !d) return;
    d.fillStyle = "#000";
    d.fillRect(0, 0, debug.width, debug.height);
    if (source) d.drawImage(source, 0, 0, debug.width, debug.height);
    d.fillStyle = "#14B8A6";
    for (const p of lm ?? []) d.fillRect(p.x * debug.width - 1.5, p.y * debug.height - 1.5, 3, 3);
  };

  return (handModel: HandLandmarker, poseModel: PoseLandmarker, now: number) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    const pose = poseModel.detectForVideo(video, now).landmarks[0] ?? null;
    const region = pose ? handRegion(pose, w, h) : null;
    // A body without a raised, free hand has no answer.
    if (pose && !region) {
      draw(null, undefined);
      return { pose, w, h, hand: null };
    }
    if (!region) {
      // Close to the phone the hand is large enough without cropping.
      const lm = handModel.detectForVideo(video, now).landmarks[0];
      draw(video, lm);
      return { pose, w, h, hand: lm ? { lm, w, h } : null };
    }
    ctx.clearRect(0, 0, CROP_PX, CROP_PX);
    ctx.drawImage(video, region.x, region.y, region.size, region.size, 0, 0, CROP_PX, CROP_PX);
    const lm = handModel.detectForVideo(crop, now).landmarks[0];
    draw(crop, lm);
    return { pose, w, h, hand: lm ? { lm, w: CROP_PX, h: CROP_PX } : null };
  };
}

// What the detectors see is only shown with ?debug in the URL.
const DEBUG = new URLSearchParams(location.search).has("debug");
const DEBUG_VIEW = DEBUG
  ? '<canvas class="hand-debug" id="hand-debug" width="96" height="96"></canvas>'
  : "";
const COVER_DEBUG_VIEW = DEBUG
  ? '<canvas class="hand-debug" id="cover-debug" width="96" height="96"></canvas>'
  : "";

let audio: AudioContext | null = null;

/** Runs inside a tap so iOS also allows sound later, when a gesture moves the test on. */
function unlockAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    audio = null;
  }
}

/** Short tone when an answer is taken: high for taken or correct, low for wrong. */
function beep(ok = true) {
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = ok ? 880 : 330;
  gain.gain.setValueAtTime(0.15, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.15);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.16);
}

const FEEDBACK_VIEW = `
  <div class="feedback" id="feedback" aria-live="polite">
    <span class="fb-icon" id="fb-icon">👉</span><span class="fb-text" id="fb-text"></span>
  </div>`;

/** Large status line that can be read from 3 m. `flash` holds a message for a moment. */
function feedbackView(root: HTMLElement) {
  const box = root.querySelector<HTMLElement>("#feedback");
  const icon = root.querySelector<HTMLElement>("#fb-icon");
  const text = root.querySelector<HTMLElement>("#fb-text");
  let until = 0;
  const write = (i: string, line: string) => {
    if (icon) icon.textContent = i;
    if (text) text.textContent = line;
  };
  return {
    set(i: string, line: string) {
      if (performance.now() >= until) write(i, line);
    },
    flash(i: string, line: string, ms = 900) {
      write(i, line);
      until = performance.now() + ms;
      box?.classList.add("flash");
      setTimeout(() => box?.classList.remove("flash"), ms);
    },
  };
}
const ARROW: Record<Direction, string> = { 0: "→", 90: "↓", 180: "←", 270: "↑" };

/**
 * Calls `onThumb` once after a thumbs-up is held, so a person standing at 3 m can continue
 * without walking back to the phone. `video` must already be playing. Returns a stop function.
 */
function followThumb(
  video: HTMLVideoElement,
  button: HTMLElement | null,
  enabled: (frame: { pose: Pose | null; w: number; h: number }) => boolean,
  onThumb: () => void,
  debug: { view: HTMLCanvasElement | null; label: HTMLElement | null } = {
    view: null,
    label: null,
  },
): () => void {
  let running = true;
  let since: number | null = null;
  let last = 0;
  // A thumb still raised from the previous screen must drop once before it counts again.
  let armed = false;
  const find = handFinder(video, debug.view);
  Promise.all([loadHandLandmarker(), loadPoseLandmarker()])
    .then(([handModel, poseModel]) => {
      const tick = () => {
        if (!running) return;
        const now = performance.now();
        if (video.readyState >= 2 && now - last >= ANALYSE_EVERY_MS) {
          last = now;
          const frame = find(handModel, poseModel, now);
          const hand = enabled(frame) ? frame.hand : null;
          const raised = hand ? thumbsUp(hand.lm, hand.w, hand.h) : false;
          if (!raised) armed = true;
          const up = raised && armed;
          if (debug.label) debug.label.textContent = raised ? "👍" : frame.hand ? "✋" : "—";
          since = up ? (since ?? now) : null;
          button?.classList.toggle("holding", up);
          if (since !== null && now - since >= THUMB_HOLD_MS) {
            running = false;
            onThumb();
            return;
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    })
    .catch(() => undefined);
  return () => {
    running = false;
  };
}

const E_PATH = '<path d="M0 0h5v1H1v1h4v1H1v1h4v1H0z" fill="currentColor"/>';
const E_SVG = `<svg viewBox="0 0 5 5" aria-hidden="true">${E_PATH}</svg>`;
// Crowding bars: one stroke thick, as long as the letter, half a letter away on each side, as
// in crowded single-optotype tests (e.g. ATS-HOTV). TODO(verify) the spacing against the protocol.
const CROWDED_UNITS = 12;
const E_CROWDED_SVG = `<svg viewBox="-3.5 -3.5 12 12" aria-hidden="true">${E_PATH}<path d="M0-3.5h5v1H0zM0 7.5h5v1H0zM-3.5 0h1v5h-1zM7.5 0h1v5h-1z" fill="currentColor"/></svg>`;

export function acuityFlow(s: Screens) {
  const { app, show, icon } = s;
  const on = (sel: string, fn: () => void) => app.querySelector(sel)?.addEventListener("click", fn);
  const header = (title: string) => `
    <header class="page-head">
      <button class="round plain" id="back" aria-label="${t.back}">${icon.back}</button>
      <h1>${title}</h1>
    </header>`;

  const steps = () => `
    <div class="gesture-steps" aria-hidden="true">
      <div><span>👉</span><b>${t.acuity.steps.point}</b></div>
      <div><span>✊</span><b>${t.acuity.steps.fist}</b></div>
      <div><span>✋</span><b>${t.acuity.steps.cant}</b></div>
    </div>`;

  const debugTargets = () => ({
    view: app.querySelector<HTMLCanvasElement>("#hand-debug"),
    label: app.querySelector<HTMLElement>("#gesture-label"),
  });

  let group: Group = "adult";
  let pxPerMm = storedPxPerMm() ?? iPhonePxPerMm();
  const results: Partial<Record<Eye, number | null>> = {};

  function who() {
    loadHandLandmarker().catch(() => undefined);
    loadPoseLandmarker().catch(() => undefined);
    app.innerHTML = `
      <main class="screen page">
        ${header(t.acuity.title)}
        <section class="card plain-text"><p>${t.acuity.intro}</p></section>
        <h3 class="section-label">${t.acuity.who}</h3>
        <div class="choice-grid">
          <button class="choice" data-g="child3">${t.acuity.groups.child3}</button>
          <button class="choice" data-g="child4">${t.acuity.groups.child4}</button>
          <button class="choice" data-g="child5">${t.acuity.groups.child5}</button>
          <button class="choice" data-g="adult">${t.acuity.groups.adult}</button>
        </div>
        <p class="notice">${icon.info}<span>${t.acuity.under3}</span></p>
      </main>`;
    on("#back", () => show(s.home));
    app.querySelectorAll<HTMLButtonElement>(".choice").forEach((b) =>
      b.addEventListener("click", () => {
        unlockAudio();
        group = b.dataset.g as Group;
        show(pxPerMm ? distance : calibrate);
      }),
    );
  }

  function calibrate() {
    const initial = pxPerMm ?? 6;
    app.innerHTML = `
      <main class="screen page">
        ${header(t.acuity.calibrateTitle)}
        <section class="card plain-text"><p>${t.acuity.calibrateHelp}</p></section>
        <div class="card-outline" id="card"></div>
        <label class="slider-label" for="size">${t.acuity.calibrateSlider}</label>
        <input id="size" type="range" min="3" max="12" step="0.01" value="${initial}" />
        <div class="spacer"></div>
        <div class="actions"><button class="btn primary" id="ok">${t.acuity.calibrateDone}</button></div>
      </main>`;
    const card = app.querySelector<HTMLDivElement>("#card")!;
    const slider = app.querySelector<HTMLInputElement>("#size")!;
    const draw = () => {
      const v = Number(slider.value);
      card.style.width = `${CARD_MM.short * v}px`;
      card.style.height = `${CARD_MM.long * v}px`;
    };
    slider.addEventListener("input", draw);
    draw();
    on("#back", () => show(who));
    on("#ok", () => {
      pxPerMm = Number(slider.value);
      storePxPerMm(pxPerMm);
      show(distance);
    });
  }

  function distance() {
    app.innerHTML = `
      <main class="screen distance">
        <div class="distance-top">
          <button class="round" id="back" aria-label="${t.back}">${icon.back}</button>
          <video id="video" playsinline muted autoplay></video>
        </div>
        <div class="distance-status" id="status">
          <strong id="headline">${t.loading}</strong>
          <span id="meters"></span>
        </div>
        <p class="distance-help">${t.acuity.distanceHelp}</p>
        <div class="gesture">${DEBUG_VIEW}<span id="gesture-label">—</span></div>
        <div class="actions">
          <button class="btn primary" id="ok">${t.acuity.distanceOk} 👍</button>
          <button class="btn link" id="recal">${t.acuity.recalibrate}</button>
        </div>
      </main>`;
    const video = app.querySelector<HTMLVideoElement>("#video")!;
    const box = app.querySelector<HTMLDivElement>("#status")!;
    const headline = app.querySelector<HTMLElement>("#headline")!;
    const meters = app.querySelector<HTMLElement>("#meters")!;
    let running = true;
    let stopThumb: (() => void) | null = null;
    s.setCleanup(() => {
      running = false;
      stopThumb?.();
      stopCamera(video);
    });
    const next = () => show(practice);
    on("#back", () => show(who));
    on("#recal", () => show(calibrate));
    on("#ok", next);

    // The face detector only finds faces up to about 2 m, so beyond that the face is cropped
    // around the pose nose first, as for the hand.
    const crop = document.createElement("canvas");
    crop.width = CROP_PX;
    crop.height = CROP_PX;
    const cropCtx = crop.getContext("2d")!;

    /** Distance between the iris centres in video pixels, or null when no face is found. */
    const ipdPx = (faces: FaceLandmarker, pose: Pose | null, w: number, h: number) => {
      const region = pose ? faceRegion(pose, w, h) : null;
      let source: HTMLVideoElement | HTMLCanvasElement = video;
      let scaleX = w;
      let scaleY = h;
      if (region) {
        cropCtx.clearRect(0, 0, CROP_PX, CROP_PX);
        cropCtx.drawImage(
          video,
          region.x,
          region.y,
          region.size,
          region.size,
          0,
          0,
          CROP_PX,
          CROP_PX,
        );
        source = crop;
        scaleX = scaleY = region.size;
      }
      const lm = faces.detectForVideo(source, performance.now()).faceLandmarks[0];
      const a = lm?.[468];
      const b = lm?.[473];
      return a && b ? Math.hypot((a.x - b.x) * scaleX, (a.y - b.y) * scaleY) : null;
    };

    Promise.all([startCamera(video, "user"), loadLandmarker()])
      .then(([, faces]) => {
        if (!running) return;
        // Reuses the pose found for the thumbs-up, which only counts at the right distance.
        stopThumb = followThumb(
          video,
          app.querySelector("#ok"),
          ({ pose, w, h }) => {
            const px = ipdPx(faces, pose, w, h);
            let state: keyof typeof t.acuity.distance = "noFace";
            if (px) {
              const focalPx =
                Math.max(w, h) / 2 / Math.tan(((ASSUMED_HFOV_DEG / 2) * Math.PI) / 180);
              const mm = (focalPx * ADULT_IPD_MM) / px;
              state =
                mm < TEST_DISTANCE_MM * 0.85
                  ? "back"
                  : mm > TEST_DISTANCE_MM * 1.15
                    ? "closer"
                    : "ok";
              meters.textContent = `≈ ${(mm / 1000).toFixed(1)} м`;
            } else {
              meters.textContent = "";
            }
            headline.textContent = t.acuity.distance[state];
            box.dataset.state = state;
            return state === "ok";
          },
          next,
          debugTargets(),
        );
      })
      .catch(() => {
        headline.textContent = t.acuity.noCamera;
        box.dataset.state = "noFace";
      });
  }

  function cover(eye: Eye) {
    app.innerHTML = `
      <main class="screen page center">
        ${header(eye === "right" ? t.acuity.rightEye : t.acuity.leftEye)}
        <h2 class="big">${eye === "right" ? t.acuity.coverLeft : t.acuity.coverRight}</h2>
        <p class="lead">${t.acuity.coverHow}</p>
        <p class="cover-status" id="cover-status" aria-live="polite"></p>
        ${steps()}
        <div class="gesture" id="gesture" hidden>
          <video id="hand" playsinline muted autoplay></video>
          ${COVER_DEBUG_VIEW}
          ${DEBUG_VIEW}
          <span id="gesture-label">—</span>
        </div>
        <div class="spacer"></div>
        <div class="actions"><button class="btn primary" id="ok">${t.acuity.ready} 👍</button></div>
      </main>`;
    const video = app.querySelector<HTMLVideoElement>("#hand")!;
    let running = true;
    let stopThumb: (() => void) | null = null;
    s.setCleanup(() => {
      running = false;
      stopThumb?.();
      stopCamera(video);
    });
    const go = () => show(() => test(eye));
    on("#back", () => show(who));
    on("#ok", go);
    Promise.all([startCamera(video, "user"), loadLandmarker(), loadCoverHandLandmarker()])
      .then(([, faces, coverHands]) => {
        if (!running) return;
        app.querySelector<HTMLElement>("#gesture")!.hidden = false;
        const status = app.querySelector<HTMLElement>("#cover-status")!;
        const check = coverChecker(video, app.querySelector("#cover-debug"));
        // The thumbs-up only starts the test once the right eye is covered. Without a body in
        // view the cover cannot be checked, so the person decides.
        stopThumb = followThumb(
          video,
          app.querySelector("#ok"),
          ({ pose, w, h }) => {
            const state = check(faces, coverHands, pose, eye, w, h);
            status.textContent = t.acuity.coverStatus[state];
            status.dataset.state = state;
            return state === "covered" || state === "noBody";
          },
          go,
          debugTargets(),
        );
      })
      .catch(() => undefined);
  }

  /** Two practice answers with both eyes open, so the gestures are clear before the test. */
  function practice() {
    let direction: Direction = 0;
    let correct = 0;
    app.innerHTML = `
      <main class="screen test">
        <div class="test-top">
          <button class="round plain" id="back" aria-label="${t.back}">${icon.back}</button>
          <span>${t.acuity.practice.title}</span>
        </div>
        <p class="lead">${t.acuity.practice.intro}</p>
        ${steps()}
        <p class="cover-warn" id="cover-warn" hidden></p>
        <div class="optotype" id="e">${E_SVG}</div>
        ${FEEDBACK_VIEW}
        <div class="gesture" id="gesture" hidden>
          <video id="hand" playsinline muted autoplay></video>
          ${DEBUG_VIEW}
          ${DEBUG ? '<b id="gesture-label">—</b>' : ""}
        </div>
        <div class="answers">
          <button class="arrow up" data-d="270" aria-label="${t.acuity.up}">↑</button>
          <button class="arrow left" data-d="180" aria-label="${t.acuity.left}">←</button>
          <button class="arrow right" data-d="0" aria-label="${t.acuity.right}">→</button>
          <button class="arrow down" data-d="90" aria-label="${t.acuity.down}">↓</button>
        </div>
        <button class="btn link" id="skip">${t.acuity.practice.skip}</button>
      </main>`;
    const e = app.querySelector<HTMLDivElement>("#e")!;
    const feedback = feedbackView(app);
    // The largest letter that fits; practice is about the gestures, not the size.
    const maxPx = Math.min(window.innerWidth - 40, window.innerHeight * 0.3);
    const size = Math.min(maxPx, optotypePx(LEVELS[0]!, pxPerMm ?? 6));
    e.style.width = `${size}px`;
    e.style.height = `${size}px`;

    const next = () => {
      const dirs: Direction[] = [0, 90, 180, 270];
      direction = dirs.filter((d) => d !== direction)[Math.floor(Math.random() * 3)]!;
      e.style.transform = `rotate(${direction}deg)`;
    };
    const answer = (d: Direction | null) => {
      if (d === direction) {
        correct += 1;
        beep(true);
        if (correct >= 2) {
          feedback.flash("🎉", t.acuity.practice.great, 1500);
          setTimeout(() => {
            if (app.contains(e)) show(() => cover("right"));
          }, 1500);
          return;
        }
        feedback.flash("✓", t.acuity.practice.correct);
      } else {
        beep(false);
        feedback.flash("↻", t.acuity.practice.wrong);
      }
      next();
    };

    app
      .querySelectorAll<HTMLButtonElement>(".arrow")
      .forEach((b) => b.addEventListener("click", () => answer(Number(b.dataset.d) as Direction)));
    on("#back", () => show(who));
    on("#skip", () => show(() => cover("right")));
    next();
    watchPointing(null, answer, feedback);
  }

  function test(eye: Eye) {
    let level = 0;
    let shown = 0;
    let correct = 0;
    let passed: number | null = null;
    let direction: Direction = 0;

    app.innerHTML = `
      <main class="screen test">
        <div class="test-top">
          <button class="round plain" id="back" aria-label="${t.back}">${icon.back}</button>
          <span id="progress"></span>
        </div>
        <p class="cover-warn" id="cover-warn" hidden>${t.acuity.coverPaused}</p>
        <div class="optotype" id="e">${E_SVG}</div>
        ${FEEDBACK_VIEW}
        <div class="gesture" id="gesture" hidden>
          <video id="hand" playsinline muted autoplay></video>
          ${COVER_DEBUG_VIEW}
          ${DEBUG_VIEW}
          <span>${t.acuity.gestureHint}${DEBUG ? ' <b id="gesture-label">—</b>' : ""}</span>
        </div>
        <div class="answers">
          <button class="arrow up" data-d="270" aria-label="${t.acuity.up}">↑</button>
          <button class="arrow left" data-d="180" aria-label="${t.acuity.left}">←</button>
          <button class="arrow right" data-d="0" aria-label="${t.acuity.right}">→</button>
          <button class="arrow down" data-d="90" aria-label="${t.acuity.down}">↓</button>
        </div>
        <button class="btn outline" id="cant">${t.acuity.cantSee}</button>
      </main>`;
    const e = app.querySelector<HTMLDivElement>("#e")!;
    const progress = app.querySelector<HTMLElement>("#progress")!;
    // Skip levels too large for this screen; a scaled-down letter would give a wrong result.
    // Crowding bars are drawn whenever they still fit around the letter.
    const maxPx = Math.min(window.innerWidth - 40, window.innerHeight * 0.5);
    const fitting = LEVELS.filter((l) => optotypePx(l, pxPerMm ?? 6) <= maxPx);
    const levels = fitting.length ? fitting : LEVELS;
    const crowdedScale = CROWDED_UNITS / 5;

    const next = () => {
      const dirs: Direction[] = [0, 90, 180, 270];
      let d = dirs[Math.floor(Math.random() * 4)]!;
      if (d === direction) d = dirs[(dirs.indexOf(d) + 1 + Math.floor(Math.random() * 3)) % 4]!;
      direction = d;
      const letter = optotypePx(levels[level]!, pxPerMm ?? 6);
      const crowded = letter * crowdedScale <= maxPx;
      const size = crowded ? letter * crowdedScale : letter;
      e.innerHTML = crowded ? E_CROWDED_SVG : E_SVG;
      e.style.width = `${size}px`;
      e.style.height = `${size}px`;
      e.style.transform = `rotate(${direction}deg)`;
      progress.textContent = t.acuity.progress(level + 1, levels.length);
    };

    const answer = (d: Direction | null) => {
      shown += 1;
      if (d === direction) correct += 1;
      const majority = Math.floor(PER_LEVEL / 2) + 1;
      if (correct >= majority || shown - correct > PER_LEVEL - majority) {
        if (correct >= majority) passed = levels[level]!;
        const done = correct < majority || level === levels.length - 1;
        if (done) {
          results[eye] = passed;
          show(eye === "right" ? () => cover("left") : result);
          return;
        }
        level += 1;
        shown = 0;
        correct = 0;
      }
      next();
    };

    app
      .querySelectorAll<HTMLButtonElement>(".arrow")
      .forEach((b) => b.addEventListener("click", () => answer(Number(b.dataset.d) as Direction)));
    on("#cant", () => answer(null));
    on("#back", () => show(who));
    next();
    watchPointing(eye, answer, feedbackView(app));
  }

  /**
   * Lets the person answer alone by pointing; the arrow buttons keep working. Pointed answers
   * pause while the other eye is uncovered.
   */
  function watchPointing(
    eye: Eye | null,
    answer: (d: Direction | null) => void,
    feedback: ReturnType<typeof feedbackView>,
  ) {
    const video = app.querySelector<HTMLVideoElement>("#hand")!;
    const panel = app.querySelector<HTMLElement>("#gesture")!;
    const warn = app.querySelector<HTMLElement>("#cover-warn")!;
    // TODO(tune): how long the eye may be uncovered before answers pause.
    const UNCOVERED_GRACE_MS = 1000;
    let uncoveredSince: number | null = null;
    let running = true;
    s.setCleanup(() => {
      running = false;
      stopCamera(video);
    });
    // "cant" is the open palm; it answers like the "can't see" button.
    type Gesture = Direction | "cant";
    // Point, then close the hand (or lower it) before the next answer. This also stops a hand
    // that is already pointing when the test starts, or passing through another direction, from
    // answering. TODO(tune): how long a lowered hand counts as neutral.
    const NEUTRAL_MS = 400;
    let armed = false;
    let noHandSince: number | null = null;
    let candidate: Gesture | null = null;
    let since = 0;
    const mark = (g: Gesture | null, cls: string) => {
      app
        .querySelectorAll<HTMLButtonElement>(".arrow")
        .forEach((b) => b.classList.toggle(cls, g !== null && Number(b.dataset.d) === g));
      app.querySelector("#cant")?.classList.toggle(cls, g === "cant");
    };

    const { view, label } = debugTargets();
    const find = handFinder(video, view);
    let last = 0;

    const check = coverChecker(video, app.querySelector("#cover-debug"));

    Promise.all([
      startCamera(video, "user"),
      loadHandLandmarker(),
      loadPoseLandmarker(),
      loadLandmarker(),
      loadCoverHandLandmarker(),
    ])
      .then(([, handModel, poseModel, faces, coverHands]) => {
        if (!running) return;
        panel.hidden = false;
        const tick = () => {
          if (!running) return;
          const now = performance.now();
          if (video.readyState >= 2 && now - last >= ANALYSE_EVERY_MS) {
            last = now;
            const frame = find(handModel, poseModel, now);
            // Practice runs with both eyes open, so there is no cover to check.
            const state = eye
              ? check(faces, coverHands, frame.pose, eye, frame.w, frame.h)
              : "noBody";
            const ok = state === "covered" || state === "noBody";
            uncoveredSince = ok ? null : (uncoveredSince ?? now);
            const paused = uncoveredSince !== null && now - uncoveredSince >= UNCOVERED_GRACE_MS;
            warn.hidden = !paused;
            const hand = frame.hand && !paused ? frame.hand : null;
            const d: Gesture | null = !hand
              ? null
              : openPalm(hand.lm, hand.w, hand.h)
                ? "cant"
                : pointing(hand.lm, hand.w, hand.h);
            if (!paused) {
              noHandSince = frame.hand ? null : (noHandSince ?? now);
              const closed = hand !== null && fist(hand.lm, hand.w, hand.h);
              if (closed || (noHandSince !== null && now - noHandSince >= NEUTRAL_MS)) armed = true;
            }
            const g = armed ? d : null;
            if (label) {
              label.textContent = paused
                ? "⏸"
                : !armed
                  ? "✊"
                  : g === "cant"
                    ? "✋"
                    : g !== null
                      ? ARROW[g]
                      : frame.hand
                        ? "·"
                        : "—";
            }
            if (g !== candidate) {
              candidate = g;
              since = now;
            }
            const f = t.acuity.feedback;
            if (paused) feedback.set("⏸", f.cover);
            else if (!armed) feedback.set("✊", f.fist);
            else if (candidate === "cant") feedback.set("✋", f.cant);
            else if (candidate !== null) feedback.set(ARROW[candidate], f.hold);
            else feedback.set("👉", f.point);
            mark(candidate, "detected");
            if (candidate !== null && now - since >= HOLD_MS) {
              mark(candidate, "hit");
              setTimeout(() => mark(null, "hit"), 250);
              beep(true);
              feedback.flash("✓", f.done, 500);
              answer(candidate === "cant" ? null : candidate);
              armed = false;
              candidate = null;
            }
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      })
      .catch(() => {
        panel.hidden = true;
      });
  }

  function result() {
    const line = PASS_LINE[group];
    const eyes: Eye[] = ["right", "left"];
    const refer = eyes.some((eye) => {
      const v = results[eye];
      return v === null || v === undefined || v > line + 1e-9;
    });
    const row = (eye: Eye) => {
      const v = results[eye];
      const value = v === null || v === undefined ? t.acuity.belowChart : decimal(v);
      return `<div><span>${eye === "right" ? t.acuity.rightEye : t.acuity.leftEye}</span><strong>${value}</strong></div>`;
    };
    const copy = refer ? t.acuity.refer : t.acuity.noSign;
    app.innerHTML = `
      <main class="screen page">
        ${header(t.acuity.resultTitle)}
        <section class="card verdict ${refer ? "refer" : "no_visible_sign"}">
          <span class="verdict-dot" aria-hidden="true"></span>
          <div><h2>${copy.title}</h2><p>${copy.body}</p></div>
        </section>
        <section class="card">
          <div class="stats">${row("right")}${row("left")}</div>
          <p class="hint">${t.acuity.scaleHint}</p>
        </section>
        <section class="card plain-text">
          <h3>${t.whatNext}</h3>
          <ul>${copy.next.map((l) => `<li>${l}</li>`).join("")}</ul>
        </section>
        <details class="card details">
          <summary>${t.details}</summary>
          <p class="hint">${t.acuity.method(decimal(line))}</p>
        </details>
        <p class="notice">${icon.info}<span>${t.acuity.notice}</span></p>
        <div class="spacer"></div>
        <div class="actions">
          <button class="btn primary" id="again">${t.acuity.again}</button>
          <button class="btn outline" id="home">${t.acuity.home}</button>
        </div>
      </main>`;
    on("#back", () => show(s.home));
    on("#home", () => show(s.home));
    on("#again", () => show(who));
  }

  return who;
}
