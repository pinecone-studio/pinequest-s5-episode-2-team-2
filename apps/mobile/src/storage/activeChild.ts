import type { SQLiteDatabase } from "expo-sqlite";

type ActiveChildDb = Pick<SQLiteDatabase, "getFirstAsync" | "runAsync">;
const KEY = "active_child_id";

/**
 * The selected child, or the oldest profile when none is selected or the selected one was
 * deleted. Null when there are no profiles.
 */
export async function getActiveChildId(db: ActiveChildDb): Promise<string | null> {
  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM children
     ORDER BY id = (SELECT value FROM app_metadata WHERE key = ?) DESC, created_at, id
     LIMIT 1`,
    KEY,
  );
  return row?.id ?? null;
}

export async function setActiveChildId(db: ActiveChildDb, id: string): Promise<void> {
  const exists = await db.getFirstAsync("SELECT 1 FROM children WHERE id = ?", id);
  if (!exists) throw new Error("Unknown child");
  await db.runAsync("INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)", KEY, id);
}
