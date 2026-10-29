import {
  worldCopy,
  rescueCopy,
  spaceCopy,
  gardenCopy,
  photoCopy,
  clinicCopy,
  styleCopy,
} from "./copy";
import {
  CLINIC_CASES,
  DIRECTIONS,
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
  inZone,
  plant,
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
