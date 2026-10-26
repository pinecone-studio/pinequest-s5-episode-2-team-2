import { parseRecording, replayRecording, analyzeRecordedPixels } from "./replay";
import type { PixelSource } from "../vision/pixels";
import type { LandmarkFrame } from "../vision/facePipeline";

const input = {
  version: 1,
  width: 4,
  height: 2,
  frames: [{ file: "frame0001.rgb", timestampMs: 0 }],
};
const source: PixelSource = {
  format: "rgb",
  width: 4,
  height: 2,
  stride: 12,
  rgb: new Uint8Array(24),
};
const result: LandmarkFrame = {
  timestampMs: 0,
  frameSize: { width: 4, height: 2 },
  faceCount: 0,
  landmarks: [],
  latencyMs: 1,
};

test("accepts only bounded local RGB frame names and increasing timestamps", () => {
  expect(parseRecording(input)).toEqual(input);
  for (const file of [
    "../face.rgb",
    "file:///private.rgb",
    "https://example.com/face.rgb",
    "face.png",
    "a\\b.rgb",
  ]) {
    expect(() => parseRecording({ ...input, frames: [{ file, timestampMs: 0 }] })).toThrow();
  }
  expect(() => parseRecording({ ...input, frames: [...input.frames, ...input.frames] })).toThrow();
  expect(() => parseRecording({ ...input, width: 10000 })).toThrow();
  expect(() =>
    parseRecording({ ...input, frames: [{ file: "f.rgb", timestampMs: NaN }] }),
  ).toThrow();
  expect(() =>
    parseRecording({ ...input, frames: [{ file: "f.rgb", timestampMs: 3001 }] }),
  ).toThrow();
});

test("replay uses the same detector normalization and avoids inventing missing eyes", () => {
  const runSync = jest.fn<ArrayBuffer[], [ArrayBuffer[]]>(() => [
    new Float32Array(896 * 16).buffer,
    new Float32Array(896).fill(-100).buffer,
  ]);
  const mesh = { runSync: jest.fn() };
  const frame = analyzeRecordedPixels(source, 0, { runSync }, mesh, undefined);
  expect(frame.faceCount).toBe(0);
  expect(frame.eyeFailure).toBe("EYE_NOT_FOUND");
  expect(frame.eyes).toBeNull();
  expect(mesh.runSync).not.toHaveBeenCalled();
  expect(new Float32Array(runSync.mock.calls[0]![0][0]!)[0]).toBe(-1);
});

test("replays frames in order and checks each loaded frame's dimensions", async () => {
  const report = jest.fn(),
    load = jest.fn<Promise<PixelSource>, [string]>(async () => source),
    analyze = jest.fn(async () => result);
  const recording = parseRecording({
    ...input,
    frames: [...input.frames, { file: "frame0002.rgb", timestampMs: 1 }],
  });
  await replayRecording(recording, load, analyze, report, new AbortController().signal);
  expect(load.mock.calls.map(([file]) => file)).toEqual(["frame0001.rgb", "frame0002.rgb"]);
  expect(report.mock.calls.map(([, count]) => count)).toEqual([1, 2]);
  await expect(
    replayRecording(
      recording,
      async () => ({ ...source, width: 8 }),
      analyze,
      report,
      new AbortController().signal,
    ),
  ).rejects.toThrow("size mismatch");
});

test("cancellation suppresses results arriving from pending analysis", async () => {
  const controller = new AbortController(),
    report = jest.fn();
  let finish!: (frame: LandmarkFrame) => void;
  let entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const task = replayRecording(
    parseRecording(input),
    async () => source,
    () => {
      entered();
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    report,
    controller.signal,
  );
  await ready;
  controller.abort();
  await task;
  finish(result);
  expect(report).not.toHaveBeenCalled();
});

test("cancellation clears a pending replay timer", async () => {
  jest.useFakeTimers();
  try {
    const controller = new AbortController();
    let reported!: () => void;
    const first = new Promise<void>((resolve) => {
      reported = resolve;
    });
    const recording = parseRecording({
      ...input,
      frames: [...input.frames, { file: "frame0002.rgb", timestampMs: 1000 }],
    });
    const load = jest.fn(async () => source);
    const task = replayRecording(recording, load, async () => result, reported, controller.signal);
    await first;
    expect(jest.getTimerCount()).toBe(1);
    controller.abort();
    await task;
    expect(jest.getTimerCount()).toBe(0);
    expect(load).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
