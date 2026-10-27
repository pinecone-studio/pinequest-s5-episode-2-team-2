import type { Exercise } from "./content";
import { stepAt, totalSeconds } from "./steps";

const blink: Exercise = {
  key: "test",
  title: "Test",
  summary: "",
  steps: [
    { text: "close", seconds: 2 },
    { text: "open", seconds: 3 },
  ],
  rounds: 2,
  source: { label: "x", url: "https://example.com" },
};

test("total counts every round", () => {
  expect(totalSeconds(blink)).toBe(10);
});

test("starts on the first step of round 1", () => {
  expect(stepAt(blink, 0)).toEqual({ done: false, stepIndex: 0, round: 1, secondsLeft: 2 });
});

test("moves to the next step and rounds up the seconds left", () => {
  expect(stepAt(blink, 2500)).toEqual({ done: false, stepIndex: 1, round: 1, secondsLeft: 3 });
});

test("starts round 2 after the last step", () => {
  expect(stepAt(blink, 5000)).toEqual({ done: false, stepIndex: 0, round: 2, secondsLeft: 2 });
});

test("is done at the end and after it", () => {
  expect(stepAt(blink, 10_000)).toEqual({ done: true });
  expect(stepAt(blink, 60_000)).toEqual({ done: true });
});

test("treats a negative clock as the start", () => {
  expect(stepAt(blink, -500)).toEqual({ done: false, stepIndex: 0, round: 1, secondsLeft: 2 });
});
