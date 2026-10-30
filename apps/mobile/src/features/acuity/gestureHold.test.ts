import { emptyHold, holdGesture, type Gesture, type Hold } from "./gestureHold";

/** Feeds observations one by one, as the camera does, and returns each step's answer. */
function run(cover = false) {
  let state: Hold = emptyHold();
  return (g: Gesture, time: number) => {
    const next = holdGesture(state, g, time, cover);
    state = next.hold;
    return next.answer;
  };
}

// The web demo's loop (demo/web-poc acuity.ts): fist or lowered hand arms, then hold 600 ms.
test("a hand already pointing cannot answer; a fist arms it and a 600 ms hold answers once", () => {
  const step = run();
  expect(step(0, 0)).toBeNull();
  expect(step(0, 600)).toBeNull();
  step("fist", 700);
  step(0, 800);
  expect(step(0, 1300)).toBeNull();
  expect(step(0, 1400)).toBe(0);
  // After an answer the hand must close (or drop) again.
  expect(step(0, 2000)).toBeNull();
  step("other", 2100);
  expect(step(0, 2700)).toBeNull();
  // A hand lowered out of view for 400 ms also arms.
  step("none", 2800);
  step("none", 3200);
  step(180, 3300);
  expect(step(180, 3900)).toBe(180);
});

test("an open palm held 600 ms answers can't see, and does not arm the next answer", () => {
  const step = run();
  step("palm", 0);
  expect(step("palm", 700)).toBeNull();
  step("fist", 800);
  step("palm", 900);
  expect(step("palm", 1400)).toBeNull();
  expect(step("palm", 1500)).toBe("cant");
  step("palm", 1600);
  expect(step(90, 2300)).toBeNull();
  expect(step(90, 2900)).toBeNull();
});

test("changing direction or losing the hand breaks a continuous hold", () => {
  const step = run();
  step("fist", 0);
  step(0, 100);
  step(90, 500);
  expect(step(90, 700)).toBeNull();
  step("noBody", 800);
  expect(step(90, 1400)).toBeNull();
  expect(step(90, 2000)).toBe(90);
});

test("thumbs-up must drop once, then hold for 800 ms", () => {
  const step = run(true);
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

// Native CPU frames can arrive about a second apart on an iPhone 12 Pro Max.
test("a slow native cadence still completes a held answer without repeating it", () => {
  let hold = holdGesture(emptyHold(), "fist", 0, false).hold;
  hold = holdGesture(hold, 0, 1067, false).hold;
  const answered = holdGesture(hold, 0, 2134, false);
  expect(answered.answer).toBe(0);
  expect(holdGesture(answered.hold, 0, 3201, false).answer).toBeNull();
});

test("an uncovered eye pauses answers: nothing is held or armed until it is covered again", () => {
  let hold = emptyHold();
  const step = (gesture: Gesture, at: number, paused = false) => {
    const result = holdGesture(hold, gesture, at, false, paused);
    hold = result.hold;
    return result.answer;
  };
  step("fist", 0);
  step(0, 100);
  // Paused just before the hold completes: no answer, and the hold starts over.
  expect(step(0, 600, true)).toBeNull();
  expect(hold.candidate).toBeNull();
  expect(step(0, 800)).toBeNull();
  expect(step(0, 1300)).toBeNull();
  expect(step(0, 1400)).toBe(0);
  // A fist while paused does not arm the next answer.
  step("fist", 1500, true);
  expect(hold.armed).toBe(false);
});
