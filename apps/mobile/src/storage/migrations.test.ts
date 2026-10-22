import { createRequire } from "node:module";
import type * as SQLite from "node:sqlite";
import { migrateDatabase } from "./migrations";

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

test("first launch initializes the schema; reopening preserves existing data", async () => {
  await migrateDatabase(db);
  expect(sqlite.prepare("PRAGMA user_version").get()).toEqual({ user_version: 1 });
  expect(sqlite.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
  sqlite.exec("INSERT INTO app_metadata VALUES ('keep', 'value')");
  await migrateDatabase(db);
  expect(sqlite.prepare("SELECT value FROM app_metadata WHERE key = 'keep'").get()).toEqual({
    value: "value",
  });
});

test("an upgrade runs pending migrations in order without rerunning earlier ones", async () => {
  const first = {
    version: 1,
    up: jest.fn(async () => {
      sqlite.exec("CREATE TABLE first (id INTEGER)");
    }),
  };
  const second = {
    version: 2,
    up: jest.fn(async () => {
      sqlite.exec("CREATE TABLE second (id INTEGER)");
    }),
  };
  const third = {
    version: 3,
    up: jest.fn(async () => {
      sqlite.exec("INSERT INTO second VALUES (1)");
    }),
  };
  await migrateDatabase(db, [first]);
  await migrateDatabase(db, [first, second, third]);
  expect(first.up).toHaveBeenCalledTimes(1);
  expect(second.up).toHaveBeenCalledTimes(1);
  expect(sqlite.prepare("SELECT * FROM second").all()).toEqual([{ id: 1 }]);
  expect(sqlite.prepare("PRAGMA user_version").get()).toEqual({ user_version: 3 });
});

test("a failed upgrade rolls back schema, writes and version; retry succeeds", async () => {
  await migrateDatabase(db);
  const failing = {
    version: 2,
    up: async () => {
      sqlite.exec(
        "CREATE TABLE partial (id INTEGER); INSERT INTO app_metadata VALUES ('partial', '1')",
      );
      throw new Error("interrupted");
    },
  };
  const { migrations } = await import("./migrations");
  await expect(migrateDatabase(db, [...migrations, failing])).rejects.toThrow("interrupted");
  expect(sqlite.prepare("PRAGMA user_version").get()).toEqual({ user_version: 1 });
  expect(
    sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'partial'").get(),
  ).toBeUndefined();
  expect(
    sqlite.prepare("SELECT value FROM app_metadata WHERE key = 'partial'").get(),
  ).toBeUndefined();
  await migrateDatabase(db, [
    ...migrations,
    {
      version: 2,
      up: async () => {
        sqlite.exec("CREATE TABLE partial (id INTEGER)");
      },
    },
  ]);
  expect(sqlite.prepare("PRAGMA user_version").get()).toEqual({ user_version: 2 });
});

test("rejects a database from a newer app and leaves its version intact", async () => {
  sqlite.exec("PRAGMA user_version = 99");
  await expect(migrateDatabase(db)).rejects.toThrow("Database is newer");
  expect(sqlite.prepare("PRAGMA user_version").get()).toEqual({ user_version: 99 });
});

test("rejects gaps or duplicate versions before changing the database", async () => {
  await expect(migrateDatabase(db, [{ version: 2, up: async () => {} }])).rejects.toThrow(
    "contiguous",
  );
  await expect(
    migrateDatabase(db, [
      { version: 1, up: async () => {} },
      { version: 1, up: async () => {} },
    ]),
  ).rejects.toThrow("contiguous");
  expect(sqlite.prepare("PRAGMA user_version").get()).toEqual({ user_version: 0 });
});
