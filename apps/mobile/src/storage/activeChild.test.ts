import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as SQLite from "node:sqlite";
import { getActiveChildId, setActiveChildId } from "./activeChild";
import { createChild, deleteChild } from "./children";
import { migrateDatabase } from "./migrations";

const { DatabaseSync } = createRequire(__filename)("node:sqlite") as typeof SQLite;
let sqlite: SQLite.DatabaseSync;
let directory: string;
let filename: string;
type Param = string | number | null;
const connection = {
  async execAsync(sql: string) {
    sqlite.exec(sql);
  },
  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    return (sqlite.prepare(sql).get(...(params as Param[])) as T | undefined) ?? null;
  },
  async getAllAsync<T>(sql: string): Promise<T[]> {
    return sqlite.prepare(sql).all() as T[];
  },
  async runAsync(sql: string, ...params: unknown[]) {
    const result = sqlite.prepare(sql).run(...(params as Param[]));
    return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
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
const now = new Date("2026-10-26T03:00:00.000Z");

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "pinequest-active-child-"));
  filename = join(directory, "profiles.db");
  sqlite = new DatabaseSync(filename);
  await migrateDatabase(db);
});
afterEach(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});

test("is null without profiles and falls back to the oldest profile", async () => {
  expect(await getActiveChildId(db)).toBeNull();
  await createChild(db, "b", { name: "Тэмүүлэн" }, new Date("2026-10-26T04:00:00Z"));
  await createChild(db, "a", { name: "Номин" }, now);
  expect(await getActiveChildId(db)).toBe("a");
});

test("keeps the selection after reopening the database", async () => {
  await createChild(db, "a", { name: "Номин" }, now);
  await createChild(db, "b", { name: "Тэмүүлэн" }, now);
  await setActiveChildId(db, "b");
  sqlite.close();
  sqlite = new DatabaseSync(filename);
  await migrateDatabase(db);
  expect(await getActiveChildId(db)).toBe("b");
});

test("falls back when the selected child is deleted and rejects unknown children", async () => {
  await createChild(db, "a", { name: "Номин" }, now);
  await createChild(db, "b", { name: "Тэмүүлэн" }, now);
  await setActiveChildId(db, "b");
  await deleteChild(db, "b");
  expect(await getActiveChildId(db)).toBe("a");
  await expect(setActiveChildId(db, "missing")).rejects.toThrow("Unknown child");
  expect(await getActiveChildId(db)).toBe("a");
});
