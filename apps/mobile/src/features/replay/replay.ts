import type { InferenceModel, LandmarkFrame } from "../vision/facePipeline";
import { inferLandmarks } from "../vision/facePipeline";
import { analyzeEyePixels } from "../vision/eyeFrame";
import { cropPixels } from "../vision/pixels";
import type { PixelSource } from "../vision/pixels";

export interface Recording {
  version: 1;
  width: number;
  height: number;
  frames: { file: string; timestampMs: number }[];
}

export function parseRecording(value: unknown): Recording {
  if (!value || typeof value !== "object") throw new Error("Invalid recording");
  const data = value as Record<string, unknown>;
  const { width, height, frames } = data;
  if (
    data.version !== 1 ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 3840 ||
    height > 3840 ||
    width * height > 3840 * 2160 ||
    !Array.isArray(frames) ||
    frames.length < 1 ||
    frames.length > 90
  )
    throw new Error("Invalid recording dimensions or frame count");
  const names = new Set<string>();
  let previous = -1;
  return {
    version: 1,
    width,
    height,
    frames: frames.map((entry, index) => {
      if (!entry || typeof entry !== "object") throw new Error("Invalid recorded frame");
      const row = entry as Record<string, unknown>;
      const { file, timestampMs } = row;
      if (
        typeof file !== "string" ||
        !/^[a-zA-Z0-9_-]{1,64}\.rgb$/.test(file) ||
        names.has(file) ||
        typeof timestampMs !== "number" ||
        !Number.isFinite(timestampMs) ||
        timestampMs <= previous ||
        timestampMs > 3000 ||
        (index === 0 && timestampMs !== 0)
      )
        throw new Error("Invalid recording file or timestamp");
      names.add(file);
      previous = timestampMs;
      return { file, timestampMs };
    }),
  };
}

/** Replay and camera paths share the same model decoding, eye crops and frame transforms. */
export function analyzeRecordedPixels(
  source: PixelSource,
  timestampMs: number,
  detector: InferenceModel,
  mesh: InferenceModel,
  eyes: InferenceModel | undefined,
): LandmarkFrame {
  "worklet";
  const started = performance.now();
  const size = Math.max(source.width, source.height);
  const rgb = cropPixels(
    source,
    { x: (source.width - size) / 2, y: (source.height - size) / 2, size },
    512,
    true,
  );
  const result = inferLandmarks(rgb, detector, mesh, source.width, source.height);
  return {
    ...result,
    ...analyzeEyePixels(source, result.landmarks, eyes),
    timestampMs,
    frameSize: { width: source.width, height: source.height },
    latencyMs: performance.now() - started,
  };
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", stop);
      resolve();
    };
    const timer = setTimeout(stop, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}

export async function replayRecording(
  recording: Recording,
  load: (file: string) => Promise<PixelSource>,
  analyze: (source: PixelSource, timestampMs: number) => Promise<LandmarkFrame>,
  report: (frame: LandmarkFrame, count: number) => void,
  signal: AbortSignal,
) {
  const started = performance.now();
  for (let i = 0; i < recording.frames.length; i++) {
    const entry = recording.frames[i]!;
    await wait(entry.timestampMs - (performance.now() - started), signal);
    if (signal.aborted) return;
    const pixels = await load(entry.file);
    if (signal.aborted) return;
    if (pixels.width !== recording.width || pixels.height !== recording.height)
      throw new Error("Recorded frame size mismatch");
    const result = await analyze(pixels, entry.timestampMs);
    if (signal.aborted) return;
    report(result, i + 1);
  }
}
