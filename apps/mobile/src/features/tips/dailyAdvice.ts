import { adviceCards, type AdviceCard } from "./advice";

/** Local calendar date: timezone offsets and daylight-saving hours do not shift a tip. */
export function getDailyAdvice(
  date = new Date(),
  cards: readonly AdviceCard[] = adviceCards,
): AdviceCard | undefined {
  if (!cards.length || !Number.isFinite(date.getTime())) return undefined;
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  return cards[((day % cards.length) + cards.length) % cards.length];
}

export function millisecondsUntilMidnight(date: Date): number {
  return (
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - date.getTime()
  );
}
