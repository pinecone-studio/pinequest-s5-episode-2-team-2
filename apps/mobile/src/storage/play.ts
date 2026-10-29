import type { SQLiteDatabase } from "expo-sqlite";
import { localDayKey } from "../features/habits/schedule";

type PlayDb = Pick<SQLiteDatabase, "runAsync" | "getAllAsync">;

export type StarSummary = {
  /** Stars ever earned by the child. */
  total: number;
  /** Games finished today (local day), each counted once. */
  today: string[];
};

/**
 * Gives the child a star for finishing a game. A game earns at most one star per local day,
 * so replaying it does not inflate the count. Returns true when a new star was added.
 */
export async function addStar(
  db: PlayDb,
  childId: string,
  game: string,
  at: Date = new Date(),
): Promise<boolean> {
  const result = await db.runAsync(
    "INSERT OR IGNORE INTO play_stars (child_id, day, game, earned_at) VALUES (?, ?, ?, ?)",
    childId,
    localDayKey(at),
    game,
    at.toISOString(),
  );
  return result.changes > 0;
}

export async function starSummary(
  db: PlayDb,
  childId: string,
  day: Date = new Date(),
): Promise<StarSummary> {
  const rows = await db.getAllAsync<{ day: string; game: string }>(
    "SELECT day, game FROM play_stars WHERE child_id = ? ORDER BY earned_at",
    childId,
  );
  const key = localDayKey(day);
  return { total: rows.length, today: rows.filter((r) => r.day === key).map((r) => r.game) };
}
