import type { SQLiteDatabase } from "expo-sqlite";

/**
 * Version of the onboarding text the parent agreed to. Bump it whenever that text changes:
 * everyone who accepted an older version sees onboarding again.
 */
export const CONSENT_VERSION = "1";

export type ConsentRecord = {
  version: string;
  /** ISO 8601. */
  acceptedAt: string;
};

type ConsentDb = Pick<SQLiteDatabase, "getFirstAsync" | "runAsync">;

export function hasCurrentConsent(
  record: ConsentRecord | null,
  currentVersion: string = CONSENT_VERSION,
): boolean {
  return record !== null && record.version === currentVersion;
}

export async function loadConsent(db: ConsentDb): Promise<ConsentRecord | null> {
  const row = await db.getFirstAsync<{ version: string; accepted_at: string }>(
    "SELECT version, accepted_at FROM consent WHERE id = 1",
  );
  return row ? { version: row.version, acceptedAt: row.accepted_at } : null;
}

/** Stores acceptance of `version`, replacing any earlier acceptance (the table has one row). */
export async function saveConsent(
  db: ConsentDb,
  now: Date = new Date(),
  version: string = CONSENT_VERSION,
): Promise<ConsentRecord> {
  const record = { version, acceptedAt: now.toISOString() };
  await db.runAsync(
    "INSERT OR REPLACE INTO consent (id, version, accepted_at) VALUES (1, ?, ?)",
    record.version,
    record.acceptedAt,
  );
  return record;
}
