import {
  answer,
  decimalAcuity,
  minusRange,
  fittingLevels,
  iPhonePointsPerMm,
  LEVELS,
  needsReferral,
  nextDirection,
  optotypeSize,
  START,
  type EyeTest,
} from "./acuity";

const run = (answers: boolean[], levels: readonly number[] = LEVELS): EyeTest =>
  answers.reduce((test, ok) => answer(test, ok, levels), START);

test("letter size follows the logMAR definition at 3 m", () => {
  // logMAR 0: 5 arcmin at 3000 mm = 4.363 mm.
  expect(optotypeSize(0, 1)).toBeCloseTo(4.3633, 4);
  // Each 0.1 logMAR step is a factor of 10^0.1 (to 1e-5: the tangent is not exactly linear).
  expect(optotypeSize(0.3, 1) / optotypeSize(0.2, 1)).toBeCloseTo(10 ** 0.1, 5);
  expect(optotypeSize(1, 2)).toBeCloseTo(2 * optotypeSize(1, 1), 9);
});

test("points per mm use Apple's published densities", () => {
  expect(iPhonePointsPerMm(3)).toBeCloseTo(460 / 3 / 25.4, 9);
  expect(iPhonePointsPerMm(2)).toBeCloseTo(326 / 2 / 25.4, 9);
});

test("levels that do not fit are skipped, not shrunk", () => {
  const ppm = iPhonePointsPerMm(3);
  const levels = fittingLevels(optotypeSize(0.5, ppm), ppm);
  expect(levels).toEqual([0.5, 0.4, 0.3, 0.2, 0.1, 0.0]);
  // Nothing fits: fall back to every level rather than an empty test.
  expect(fittingLevels(1, ppm)).toEqual([...LEVELS]);
});

test("a correct first letter passes the level", () => {
  const t = run([true, true]);
  expect(t).toEqual({ level: 2, shown: 0, correct: 0, passed: 0.7, done: false });
});

test("after a miss, two of three letters pass the level", () => {
  expect(run([false, true, true])).toMatchObject({ level: 1, passed: 1.0, done: false });
  // Two misses at the first level: nothing passed, the eye is finished.
  expect(run([false, false])).toEqual({ level: 0, shown: 2, correct: 0, passed: null, done: true });
  // Fails at the third level: the last passed level is kept.
  expect(run([true, true, false, true, false])).toMatchObject({ passed: 0.7, done: true });
});

test("passing the smallest level finishes with logMAR 0", () => {
  const t = run(LEVELS.map(() => true));
  expect(t).toMatchObject({ passed: 0, done: true });
  expect(answer(t, false, LEVELS)).toBe(t);
});

test("the next letter never points the same way twice", () => {
  const seq = [0.1, 0.1, 0.9, 0.5, 0.3];
  let i = 0;
  const random = () => seq[i++ % seq.length]!;
  // First pick (0.1 -> 0) equals the previous 0, so it moves on by 1 + floor(0.1 * 3) = 1.
  expect(nextDirection(0, random)).toBe(90);
  for (let k = 0; k < 50; k++) {
    const r = Math.random;
    const prev = nextDirection(null, r);
    expect(nextDirection(prev, r)).not.toBe(prev);
  }
});

test("referral when either eye misses the age group's pass line", () => {
  expect(needsReferral({ right: 0.3, left: 0.3 }, "child4")).toBe(false);
  expect(needsReferral({ right: 0.3, left: 0.4 }, "child4")).toBe(true);
  expect(needsReferral({ right: 0.4, left: 0.4 }, "child3")).toBe(false);
  expect(needsReferral({ right: 0.0, left: null }, "adult")).toBe(true);
});

test("decimal acuity matches the web demo", () => {
  expect(decimalAcuity(1.0)).toBe("0.1");
  expect(decimalAcuity(0.3)).toBe("0.5");
  expect(decimalAcuity(0.0)).toBe("1.0");
});

test("rough minus range follows the web demo: none at full acuity, below when nothing passed", () => {
  expect(minusRange(0.0)).toBeNull();
  expect(minusRange(0.3)).toBe("−0.5 … −1.0");
  expect(minusRange(1.0)).toBe("−2.0 … −3.0");
  expect(minusRange(null)).toBe("below");
});
