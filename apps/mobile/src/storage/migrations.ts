import type { SQLiteDatabase } from "expo-sqlite";

type Connection = Pick<SQLiteDatabase, "execAsync" | "getFirstAsync">;
export type Migration = {
  version: number;
  up: (db: Connection) => Promise<void>;
};

// Append migrations here. Never edit an already released migration.
export const migrations: readonly Migration[] = [
  {
    version: 1,
    up: (db) =>
      db.execAsync(`
        CREATE TABLE app_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        INSERT INTO app_metadata (key, value) VALUES ('initialized', '1');
      `),
  },
  {
    // #30: one row holding the consent version the parent accepted.
    version: 2,
    up: (db) =>
      db.execAsync(`
        CREATE TABLE consent (
          id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
          version TEXT NOT NULL,
          accepted_at TEXT NOT NULL
        );
      `),
  },
];

type MigrationDatabase = {
  execAsync: Connection["execAsync"];
  withExclusiveTransactionAsync: (
    task: (transaction: Connection) => Promise<void>,
  ) => Promise<void>;
};

export async function migrateDatabase(
  db: MigrationDatabase,
  steps: readonly Migration[] = migrations,
): Promise<void> {
  steps.forEach((step, index) => {
    if (step.version !== index + 1) throw new Error("Migrations must be contiguous from version 1");
  });
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  // Schema changes and the version number commit or roll back together.
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const row = await transaction.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    const version = row?.user_version ?? 0;
    if (version > steps.length) throw new Error("Database is newer than this app");
    for (const step of steps) {
      if (step.version <= version) continue;
      await step.up(transaction);
      await transaction.execAsync(`PRAGMA user_version = ${step.version}`);
    }
  });
}
