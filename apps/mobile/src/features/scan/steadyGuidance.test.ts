import { initialSteady, nextSteady, type SteadyOptions } from "./steadyGuidance";

const options: SteadyOptions = { window: 4, switchAt: 3 };
const feed = (messages: string[]) =>
  messages.reduce((state, m) => nextSteady(state, m, options), initialSteady);

test("shows the first message at once", () => {
  expect(nextSteady(initialSteady, "closer", options).shown).toBe("closer");
});

test("ignores a single different frame", () => {
  expect(feed(["closer", "closer", "blink", "closer"]).shown).toBe("closer");
});

test("switches once enough recent frames agree", () => {
  expect(feed(["closer", "hold", "hold"]).shown).toBe("closer");
  expect(feed(["closer", "hold", "hold", "hold"]).shown).toBe("hold");
});

test("agreement does not need to be consecutive", () => {
  expect(feed(["closer", "hold", "blink", "hold", "hold"]).shown).toBe("hold");
});

test("only the last frames count", () => {
  const state = feed(["hold", "a", "a", "b", "b", "c", "a"]);
  expect(state.recent).toEqual(["b", "b", "c", "a"]);
  expect(state.shown).toBe("hold");
});

test("uses the default window when no options are given", () => {
  let state = nextSteady(initialSteady, "closer");
  for (let i = 0; i < 4; i++) state = nextSteady(state, "hold");
  expect(state.shown).toBe("closer");
  state = nextSteady(state, "hold");
  expect(state.shown).toBe("hold");
});
