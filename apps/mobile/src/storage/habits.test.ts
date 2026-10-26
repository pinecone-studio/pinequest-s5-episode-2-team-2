import { createRequire } from "node:module";
import type * as SQLite from "node:sqlite";
import { createChild, deleteChild } from "./children";
import { deleteAllData } from "./deleteAllData";
import { addHabit, getReminder, habitTotals, setReminder } from "./habits";
import { migrateDatabase } from "./migrations";

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

test("habits add up per child and local day", async () => {
  const morning = at("2026-10-27T07:00:00");
  await addHabit(db, "c1", "outdoor", 30, morning);
  await addHabit(db, "c1", "outdoor", 45, at("2026-10-27T17:00:00"));
  await addHabit(db, "c1", "screen_break", 1, morning);
  await addHabit(db, "c1", "outdoor", 20, at("2026-10-26T17:00:00"));
  await addHabit(db, "c2", "outdoor", 10, morning);

  expect(await habitTotals(db, "c1", morning)).toEqual({ outdoor: 75, screen_break: 1 });
  expect(await habitTotals(db, "c1", at("2026-10-28T12:00:00"))).toEqual({
    outdoor: 0,
    screen_break: 0,
  });
  await expect(addHabit(db, "c1", "outdoor", 0)).rejects.toThrow("Amount");
});

test("reminders are saved per child and kind and can be changed", async () => {
  expect(await getReminder(db, "c1", "outdoor")).toBeNull();
  await setReminder(db, "c1", "outdoor", { enabled: true, timeOfDay: "16:00", intervalDays: 5 });
  await setReminder(db, "c1", "rescan", { enabled: true, timeOfDay: "09:00", intervalDays: 30 });
  await setReminder(db, "c1", "outdoor", {
    enabled: false,
    timeOfDay: "17:30",
    intervalDays: null,
  });

  // Fields that do not apply to a kind are not stored.
  expect(await getReminder(db, "c1", "outdoor")).toEqual({
    enabled: false,
    timeOfDay: "17:30",
    intervalDays: null,
  });
  expect(await getReminder(db, "c1", "rescan")).toEqual({
    enabled: true,
    timeOfDay: null,
    intervalDays: 30,
  });
  expect(await getReminder(db, "c2", "outdoor")).toBeNull();
});

test("invalid reminder settings are rejected", async () => {
  const off = { enabled: true, timeOfDay: null, intervalDays: null };
  await expect(setReminder(db, "c1", "outdoor", off)).rejects.toThrow("HH:MM");
  await expect(
    setReminder(db, "c1", "screen_break", { ...off, timeOfDay: "25:00" }),
  ).rejects.toThrow("HH:MM");
  await expect(setReminder(db, "c1", "rescan", { ...off, intervalDays: 0 })).rejects.toThrow("365");
});

test("deleting a child or all data removes habits and reminders", async () => {
  await addHabit(db, "c1", "outdoor", 30);
  await setReminder(db, "c1", "rescan", { enabled: true, timeOfDay: null, intervalDays: 30 });
  await addHabit(db, "c2", "outdoor", 30);
  await deleteChild(db, "c1");
  expect(count("habit_days")).toBe(1);
  expect(count("reminders")).toBe(0);
  await deleteAllData(db);
  expect(count("habit_days")).toBe(0);
});
