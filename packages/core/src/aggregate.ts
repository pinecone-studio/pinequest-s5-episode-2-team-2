import { magnitude } from "./geometry";
import type { FrameAnalysis, PolicyInput, QualityReason } from "./types";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  return sorted.length % 2 ? sorted[Math.floor(mid)]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function usableAsymmetry(frame: FrameAnalysis): number | null {
  if (!frame.quality.ok || frame.eyes === null || frame.asymmetry === null) return null;
  const value = magnitude(frame.asymmetry);
  return Number.isFinite(value) ? value : null;
}

/**
 * Summarizes the frames of one scan for the decision policy. The score is the median
 * asymmetry magnitude of the usable frames; the spread is their median absolute deviation.
 */
export function summarizeFrames(frames: FrameAnalysis[]): Omit<PolicyInput, "failure"> {
  const used: number[] = [];
  const reasons = new Set<QualityReason>();
  for (const frame of frames) {
    const value = usableAsymmetry(frame);
    if (value !== null) {
      used.push(value);
      continue;
    }
    if (frame.quality.reasons.length) frame.quality.reasons.forEach((r) => reasons.add(r));
    else reasons.add(frame.eyes === null ? "EYE_NOT_FOUND" : "REFLEX_NOT_FOUND");
  }
  const score = used.length ? median(used) : null;
  return {
    summary: {
      framesTotal: frames.length,
      framesUsed: used.length,
      asymmetryScore: score,
      spread: score === null ? null : median(used.map((v) => Math.abs(v - score))),
    },
    qualityReasons: [...reasons],
  };
}
