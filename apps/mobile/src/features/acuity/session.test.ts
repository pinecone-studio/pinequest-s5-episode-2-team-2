import { LEVELS, type Direction } from "./acuity";
import { beginEye, respond, startSession, type Session } from "./session";

const random = () => 0.4;
// Answer every letter correctly (follow the shown direction) or wrongly.
const right = (s: Session) => respond(s, s.direction, random);
const wrong = (s: Session) => respond(s, ((s.direction + 90) % 360) as Direction, random);

test("starts with the right eye, waiting for the left eye to be covered", () => {
  const s = startSession("child4", LEVELS, random);
  expect(s).toMatchObject({ eye: "right", stage: "cover", results: {} });
  // Answers before the eye is covered are ignored.
  expect(respond(s, s.direction, random)).toBe(s);
  expect(beginEye(s).stage).toBe("test");
});

test("moves to the left eye after the right eye finishes, then to the result", () => {
  let s = beginEye(startSession("adult", [0.3, 0.2], random));
  s = right(right(s));
  expect(s).toMatchObject({ eye: "left", stage: "cover", results: { right: 0.2 } });
  s = beginEye(s);
  s = wrong(wrong(s));
  expect(s).toMatchObject({ stage: "result", results: { right: 0.2, left: null } });
  // Finished: further answers change nothing.
  expect(right(s)).toBe(s);
});

test("can't see counts as a wrong answer", () => {
  let s = beginEye(startSession("child3", [1.0, 0.7], random));
  s = respond(respond(s, null, random), null, random);
  expect(s).toMatchObject({ eye: "left", results: { right: null } });
});

test("the next letter turns after every answer", () => {
  let s = beginEye(startSession("adult", LEVELS, Math.random));
  for (let i = 0; i < 20 && s.stage === "test"; i++) {
    const before = s.direction;
    s = respond(s, null, Math.random);
    if (s.stage === "test" && s.eye === "right") expect(s.direction).not.toBe(before);
  }
});
