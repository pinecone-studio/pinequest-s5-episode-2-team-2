import { DEFAULT_FORMS, toForm, toReminder } from "./reminderForm";

test("daily reminders keep a valid time and drop the interval", () => {
  expect(toReminder("outdoor", { enabled: true, timeOfDay: " 16:30 ", intervalDays: "7" })).toEqual(
    { enabled: true, timeOfDay: "16:30", intervalDays: null },
  );
  expect(
    toReminder("screen_break", { ...DEFAULT_FORMS.screen_break, timeOfDay: "7pm" }),
  ).toBeNull();
});

test("re-scan needs 1 to 365 whole days and drops the time", () => {
  const form = { enabled: true, timeOfDay: "09:00", intervalDays: "14" };
  expect(toReminder("rescan", form)).toEqual({ enabled: true, timeOfDay: null, intervalDays: 14 });
  for (const bad of ["0", "366", "1.5", "", "two"]) {
    expect(toReminder("rescan", { ...form, intervalDays: bad })).toBeNull();
  }
});

test("saved reminders round-trip through the form; defaults are valid", () => {
  const saved = { enabled: true, timeOfDay: null, intervalDays: 30 };
  expect(toReminder("rescan", toForm("rescan", saved))).toEqual(saved);
  for (const kind of ["outdoor", "screen_break", "rescan"] as const) {
    expect(toForm(kind, null)).toBe(DEFAULT_FORMS[kind]);
    expect(toReminder(kind, DEFAULT_FORMS[kind])).not.toBeNull();
  }
});
