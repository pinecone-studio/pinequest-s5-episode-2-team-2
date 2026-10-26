import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as SQLite from "node:sqlite";
import { createChild, deleteChild, getChild, listChildren, updateChild } from "./children";
import { migrateDatabase, migrations } from "./migrations";

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
  directory = mkdtempSync(join(tmpdir(), "pinequest-children-"));
  filename = join(directory, "profiles.db");
  sqlite = new DatabaseSync(filename);
  await migrateDatabase(db);
});
afterEach(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});

test("creates, lists and reads profiles with an optional birth year", async () => {
  expect(await listChildren(db)).toEqual([]);
  const child = await createChild(db, "a", { name: "  Номин  ", birthYear: 2020 }, now);
  const second = await createChild(db, "b", { name: "Тэмүүлэн" }, now);
  expect(child).toEqual({ id: "a", name: "Номин", birthYear: 2020, createdAt: now.toISOString() });
  expect(second.birthYear).toBeNull();
  expect(await listChildren(db)).toEqual([child, second]);
  expect(await getChild(db, "a")).toEqual(child);
  expect(await getChild(db, "missing")).toBeNull();
});

test("edits only the chosen child and preserves its ID and creation time", async () => {
  const child = await createChild(db, "a", { name: "Номин", birthYear: 2020 }, now);
  const sibling = await createChild(db, "b", { name: "Тэмүүлэн" }, now);
  expect(await updateChild(db, "a", { name: "Номи" })).toEqual({
    ...child,
    name: "Номи",
    birthYear: null,
  });
  expect((await updateChild(db, "a", { name: "Номи", birthYear: 2021 }))?.birthYear).toBe(2021);
  expect(await getChild(db, "b")).toEqual(sibling);
  expect(await updateChild(db, "missing", { name: "Нэр" })).toBeNull();
});

test("deletes only the chosen profile and tolerates repeated deletion", async () => {
  await createChild(db, "a", { name: "Номин" }, now);
  const sibling = await createChild(db, "b", { name: "Тэмүүлэн" }, now);
  await deleteChild(db, "a");
  await deleteChild(db, "a");
  expect(await getChild(db, "a")).toBeNull();
  expect(await listChildren(db)).toEqual([sibling]);
});

test("rejects invalid input and duplicate IDs without replacing saved data", async () => {
  const child = await createChild(db, "a", { name: "Номин" }, now);
  await expect(createChild(db, "a", { name: "Other" })).rejects.toThrow();
  await expect(createChild(db, " ", { name: "Нэр" })).rejects.toThrow("ID");
  await expect(updateChild(db, "a", { name: "  " })).rejects.toThrow("name");
  for (const birthYear of [0, 2020.5, NaN, Infinity, new Date().getFullYear() + 1]) {
    await expect(updateChild(db, "a", { name: "Номин", birthYear })).rejects.toThrow("year");
  }
  expect(await listChildren(db)).toEqual([child]);
});

test("saved edits and deletions survive closing and reopening the database", async () => {
  await createChild(db, "a", { name: "Номин" }, now);
  await createChild(db, "b", { name: "Тэмүүлэн" }, now);
  const edited = await updateChild(db, "a", { name: "Номи", birthYear: 2020 });
  await deleteChild(db, "b");
  sqlite.close();
  sqlite = new DatabaseSync(filename);
  await migrateDatabase(db);
  expect(await listChildren(db)).toEqual([edited]);
});

test("upgrading version 2 adds profiles without losing consent or metadata", async () => {
  sqlite.close();
  sqlite = new DatabaseSync(":memory:");
  await migrateDatabase(db, migrations.slice(0, 2));
  sqlite.exec("INSERT INTO consent VALUES (1, '1', '2026-10-26')");
  await migrateDatabase(db);
  await createChild(db, "a", { name: "Номин" }, now);
  expect(await listChildren(db)).toHaveLength(1);
  expect(sqlite.prepare("SELECT version FROM consent").get()).toEqual({ version: "1" });
  expect(sqlite.prepare("SELECT value FROM app_metadata").get()).toEqual({ value: "1" });
});
