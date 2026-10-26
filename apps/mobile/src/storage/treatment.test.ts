import { createRequire } from "node:module";
import type * as SQLite from "node:sqlite";
import { createChild, deleteChild } from "./children";
import { deleteAllData } from "./deleteAllData";
import { migrateDatabase } from "./migrations";
import {
  getGoal,
  getRunning,
  logsBetween,
  logsForDay,
  setGoal,
  startTimer,
  stopTimer,
} from "./treatment";

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

test("a goal is absent until set, then can be changed", async () => {
  expect(await getGoal(db, "c1", "patch")).toBeNull();
  await setGoal(db, "c1", "patch", 120);
  await setGoal(db, "c1", "patch", 90);
  expect(await getGoal(db, "c1", "patch")).toBe(90);
  expect(await getGoal(db, "c1", "glasses")).toBeNull();
  await expect(setGoal(db, "c1", "patch", 0)).rejects.toThrow("Daily goal");
  await expect(setGoal(db, "c1", "patch", 1.5)).rejects.toThrow("Daily goal");
});

test("start and stop record one period; a second running timer is refused", async () => {
  await startTimer(db, "l1", "c1", "patch", at("2026-10-26T08:00:00"));
  await expect(startTimer(db, "l2", "c1", "patch", at("2026-10-26T08:05:00"))).rejects.toThrow();
  // Another treatment or another child can run at the same time.
  await startTimer(db, "l3", "c1", "glasses", at("2026-10-26T08:05:00"));
  await startTimer(db, "l4", "c2", "patch", at("2026-10-26T08:05:00"));

  const stopped = await stopTimer(db, "c1", "patch", at("2026-10-26T09:00:00"));
  expect(stopped?.endedAt).toBe(at("2026-10-26T09:00:00").toISOString());
  expect(await getRunning(db, "c1", "patch")).toBeNull();
  expect(await stopTimer(db, "c1", "patch")).toBeNull();
});

test("a clock moved backwards never ends a period before it started", async () => {
  await startTimer(db, "l1", "c1", "patch", at("2026-10-26T08:00:00"));
  const stopped = await stopTimer(db, "c1", "patch", at("2026-10-26T07:00:00"));
  expect(stopped?.endedAt).toBe(stopped?.startedAt);
});

test("a day's logs include overnight and running periods, not other days or children", async () => {
  await startTimer(db, "old", "c1", "patch", at("2026-10-24T08:00:00"));
  await stopTimer(db, "c1", "patch", at("2026-10-24T09:00:00"));
  await startTimer(db, "night", "c1", "patch", at("2026-10-25T23:00:00"));
  await stopTimer(db, "c1", "patch", at("2026-10-26T01:00:00"));
  await startTimer(db, "now", "c1", "patch", at("2026-10-26T20:00:00"));
  await startTimer(db, "sibling", "c2", "patch", at("2026-10-26T10:00:00"));

  const logs = await logsForDay(db, "c1", "patch", at("2026-10-26T12:00:00"));
  expect(logs.map((log) => log.id)).toEqual(["night", "now"]);
});

test("a range includes periods overlapping its ends and a running one", async () => {
  await startTimer(db, "before", "c1", "patch", at("2026-10-19T08:00:00"));
  await stopTimer(db, "c1", "patch", at("2026-10-19T09:00:00"));
  await startTimer(db, "edge", "c1", "patch", at("2026-10-19T23:30:00"));
  await stopTimer(db, "c1", "patch", at("2026-10-20T00:30:00"));
  await startTimer(db, "mid", "c1", "patch", at("2026-10-23T10:00:00"));
  await stopTimer(db, "c1", "patch", at("2026-10-23T11:00:00"));
  await startTimer(db, "glasses", "c1", "glasses", at("2026-10-23T10:00:00"));
  await startTimer(db, "now", "c1", "patch", at("2026-10-26T20:00:00"));

  const logs = await logsBetween(
    db,
    "c1",
    "patch",
    at("2026-10-20T00:00:00"),
    at("2026-10-27T00:00:00"),
  );
  expect(logs.map((log) => log.id)).toEqual(["edge", "mid", "now"]);
});

test("deleting a child or all data removes their goals and logs", async () => {
  await setGoal(db, "c1", "patch", 120);
  await startTimer(db, "l1", "c1", "patch");
  await setGoal(db, "c2", "glasses", 60);
  await deleteChild(db, "c1");
  expect(count("treatment_goals")).toBe(1);
  expect(count("treatment_logs")).toBe(0);

  await deleteAllData(db);
  expect(count("treatment_goals")).toBe(0);
});
