import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as SQLite from "node:sqlite";
import { mockScanResult } from "@app/core";
import type { Outcome, ReasonCode, ScanResult } from "@app/core";
import { createChild } from "./children";
import { migrateDatabase } from "./migrations";
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
  directory = mkdtempSync(join(tmpdir(), "pinequest-sessions-props-"));
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

// Round-trip and ordering properties of saved scans over many generated results.

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const OUTCOMES: Outcome[] = ["REFER", "RETAKE", "NOT_ASSESSED", "NO_VISIBLE_SIGN"];
const REASONS: ReasonCode[] = ["BLUR", "TOO_FAR", "NOT_LOOKING", "TOO_FEW_FRAMES", "MODEL_ERROR"];

function results(seed: number, count: number): ScanResult[] {
  const random = lcg(seed);
  return Array.from({ length: count }, (_, i) => {
    const total = 1 + Math.floor(random() * 90);
    const used = Math.floor(random() * (total + 1));
    const measured = used > 0 && random() > 0.2;
    return mockScanResult(OUTCOMES[Math.floor(random() * 4)]!, {
      id: `scan-${seed}-${i}`,
      childId: random() < 0.5 ? "child-1" : random() < 0.8 ? "child-2" : null,
      createdAt: new Date(
        Date.UTC(2026, 9, 1) + Math.floor(random() * 26 * 86_400_000),
      ).toISOString(),
      reasons: REASONS.filter(() => random() < 0.3),
      summary: {
        framesTotal: total,
        framesUsed: used,
        asymmetryScore: measured ? random() * 0.4 : null,
        spread: measured ? random() * 0.1 : null,
      },
      modelVersion: `model-${Math.floor(random() * 3)}`,
      policyVersion: "policy-test",
      durationMs: 3000 + Math.floor(random() * 500),
    });
  });
}

test("every saved field comes back unchanged", async () => {
  const saved = results(1, 120);
  for (const r of saved) await saveSession(db, r);
  for (const r of saved) expect(await getSession(db, r.id)).toEqual(r);
});

test("each child's list holds exactly their scans, newest first", async () => {
  const saved = results(2, 120);
  for (const r of saved) await saveSession(db, r);
  for (const child of ["child-1", "child-2", null]) {
    const list = await listSessions(db, child);
    expect(list.map((s) => s.id).sort()).toEqual(
      saved
        .filter((s) => s.childId === child)
        .map((s) => s.id)
        .sort(),
    );
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1]!.createdAt >= list[i]!.createdAt).toBe(true);
    }
  }
});

test("deleting scans removes exactly those, and saving again never duplicates", async () => {
  const saved = results(3, 80);
  for (const r of saved) await saveSession(db, r);
  for (const r of saved) await saveSession(db, r);
  const random = lcg(4);
  const removed = new Set(saved.filter(() => random() < 0.4).map((r) => r.id));
  for (const id of removed) expect(await deleteSession(db, id)).toBe(true);
  const left = [
    ...(await listSessions(db, "child-1")),
    ...(await listSessions(db, "child-2")),
    ...(await listSessions(db, null)),
  ];
  expect(left.map((s) => s.id).sort()).toEqual(
    saved
      .filter((r) => !removed.has(r.id))
      .map((r) => r.id)
      .sort(),
  );
});
