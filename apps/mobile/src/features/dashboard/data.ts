import type { SQLiteDatabase } from "expo-sqlite";
import { getActiveChildId } from "../../storage/activeChild";
import { listAcuityResults } from "../../storage/acuity";
import { listChildren } from "../../storage/children";
import { habitTotals } from "../../storage/habits";
import { listSessions } from "../../storage/sessions";
import { getGoal, logsBetween } from "../../storage/treatment";
import { summaryStart, weekSummary, type TreatmentKind } from "../treatment/progress";

/** Keep even mixed inputs scoped to one child; never mutate repository results. */
export function childResults<T extends { childId: string | null; createdAt: string; id: string }>(
  rows: readonly T[],
  childId: string,
): T[] {
  return rows
    .filter((row) => row.childId === childId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
}

/** One read-only snapshot, using the same child and local-day clock for every card. */
export async function loadDashboard(db: SQLiteDatabase, now = new Date()) {
  const [children, activeId] = await Promise.all([listChildren(db), getActiveChildId(db)]);
  const child = children.find((row) => row.id === activeId) ?? children[0] ?? null;
  if (!child) return { children, child: null, details: null };

  const childId = child.id;
  async function treatment(kind: TreatmentKind) {
    const [goal, logs] = await Promise.all([
      getGoal(db, childId, kind),
      logsBetween(db, childId, kind, summaryStart(now), now),
    ]);
    return { goal, hasLogs: logs.length > 0, week: weekSummary(logs, goal, now) };
  }
  const [scans, vision, patch, glasses, habits] = await Promise.all([
    listSessions(db, child.id),
    listAcuityResults(db, child.id),
    treatment("patch"),
    treatment("glasses"),
    habitTotals(db, child.id, now),
  ]);
  const sessions = childResults(scans, child.id);
  return {
    children,
    child,
    details: {
      childId: child.id,
      asOf: now,
      sessions,
      latestScan: sessions[0] ?? null,
      latestVision: childResults(vision, child.id)[0] ?? null,
      patch,
      glasses,
      habits,
    },
  };
}

export type Dashboard = Awaited<ReturnType<typeof loadDashboard>>;
export type DashboardDetails = NonNullable<Dashboard["details"]>;
