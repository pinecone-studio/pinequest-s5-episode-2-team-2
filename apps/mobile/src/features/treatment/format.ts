/** "1:05:09" / "5:09" style elapsed time for the running timer. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Parses the goal field; null unless it is a whole number of minutes from 1 to 1440. */
export function parseGoalMinutes(input: string): number | null {
  const text = input.trim();
  if (!/^\d+$/.test(text)) return null;
  const minutes = Number(text);
  return minutes >= 1 && minutes <= 1440 ? minutes : null;
}

/** Locally unique ID without a native module: time plus randomness. */
export function newLogId(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 36 ** 8).toString(36)}`;
}
