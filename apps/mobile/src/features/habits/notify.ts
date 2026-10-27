import * as Notifications from "expo-notifications";
import { REMINDER_KINDS, reminderIdentifier, type PlannedReminder } from "./reminderPlan";
import type { ReminderKind } from "./schedule";

export type SyncResult = "scheduled" | "cleared" | "denied";
export type ReminderText = (kind: ReminderKind) => { title: string; body: string };

/** Asks only when needed; iOS shows the system prompt once. */
async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Replaces this child's scheduled local reminders with `plan`. Nothing leaves the phone:
 * remote (push) notifications are disabled in app.json.
 */
export async function syncChildReminders(
  childId: string,
  plan: PlannedReminder[],
  text: ReminderText,
): Promise<SyncResult> {
  await Promise.all(
    REMINDER_KINDS.map((kind) =>
      Notifications.cancelScheduledNotificationAsync(reminderIdentifier(childId, kind)),
    ),
  );
  if (plan.length === 0) return "cleared";
  if (!(await ensurePermission())) return "denied";
  for (const reminder of plan) {
    const trigger: Notifications.NotificationTriggerInput =
      reminder.trigger.type === "daily"
        ? {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: reminder.trigger.hour,
            minute: reminder.trigger.minute,
          }
        : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.trigger.date };
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.identifier,
      content: text(reminder.kind),
      trigger,
    });
  }
  return "scheduled";
}

/** Used by "delete all data" so no reminder about a deleted child fires later. */
export function cancelAllReminders(): Promise<void> {
  return Notifications.cancelAllScheduledNotificationsAsync();
}
