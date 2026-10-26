import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as SQLite from "node:sqlite";
import { mockScanResult } from "@app/core";
import type { Outcome } from "@app/core";
import { createChild, deleteChild } from "./children";
import { migrateDatabase, migrations } from "./migrations";
import { deleteSession, getSession, listSessions, saveSession } from "./sessions";

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

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "pinequest-sessions-"));
  filename = join(directory, "sessions.db");
  sqlite = new DatabaseSync(filename);
  await migrateDatabase(db);
  await createChild(db, "child-1", { name: "Номин" });
  await createChild(db, "child-2", { name: "Тэмүүлэн" });
});
afterEach(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});

test.each<Outcome>(["REFER", "RETAKE", "NOT_ASSESSED", "NO_VISIBLE_SIGN"])(
  "%s preserves all result fields after closing and reopening the database",
  async (outcome) => {
    const result = mockScanResult(outcome, {
      modelVersion: `test-${outcome}`,
      policyVersion: "policy-test-2",
      durationMs: 1500.5,
    });
    await saveSession(db, result);
    sqlite.close();
    sqlite = new DatabaseSync(filename);
    await migrateDatabase(db);
    expect(await getSession(db, result.id)).toEqual(result);
  },
);

test("lists only the requested child's sessions, newest first, with UTC timestamps", async () => {
  await saveSession(db, mockScanResult("REFER", { id: "old" }));
  const recent = mockScanResult("RETAKE", { id: "new", createdAt: "2026-10-26T12:00:00+08:00" });
  await saveSession(db, recent);
  await saveSession(db, mockScanResult("NOT_ASSESSED", { childId: "child-2" }));
  const unassigned = mockScanResult("NO_VISIBLE_SIGN", { childId: null });
  await saveSession(db, unassigned);
  expect((await listSessions(db, "child-1")).map((scan) => scan.id)).toEqual(["new", "old"]);
  expect((await getSession(db, "new"))?.createdAt).toBe("2026-10-26T04:00:00.000Z");
  expect(await listSessions(db, null)).toEqual([unassigned]);
  expect(await listSessions(db, "missing")).toEqual([]);
  expect(await getSession(db, "missing")).toBeNull();
});

test("retrying a save never duplicates or replaces an existing result", async () => {
  const result = mockScanResult("REFER");
  await saveSession(db, result);
  await saveSession(db, result);
  await saveSession(db, mockScanResult("NOT_ASSESSED", { id: result.id }));
  expect(await listSessions(db, "child-1")).toEqual([result]);
});

test("deleting a child cascades only their sessions, including after reopening", async () => {
  const own = mockScanResult("REFER");
  const sibling = mockScanResult("RETAKE", { childId: "child-2" });
  await saveSession(db, own);
  await saveSession(db, sibling);
  await deleteChild(db, "child-1");
  sqlite.close();
  sqlite = new DatabaseSync(filename);
  await migrateDatabase(db);
  expect(await getSession(db, own.id)).toBeNull();
  expect(await getSession(db, sibling.id)).toEqual(sibling);
});

test("deletes one session and leaves the others, including after reopening", async () => {
  const kept = mockScanResult("REFER", { id: "kept" });
  await saveSession(db, kept);
  await saveSession(db, mockScanResult("RETAKE", { id: "removed" }));
  expect(await deleteSession(db, "removed")).toBe(true);
  expect(await deleteSession(db, "removed")).toBe(false);
  sqlite.close();
  sqlite = new DatabaseSync(filename);
  await migrateDatabase(db);
  expect(await listSessions(db, "child-1")).toEqual([kept]);
});

test("rejects missing children, unsupported outcomes and invalid measurements without saving", async () => {
  const result = mockScanResult("RETAKE");
  await expect(saveSession(db, { ...result, childId: "missing" })).rejects.toThrow();
  await expect(saveSession(db, { ...result, outcome: "UNKNOWN" as Outcome })).rejects.toThrow();
  await expect(saveSession(db, { ...result, createdAt: "invalid" })).rejects.toThrow();
  await expect(saveSession(db, { ...result, durationMs: Infinity })).rejects.toThrow();
  for (const summary of [
    { ...result.summary, framesUsed: 31 },
    { ...result.summary, framesTotal: 1.5 },
    { ...result.summary, asymmetryScore: NaN },
    { ...result.summary, spread: -1 },
  ]) {
    await expect(saveSession(db, { ...result, summary })).rejects.toThrow("measurements");
  }
  expect(await listSessions(db, "child-1")).toEqual([]);
});

test("persists only the declared scalar fields, excluding image properties", async () => {
  const result = { ...mockScanResult("REFER"), imageUri: "file:///mock-eye.jpg" };
  await saveSession(db, result);
  expect(JSON.stringify(sqlite.prepare("SELECT * FROM sessions").get())).not.toContain("mock-eye");
  expect(await getSession(db, result.id)).toEqual(mockScanResult("REFER"));
});

test("upgrading version 4 preserves existing children and treatment data", async () => {
  sqlite.close();
  sqlite = new DatabaseSync(":memory:");
  await migrateDatabase(db, migrations.slice(0, 4));
  await createChild(db, "child-1", { name: "Номин" });
  sqlite.exec("INSERT INTO treatment_goals VALUES ('child-1', 'patch', 60, '2026-10-26')");
  await migrateDatabase(db);
  const result = mockScanResult("REFER");
  await saveSession(db, result);
  expect(await getSession(db, result.id)).toEqual(result);
  expect(sqlite.prepare("SELECT daily_minutes FROM treatment_goals").get()).toEqual({
    daily_minutes: 60,
  });
});
