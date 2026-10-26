import type { ScanResult, ScanSummary } from "@app/core";
import type { SQLiteDatabase } from "expo-sqlite";

type SessionDb = Pick<SQLiteDatabase, "runAsync" | "getFirstAsync" | "getAllAsync">;
type Row = Omit<ScanResult, "reasons" | "summary"> & ScanSummary & { reasonCodes: string };
const columns = `id, child_id AS childId, created_at AS createdAt, outcome,
  reason_codes AS reasonCodes, frames_total AS framesTotal, frames_used AS framesUsed,
  asymmetry_score AS asymmetryScore, spread, model_version AS modelVersion,
  policy_version AS policyVersion, duration_ms AS durationMs`;

function fromRow(row: Row): ScanResult {
  const { reasonCodes, framesTotal, framesUsed, asymmetryScore, spread, ...result } = row;
  return {
    ...result,
    reasons: JSON.parse(reasonCodes) as ScanResult["reasons"],
    summary: { framesTotal, framesUsed, asymmetryScore, spread },
  };
}

/** A completed scan is immutable: retrying the same ID keeps the original result. No images. */
export async function saveSession(db: SessionDb, result: ScanResult): Promise<void> {
  const { framesTotal, framesUsed, asymmetryScore, spread } = result.summary;
  if (
    ![result.durationMs, framesTotal, framesUsed].every((n) => Number.isFinite(n) && n >= 0) ||
    !Number.isInteger(framesTotal) ||
    !Number.isInteger(framesUsed) ||
    framesUsed > framesTotal ||
    ![asymmetryScore, spread].every((n) => n === null || (Number.isFinite(n) && n >= 0))
  ) {
    throw new Error("Invalid scan measurements");
  }
  // Normalize offsets to UTC so timestamp ordering is consistent across scans.
  const createdAt = new Date(result.createdAt).toISOString();
  await db.runAsync(
    `INSERT INTO sessions (id, child_id, created_at, outcome, reason_codes,
      frames_total, frames_used, asymmetry_score, spread, model_version, policy_version, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
    result.id,
    result.childId,
    createdAt,
    result.outcome,
    JSON.stringify(result.reasons),
    framesTotal,
    framesUsed,
    asymmetryScore,
    spread,
    result.modelVersion,
    result.policyVersion,
    result.durationMs,
  );
}

export async function getSession(db: SessionDb, id: string): Promise<ScanResult | null> {
  const row = await db.getFirstAsync<Row>(`SELECT ${columns} FROM sessions WHERE id = ?`, id);
  return row ? fromRow(row) : null;
}

/** Null selects unassigned scans, matching ScanResult.childId. */
export async function listSessions(db: SessionDb, childId: string | null): Promise<ScanResult[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT ${columns} FROM sessions WHERE child_id IS ? ORDER BY created_at DESC, id DESC`,
    childId,
  );
  return rows.map(fromRow);
}

/** Removes one saved scan; resolves to false when it did not exist. */
export async function deleteSession(db: SessionDb, id: string): Promise<boolean> {
  const { changes } = await db.runAsync("DELETE FROM sessions WHERE id = ?", id);
  return changes > 0;
}
