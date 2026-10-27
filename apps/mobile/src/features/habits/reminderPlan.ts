import type { Reminder } from "../../storage/habits";
import { nextRescanAt, parseTimeOfDay, type ReminderKind } from "./schedule";

export type PlannedReminder = {
  /** Stable per child and kind, so saving again replaces instead of duplicating. */
  identifier: string;
  kind: ReminderKind;
  trigger: { type: "daily"; hour: number; minute: number } | { type: "date"; date: Date };
};

export const REMINDER_KINDS: ReminderKind[] = ["outdoor", "screen_break", "rescan"];

export function reminderIdentifier(childId: string, kind: ReminderKind): string {
  return `reminder:${childId}:${kind}`;
}

/** Turns saved settings into local notifications to schedule; disabled ones are left out. */
export function planReminders(
  childId: string,
  reminders: Partial<Record<ReminderKind, Reminder | null>>,
  lastScanAt: string | null,
  now: Date,
): PlannedReminder[] {
  const plan: PlannedReminder[] = [];
  for (const kind of REMINDER_KINDS) {
    const reminder = reminders[kind];
    if (!reminder?.enabled) continue;
    const identifier = reminderIdentifier(childId, kind);
    if (kind === "rescan") {
      if (reminder.intervalDays === null) continue;
      const date = nextRescanAt(lastScanAt, reminder.intervalDays, now);
      plan.push({ identifier, kind, trigger: { type: "date", date } });
    } else {
      const time = reminder.timeOfDay ? parseTimeOfDay(reminder.timeOfDay) : null;
      if (time) plan.push({ identifier, kind, trigger: { type: "daily", ...time } });
    }
  }
  return plan;
}
