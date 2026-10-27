import {
  answer,
  nextDirection,
  START,
  type AgeGroup,
  type Direction,
  type Eye,
  type EyeTest,
} from "./acuity";

/**
 * One vision check (#139): the right eye first, then the left, as in the web demo. The other
 * eye is covered before each eye's test.
 */
export interface Session {
  group: AgeGroup;
  /** logMAR levels in use, largest letter first (see fittingLevels). */
  levels: readonly number[];
  eye: Eye;
  stage: "cover" | "test" | "result";
  test: EyeTest;
  direction: Direction;
  /** Smallest level passed per finished eye; null when none passed. */
  results: Partial<Record<Eye, number | null>>;
}

export function startSession(
  group: AgeGroup,
  levels: readonly number[],
  random: () => number,
): Session {
  return {
    group,
    levels,
    eye: "right",
    stage: "cover",
    test: START,
    direction: nextDirection(null, random),
    results: {},
  };
}

/** The other eye is covered; show the first letter. */
export function beginEye(session: Session): Session {
  return session.stage === "cover" ? { ...session, stage: "test" } : session;
}

/** The direction the child showed, or null for "can't see". */
export function respond(session: Session, shown: Direction | null, random: () => number): Session {
  if (session.stage !== "test") return session;
  const test = answer(session.test, shown === session.direction, session.levels);
  if (!test.done) return { ...session, test, direction: nextDirection(session.direction, random) };
  const results = { ...session.results, [session.eye]: test.passed };
  if (session.eye === "right") {
    return {
      ...session,
      eye: "left",
      stage: "cover",
      test: START,
      direction: nextDirection(session.direction, random),
      results,
    };
  }
  return { ...session, test, stage: "result", results };
}
