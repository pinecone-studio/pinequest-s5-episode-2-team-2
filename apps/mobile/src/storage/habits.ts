import type { SQLiteDatabase } from "expo-sqlite";
import {
  localDayKey,
  parseTimeOfDay,
  type HabitKind,
  type ReminderKind,
} from "../features/habits/schedule";

type HabitsDb = Pick<SQLiteDatabase, "runAsync" | "getFirstAsync" | "getAllAsync">;

export type HabitTotals = Record<HabitKind, number>;
export type Reminder = {
  enabled: boolean;
  /** "HH:MM" for daily habit reminders; null for re-scan. */
  timeOfDay: string | null;
  /** Days after the last scan; only for re-scan. */
  intervalDays: number | null;
};

/** Adds outdoor minutes or screen breaks to the child's total for the local day. */
export async function addHabit(
  db: HabitsDb,
  childId: string,
  kind: HabitKind,
  amount: number,
  day: Date = new Date(),
): Promise<void> {
  if (!Number.isInteger(amount) || amount < 1 || amount > 1440) {
    throw new Error("Amount must be a whole number from 1 to 1440");
  }
  await db.runAsync(
    `INSERT INTO habit_days (child_id, day, kind, amount) VALUES (?, ?, ?, ?)
     ON CONFLICT (child_id, day, kind) DO UPDATE SET amount = amount + excluded.amount`,
    childId,
    localDayKey(day),
    kind,
    amount,
  );
}

export async function habitTotals(db: HabitsDb, childId: string, day: Date): Promise<HabitTotals> {
  const rows = await db.getAllAsync<{ kind: HabitKind; amount: number }>(
    "SELECT kind, amount FROM habit_days WHERE child_id = ? AND day = ?",
    childId,
    localDayKey(day),
  );
  const totals: HabitTotals = { outdoor: 0, screen_break: 0 };
  for (const row of rows) totals[row.kind] = row.amount;
  return totals;
}

export async function getReminder(
  db: HabitsDb,
  childId: string,
  kind: ReminderKind,
): Promise<Reminder | null> {
  const row = await db.getFirstAsync<{
    enabled: number;
    timeOfDay: string | null;
    intervalDays: number | null;
  }>(
    `SELECT enabled, time_of_day AS timeOfDay, interval_days AS intervalDays
     FROM reminders WHERE child_id = ? AND kind = ?`,
    childId,
    kind,
  );
  return row ? { ...row, enabled: row.enabled === 1 } : null;
}

/** Daily habits need a valid "HH:MM"; re-scan needs 1–365 days. */
export async function setReminder(
  db: HabitsDb,
  childId: string,
  kind: ReminderKind,
  reminder: Reminder,
  now: Date = new Date(),
): Promise<void> {
  const timeOfDay = kind === "rescan" ? null : reminder.timeOfDay;
  const intervalDays = kind === "rescan" ? reminder.intervalDays : null;
  if (kind !== "rescan" && (timeOfDay === null || !parseTimeOfDay(timeOfDay))) {
    throw new Error("Daily reminders need a time as HH:MM");
  }
  if (
    kind === "rescan" &&
    (intervalDays === null ||
      !Number.isInteger(intervalDays) ||
      intervalDays < 1 ||
      intervalDays > 365)
  ) {
    throw new Error("Re-scan reminders need 1 to 365 days");
  }
  await db.runAsync(
    `INSERT INTO reminders (child_id, kind, enabled, time_of_day, interval_days, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (child_id, kind) DO UPDATE SET enabled = excluded.enabled,
       time_of_day = excluded.time_of_day, interval_days = excluded.interval_days,
       updated_at = excluded.updated_at`,
    childId,
    kind,
    reminder.enabled ? 1 : 0,
    timeOfDay,
    intervalDays,
    now.toISOString(),
  );
}
