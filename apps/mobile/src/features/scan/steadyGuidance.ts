/**
 * Keeps the live instruction steady. Frames arrive many times a second and a single bad frame
 * (a blink, a moment of blur) would otherwise swap the text back and forth, which is hard to
 * read and makes screen readers announce every change.
 */
export interface SteadyGuidance {
  shown: string | null;
  /** The most recent messages, oldest first, at most `window` long. */
  recent: string[];
}

export interface SteadyOptions {
  /** How many recent frames are considered. */
  window: number;
  /** How many of them must agree on a new message before it replaces the shown one. */
  switchAt: number;
}

// About a third of a second at the camera's analysis rate.
export const DEFAULT_STEADY: SteadyOptions = { window: 8, switchAt: 5 };

export const initialSteady: SteadyGuidance = { shown: null, recent: [] };

export function nextSteady(
  state: SteadyGuidance,
  message: string,
  options: SteadyOptions = DEFAULT_STEADY,
): SteadyGuidance {
  const recent = [...state.recent, message].slice(-options.window);
  // The first message is shown at once so the screen is never empty.
  if (state.shown === null) return { shown: message, recent };
  if (message === state.shown) return { shown: state.shown, recent };
  const agreeing = recent.filter((m) => m === message).length;
  return { shown: agreeing >= options.switchAt ? message : state.shown, recent };
}
