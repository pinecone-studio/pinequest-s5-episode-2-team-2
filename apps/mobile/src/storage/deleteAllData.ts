import type { SQLiteDatabase } from "expo-sqlite";

type Connection = Pick<SQLiteDatabase, "execAsync" | "getAllAsync">;
type DeleteDatabase = {
  withExclusiveTransactionAsync: (
    task: (transaction: Connection) => Promise<void>,
  ) => Promise<void>;
};

/** App-internal tables that hold no user data and must survive a reset. */
const KEEP_TABLES = new Set(["app_metadata"]);

/**
 * Deletes every row of user data on this device (#33): consent, children, sessions and any
 * table added by a later migration. The schema and its migration version stay, so the app
 * keeps working and starts again from onboarding. All tables are cleared or none are.
 */
export async function deleteAllData(db: DeleteDatabase): Promise<string[]> {
  const cleared: string[] = [];
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const tables = await transaction.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    // Check foreign keys at commit instead of per statement, so table order does not matter.
    // The pragma resets automatically when the transaction ends.
    await transaction.execAsync("PRAGMA defer_foreign_keys = ON");
    for (const { name } of tables) {
      if (KEEP_TABLES.has(name)) continue;
      await transaction.execAsync(`DELETE FROM "${name.replaceAll('"', '""')}"`);
      cleared.push(name);
    }
  });
  return cleared;
}
