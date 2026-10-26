import type { Reminder } from "../../storage/habits";
import { parseTimeOfDay, type ReminderKind } from "./schedule";

export type ReminderForm = { enabled: boolean; timeOfDay: string; intervalDays: string };

export const DEFAULT_FORMS: Record<ReminderKind, ReminderForm> = {
  outdoor: { enabled: false, timeOfDay: "16:00", intervalDays: "" },
  screen_break: { enabled: false, timeOfDay: "19:00", intervalDays: "" },
  rescan: { enabled: false, timeOfDay: "", intervalDays: "30" },
};

/** Turns the text fields into a storable reminder, or null if the relevant field is invalid. */
export function toReminder(kind: ReminderKind, form: ReminderForm): Reminder | null {
  if (kind === "rescan") {
    const text = form.intervalDays.trim();
    const days = /^\d+$/.test(text) ? Number(text) : NaN;
    if (!(days >= 1 && days <= 365)) return null;
    return { enabled: form.enabled, timeOfDay: null, intervalDays: days };
  }
  const time = form.timeOfDay.trim();
  if (!parseTimeOfDay(time)) return null;
  return { enabled: form.enabled, timeOfDay: time, intervalDays: null };
}

export function toForm(kind: ReminderKind, saved: Reminder | null): ReminderForm {
  if (!saved) return DEFAULT_FORMS[kind];
  return {
    enabled: saved.enabled,
    timeOfDay: saved.timeOfDay ?? "",
    intervalDays: saved.intervalDays === null ? "" : String(saved.intervalDays),
  };
}
