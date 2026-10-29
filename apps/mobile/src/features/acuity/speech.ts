import type { AgeGroup, Direction } from "./acuity";

/** What a spoken reply means: an E direction, "can't see", or nothing usable. */
export type SpokenAnswer = Direction | "cantSee";

// Word stems per answer. Whisper writes Mongolian in Cyrillic; a Latin spelling is kept too
// because the model sometimes transliterates very short replies.
const STEMS: { answer: SpokenAnswer; stems: string[] }[] = [
  { answer: 270, stems: ["дээш", "дээр", "deesh"] },
  { answer: 90, stems: ["доош", "доор", "doosh"] },
  { answer: 180, stems: ["зүүн", "зуун", "zuun", "zuun"] },
  { answer: 0, stems: ["баруун", "baruun"] },
  { answer: "cantSee", stems: ["харагдахгүй", "харагдахгуй", "мэдэхгүй", "мэдэхгуй", "харахгүй"] },
];

/** Hints the model towards the five replies (whisper's initial prompt). */
export const SPEECH_PROMPT = "дээш, доош, зүүн, баруун, харагдахгүй";

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

/** A word matches a stem when it starts with it, allowing one wrong letter in longer stems. */
function matches(word: string, stem: string): boolean {
  const head = word.slice(0, stem.length);
  if (head === stem) return true;
  return stem.length >= 4 && head.length === stem.length && distance(head, stem) <= 1;
}

/**
 * Turns a transcript into one answer. Returns null when nothing matches or when the words
 * disagree (e.g. "зүүн ... баруун"), so the app asks again instead of guessing.
 */
export function matchSpoken(transcript: string): SpokenAnswer | null {
  const words = transcript
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const found = new Set<SpokenAnswer>();
  for (const word of words) {
    for (const { answer, stems } of STEMS) {
      if (stems.some((stem) => matches(word, stem))) found.add(answer);
    }
  }
  return found.size === 1 ? [...found][0]! : null;
}

/**
 * Young children often mix up left and right words while seeing the E correctly, which would
 * score as poor vision. For them a spoken left/right is not taken; they point instead.
 */
export function acceptsSpoken(group: AgeGroup, answer: SpokenAnswer): boolean {
  if (group === "adult") return true;
  return answer !== 0 && answer !== 180;
}
