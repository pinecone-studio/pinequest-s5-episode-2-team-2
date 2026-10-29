import { emptyDistance, stabilizeDistance, type StableDistance } from "./stability";
function series(values: number[], start = 1000, initial = emptyDistance()) {
  return values.reduce(
    (state, value, index) =>
      stabilizeDistance(state, value, start + index * 200, start + index * 200),
    initial,
  );
}
test("jitter needs three coherent samples and median/deadband avoids tenth flicker", () => {
  expect(series([0.54, 0.56]).value).toBeNull();
  let state = series([0.54, 0.56, 0.54]);
  expect(state.value).toBe(0.5);
  state = series([0.56, 0.54, 0.56, 0.54], 1600, state);
  expect(state.value).toBe(0.5);
  expect(state.samples.length).toBeLessThanOrEqual(5);
});
test("a large jump hides the previous number and requires fresh consistent evidence", () => {
  const old = series([0.5, 0.51, 0.49]);
  const jump = series([2.5], 1600, old);
  expect(jump.value).toBeNull();
  expect(series([0.5, 0.52], 1800, jump).value).toBeNull();
  expect(series([1, 1.01, 0.99], 1800, jump).value).toBe(1);
});
test("missing, old, invalid and non-monotonic readings clear both number and ready hold", () => {
  const old = series(Array(7).fill(3));
  expect(old.ready).toBe(true);
  for (const [value, at, now] of [
    [null, 2400, 2400],
    [NaN, 2400, 2400],
    [3, 2400, 3200],
    [3, 2400, 2300],
    [3, 2000, 2400],
  ] as const) {
    expect(stabilizeDistance(old, value, at, now)).toEqual(emptyDistance());
  }
  expect(series([3], 3000, old).ready).toBe(false);
});
test("green readiness needs a continuous second at the target, resets on leaving", () => {
  expect(series(Array(5).fill(3)).ready).toBe(false);
  const ready = series(Array(6).fill(3));
  expect(ready.ready).toBe(true);
  const left = series([2.9], 2200, ready);
  expect(left.ready).toBe(false);
  expect(series([3, 3, 3], 2400, left).ready).toBe(false);
});
test("a continuously changing distance is not ready and cannot accumulate an old window", () => {
  let state: StableDistance = emptyDistance();
  for (let i = 0; i < 30; i++) state = series([1 + i * 0.1], 1000 + i * 200, state);
  expect(state.value).toBeNull();
  expect(state.ready).toBe(false);
  expect(state.samples.length).toBeLessThanOrEqual(5);
});
