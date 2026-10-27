import { createRequire } from "node:module";
import type * as SQLite from "node:sqlite";
import { migrateDatabase, migrations } from "./migrations";

// Use Node's real SQLite engine without loading Expo's native bridge in Jest.
const { DatabaseSync } = createRequire(__filename)("node:sqlite") as typeof SQLite;
let sqlite: SQLite.DatabaseSync;

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
});
afterEach(() => {
  sqlite.close();
});

const connection = {
  async execAsync(sql: string) {
    sqlite.exec(sql);
  },
  async getFirstAsync<T>(sql: string): Promise<T | null> {
    return (sqlite.prepare(sql).get() as T | undefined) ?? null;
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

// Properties of the migration chain: whatever version a phone has, it ends up with the same
// schema, and running the migrations again changes nothing.

/** Tables, columns, indexes and triggers, without SQLite's internal tables. */
function schema(): string {
  const rows = sqlite
    .prepare(
      "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
    )
    .all() as { type: string; name: string; tbl_name: string; sql: string | null }[];
  const columns = rows
    .filter((r) => r.type === "table")
    .map((r) => [r.name, sqlite.prepare(`PRAGMA table_info(${r.name})`).all()]);
  return JSON.stringify({ objects: rows.map((r) => [r.type, r.name, r.tbl_name]), columns });
}

const version = () =>
  (sqlite.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;

test("upgrading from any earlier version gives the same schema as a fresh install", async () => {
  await migrateDatabase(db);
  const fresh = schema();
  for (let from = 0; from < migrations.length; from++) {
    sqlite.close();
    sqlite = new DatabaseSync(":memory:");
    await migrateDatabase(db, migrations.slice(0, from));
    expect(version()).toBe(from);
    await migrateDatabase(db);
    expect(version()).toBe(migrations.length);
    expect(schema()).toEqual(fresh);
  }
});

test("running the migrations again changes nothing", async () => {
  await migrateDatabase(db);
  const once = schema();
  await migrateDatabase(db);
  await migrateDatabase(db);
  expect(schema()).toEqual(once);
  expect(version()).toBe(migrations.length);
});

test("versions are numbered from 1 without gaps", () => {
  expect(migrations.map((m) => m.version)).toEqual(migrations.map((_, i) => i + 1));
});

test("foreign keys point at tables that exist", async () => {
  await migrateDatabase(db);
  const tables = (
    sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
    }[]
  ).map((t) => t.name);
  for (const table of tables) {
    const keys = sqlite.prepare(`PRAGMA foreign_key_list(${table})`).all() as { table: string }[];
    for (const key of keys) expect(tables).toContain(key.table);
  }
});
