import { emptyHold, holdGesture, type Gesture, type Hold } from "./gestureHold";

test("a held pointing hand cannot answer at entry or repeat before a fist/release", () => {
  let state = emptyHold();
  const step = (g: Gesture, time: number) => {
    const next = holdGesture(state, g, time, false);
    state = next.hold;
    return next.answer;
  };
  expect(step(0, 0)).toBeNull();
  expect(step(0, 600)).toBeNull();
  step("fist", 700);
  step(0, 800);
  expect(step(0, 1400)).toBe(0);
  expect(step(0, 2000)).toBeNull();
  step("other", 2100);
  expect(step(0, 2700)).toBeNull();
  step("none", 2800);
  step("none", 3200);
  step(180, 3300);
  expect(step(180, 3900)).toBe(180);
});

test("changing direction or losing the body breaks a continuous hold", () => {
  let state: Hold = emptyHold();
  const step = (g: Gesture, time: number) => {
    const next = holdGesture(state, g, time, false);
    state = next.hold;
    return next.answer;
  };
  step("fist", 0);
  step(0, 100);
  step(90, 500);
  expect(step(90, 700)).toBeNull();
  step("noBody", 800);
  expect(step(90, 1400)).toBeNull();
  step("fist", 1500);
  step("cant", 1600);
  expect(step("cant", 2200)).toBe("cant");
});

test("thumbs-up must drop once, then hold for 800 ms", () => {
  let hold = emptyHold();
  const step = (g: Gesture, t: number) => {
    const next = holdGesture(hold, g, t, true);
    hold = next.hold;
    return next.answer;
  };
  step("ready", 0);
  expect(step("ready", 800)).toBeNull();
  step("none", 900);
  step("ready", 1000);
  expect(step("ready", 1700)).toBeNull();
  expect(step("ready", 1800)).toBe("ready");
  expect(step("ready", 2600)).toBeNull();
});

test("bad/out-of-order timestamps and gaps cannot complete a hold", () => {
  let hold = holdGesture(emptyHold(), "fist", 10, false).hold;
  hold = holdGesture(hold, 270, 20, false).hold;
  expect(holdGesture(hold, 270, NaN, false).answer).toBeNull();
  expect(holdGesture(hold, 270, 19, false).hold).toBe(hold);
  const late = holdGesture(hold, 270, 3000, false);
  expect(late.answer).toBeNull();
  expect(late.hold.armed).toBe(false);
});

// Native CPU + throttling delivered observations ~1067 ms apart on iPhone 12 Pro Max.
test("native one-second cadence can complete a held answer without repeating it", () => {
  let hold = holdGesture(emptyHold(), "fist", 0, false).hold;
  hold = holdGesture(hold, 0, 1067, false).hold;
  const answered = holdGesture(hold, 0, 2134, false);
  expect(answered.answer).toBe(0);
  expect(holdGesture(answered.hold, 0, 3201, false).answer).toBeNull();
});
