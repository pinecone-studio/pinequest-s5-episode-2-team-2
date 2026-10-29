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
    version: 5,
    up: (db) =>
      db.execAsync(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
          child_id TEXT REFERENCES children (id) ON DELETE CASCADE,
          created_at TEXT NOT NULL,
          outcome TEXT NOT NULL CHECK (outcome IN
            ('REFER', 'RETAKE', 'NOT_ASSESSED', 'NO_VISIBLE_SIGN')),
          reason_codes TEXT NOT NULL CHECK (json_valid(reason_codes) AND json_type(reason_codes) = 'array'),
          frames_total INTEGER NOT NULL CHECK (typeof(frames_total) = 'integer' AND frames_total >= 0),
          frames_used INTEGER NOT NULL CHECK (typeof(frames_used) = 'integer' AND frames_used BETWEEN 0 AND frames_total),
          asymmetry_score REAL CHECK (asymmetry_score IS NULL OR asymmetry_score >= 0),
          spread REAL CHECK (spread IS NULL OR spread >= 0),
          model_version TEXT NOT NULL CHECK (length(trim(model_version)) > 0),
          policy_version TEXT NOT NULL CHECK (length(trim(policy_version)) > 0),
          duration_ms REAL NOT NULL CHECK (duration_ms >= 0)
        );
        CREATE INDEX sessions_by_child ON sessions (child_id, created_at DESC, id DESC);
      `),
  },
  {
    // #32: daily habit totals and reminder settings per child.
    version: 6,
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
  {
    // #139: one row per vision check; the smallest logMAR level passed per eye (NULL: none).
    version: 7,
    up: (db) =>
      db.execAsync(`
        CREATE TABLE acuity_results (
          id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
          child_id TEXT REFERENCES children (id) ON DELETE CASCADE,
          created_at TEXT NOT NULL,
          age_group TEXT NOT NULL CHECK (age_group IN ('child3', 'child4', 'child5', 'adult')),
          right_logmar REAL CHECK (right_logmar IS NULL OR right_logmar BETWEEN 0 AND 1),
          left_logmar REAL CHECK (left_logmar IS NULL OR left_logmar BETWEEN 0 AND 1),
          refer INTEGER NOT NULL CHECK (refer IN (0, 1))
        );
        CREATE INDEX acuity_results_by_child ON acuity_results (child_id, created_at DESC, id DESC);
      `),
  },
  {
    // Eye-rest games: one star per child, local day and game, so a game counts once a day.
    version: 8,
    up: (db) =>
      db.execAsync(`
        CREATE TABLE play_stars (
          child_id TEXT NOT NULL REFERENCES children (id) ON DELETE CASCADE,
          day TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
          game TEXT NOT NULL CHECK (length(trim(game)) > 0),
          earned_at TEXT NOT NULL,
          PRIMARY KEY (child_id, day, game)
        );
      `),
  },
  {
    // Нүдхэний ертөнц: small per-child game progress (garden plots, the mascot's outfit) as JSON.
    version: 9,
    up: (db) =>
      db.execAsync(`
        CREATE TABLE play_state (
          child_id TEXT NOT NULL REFERENCES children (id) ON DELETE CASCADE,
          key TEXT NOT NULL CHECK (length(trim(key)) > 0),
          value TEXT NOT NULL CHECK (json_valid(value)),
          updated_at TEXT NOT NULL,
          PRIMARY KEY (child_id, key)
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
