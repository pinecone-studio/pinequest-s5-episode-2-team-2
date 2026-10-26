import { createRequire } from "node:module";
import type * as SQLite from "node:sqlite";
import { deleteAllData } from "./deleteAllData";
import { migrateDatabase, migrations } from "./migrations";

// Real SQLite (Node) with the app's real migrations, as in migrations.test.ts.
const { DatabaseSync } = createRequire(__filename)("node:sqlite") as typeof SQLite;
let sqlite: SQLite.DatabaseSync;

const connection = {
  async execAsync(sql: string) {
    sqlite.exec(sql);
  },
  async getFirstAsync<T>(sql: string): Promise<T | null> {
    return (sqlite.prepare(sql).get() as T | undefined) ?? null;
  },
  async getAllAsync<T>(sql: string): Promise<T[]> {
    return sqlite.prepare(sql).all() as T[];
  },
};
const db = {
  ...connection,
  async withExclusiveTransactionAsync(task: (tx: typeof connection) => Promise<void>) {
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      await task(connection);
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  },
};

const count = (table: string) =>
  (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

beforeEach(async () => {
  sqlite = new DatabaseSync(":memory:");
  await migrateDatabase(db);
  sqlite.exec("INSERT INTO consent (id, version, accepted_at) VALUES (1, '1', '2026-10-26')");
  // A stand-in for the sessions table a later feature adds.
  sqlite.exec(`
    CREATE TABLE sessions (id TEXT PRIMARY KEY, child_id TEXT REFERENCES children (id));
    INSERT INTO children (id, name, created_at) VALUES ('c1', 'Child', '2026-10-26');
    INSERT INTO sessions VALUES ('s1', 'c1');
  `);
});
afterEach(() => {
  sqlite.close();
});

test("deletes all user rows, including tables added by later features", async () => {
  const cleared = await deleteAllData(db);
  expect(cleared).toEqual(["children", "consent", "sessions"]);
  expect(count("consent")).toBe(0);
  expect(count("children")).toBe(0);
  expect(count("sessions")).toBe(0);
});

test("keeps the schema and migration version so the app still works afterwards", async () => {
  await deleteAllData(db);
  expect(sqlite.prepare("PRAGMA user_version").get()).toEqual({ user_version: migrations.length });
  expect(count("app_metadata")).toBe(1);
  sqlite.exec("INSERT INTO children (id, name, created_at) VALUES ('c2', 'Child', '2026-10-26')");
  expect(count("children")).toBe(1);
});

test("deletes nothing if any table fails to clear", async () => {
  sqlite.exec(`
    CREATE TRIGGER block_delete BEFORE DELETE ON sessions
    BEGIN SELECT RAISE(ABORT, 'blocked'); END;
  `);
  await expect(deleteAllData(db)).rejects.toThrow("blocked");
  expect(count("consent")).toBe(1);
  expect(count("children")).toBe(1);
  expect(count("sessions")).toBe(1);
});
