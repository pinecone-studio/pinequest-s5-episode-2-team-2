import { createRequire } from "node:module";
import type * as SQLite from "node:sqlite";
import { migrateDatabase } from "../../storage/migrations";
import { hasCurrentConsent, loadConsent, saveConsent } from "./consent";

// Real SQLite (Node) with the app's real migrations, as in storage/migrations.test.ts.
const { DatabaseSync } = createRequire(__filename)("node:sqlite") as typeof SQLite;
let sqlite: SQLite.DatabaseSync;

type Param = string | number | null;
type TestDb = {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  runAsync(
    sql: string,
    ...params: unknown[]
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  withExclusiveTransactionAsync(task: (tx: TestDb) => Promise<void>): Promise<void>;
};
const db: TestDb = {
  async execAsync(sql: string) {
    sqlite.exec(sql);
  },
  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    return (sqlite.prepare(sql).get(...(params as Param[])) as T | undefined) ?? null;
  },
  async runAsync(sql: string, ...params: unknown[]) {
    const result = sqlite.prepare(sql).run(...(params as Param[]));
    return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
  },
  async withExclusiveTransactionAsync(task) {
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      await task(db);
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  },
};

beforeEach(async () => {
  sqlite = new DatabaseSync(":memory:");
  await migrateDatabase(db);
});
afterEach(() => {
  sqlite.close();
});

test("there is no consent on first launch", async () => {
  const record = await loadConsent(db);
  expect(record).toBeNull();
  expect(hasCurrentConsent(record)).toBe(false);
});

test("accepting stores the current version", async () => {
  const now = new Date("2026-10-23T09:00:00.000Z");
  await saveConsent(db, now);
  const record = await loadConsent(db);
  expect(record).toEqual({ version: "1", acceptedAt: now.toISOString() });
  expect(hasCurrentConsent(record)).toBe(true);
});

test("consent to an older version is not enough after the text changes", async () => {
  await saveConsent(db, new Date(), "1");
  expect(hasCurrentConsent(await loadConsent(db), "2")).toBe(false);
});

test("accepting again replaces the earlier row instead of adding one", async () => {
  await saveConsent(db, new Date("2026-10-01T00:00:00.000Z"), "1");
  await saveConsent(db, new Date("2026-10-23T00:00:00.000Z"), "2");
  expect(sqlite.prepare("SELECT COUNT(*) AS n FROM consent").get()).toEqual({ n: 1 });
  expect((await loadConsent(db))?.version).toBe("2");
});
