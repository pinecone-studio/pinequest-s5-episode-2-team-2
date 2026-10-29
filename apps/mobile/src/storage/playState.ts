import type { SQLiteDatabase } from "expo-sqlite";

type StateDb = Pick<SQLiteDatabase, "runAsync" | "getFirstAsync" | "getAllAsync">;

/**
 * Reads a child's saved game progress (e.g. the garden), or `fallback` when nothing is saved
 * yet or the saved value is unreadable. Progress is local only; nothing leaves the phone.
 */
export async function loadPlayState<T>(
  db: StateDb,
  childId: string,
  key: string,
  fallback: T,
): Promise<T> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM play_state WHERE child_id = ? AND key = ?",
    childId,
    key,
  );
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function savePlayState(
  db: StateDb,
  childId: string,
  key: string,
  value: unknown,
  at: Date = new Date(),
): Promise<void> {
  await db.runAsync(
    `INSERT INTO play_state (child_id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (child_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    childId,
    key,
    JSON.stringify(value),
    at.toISOString(),
  );
}

/** How many stars a child has earned from games whose key starts with `prefix`, ever. */
export async function countStars(db: StateDb, childId: string, prefix: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM play_stars WHERE child_id = ? AND substr(game, 1, ?) = ?",
    childId,
    prefix.length,
    prefix,
  );
  return row?.n ?? 0;
}
