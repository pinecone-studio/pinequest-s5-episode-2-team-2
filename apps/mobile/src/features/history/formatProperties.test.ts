import { mockScanResult, type Outcome, type ScanResult } from "@app/core";
import { dayKey, formatScanTime, groupByDay, summarizeHistory } from "./format";
import { filterSessions } from "./OutcomeFilter";

// Properties of the History tab's grouping and counts over generated histories.

jest.mock("../../components/ui", () => ({ Text: "Text" }));
jest.mock("react-native", () => ({
  Pressable: "Pressable",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles },
}));

function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const OUTCOMES: Outcome[] = ["REFER", "RETAKE", "NOT_ASSESSED", "NO_VISIBLE_SIGN"];

/** Newest first, as listSessions returns them. */
function history(seed: number): ScanResult[] {
  const random = lcg(seed);
  return Array.from({ length: Math.floor(random() * 40) }, (_, i) =>
    mockScanResult(OUTCOMES[Math.floor(random() * 4)]!, {
      id: `s${i}`,
      createdAt: new Date(
        2026,
        9,
        1 + Math.floor(random() * 26),
        Math.floor(random() * 24),
        Math.floor(random() * 60),
      ).toISOString(),
    }),
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const HISTORIES = Array.from({ length: 150 }, (_, i) => history(i + 1));

test("grouping by day keeps every session once, in order, under its own day", () => {
  for (const sessions of HISTORIES) {
    const sections = groupByDay(sessions);
    expect(sections.flatMap((s) => s.sessions)).toEqual(sessions);
    expect(new Set(sections.map((s) => s.day)).size).toBe(sections.length);
    for (const section of sections) {
      for (const s of section.sessions) expect(dayKey(s.createdAt)).toBe(section.day);
    }
  }
});

test("the outcome counts add up to the total and match the filters", () => {
  for (const sessions of HISTORIES) {
    const { total, counts, latest } = summarizeHistory(sessions);
    expect(total).toBe(sessions.length);
    expect(OUTCOMES.reduce((sum, o) => sum + counts[o], 0)).toBe(total);
    for (const o of OUTCOMES) expect(filterSessions(sessions, o)).toHaveLength(counts[o]);
    expect(latest).toBe(sessions[0] ?? null);
  }
});

test("the shown time and day agree", () => {
  for (const sessions of HISTORIES) {
    for (const s of sessions) {
      const time = formatScanTime(s.createdAt);
      expect(time).toMatch(/^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$/);
      expect(time.slice(0, 10)).toBe(dayKey(s.createdAt).replaceAll("-", "."));
    }
  }
});
