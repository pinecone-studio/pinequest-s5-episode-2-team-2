import { analyzeFrame, completeScan, representativeFrame } from "@app/core";
import type { EyeMeasure, FrameAnalysis, PolicyConfig, ScanFailure, ScanResult } from "@app/core";
import type { ResultPhotos } from "../eyeView/EyePhotoView";
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
  /** Each frame's eye crops, by index, for the result screen; in memory only, never saved. */
  photos: (ResultPhotos | null)[];
  /** The first model failure seen; one failing frame means the scan cannot be measured. */
  failure: ScanFailure | null;
}

export const emptyRecording = (): ScanRecording => ({ frames: [], photos: [], failure: null });

function framePhotos(frame: LandmarkFrame): ResultPhotos | null {
  const [left, right] = frame.eyes ?? [];
  return left?.photo && right?.photo
    ? [
        { crop: left.crop, pixels: left.photo },
        { crop: right.crop, pixels: right.photo },
      ]
    : null;
}

/** Adds one frame; returns a new recording so it can live in React state. */
export function recordFrame(recording: ScanRecording, frame: LandmarkFrame): ScanRecording {
  return {
    frames: [...recording.frames, toFrameAnalysis(frame)],
    photos: [...recording.photos, framePhotos(frame)],
    failure: recording.failure ?? scanFailure(frame.eyeFailure),
  };
}

export type ScanMeta = Omit<Parameters<typeof completeScan>[1], "failure">;

/** The result to show and save, and the representative frame's eyes and crops for the result screen. */
export function finishScan(
  recording: ScanRecording,
  meta: ScanMeta,
  config: PolicyConfig,
): {
  result: ScanResult;
  eyes: [EyeMeasure, EyeMeasure] | null;
  photos: ResultPhotos | null;
} {
  const result = completeScan(recording.frames, { ...meta, failure: recording.failure }, config);
  const frame =
    result.outcome === "NOT_ASSESSED"
      ? null
      : representativeFrame(recording.frames, result.summary.asymmetryScore);
  const photos = frame ? (recording.photos[recording.frames.indexOf(frame)] ?? null) : null;
  return { result, eyes: frame?.eyes ?? null, photos };
}
