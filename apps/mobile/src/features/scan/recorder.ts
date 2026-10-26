import { analyzeFrame, completeScan, representativeFrame } from "@app/core";
import type { EyeMeasure, FrameAnalysis, PolicyConfig, ScanFailure, ScanResult } from "@app/core";
import { scanFailure, toEyeMeasures } from "../measurement/eyeMeasure";
import type { LandmarkFrame } from "../vision/facePipeline";

/** One camera frame as the shared `FrameAnalysis`, reusing the producer's quality if set. */
export function toFrameAnalysis(frame: LandmarkFrame): FrameAnalysis {
  const eyes = toEyeMeasures(frame);
  const analysis = analyzeFrame({ ...frame, eyes });
  return frame.quality ? { ...analysis, quality: frame.quality } : analysis;
}

export interface ScanRecording {
  frames: FrameAnalysis[];
  /** The first model failure seen; one failing frame means the scan cannot be measured. */
  failure: ScanFailure | null;
}

export const emptyRecording = (): ScanRecording => ({ frames: [], failure: null });

/** Adds one frame; returns a new recording so it can live in React state. */
export function recordFrame(recording: ScanRecording, frame: LandmarkFrame): ScanRecording {
  return {
    frames: [...recording.frames, toFrameAnalysis(frame)],
    failure: recording.failure ?? scanFailure(frame.eyeFailure),
  };
}

export type ScanMeta = Omit<Parameters<typeof completeScan>[1], "failure">;

/** The result to show and save, and the representative frame's eyes for the result screen. */
export function finishScan(
  recording: ScanRecording,
  meta: ScanMeta,
  config: PolicyConfig,
): { result: ScanResult; eyes: [EyeMeasure, EyeMeasure] | null } {
  const result = completeScan(recording.frames, { ...meta, failure: recording.failure }, config);
  const frame =
    result.outcome === "NOT_ASSESSED"
      ? null
      : representativeFrame(recording.frames, result.summary.asymmetryScore);
  return { result, eyes: frame?.eyes ?? null };
}
