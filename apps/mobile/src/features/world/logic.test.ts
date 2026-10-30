import {
  worldCopy,
  rescueCopy,
  spaceCopy,
  gardenCopy,
  photoCopy,
  clinicCopy,
  styleCopy,
  eyeMovesCopy,
} from "./copy";
import {
  CLINIC_CASES,
  DIRECTIONS,
  EYE_MOVES,
  EMPTY_GARDEN,
  GARDEN_BREAKS,
  GARDEN_SIZE,
  PHOTO_ROUNDS,
  RESCUE_CHOICES,
  STYLE_ITEMS,
  canConfirmBreak,
  cleanGarden,
  cleanOutfit,
  curtainLight,
  eyeMovePath,
  eyeMovePoint,
  eyeRoutine,
  inZone,
  plant,
  routineSeconds,
  seedsLeft,
  spaceRounds,
  toggleItem,
  unlockedPlants,
} from "./logic";
import { worldVoiceScript } from "./voiceScript";

test("the phone counts as moved only when dropped near the comfortable spot", () => {
  expect(inZone({ x: 200, y: 100 }, { x: 210, y: 110 }, 40)).toBe(true);
  expect(inZone({ x: 60, y: 100 }, { x: 210, y: 110 }, 40)).toBe(false);
});

test("a half-closed curtain is comfortable; open glares and shut is too dark", () => {
  expect(curtainLight(0)).toBe("glare");
  expect(curtainLight(0.6)).toBe("comfy");
  expect(curtainLight(1)).toBe("dark");
});

test("only the break is the right choice in the rescue's last puzzle", () => {
  expect(RESCUE_CHOICES.filter((c) => c.good).map((c) => c.id)).toEqual(["takeBreak"]);
});

test("space rounds show every direction and never repeat one in a row", () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let run = 0; run < 50; run++) {
    const rounds = spaceRounds(6, random);
    expect(rounds).toHaveLength(6);
    expect(new Set(rounds.slice(0, 4))).toEqual(new Set(DIRECTIONS));
    for (let i = 1; i < rounds.length; i++) expect(rounds[i]).not.toBe(rounds[i - 1]);
  }
});

test("garden: seeds come from breaks, plants unlock slowly and the garden has an end", () => {
  expect(seedsLeft(0, EMPTY_GARDEN)).toBe(0);
  expect(plant(EMPTY_GARDEN, 0, "flower", 0)).toBe(EMPTY_GARDEN);
  const one = plant(EMPTY_GARDEN, 0, "flower", 1);
  expect(one.plots[0]).toBe("flower");
  expect(seedsLeft(1, one)).toBe(0);
  // Locked plants and taken plots change nothing.
  expect(plant(one, 1, "house", 2)).toBe(one);
  expect(plant(one, 0, "sunflower", 2)).toBe(one);
  expect(unlockedPlants(0).map((p) => p.id)).toEqual(["flower"]);
  // More seeds than plots never pile up.
  const full = { plots: Array(GARDEN_SIZE).fill("flower") };
  expect(seedsLeft(40, full)).toBe(0);
});

test("a saved garden is cleaned before use", () => {
  expect(cleanGarden(null).plots).toHaveLength(GARDEN_SIZE);
  expect(cleanGarden({ plots: ["tree", "dragon", 3] }).plots.slice(0, 3)).toEqual([
    "tree",
    null,
    null,
  ]);
});

test("a break can only be confirmed after its minimum time", () => {
  const rest = GARDEN_BREAKS.find((b) => b.id === "rest")!;
  expect(canConfirmBreak(0, 19_000, rest.minSeconds)).toBe(false);
  expect(canConfirmBreak(0, 20_000, rest.minSeconds)).toBe(true);
});

test("every photo and clinic round has exactly one right answer", () => {
  for (const round of PHOTO_ROUNDS) expect(round.filter((o) => o.good)).toHaveLength(1);
  for (const item of CLINIC_CASES) {
    expect(item.choices.filter((o) => o.good)).toHaveLength(1);
    for (const choice of item.choices.filter((o) => !o.good)) expect(choice.why).toBeTruthy();
  }
});

test("style items unlock with stars and saved outfits drop unknown or locked items", () => {
  const crown = STYLE_ITEMS.find((i) => i.id === "crown")!;
  const starHat = STYLE_ITEMS.find((i) => i.id === "starHat")!;
  expect(toggleItem({}, crown, 0)).toEqual({});
  expect(toggleItem({}, starHat, 0)).toEqual({ hat: "starHat" });
  expect(toggleItem({ hat: "starHat" }, starHat, 0)).toEqual({});
  expect(toggleItem({ hat: "starHat" }, crown, 6)).toEqual({ hat: "crown" });
  expect(cleanOutfit({ hat: "crown", glasses: "round", outfit: "pirate" }, 0)).toEqual({
    glasses: "round",
  });
});

test("the games never claim to check, treat or improve eyes", () => {
  const banned = [/эрүүл/i, /хэвийн/i, /сайжр/i, /эмчилнэ/i, /эдгэр/i, /оношло/i];
  const all = JSON.stringify([
    worldCopy,
    rescueCopy,
    spaceCopy,
    gardenCopy,
    photoCopy,
    clinicCopy,
    styleCopy,
    eyeMovesCopy,
  ]);
  for (const word of banned) expect(all).not.toMatch(word);
});

test("every voice clip has a unique file name and a line to say", () => {
  const files = worldVoiceScript.map((line) => line.file);
  expect(new Set(files).size).toBe(files.length);
  for (const line of worldVoiceScript) {
    expect(line.file).toMatch(/^[a-z]+(-[a-z]+)*\.m4a$/);
    expect(line.text.trim().length).toBeGreaterThan(0);
  }
});

test("eye moves: every direction, then blinks and a rest; children's routine is shorter", () => {
  for (const who of ["child", "adult"] as const) {
    const steps = eyeRoutine(who);
    expect(steps.flatMap((s) => (s.kind === "move" ? [s.move] : []))).toEqual(EYE_MOVES);
    expect(steps.slice(-2).map((s) => s.kind)).toEqual(["blink", "rest"]);
  }
  expect(routineSeconds(eyeRoutine("child"))).toBeLessThanOrEqual(90);
  expect(routineSeconds(eyeRoutine("adult"))).toBeLessThanOrEqual(150);
  expect(routineSeconds(eyeRoutine("child"))).toBeLessThan(routineSeconds(eyeRoutine("adult")));
});

test("eye moves stay in the sky and trace their shapes", () => {
  for (const move of EYE_MOVES) {
    for (let i = 0; i <= 40; i++) {
      const p = eyeMovePoint(move, i / 40);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1 + 1e-9);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1 + 1e-9);
    }
  }
  expect(eyeMovePoint("sideways", 0.25)).toEqual({ x: 1, y: 0 });
  // Up first (y grows downwards), staying in the middle.
  expect(eyeMovePoint("upDown", 0.25)).toEqual({ x: 0, y: -1 });
  const up = eyeMovePoint("diagonalUp", 0.2);
  expect(up.y).toBeCloseTo(-up.x);
  const down = eyeMovePoint("diagonalDown", 0.2);
  expect(down.y).toBeCloseTo(down.x);
  for (const phase of [0, 0.1, 0.37, 0.8]) {
    const c = eyeMovePoint("circleRight", phase);
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(1);
  }
  // From the top, clockwise goes right and the other circle goes left.
  expect(eyeMovePoint("circleRight", 0.25).x).toBeCloseTo(1);
  expect(eyeMovePoint("circleLeft", 0.25).x).toBeCloseTo(-1);
  // The sideways eight crosses the middle twice a round and reaches both sides.
  expect(eyeMovePoint("eight", 0)).toEqual({ x: 0, y: 0 });
  expect(eyeMovePoint("eight", 0.5).x).toBeCloseTo(0);
  expect(eyeMovePoint("eight", 0.25).x).toBeCloseTo(1);
  expect(eyeMovePoint("eight", 0.75).x).toBeCloseTo(-1);
});

test("eye move keyframes run 0..1 and end where they start; held ones only hop", () => {
  const path = eyeMovePath("circleRight", 3);
  expect(path.input[0]).toBe(0);
  expect(path.input.at(-1)).toBe(1);
  for (let i = 1; i < path.input.length; i++) {
    expect(path.input[i]!).toBeGreaterThan(path.input[i - 1]!);
  }
  expect(path.x.at(-1)).toBeCloseTo(path.x[0]!);
  expect(path.y.at(-1)).toBeCloseTo(path.y[0]!);

  const held = eyeMovePath("sideways", 2, 4, true);
  for (let i = 1; i < held.input.length; i++) {
    expect(held.input[i]!).toBeGreaterThan(held.input[i - 1]!);
  }
  // Before every jump the butterfly waits where it was.
  for (let i = 1; i < held.x.length; i += 2) expect(held.x[i]).toBe(held.x[i - 1]);
  expect(new Set(held.x.map((v) => Math.round(v * 1000) / 1000))).toEqual(new Set([0, 1, -1]));
});
