import type { SQLiteDatabase } from "expo-sqlite";
import { childResults, loadDashboard } from "./data";
import { getActiveChildId } from "../../storage/activeChild";
import { listAcuityResults } from "../../storage/acuity";
import { listChildren } from "../../storage/children";
import { habitTotals } from "../../storage/habits";
import { listSessions } from "../../storage/sessions";
import { getGoal, logsBetween } from "../../storage/treatment";

jest.mock("../../storage/activeChild");
jest.mock("../../storage/acuity");
jest.mock("../../storage/children");
jest.mock("../../storage/habits");
jest.mock("../../storage/sessions");
jest.mock("../../storage/treatment");
const db = {} as SQLiteDatabase;
const now = new Date(2026, 9, 27, 12);
const child = (id: string) => ({ id, name: id, birthYear: null, createdAt: "" });
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(listChildren).mockResolvedValue([child("a"), child("b")]);
  jest.mocked(getActiveChildId).mockResolvedValue("b");
  jest.mocked(listSessions).mockResolvedValue([]);
  jest.mocked(listAcuityResults).mockResolvedValue([]);
  jest.mocked(getGoal).mockResolvedValue(null);
  jest.mocked(logsBetween).mockResolvedValue([]);
  jest.mocked(habitTotals).mockResolvedValue({ outdoor: 0, screen_break: 0 });
});

test("latest results exclude other children and unassigned rows without changing inputs", () => {
  const row = (id: string, childId: string | null, createdAt: string) => ({
    id,
    childId,
    createdAt,
  });
  const rows = [
    row("old", "b", "2026-10-26T01:00:00Z"),
    row("other", "a", "2026-10-28T01:00:00Z"),
    row("none", null, "2026-10-28T01:00:00Z"),
    row("latest", "b", "2026-10-27T08:00:00+08:00"),
  ];
  const copy = [...rows];
  expect(childResults(rows, "b").map((r) => r.id)).toEqual(["latest", "old"]);
  expect(rows).toEqual(copy);
});

test("every card reads the selected child using a single local-day snapshot", async () => {
  const result = await loadDashboard(db, now);
  expect(result.child?.id).toBe("b");
  expect(listSessions).toHaveBeenCalledWith(db, "b");
  expect(listAcuityResults).toHaveBeenCalledWith(db, "b");
  expect(habitTotals).toHaveBeenCalledWith(db, "b", now);
  for (const kind of ["patch", "glasses"]) {
    expect(getGoal).toHaveBeenCalledWith(db, "b", kind);
    expect(logsBetween).toHaveBeenCalledWith(db, "b", kind, new Date(2026, 9, 21), now);
  }
  expect(result.details?.latestScan).toBeNull();
  expect(result.details?.latestVision).toBeNull();
  expect(result.details?.patch.week).toHaveLength(7);
  expect(result.details?.patch.hasLogs).toBe(false);
});

test("no profile does not read unassigned health records", async () => {
  jest.mocked(listChildren).mockResolvedValue([]);
  const result = await loadDashboard(db, now);
  expect(result.details).toBeNull();
  expect(listSessions).not.toHaveBeenCalled();
  expect(listAcuityResults).not.toHaveBeenCalled();
  expect(logsBetween).not.toHaveBeenCalled();
  expect(habitTotals).not.toHaveBeenCalled();
});

test("a deleted selection falls back to an existing child", async () => {
  jest.mocked(getActiveChildId).mockResolvedValue("deleted");
  expect((await loadDashboard(db, now)).child?.id).toBe("a");
});

test("treatment across midnight uses existing week math and does not invent a goal", async () => {
  jest.mocked(logsBetween).mockResolvedValue([
    {
      id: "log",
      childId: "b",
      kind: "patch",
      startedAt: new Date(2026, 9, 26, 23, 50).toISOString(),
      endedAt: new Date(2026, 9, 27, 0, 10).toISOString(),
    },
  ]);
  const { details } = await loadDashboard(db, now);
  expect(details?.patch.goal).toBeNull();
  expect(details?.patch.week.slice(-2).map((d) => d.minutes)).toEqual([10, 10]);
  expect(details?.patch.week.every((d) => d.metGoal === null)).toBe(true);
});

test("storage errors propagate instead of becoming empty health histories", async () => {
  jest.mocked(listSessions).mockRejectedValue(new Error("read failed"));
  await expect(loadDashboard(db, now)).rejects.toThrow("read failed");
});
