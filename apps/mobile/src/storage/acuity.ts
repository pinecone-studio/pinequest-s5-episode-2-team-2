import type { SQLiteDatabase } from "expo-sqlite";
import type { AgeGroup } from "../features/acuity/acuity";

type AcuityDb = Pick<SQLiteDatabase, "runAsync" | "getAllAsync">;

/** One finished vision check (#139). No images. */
export interface AcuityResult {
  id: string;
  childId: string | null;
  /** ISO 8601. */
  createdAt: string;
  group: AgeGroup;
  /** Smallest logMAR level passed per eye; null when none was passed. */
  right: number | null;
  left: number | null;
  /** Seeing an eye doctor was recommended. */
  refer: boolean;
}

type Row = Omit<AcuityResult, "refer"> & { refer: number };
const columns = `id, child_id AS childId, created_at AS createdAt, age_group AS "group",
  right_logmar AS right, left_logmar AS left, refer`;

/** A finished check is immutable: saving the same ID again keeps the first result. */
export async function saveAcuityResult(db: AcuityDb, result: AcuityResult): Promise<void> {
  await db.runAsync(
    `INSERT INTO acuity_results (id, child_id, created_at, age_group, right_logmar, left_logmar, refer)
     VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
    result.id,
    result.childId,
    // Normalize offsets to UTC so ordering by timestamp is consistent.
    new Date(result.createdAt).toISOString(),
    result.group,
    result.right,
    result.left,
    result.refer ? 1 : 0,
  );
}

/** The child's vision checks, newest first. Null selects unassigned checks. */
export async function listAcuityResults(
  db: AcuityDb,
  childId: string | null,
): Promise<AcuityResult[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT ${columns} FROM acuity_results WHERE child_id IS ? ORDER BY created_at DESC, id DESC`,
    childId,
  );
  return rows.map(({ refer, ...row }) => ({ ...row, refer: refer === 1 }));
}

/** A new check ID, like the scan and child IDs: time plus random. */
export function acuityResultId(
  now: number = Date.now(),
  random: () => number = Math.random,
): string {
  return `acuity-${now.toString(36)}-${random().toString(36).slice(2)}`;
}
