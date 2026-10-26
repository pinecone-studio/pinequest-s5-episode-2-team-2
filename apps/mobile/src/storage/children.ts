import type { SQLiteDatabase } from "expo-sqlite";

export type Child = {
  id: string;
  name: string;
  birthYear: number | null;
  createdAt: string;
};
export type ChildDetails = { name: string; birthYear?: number | null };
type ChildrenDb = Pick<SQLiteDatabase, "runAsync" | "getFirstAsync" | "getAllAsync">;
const columns = "id, name, birth_year AS birthYear, created_at AS createdAt";

function validate(details: ChildDetails): { name: string; birthYear: number | null } {
  const name = details.name.trim();
  const birthYear = details.birthYear ?? null;
  if (!name) throw new Error("Child name is required");
  if (
    birthYear !== null &&
    (!Number.isInteger(birthYear) || birthYear < 1 || birthYear > new Date().getFullYear())
  ) {
    throw new Error("Birth year must be a whole year no later than the current year");
  }
  return { name, birthYear };
}

export function listChildren(db: ChildrenDb): Promise<Child[]> {
  return db.getAllAsync<Child>(`SELECT ${columns} FROM children ORDER BY created_at, id`);
}

export function getChild(db: ChildrenDb, id: string): Promise<Child | null> {
  return db.getFirstAsync<Child>(`SELECT ${columns} FROM children WHERE id = ?`, id);
}

/** The caller supplies a stable unique ID, avoiding a dependency on the native bridge. */
export async function createChild(
  db: ChildrenDb,
  id: string,
  details: ChildDetails,
  now: Date = new Date(),
): Promise<Child> {
  if (!id.trim()) throw new Error("Child ID is required");
  const child = { id, ...validate(details), createdAt: now.toISOString() };
  await db.runAsync(
    "INSERT INTO children (id, name, birth_year, created_at) VALUES (?, ?, ?, ?)",
    child.id,
    child.name,
    child.birthYear,
    child.createdAt,
  );
  return child;
}

/** Replaces editable details; omitting the optional birth year clears it. */
export async function updateChild(
  db: ChildrenDb,
  id: string,
  details: ChildDetails,
): Promise<Child | null> {
  const { name, birthYear } = validate(details);
  await db.runAsync(
    "UPDATE children SET name = ?, birth_year = ? WHERE id = ?",
    name,
    birthYear,
    id,
  );
  return getChild(db, id);
}

export async function deleteChild(db: ChildrenDb, id: string): Promise<void> {
  await db.runAsync("DELETE FROM children WHERE id = ?", id);
}
