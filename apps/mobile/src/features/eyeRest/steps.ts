import type { Exercise } from "./content";

export type StepState =
  { done: false; stepIndex: number; round: number; secondsLeft: number } | { done: true };

/** Total length of an exercise in seconds, all rounds included. */
export function totalSeconds(exercise: Exercise): number {
  const oneRound = exercise.steps.reduce((sum, step) => sum + step.seconds, 0);
  return oneRound * exercise.rounds;
}

/**
 * Where the exercise is after `elapsedMs`: the current step, the round (1-based)
 * and whole seconds left in that step. Pure, so the screen only feeds it a clock.
 */
export function stepAt(exercise: Exercise, elapsedMs: number): StepState {
  const elapsed = Math.max(0, elapsedMs) / 1000;
  if (elapsed >= totalSeconds(exercise)) return { done: true };

  const oneRound = totalSeconds(exercise) / exercise.rounds;
  const round = Math.floor(elapsed / oneRound);
  let intoRound = elapsed - round * oneRound;
  for (const [stepIndex, { seconds }] of exercise.steps.entries()) {
    if (intoRound < seconds) {
      return {
        done: false,
        stepIndex,
        round: round + 1,
        secondsLeft: Math.ceil(seconds - intoRound),
      };
    }
    intoRound -= seconds;
  }
  return { done: true };
}
