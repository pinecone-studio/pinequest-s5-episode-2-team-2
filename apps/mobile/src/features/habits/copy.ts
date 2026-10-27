// Placeholders until the team writes the final Mongolian copy (CONTRIBUTING.md "App copy").
export const habitsCopy = {
  title: "TODO(copy): Healthy habits",
  noChild: "TODO(copy): Add a child profile first",
  today: "TODO(copy): Today",
  outdoor: "TODO(copy): Time outdoors",
  outdoorTotal: (min: number) => `${min} TODO(copy): min`,
  addMinutes: (min: number) => `+${min} TODO(copy): min`,
  screenBreaks: "TODO(copy): Screen breaks",
  breakTotal: (n: number) => `${n} TODO(copy): breaks`,
  addBreak: "TODO(copy): +1 break",
  remindersTitle: "TODO(copy): Reminders",
  remindersNote: "TODO(copy): Reminders are local notifications on this phone.",
  permissionDenied: "TODO(copy): Saved, but notifications are off. Allow them in Settings.",
  notification: (kind: "outdoor" | "screen_break" | "rescan", name: string) =>
    ({
      outdoor: { title: "TODO(copy): Time outdoors", body: `TODO(copy): Go outside with ${name}` },
      screen_break: {
        title: "TODO(copy): Screen break",
        body: `TODO(copy): ${name}, rest your eyes`,
      },
      rescan: { title: "TODO(copy): Eye check", body: `TODO(copy): Time to scan ${name} again` },
    })[kind],
  reminderLabels: {
    outdoor: "TODO(copy): Go outside (daily, HH:MM)",
    screen_break: "TODO(copy): Screen break (daily, HH:MM)",
    rescan: "TODO(copy): Scan again after (days)",
  },
  save: "TODO(copy): Save",
  saved: "TODO(copy): Saved",
  invalid: "TODO(copy): Check the time (HH:MM) or days (1–365)",
  failed: "TODO(copy): Could not save. Try again.",
} as const;
