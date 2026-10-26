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
  {
    version: 3,
    up: (db) =>
      db.execAsync(`
        CREATE TABLE children (
          id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
          name TEXT NOT NULL CHECK (length(trim(name)) > 0),
          birth_year INTEGER CHECK (birth_year IS NULL OR
            (typeof(birth_year) = 'integer' AND birth_year BETWEEN 1 AND 9999)),
          created_at TEXT NOT NULL
        );
      `),
  },
  {
    // #31: the parent's daily goal per treatment, and one row per timed wear/patch period.
    version: 4,
    up: (db) =>
      db.execAsync(`
        CREATE TABLE treatment_goals (
          child_id TEXT NOT NULL REFERENCES children (id) ON DELETE CASCADE,
          kind TEXT NOT NULL CHECK (kind IN ('patch', 'glasses')),
          daily_minutes INTEGER NOT NULL CHECK (daily_minutes BETWEEN 1 AND 1440),
          updated_at TEXT NOT NULL,
          PRIMARY KEY (child_id, kind)
        );
        CREATE TABLE treatment_logs (
          id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
          child_id TEXT NOT NULL REFERENCES children (id) ON DELETE CASCADE,
          kind TEXT NOT NULL CHECK (kind IN ('patch', 'glasses')),
          started_at TEXT NOT NULL,
          ended_at TEXT CHECK (ended_at IS NULL OR ended_at >= started_at)
        );
        CREATE INDEX treatment_logs_by_child ON treatment_logs (child_id, started_at);
        -- At most one running timer per child and treatment.
        CREATE UNIQUE INDEX treatment_logs_one_running
          ON treatment_logs (child_id, kind) WHERE ended_at IS NULL;
      `),
  },
  {
    // #32: daily habit totals and reminder settings per child.
    version: 5,
    up: (db) =>
      db.execAsync(`
        CREATE TABLE habit_days (
          child_id TEXT NOT NULL REFERENCES children (id) ON DELETE CASCADE,
          day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
          kind TEXT NOT NULL CHECK (kind IN ('outdoor', 'screen_break')),
          amount INTEGER NOT NULL CHECK (amount >= 0),
          PRIMARY KEY (child_id, day, kind)
        );
        CREATE TABLE reminders (
          child_id TEXT NOT NULL REFERENCES children (id) ON DELETE CASCADE,
          kind TEXT NOT NULL CHECK (kind IN ('outdoor', 'screen_break', 'rescan')),
          enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
          time_of_day TEXT CHECK (time_of_day IS NULL OR time_of_day GLOB '[0-2][0-9]:[0-5][0-9]'),
          interval_days INTEGER CHECK (interval_days IS NULL OR interval_days BETWEEN 1 AND 365),
          updated_at TEXT NOT NULL,
          PRIMARY KEY (child_id, kind)
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
