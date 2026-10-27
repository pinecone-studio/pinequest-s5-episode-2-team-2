// Placeholders until the team writes the final Mongolian copy (CONTRIBUTING.md "App copy").
export const testsCopy = {
  title: "TODO(copy): Checks",
  intro: "TODO(copy): Choose a check. Neither one is a diagnosis.",
  start: "TODO(copy): Start",
  comingSoon: "TODO(copy): Coming soon",
  notYet: "TODO(copy): Not done yet",
  lastResult: (outcome: string, days: number) =>
    days === 0
      ? `TODO(copy): Last: ${outcome}, today`
      : `TODO(copy): Last: ${outcome}, ${days} days ago`,
  checks: {
    strabismus: {
      title: "TODO(copy): Eye alignment scan",
      what: "TODO(copy): Looks at the light reflex in both eyes for signs of a squint.",
      time: "TODO(copy): 3 seconds",
      needs: "TODO(copy): Torch on, phone about 35 cm away",
    },
    vision: {
      title: "TODO(copy): Vision check",
      what: "TODO(copy): Shows the letter E in different sizes for each eye.",
      time: "TODO(copy): About 3 minutes",
      needs: "TODO(copy): About 3 m of space",
    },
  },
} as const;
