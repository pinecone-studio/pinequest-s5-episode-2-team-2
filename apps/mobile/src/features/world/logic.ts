// Pure rules for the Нүдхэний ертөнц games, kept apart from the screens so they are easy to test.
import { reasonCopy } from "../scan/resultCopy";
import { testsCopy } from "../tests/copy";
import type { gardenCopy, styleCopy } from "./copy";
import { clinicCopy, photoCopy } from "./copy";

// ── Shared ──────────────────────────────────────────────────────────────────────────────────────

export type WorldGameKey =
  "rescue" | "space" | "garden" | "photo" | "clinic" | "style" | "eyeMoves";
/** Star keys in play_stars. Garden breaks use `garden-<break>` so each break counts once a day. */
export const GARDEN_STAR_PREFIX = "garden-";

// ── Rescue ──────────────────────────────────────────────────────────────────────────────────────

export type Point = { x: number; y: number };

/** True when the dragged phone is dropped close enough to the comfortable spot. */
export function inZone(point: Point, target: Point, radius: number) {
  return Math.hypot(point.x - target.x, point.y - target.y) <= radius;
}

/** How the room feels for a curtain that is `closed` (0 open … 1 shut). */
export function curtainLight(closed: number): "glare" | "comfy" | "dark" {
  if (closed < 0.4) return "glare";
  if (closed > 0.8) return "dark";
  return "comfy";
}

export const CURTAIN_PRESETS = { open: 0, half: 0.6, closed: 1 } as const;

export type RescueChoice = "keepPlaying" | "takeBreak" | "closer";
export const RESCUE_CHOICES: { id: RescueChoice; emoji: string; good: boolean }[] = [
  { id: "keepPlaying", emoji: "📱", good: false },
  { id: "takeBreak", emoji: "🧸", good: true },
  { id: "closer", emoji: "🔍", good: false },
];

// ── Space ───────────────────────────────────────────────────────────────────────────────────────

export type Direction = "up" | "down" | "left" | "right";
export const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];
export const SPACE_ROUNDS = 5;

/**
 * Directions for the practice rounds: every direction once in random order, then more without
 * repeating the previous one. A familiarisation game only: answers are never scored or saved.
 */
export function spaceRounds(count = SPACE_ROUNDS, random: () => number = Math.random) {
  const pool = [...DIRECTIONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const rounds = pool.slice(0, Math.min(count, pool.length));
  while (rounds.length < count) {
    const options = DIRECTIONS.filter((d) => d !== rounds[rounds.length - 1]);
    rounds.push(options[Math.floor(random() * options.length)]!);
  }
  return rounds;
}

/** Rotation of the E so its open side faces `direction`; the plain E opens to the right. */
export const E_ROTATION: Record<Direction, string> = {
  right: "0deg",
  down: "90deg",
  left: "180deg",
  up: "270deg",
};

// ── Garden ──────────────────────────────────────────────────────────────────────────────────────

export type BreakId = keyof typeof gardenCopy.breaks;
export type GardenBreak = { id: BreakId; emoji: string; minutes: string; minSeconds: number };
/**
 * Breaks away from the screen. The app cannot see them, so the child or parent confirms; the
 * confirm button only works after a sensible minimum. "Rest" reuses the approved 20-second
 * 20-20-20 break.
 */
export const GARDEN_BREAKS: GardenBreak[] = [
  { id: "outside", emoji: "⚽", minutes: "5 мин", minSeconds: 5 * 60 },
  { id: "rest", emoji: "🌤️", minutes: "20 сек", minSeconds: 20 },
  { id: "walk", emoji: "🚶", minutes: "2 мин", minSeconds: 2 * 60 },
  { id: "family", emoji: "🧩", minutes: "5 мин", minSeconds: 5 * 60 },
];

export function canConfirmBreak(startedAt: number, now: number, minSeconds: number) {
  return now - startedAt >= minSeconds * 1000;
}

export type PlantId = keyof typeof gardenCopy.plants;
/** Garden items in unlock order: `unlockAt` is the number of seeds ever earned. */
export const PLANTS: { id: PlantId; emoji: string; unlockAt: number }[] = [
  { id: "flower", emoji: "🌷", unlockAt: 0 },
  { id: "sunflower", emoji: "🌻", unlockAt: 1 },
  { id: "tree", emoji: "🌳", unlockAt: 2 },
  { id: "mushroom", emoji: "🍄", unlockAt: 3 },
  { id: "butterfly", emoji: "🦋", unlockAt: 5 },
  { id: "house", emoji: "🏡", unlockAt: 7 },
  { id: "star", emoji: "⭐", unlockAt: 9 },
  { id: "cloud", emoji: "☁️", unlockAt: 11 },
];
/** A finished garden, so there is no endless reward to chase. */
export const GARDEN_SIZE = 12;

export type GardenState = { plots: (PlantId | null)[] };
export const EMPTY_GARDEN: GardenState = { plots: Array(GARDEN_SIZE).fill(null) };

/** Makes a saved garden safe to use: right size, only known plants. */
export function cleanGarden(saved: unknown): GardenState {
  const plots = (saved as GardenState | null)?.plots;
  const known = new Set<string>(PLANTS.map((p) => p.id));
  return {
    plots: Array.from({ length: GARDEN_SIZE }, (_, i) => {
      const plot = Array.isArray(plots) ? plots[i] : null;
      return typeof plot === "string" && known.has(plot) ? (plot as PlantId) : null;
    }),
  };
}

export function plantedCount(garden: GardenState) {
  return garden.plots.filter(Boolean).length;
}

export function seedsLeft(earned: number, garden: GardenState) {
  return Math.max(0, Math.min(earned, GARDEN_SIZE) - plantedCount(garden));
}

export function unlockedPlants(earned: number) {
  return PLANTS.filter((plant) => plant.unlockAt <= earned);
}

/** Plants `plant` in an empty plot when a seed is left; otherwise returns the garden unchanged. */
export function plant(garden: GardenState, index: number, id: PlantId, earned: number) {
  if (garden.plots[index] !== null || seedsLeft(earned, garden) === 0) return garden;
  if (!unlockedPlants(earned).some((p) => p.id === id)) return garden;
  return { plots: garden.plots.map((plot, i) => (i === index ? id : plot)) };
}

// ── Photo ───────────────────────────────────────────────────────────────────────────────────────

export type Face = {
  eyes?: "open" | "closed";
  look?: "camera" | "away";
  turned?: boolean;
  blurry?: boolean;
  distance?: "close" | "good" | "far";
};
export type PhotoOption = { face: Face; good: boolean; label: string };

/** Each round teaches one point of the app's approved capture preparation and scan checks. */
export const PHOTO_ROUNDS: PhotoOption[][] = [
  [
    { face: { eyes: "closed" }, good: false, label: reasonCopy.EYES_CLOSED },
    { face: {}, good: true, label: testsCopy.prepare.steps.look },
    { face: { look: "away" }, good: false, label: reasonCopy.NOT_LOOKING },
  ],
  [
    { face: { turned: true }, good: false, label: reasonCopy.HEAD_TURNED },
    { face: { look: "away", turned: true }, good: false, label: reasonCopy.HEAD_TURNED },
    { face: {}, good: true, label: photoCopy.forward },
  ],
  [
    { face: {}, good: true, label: photoCopy.sharp },
    { face: { blurry: true }, good: false, label: reasonCopy.BLUR },
    { face: { blurry: true, eyes: "closed" }, good: false, label: reasonCopy.BLUR },
  ],
  [
    { face: { distance: "close" }, good: false, label: reasonCopy.TOO_CLOSE },
    { face: { distance: "far" }, good: false, label: reasonCopy.TOO_FAR },
    { face: {}, good: true, label: testsCopy.prepare.steps.distance },
  ],
];

// ── Clinic ──────────────────────────────────────────────────────────────────────────────────────

type CaseId = keyof typeof clinicCopy.cases;
export type ClinicCase = {
  id: CaseId;
  emoji: string;
  name: string;
  says: string;
  ask: string;
  choices: { label: string; emoji: string; good: boolean; why?: string }[];
};

const c = clinicCopy.cases;
/** Each case teaches one thing: tell a trusted adult, rest from screens, follow the doctor. */
export const CLINIC_CASES: ClinicCase[] = [
  {
    id: "rabbit",
    emoji: "🐰",
    ...pick(c.rabbit),
    choices: [
      { label: c.rabbit.tell, emoji: "🙋", good: true },
      { label: c.rabbit.ignore, emoji: "🙈", good: false, why: c.rabbit.ignoreWhy },
      { label: c.rabbit.borrow, emoji: "👓", good: false, why: c.rabbit.borrowWhy },
    ],
  },
  {
    id: "fox",
    emoji: "🦊",
    ...pick(c.fox),
    choices: [
      { label: c.fox.rub, emoji: "✋", good: false, why: c.fox.rubWhy },
      { label: c.fox.tell, emoji: "🙋", good: true },
      { label: c.fox.hide, emoji: "🤐", good: false, why: c.fox.hideWhy },
    ],
  },
  {
    id: "panda",
    emoji: "🐼",
    ...pick(c.panda),
    choices: [
      { label: c.panda.more, emoji: "📺", good: false, why: c.panda.moreWhy },
      { label: c.panda.rest, emoji: "🌳", good: true },
    ],
  },
  {
    id: "bear",
    emoji: "🐻",
    ...pick(c.bear),
    choices: [
      { label: c.bear.wear, emoji: "👓", good: true },
      { label: c.bear.hide, emoji: "📦", good: false, why: c.bear.hideWhy },
    ],
  },
];

function pick(source: { name: string; says: string; ask: string }) {
  return { name: source.name, says: source.says, ask: source.ask };
}

// ── Style studio ────────────────────────────────────────────────────────────────────────────────

export type StyleCategory = keyof typeof styleCopy.categories;
export type StyleItemId = keyof typeof styleCopy.items;
export type StyleItem = {
  id: StyleItemId;
  category: StyleCategory;
  emoji: string;
  /** Total stars ever earned that unlock the item: play brings new items, never pressure. */
  unlockAt: number;
};

export const STYLE_CATEGORIES: StyleCategory[] = [
  "hat",
  "glasses",
  "outfit",
  "accessory",
  "background",
];
export const STYLE_ITEMS: StyleItem[] = [
  { id: "starHat", category: "hat", emoji: "🌟", unlockAt: 0 },
  { id: "party", category: "hat", emoji: "🎉", unlockAt: 3 },
  { id: "crown", category: "hat", emoji: "👑", unlockAt: 6 },
  { id: "round", category: "glasses", emoji: "⭕", unlockAt: 0 },
  { id: "colorful", category: "glasses", emoji: "🌈", unlockAt: 3 },
  { id: "starFrames", category: "glasses", emoji: "⭐", unlockAt: 6 },
  { id: "explorer", category: "outfit", emoji: "🧭", unlockAt: 0 },
  { id: "gardener", category: "outfit", emoji: "🌱", unlockAt: 3 },
  { id: "astronaut", category: "outfit", emoji: "🚀", unlockAt: 6 },
  { id: "flower", category: "accessory", emoji: "🌸", unlockAt: 0 },
  { id: "backpack", category: "accessory", emoji: "🎒", unlockAt: 3 },
  { id: "wand", category: "accessory", emoji: "🪄", unlockAt: 6 },
  { id: "clouds", category: "background", emoji: "☁️", unlockAt: 0 },
  { id: "garden", category: "background", emoji: "🌷", unlockAt: 3 },
  { id: "night", category: "background", emoji: "✨", unlockAt: 6 },
];

export type Outfit = Partial<Record<StyleCategory, StyleItemId>>;

export function isUnlocked(item: StyleItem, totalStars: number) {
  return item.unlockAt <= totalStars;
}

/** Tap to wear, tap again to take off; locked items change nothing. */
export function toggleItem(outfit: Outfit, item: StyleItem, totalStars: number): Outfit {
  if (!isUnlocked(item, totalStars)) return outfit;
  const next = { ...outfit };
  if (next[item.category] === item.id) delete next[item.category];
  else next[item.category] = item.id;
  return next;
}

/** Keeps only known, unlocked items from a saved outfit. */
export function cleanOutfit(saved: unknown, totalStars: number): Outfit {
  const outfit: Outfit = {};
  if (!saved || typeof saved !== "object") return outfit;
  for (const [category, id] of Object.entries(saved as Record<string, unknown>)) {
    const item = STYLE_ITEMS.find((i) => i.id === id && i.category === category);
    if (item && isUnlocked(item, totalStars)) outfit[item.category] = item.id;
  }
  return outfit;
}

// ── Eye moves ───────────────────────────────────────────────────────────────────────────────────

export type EyeMove =
  "sideways" | "upDown" | "diagonalUp" | "diagonalDown" | "circleRight" | "circleLeft" | "eight";
export const EYE_MOVES: EyeMove[] = [
  "sideways",
  "upDown",
  "diagonalUp",
  "diagonalDown",
  "circleRight",
  "circleLeft",
  "eight",
];
export type EyeStep =
  | { kind: "move"; move: EyeMove; cycles: number; seconds: number }
  | { kind: "blink"; seconds: number }
  | { kind: "rest"; seconds: number };

/**
 * Every move in turn, two slow rounds each so children and adults can both follow, then quick
 * blinks and a rest with closed eyes: about a minute and a half.
 */
export function eyeRoutine(): EyeStep[] {
  return [
    ...EYE_MOVES.map((move) => ({ kind: "move" as const, move, cycles: 2, seconds: 8 })),
    { kind: "blink", seconds: 12 },
    { kind: "rest", seconds: 15 },
  ];
}

/**
 * Before each move the butterfly waits at its start while it says "Эрвээхэйг дагаарай!"
 * (the clip is about 1.6 s with its quiet tail), so the first direction word never talks over it.
 */
export const MOVE_LEAD_SECONDS = 1.8;

/** How long a step lasts on screen: a move adds its short lead before the flight. */
export const stepSeconds = (step: EyeStep) =>
  step.seconds + (step.kind === "move" ? MOVE_LEAD_SECONDS : 0);

export const routineSeconds = (steps: readonly EyeStep[]) =>
  steps.reduce((sum, step) => sum + stepSeconds(step), 0);

/**
 * The words the butterfly says as it reaches an edge in its first round: which way it went,
 * read off the same path it flies, so voice and flight never drift apart. Corners say up or
 * down. The second round is quiet, so the child follows on their own.
 */
export function eyeMoveCues(move: EyeMove): { phase: number; direction: Direction }[] {
  const cues: { phase: number; direction: Direction }[] = [];
  for (const phase of [0, 0.25, 0.5, 0.75]) {
    const p = eyeMovePoint(move, phase);
    if (Math.abs(p.y) > 0.9) cues.push({ phase, direction: p.y < 0 ? "up" : "down" });
    else if (Math.abs(p.x) > 0.9) cues.push({ phase, direction: p.x > 0 ? "right" : "left" });
  }
  return cues;
}

/** Spoken a little early, so the word lands as the butterfly arrives. */
export const CUE_EARLY_SECONDS = 0.15;

/** When each direction word is said, in seconds from the start of a move step. */
export function eyeCueTimes(step: Extract<EyeStep, { kind: "move" }>) {
  const round = step.seconds / step.cycles;
  return eyeMoveCues(step.move).map(({ phase, direction }) => ({
    at: MOVE_LEAD_SECONDS + phase * round - CUE_EARLY_SECONDS,
    direction,
  }));
}

/**
 * Where the butterfly is `phase` rounds into a move, with x and y in -1..1 and y growing
 * downwards. Lines and diagonals start in the middle; circles start at the top.
 */
export function eyeMovePoint(move: EyeMove, phase: number): Point {
  const a = 2 * Math.PI * phase;
  const s = Math.sin(a);
  switch (move) {
    case "sideways":
      return { x: s, y: 0 };
    case "upDown":
      return { x: 0, y: -s };
    case "diagonalUp":
      return { x: s, y: -s };
    case "diagonalDown":
      return { x: s, y: s };
    case "circleRight":
      return { x: s, y: -Math.cos(a) };
    case "circleLeft":
      return { x: -s, y: -Math.cos(a) };
    case "eight":
      return { x: s, y: Math.sin(2 * a) / 2 };
  }
}

/**
 * A move as animation keyframes over the whole step: `input` runs 0..1, x and y in -1..1.
 * With `hold` the butterfly waits at each point and then jumps, for people who reduce motion.
 */
export function eyeMovePath(move: EyeMove, cycles: number, perCycle = 24, hold = false) {
  const count = Math.max(1, Math.round(cycles * perCycle));
  const input: number[] = [];
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i <= count; i++) {
    const point = eyeMovePoint(move, (i / count) * cycles);
    const at = i / count;
    if (hold && i > 0) {
      // Stay at the previous point until just before this one, then jump.
      input.push(at - 1e-4);
      x.push(x[x.length - 1]!);
      y.push(y[y.length - 1]!);
    }
    input.push(at);
    x.push(point.x);
    y.push(point.y);
  }
  return { input, x, y };
}
