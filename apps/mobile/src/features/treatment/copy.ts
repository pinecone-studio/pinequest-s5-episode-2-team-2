// Placeholders until the team writes the final Mongolian copy (CONTRIBUTING.md "App copy").
export const treatmentCopy = {
  title: "TODO(copy): Treatment",
  noChild: "TODO(copy): Add a child profile first",
  kinds: { patch: "TODO(copy): Eye patch", glasses: "TODO(copy): Glasses" },
  today: "TODO(copy): Today",
  minutes: (n: number) => `${n} TODO(copy): min`,
  goal: "TODO(copy): Daily goal from the doctor (minutes)",
  noGoal: "TODO(copy): No goal set",
  saveGoal: "TODO(copy): Save goal",
  invalidGoal: "TODO(copy): Enter whole minutes from 1 to 1440",
  start: "TODO(copy): Start",
  stop: "TODO(copy): Stop",
  running: "TODO(copy): Running",
  failed: "TODO(copy): Could not save. Try again.",
  week: "TODO(copy): Last 7 days",
  // Day of the month only, so the axis needs no translated weekday names.
  weekday: (day: Date) => String(day.getDate()),
  streak: (days: number) => `TODO(copy): Goal met ${days} days in a row`,
  dayLabel: (day: Date, minutes: number, met: boolean | null) =>
    `${day.getMonth() + 1}/${day.getDate()}: ${minutes} TODO(copy): min` +
    (met === null ? "" : met ? " TODO(copy): goal met" : " TODO(copy): goal not met"),
} as const;
