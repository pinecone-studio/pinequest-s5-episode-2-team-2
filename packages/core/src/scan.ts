import { summarizeFrames } from "./aggregate";
import { decide } from "./policy";
import type { FrameAnalysis, PolicyConfig, ScanFailure, ScanResult } from "./types";

export interface ScanContext {
  id: string;
  childId: string | null;
  /** ISO 8601 time the scan started. */
  createdAt: string;
  durationMs: number;
  modelVersion: string;
  policyVersion: string;
  /** Set when the model was missing or failed; the frames are then ignored. */
  failure: ScanFailure | null;
}

/** Summarizes the frames of one scan, applies the policy and returns the result to store. */
export function completeScan(
  frames: readonly FrameAnalysis[],
  context: ScanContext,
  config: PolicyConfig,
): ScanResult {
  const { failure, ...meta } = context;
  const { summary, qualityReasons } = summarizeFrames([...frames]);
  const { outcome, reasons } = decide({ summary, qualityReasons, failure }, config);
  return { ...meta, outcome, reasons, summary };
}
