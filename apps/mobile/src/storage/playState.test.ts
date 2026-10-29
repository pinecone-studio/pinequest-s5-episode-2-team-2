import { createRequire } from "node:module";
import type * as SQLite from "node:sqlite";
import { createChild, deleteChild } from "./children";
import { migrateDatabase } from "./migrations";
import { addStar } from "./play";
import { countStars, loadPlayState, savePlayState } from "./playState";

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

test("saves, overwrites and reads a child's progress; others start empty", async () => {
  expect(await loadPlayState(db, "c1", "garden", { plots: [] })).toEqual({ plots: [] });
  await savePlayState(db, "c1", "garden", { plots: ["flower"] });
  await savePlayState(db, "c1", "garden", { plots: ["flower", "tree"] });
  expect(await loadPlayState(db, "c1", "garden", { plots: [] })).toEqual({
    plots: ["flower", "tree"],
  });
  expect(await loadPlayState(db, "c2", "garden", null)).toBeNull();
  expect(count("play_state")).toBe(1);
});

test("counts stars by game prefix, so each break counts once a day", async () => {
  await addStar(db, "c1", "garden-outside", at("2026-10-29T08:00:00"));
  await addStar(db, "c1", "garden-outside", at("2026-10-29T09:00:00"));
  await addStar(db, "c1", "garden-walk", at("2026-10-29T09:00:00"));
  await addStar(db, "c1", "quiz", at("2026-10-29T09:00:00"));
  expect(await countStars(db, "c1", "garden-")).toBe(2);
  expect(await countStars(db, "c2", "garden-")).toBe(0);
});

test("deleting a child removes their progress", async () => {
  await savePlayState(db, "c1", "style", { hat: "crown" });
  await deleteChild(db, "c1");
  expect(count("play_state")).toBe(0);
});
