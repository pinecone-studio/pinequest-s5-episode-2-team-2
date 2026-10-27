import { createRequire } from "node:module";
import type * as SQLite from "node:sqlite";
import { acuityResultId, type AcuityResult, listAcuityResults, saveAcuityResult } from "./acuity";
import { createChild, deleteChild } from "./children";
import { deleteAllData } from "./deleteAllData";
import { migrateDatabase } from "./migrations";

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
const result = (overrides: Partial<AcuityResult> = {}): AcuityResult => ({
  id: "a1",
  childId: "c1",
  createdAt: "2026-10-27T10:00:00+08:00",
  group: "child4",
  right: 0.3,
  left: null,
  refer: true,
  ...overrides,
});

beforeEach(async () => {
  sqlite = new DatabaseSync(":memory:");
  await migrateDatabase(db);
  await createChild(db, "c1", { name: "Bat" });
  await createChild(db, "c2", { name: "Saraa" });
});
afterEach(() => {
  sqlite.close();
});

test("saves and lists a child's checks newest first, with UTC timestamps", async () => {
  await saveAcuityResult(db, result());
  await saveAcuityResult(db, result({ id: "a2", createdAt: "2026-10-27T12:00:00+08:00" }));
  await saveAcuityResult(db, result({ id: "a3", childId: "c2", right: 0, left: 0, refer: false }));
  const list = await listAcuityResults(db, "c1");
  expect(list.map((r) => r.id)).toEqual(["a2", "a1"]);
  expect(list[1]).toEqual({ ...result(), createdAt: "2026-10-27T02:00:00.000Z" });
  expect(await listAcuityResults(db, "c2")).toEqual([
    {
      ...result({ id: "a3", childId: "c2", right: 0, left: 0, refer: false }),
      createdAt: "2026-10-27T02:00:00.000Z",
    },
  ]);
});

test("saving the same check twice keeps the first result", async () => {
  await saveAcuityResult(db, result());
  await saveAcuityResult(db, result({ right: 0.0, refer: false }));
  expect(await listAcuityResults(db, "c1")).toHaveLength(1);
  expect((await listAcuityResults(db, "c1"))[0]).toMatchObject({ right: 0.3, refer: true });
});

test("rejects values outside the chart", async () => {
  await expect(saveAcuityResult(db, result({ right: 1.3 }))).rejects.toThrow();
  await expect(saveAcuityResult(db, result({ group: "baby" as never }))).rejects.toThrow();
});

test("deleting a child or all data removes their checks", async () => {
  await saveAcuityResult(db, result());
  await saveAcuityResult(db, result({ id: "a2", childId: "c2" }));
  await deleteChild(db, "c1");
  expect(await listAcuityResults(db, "c1")).toEqual([]);
  await deleteAllData(db);
  expect(await listAcuityResults(db, "c2")).toEqual([]);
});

test("ids are unique per check", () => {
  expect(acuityResultId()).not.toBe(acuityResultId());
});
