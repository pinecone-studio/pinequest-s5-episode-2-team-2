import { adviceCards, findAdvice } from "./advice";
import { tipSections } from "./content";
import { getDailyAdvice, millisecondsUntilMidnight } from "./dailyAdvice";

test("four topics reuse every existing tip and its source without rewriting medical copy", () => {
  expect(adviceCards.map((card) => card.id)).toEqual([
    "early-checks",
    "screen-time",
    "outdoor-time",
    "doctor-signs",
  ]);
  const originals = tipSections.flatMap((section) => section.tips);
  const displayed = adviceCards.flatMap((card) => card.tips);
  expect(displayed).toHaveLength(originals.length);
  for (const tip of originals) expect(displayed).toContain(tip);
  for (const card of adviceCards) {
    expect(card.tips.some((tip) => tip.text === card.summary)).toBe(true);
    expect(findAdvice(card.id)).toBe(card);
  }
  expect(findAdvice("not-a-topic")).toBeUndefined();
  expect(findAdvice(undefined)).toBeUndefined();
});

test("the same local day is stable and consecutive dates rotate through every card", () => {
  const first = new Date(2026, 9, 29, 0, 1);
  expect(getDailyAdvice(first)).toBe(getDailyAdvice(new Date(2026, 9, 29, 23, 59)));
  const cycle = Array.from({ length: 4 }, (_, day) => getDailyAdvice(new Date(2026, 9, 29 + day)));
  expect(new Set(cycle).size).toBe(4);
  expect(getDailyAdvice(new Date(2026, 10, 2))).toBe(cycle[0]);
});

test("month, year and leap-day boundaries advance one card", () => {
  for (const [year, month, day] of [
    [2026, 11, 31],
    [2028, 1, 28],
    [2028, 1, 29],
  ]) {
    const before = getDailyAdvice(new Date(year!, month!, day!, 23, 59));
    const after = getDailyAdvice(new Date(year!, month!, day! + 1));
    const index = adviceCards.indexOf(before!);
    expect(after).toBe(adviceCards[(index + 1) % adviceCards.length]);
  }
});

test("midnight scheduling uses the next local calendar date", () => {
  const now = new Date(2026, 9, 29, 23, 59, 30);
  expect(millisecondsUntilMidnight(now)).toBe(30_000);
  expect(getDailyAdvice(new Date("invalid"))).toBeUndefined();
  expect(getDailyAdvice(now, [])).toBeUndefined();
  expect(getDailyAdvice(new Date(1960, 0, 1))).toBeDefined();
});
