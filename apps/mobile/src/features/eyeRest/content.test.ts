import { exercises, eyeRestCopy } from "./content";
import { totalSeconds } from "./steps";

test("each exercise has steps, a source and a short length", () => {
  expect(exercises.length).toBeGreaterThanOrEqual(3);
  for (const exercise of exercises) {
    expect(exercise.steps.length).toBeGreaterThan(0);
    expect(exercise.rounds).toBeGreaterThan(0);
    expect(exercise.source.url).toMatch(/^https:\/\//);
    expect(totalSeconds(exercise)).toBeLessThanOrEqual(5 * 60);
  }
});

test("keys are unique", () => {
  const keys = exercises.map((exercise) => exercise.key);
  expect(new Set(keys).size).toBe(keys.length);
});

test("copy never claims a diagnosis, healthy eyes or a cure", () => {
  const banned = [/оношло/i, /хэвийн/i, /эрүүл нүд/i, /эдгэр/i, /засна/i];
  const texts = [
    ...Object.values(eyeRestCopy),
    ...exercises.flatMap((e) => [e.title, e.summary, ...e.steps.map((s) => s.text)]),
  ];
  for (const text of texts) {
    for (const word of banned) expect(text).not.toMatch(word);
  }
});
