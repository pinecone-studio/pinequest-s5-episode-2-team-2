import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { useAsyncRunner, useFrameOutput, type Frame } from "react-native-vision-camera";
import { useResizer } from "react-native-vision-camera-resizer";
import { createSynchronizable, scheduleOnRN } from "react-native-worklets";
import { analyzeGestureFrame, type GestureModels } from "./gestureFrame";
import { loadGestureModels } from "./gestureModels";
import type { GesturePoint } from "./gesturePipeline";

export interface GestureFrame {
  body: boolean;
  hand: GesturePoint[];
  timestampMs: number;
  latencyMs: number;
  diagnostics?: {
    cropFound: boolean;
    cropSizePx: number;
    visibleWrists: number;
    visibleIndices: number;
    palmFound: boolean;
    handPresent: boolean;
  };
}
// All camera instances share cached interpreters: RN serialises access across remounts.
let inFlight = false;
const releaseModels = () => {
  inFlight = false;
};
// V5 useFrameOutput memoises by object identity; do not rebuild its native thread on render.
const resolution = { width: 3840, height: 2160 };
export function useGestureFrames(
  round: string,
  onFrame: (frame: GestureFrame) => void,
  onError: () => void,
) {
  const [models, setModels] = useState<GestureModels>();
  const live = useMemo(() => createSynchronizable(true), []);
  const epoch = useMemo(() => createSynchronizable(round), []);
  const pending = useMemo(() => createSynchronizable(false), []);
  const next = useMemo(() => createSynchronizable(0), []);
  const { resizer, error } = useResizer({
    width: 512,
    height: 512,
    channelOrder: "rgb",
    dataType: "float32",
    pixelLayout: "interleaved",
    scaleMode: "contain",
  });
  const runner = useAsyncRunner();
  const scale = Platform.OS === "android" ? 1 / 1_000_000 : 1000;
  useLayoutEffect(() => {
    epoch.setBlocking(round);
  }, [round, epoch]);
  useLayoutEffect(() => {
    live.setBlocking(true);
    return () => live.setBlocking(false);
  }, [live]);
  const fail = useCallback(
    (reason?: string) => {
      if (live.getBlocking()) {
        if (__DEV__ && reason) console.warn("gesture-error", reason);
        onError();
      }
    },
    [live, onError],
  );
  useEffect(() => {
    let active = true;
    loadGestureModels().then(
      (m) => {
        if (active) setModels(m);
      },
      (error: unknown) => {
        if (active) fail(`models: ${String(error)}`);
      },
    );
    return () => {
      active = false;
    };
  }, [fail]);
  useEffect(() => {
    if (error) fail(`resizer: ${String(error)}`);
  }, [error, fail]);
  const report = useCallback(
    (value: GestureFrame, key: string) => {
      if (live.getBlocking() && epoch.getBlocking() === key) onFrame(value);
    },
    [live, epoch, onFrame],
  );
  // RN-created worker closure, like useLandmarks: at most one native frame can await RN.
  const process = useCallback(
    (frame: Frame, timestampMs: number, key: string) => {
      if (!live.getBlocking() || epoch.getBlocking() !== key || !models || !resizer || inFlight) {
        frame.dispose();
        pending.setBlocking(false);
        return;
      }
      inFlight = true;
      try {
        const accepted = runner.runAsync(() => {
          "worklet";
          try {
            if (!live.getBlocking() || epoch.getBlocking() !== key) return;
            const started = performance.now(),
              resized = resizer.resize(frame);
            try {
              const result = analyzeGestureFrame(
                frame,
                new Float32Array(resized.getPixelBuffer()),
                models,
              );
              const latencyMs = performance.now() - started;
              next.setBlocking(timestampMs + Math.max(150, latencyMs * 2));
              scheduleOnRN(report, { ...result, timestampMs, latencyMs }, key);
            } finally {
              resized.dispose();
            }
          } catch (error) {
            scheduleOnRN(fail, `worker: ${String(error)}`);
          } finally {
            frame.dispose();
            pending.setBlocking(false);
            scheduleOnRN(releaseModels);
          }
        });
        if (!accepted) {
          frame.dispose();
          pending.setBlocking(false);
          releaseModels();
        }
      } catch (error) {
        frame.dispose();
        pending.setBlocking(false);
        releaseModels();
        fail(`dispatch: ${String(error)}`);
      }
    },
    [live, epoch, models, resizer, runner, pending, next, report, fail],
  );
  const output = useFrameOutput({
    targetResolution: resolution,
    pixelFormat: "yuv",
    enablePhysicalBufferRotation: true,
    dropFramesWhileBusy: true,
    onFrame(frame) {
      "worklet";
      const time = frame.timestamp * scale;
      if (
        !live.getBlocking() ||
        !models ||
        !resizer ||
        !Number.isFinite(time) ||
        pending.getBlocking() ||
        time < next.getBlocking()
      ) {
        frame.dispose();
        return;
      }
      pending.setBlocking(true);
      next.setBlocking(time + 150);
      try {
        scheduleOnRN(process, frame, time, epoch.getBlocking());
      } catch {
        frame.dispose();
        pending.setBlocking(false);
        scheduleOnRN(fail);
      }
    },
  });
  return { output, ready: !!models && !!resizer };
}
