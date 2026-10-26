import { magnitude } from "./geometry";
import type { FrameAnalysis } from "./types";

/**
 * The usable frame whose asymmetry is closest to the scan's score, to illustrate the result.
 * Ties go to the higher eye confidence, then the earlier frame. Null without usable frames.
 */
export function representativeFrame(
  frames: readonly FrameAnalysis[],
  score: number | null,
): FrameAnalysis | null {
  if (score === null || !Number.isFinite(score)) return null;
  let best: { frame: FrameAnalysis; distance: number; confidence: number } | null = null;
  for (const frame of frames) {
    if (!frame.quality.ok || !frame.eyes || !frame.asymmetry) continue;
    const value = magnitude(frame.asymmetry);
    if (!Number.isFinite(value)) continue;
    const distance = Math.abs(value - score);
    const confidence = Math.min(frame.eyes[0].confidence, frame.eyes[1].confidence);
    if (
      !best ||
      distance < best.distance ||
      (distance === best.distance && confidence > best.confidence)
    ) {
      best = { frame, distance, confidence };
    }
  }
  return best?.frame ?? null;
}
