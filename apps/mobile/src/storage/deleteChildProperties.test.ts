import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as SQLite from "node:sqlite";
import { mockScanResult } from "@app/core";
import { createChild, deleteChild } from "./children";
import { migrateDatabase } from "./migrations";
import { addHabit, setReminder } from "./habits";
import { saveSession } from "./sessions";
import { setGoal, startTimer, stopTimer } from "./treatment";

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

// Deleting a profile must remove that child's data from every table that has a child_id,
// including tables added later, and leave the other children's data alone.

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "pinequest-delete-child-"));
  filename = join(directory, "children.db");
  sqlite = new DatabaseSync(filename);
  await migrateDatabase(db);
});
afterEach(() => {
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});

const CHILDREN = ["c1", "c2", "c3"];

async function fill(child: string, i: number) {
  await createChild(db, child, { name: `Хүүхэд ${i + 1}` });
  for (let n = 0; n < 3; n++) {
    await saveSession(db, mockScanResult("REFER", { id: `${child}-scan-${n}`, childId: child }));
  }
  await setGoal(db, child, "patch", 60 + i);
  await startTimer(db, `${child}-log`, child, "patch", new Date("2026-10-27T01:00:00Z"));
  await stopTimer(db, child, "patch", new Date("2026-10-27T02:00:00Z"));
  await addHabit(db, child, "outdoor", 30, new Date("2026-10-27T03:00:00Z"));
  await setReminder(db, child, "rescan", { enabled: true, timeOfDay: null, intervalDays: 7 });
}

/** Row counts per child for every table with a child_id column. */
function childRows(): Record<string, Record<string, number>> {
  const tables = (
    sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
    }[]
  )
    .map((t) => t.name)
    .filter((t) =>
      (sqlite.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).some(
        (c) => c.name === "child_id",
      ),
    );
  return Object.fromEntries(
    tables.map((t) => [
      t,
      Object.fromEntries(
        CHILDREN.map((c) => [
          c,
          (
            sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE child_id = ?`).get(c) as {
              n: number;
            }
          ).n,
        ]),
      ),
    ]),
  );
}

test.each(CHILDREN)(
  "deleting %s clears their rows in every child table and only theirs",
  async (gone) => {
    for (const [i, child] of CHILDREN.entries()) await fill(child, i);
    const before = childRows();
    expect(Object.keys(before).length).toBeGreaterThanOrEqual(4);
    await deleteChild(db, gone);
    const after = childRows();
    for (const [table, counts] of Object.entries(after)) {
      for (const child of CHILDREN) {
        expect([table, child, counts[child]]).toEqual([
          table,
          child,
          child === gone ? 0 : before[table]![child],
        ]);
      }
    }
  },
);
