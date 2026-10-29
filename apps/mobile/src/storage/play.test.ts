import { createRequire } from "node:module";
import type * as SQLite from "node:sqlite";
import { createChild, deleteChild } from "./children";
import { migrateDatabase } from "./migrations";
import { addStar, starSummary } from "./play";

process.env.TZ = "Asia/Ulaanbaatar";
const { DatabaseSync } = createRequire(__filename)("node:sqlite") as typeof SQLite;
let sqlite: SQLite.DatabaseSync;
type Param = string | number | null;
const connection = {
  async execAsync(sql: string) {
    sqlite.exec(sql);
  },
  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    return (sqlite.prepare(sql).get(...(params as Param[])) as T | undefined) ?? null;
  },
  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return sqlite.prepare(sql).all(...(params as Param[])) as T[];
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
const at = (local: string) => new Date(`${local}+08:00`);
const count = (table: string) =>
  (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

beforeEach(async () => {
  sqlite = new DatabaseSync(":memory:");
  await migrateDatabase(db);
  await createChild(db, "c1", { name: "Bat" });
  await createChild(db, "c2", { name: "Saraa" });
});
afterEach(() => {
  sqlite.close();
});

test("a game earns one star per child and local day", async () => {
  const morning = at("2026-10-29T08:00:00");
  expect(await addStar(db, "c1", "outside", morning)).toBe(true);
  expect(await addStar(db, "c1", "outside", at("2026-10-29T20:00:00"))).toBe(false);
  expect(await addStar(db, "c1", "quiz", morning)).toBe(true);
  expect(await addStar(db, "c1", "outside", at("2026-10-30T08:00:00"))).toBe(true);
  expect(await addStar(db, "c2", "outside", morning)).toBe(true);

  expect(await starSummary(db, "c1", morning)).toEqual({ total: 3, today: ["outside", "quiz"] });
  expect(await starSummary(db, "c2", morning)).toEqual({ total: 1, today: ["outside"] });
  expect(await starSummary(db, "c1", at("2026-10-31T08:00:00"))).toEqual({ total: 3, today: [] });
});

test("local midnight starts a new day in Ulaanbaatar", async () => {
  expect(await addStar(db, "c1", "blink", at("2026-10-29T23:59:00"))).toBe(true);
  expect(await addStar(db, "c1", "blink", at("2026-10-30T00:01:00"))).toBe(true);
  expect(count("play_stars")).toBe(2);
});

test("deleting a child removes their stars", async () => {
  await addStar(db, "c1", "quiz", at("2026-10-29T08:00:00"));
  await deleteChild(db, "c1");
  expect(count("play_stars")).toBe(0);
});
