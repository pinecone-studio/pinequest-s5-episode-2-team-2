import { planReminders, reminderIdentifier } from "./reminderPlan";

process.env.TZ = "Asia/Ulaanbaatar";
const at = (local: string) => new Date(`${local}+08:00`);
const now = at("2026-10-27T12:00:00");

test("only enabled reminders are planned, with stable identifiers", () => {
  const plan = planReminders(
    "c1",
    {
      outdoor: { enabled: true, timeOfDay: "16:30", intervalDays: null },
      screen_break: { enabled: false, timeOfDay: "19:00", intervalDays: null },
      rescan: null,
    },
    null,
    now,
  );
  expect(plan).toEqual([
    {
      identifier: reminderIdentifier("c1", "outdoor"),
      kind: "outdoor",
      trigger: { type: "daily", hour: 16, minute: 30 },
    },
  ]);
  expect(reminderIdentifier("c1", "outdoor")).not.toBe(reminderIdentifier("c2", "outdoor"));
});

test("re-scan is planned from the last scan", () => {
  const plan = planReminders(
    "c1",
    { rescan: { enabled: true, timeOfDay: null, intervalDays: 14 } },
    at("2026-10-20T15:00:00").toISOString(),
    now,
  );
  expect(plan[0]?.trigger).toEqual({ type: "date", date: at("2026-11-03T10:00:00") });
});

test("nothing is planned when everything is off", () => {
  expect(planReminders("c1", {}, null, now)).toEqual([]);
});
