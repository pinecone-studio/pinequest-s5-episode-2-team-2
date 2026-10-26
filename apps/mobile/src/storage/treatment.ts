import type { SQLiteDatabase } from "expo-sqlite";
import { localDayBounds, type TreatmentKind } from "../features/treatment/progress";

export type TreatmentLog = {
  id: string;
  childId: string;
  kind: TreatmentKind;
  startedAt: string;
  endedAt: string | null;
};
type TreatmentDb = Pick<SQLiteDatabase, "runAsync" | "getFirstAsync" | "getAllAsync">;
const logColumns = "id, child_id AS childId, kind, started_at AS startedAt, ended_at AS endedAt";

/** Daily goal in minutes from the doctor's instructions, or null if none is set. */
export async function getGoal(
  db: TreatmentDb,
  childId: string,
  kind: TreatmentKind,
): Promise<number | null> {
  const row = await db.getFirstAsync<{ minutes: number }>(
    "SELECT daily_minutes AS minutes FROM treatment_goals WHERE child_id = ? AND kind = ?",
    childId,
    kind,
  );
  return row?.minutes ?? null;
}

export async function setGoal(
  db: TreatmentDb,
  childId: string,
  kind: TreatmentKind,
  dailyMinutes: number,
  now: Date = new Date(),
): Promise<void> {
  if (!Number.isInteger(dailyMinutes) || dailyMinutes < 1 || dailyMinutes > 1440) {
    throw new Error("Daily goal must be a whole number of minutes between 1 and 1440");
  }
  await db.runAsync(
    `INSERT INTO treatment_goals (child_id, kind, daily_minutes, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (child_id, kind) DO UPDATE SET daily_minutes = excluded.daily_minutes,
       updated_at = excluded.updated_at`,
    childId,
    kind,
    dailyMinutes,
    now.toISOString(),
  );
}

export function getRunning(
  db: TreatmentDb,
  childId: string,
  kind: TreatmentKind,
): Promise<TreatmentLog | null> {
  return db.getFirstAsync<TreatmentLog>(
    `SELECT ${logColumns} FROM treatment_logs WHERE child_id = ? AND kind = ? AND ended_at IS NULL`,
    childId,
    kind,
  );
}

/** Starts a timer. Fails if one is already running for this child and treatment. */
export async function startTimer(
  db: TreatmentDb,
  id: string,
  childId: string,
  kind: TreatmentKind,
  now: Date = new Date(),
): Promise<TreatmentLog> {
  const log = { id, childId, kind, startedAt: now.toISOString(), endedAt: null };
  await db.runAsync(
    "INSERT INTO treatment_logs (id, child_id, kind, started_at) VALUES (?, ?, ?, ?)",
    log.id,
    log.childId,
    log.kind,
    log.startedAt,
  );
  return log;
}

/** Stops the running timer, if any, and returns it. */
export async function stopTimer(
  db: TreatmentDb,
  childId: string,
  kind: TreatmentKind,
  now: Date = new Date(),
): Promise<TreatmentLog | null> {
  const running = await getRunning(db, childId, kind);
  if (!running) return null;
  // Never end before the start, even if the phone clock moved backwards.
  const endedAt = new Date(Math.max(now.getTime(), Date.parse(running.startedAt))).toISOString();
  await db.runAsync("UPDATE treatment_logs SET ended_at = ? WHERE id = ?", endedAt, running.id);
  return { ...running, endedAt };
}

/** Periods overlapping the local day of `day` (including a running one), oldest first. */
export function logsForDay(
  db: TreatmentDb,
  childId: string,
  kind: TreatmentKind,
  day: Date,
): Promise<TreatmentLog[]> {
  const { start, end } = localDayBounds(day);
  return db.getAllAsync<TreatmentLog>(
    `SELECT ${logColumns} FROM treatment_logs
     WHERE child_id = ? AND kind = ? AND started_at < ? AND (ended_at IS NULL OR ended_at > ?)
     ORDER BY started_at`,
    childId,
    kind,
    end.toISOString(),
    start.toISOString(),
  );
}

/** Periods overlapping [from, to) (including a running one), oldest first. */
export function logsBetween(
  db: TreatmentDb,
  childId: string,
  kind: TreatmentKind,
  from: Date,
  to: Date,
): Promise<TreatmentLog[]> {
  return db.getAllAsync<TreatmentLog>(
    `SELECT ${logColumns} FROM treatment_logs
     WHERE child_id = ? AND kind = ? AND started_at < ? AND (ended_at IS NULL OR ended_at > ?)
     ORDER BY started_at`,
    childId,
    kind,
    to.toISOString(),
    from.toISOString(),
  );
}
