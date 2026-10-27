import {
  answer,
  fittingLevels,
  LEVELS,
  needsReferral,
  nextDirection,
  optotypeSize,
  PASS_LINE,
  PER_LEVEL,
  START,
  type AgeGroup,
  type Direction,
  type EyeTest,
} from "./acuity";

// Properties of the vision check over many simulated children and screens.

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** Runs one eye with a child who reads every level up to `best` (logMAR) and guesses below. */
function run(best: number, levels: readonly number[], random: () => number, guess = 0.25) {
  let test: EyeTest = START;
  let answers = 0;
  while (!test.done) {
    const level = levels[test.level]!;
    test = answer(test, level >= best - 1e-9 || random() < guess, levels);
    answers++;
  }
  return { test, answers };
}

test("smaller letters for better levels, in proportion to the screen density", () => {
  for (const ppmm of [5, 6.4, 7.2]) {
    const sizes = LEVELS.map((l) => optotypeSize(l, ppmm));
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]!).toBeLessThan(sizes[i - 1]!);
    LEVELS.forEach((l, i) => expect(optotypeSize(l, ppmm * 2)).toBeCloseTo(sizes[i]! * 2, 9));
  }
});

test("only letters that fit are used, in the original order", () => {
  for (let max = 10; max <= 400; max += 13) {
    const levels = fittingLevels(max, 6.4);
    expect(levels).toEqual(LEVELS.filter((l) => levels.includes(l)));
    const fit = LEVELS.filter((l) => optotypeSize(l, 6.4) <= max);
    if (fit.length) for (const l of levels) expect(optotypeSize(l, 6.4)).toBeLessThanOrEqual(max);
    else expect(levels).toEqual([...LEVELS]);
  }
});

test("the letter never points the same way twice in a row, and every way comes up", () => {
  const random = lcg(1);
  let previous: Direction | null = null;
  const seen = new Set<Direction>();
  for (let i = 0; i < 2000; i++) {
    const d = nextDirection(previous, random);
    expect([0, 90, 180, 270]).toContain(d);
    expect(d).not.toBe(previous);
    seen.add(d);
    previous = d;
  }
  expect(seen.size).toBe(4);
});

test("a test always ends within the letters available", () => {
  const random = lcg(2);
  for (let i = 0; i < 500; i++) {
    const best = LEVELS[Math.floor(random() * LEVELS.length)]!;
    const { answers } = run(best, LEVELS, random, random() * 0.5);
    expect(answers).toBeLessThanOrEqual(LEVELS.length * PER_LEVEL);
  }
});

test("a child who never guesses passes exactly down to their best line", () => {
  for (const best of LEVELS) {
    const { test } = run(best, LEVELS, () => 1);
    expect(test.passed).toBe(best);
  }
  // One who reads even the smallest line passes it; one who reads nothing passes nothing.
  expect(run(-1, LEVELS, () => 1).test.passed).toBe(0);
  let test: EyeTest = START;
  while (!test.done) test = answer(test, false, LEVELS);
  expect(test.passed).toBeNull();
});

test("guessing can only help: the passed line is never worse than the true one", () => {
  const random = lcg(3);
  for (let i = 0; i < 500; i++) {
    const best = LEVELS[Math.floor(random() * LEVELS.length)]!;
    const { test } = run(best, LEVELS, random, 0.25);
    expect(test.passed!).toBeLessThanOrEqual(best + 1e-9);
  }
});

test("a worse result never removes a referral, and a pass line result never adds one", () => {
  const groups = Object.keys(PASS_LINE) as AgeGroup[];
  for (const group of groups) {
    for (const right of LEVELS) {
      for (const left of LEVELS) {
        const referred = needsReferral({ right, left }, group);
        if (referred) {
          expect(needsReferral({ right: Math.min(1, right + 0.1), left }, group)).toBe(true);
        }
        if (right <= PASS_LINE[group] && left <= PASS_LINE[group]) expect(referred).toBe(false);
      }
      expect(needsReferral({ right, left: null }, group)).toBe(true);
    }
  }
});
