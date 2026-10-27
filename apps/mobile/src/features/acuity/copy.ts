import type { AgeGroup, Eye } from "./acuity";

// Placeholders until the team writes the final Mongolian copy (CONTRIBUTING.md "App copy").
export const acuityCopy = {
  title: "TODO(copy): Vision check",
  who: "TODO(copy): Who is being checked?",
  groups: {
    child3: "TODO(copy): Child, 3 years",
    child4: "TODO(copy): Child, 4 years",
    child5: "TODO(copy): Child, 5 years or older",
    adult: "TODO(copy): Adult",
  } satisfies Record<AgeGroup, string>,
  setup:
    "TODO(copy): Hold the phone at the child's eye level, about 3 m away. Show the screen to the child; they point where the E's legs go and you tap that arrow.",
  cover: (eye: Eye) =>
    eye === "right"
      ? "TODO(copy): Cover the LEFT eye with a hand or card. Check the RIGHT eye."
      : "TODO(copy): Now cover the RIGHT eye. Check the LEFT eye.",
  ready: "TODO(copy): Eye covered, start",
  progress: (level: number, total: number) => `TODO(copy): Size ${level} of ${total}`,
  up: "TODO(copy): Up",
  down: "TODO(copy): Down",
  left: "TODO(copy): Left",
  right: "TODO(copy): Right",
  cantSee: "TODO(copy): Can't see it",
  resultTitle: "TODO(copy): Vision check result",
  eyeLabel: (eye: Eye) => (eye === "right" ? "TODO(copy): Right eye" : "TODO(copy): Left eye"),
  belowChart: "TODO(copy): Below the chart",
  refer: "TODO(copy): Seeing an eye doctor is recommended.",
  noSign: "TODO(copy): No sign was seen at this check.",
  notice: "TODO(copy): This check does not diagnose and does not replace an eye exam.",
  again: "TODO(copy): Check again",
  done: "TODO(copy): Done",
} as const;
