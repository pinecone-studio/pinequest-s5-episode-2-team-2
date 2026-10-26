import type { Outcome, ScanResult } from "@app/core";

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day, "2026-10-26". */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local date and time, "2026.10.26 14:05". */
export function formatScanTime(iso: string): string {
  const d = new Date(iso);
  return `${dayKey(iso).replaceAll("-", ".")} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type HistorySection = { day: string; sessions: ScanResult[] };

/** Groups sessions by local day, keeping the incoming (newest first) order. */
export function groupByDay(sessions: readonly ScanResult[]): HistorySection[] {
  const sections: HistorySection[] = [];
  for (const session of sessions) {
    const day = dayKey(session.createdAt);
    const last = sections.at(-1);
    if (last?.day === day) last.sessions.push(session);
    else sections.push({ day, sessions: [session] });
  }
  return sections;
}

export type HistorySummary = {
  total: number;
  counts: Record<Outcome, number>;
  /** Newest session, or null without sessions. */
  latest: ScanResult | null;
};

export function summarizeHistory(sessions: readonly ScanResult[]): HistorySummary {
  const counts: Record<Outcome, number> = {
    REFER: 0,
    RETAKE: 0,
    NOT_ASSESSED: 0,
    NO_VISIBLE_SIGN: 0,
  };
  let latest: ScanResult | null = null;
  for (const s of sessions) {
    counts[s.outcome]++;
    if (!latest || s.createdAt > latest.createdAt) latest = s;
  }
  return { total: sessions.length, counts, latest };
}
