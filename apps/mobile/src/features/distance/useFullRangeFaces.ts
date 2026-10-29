import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useAsyncRunner, useFrameOutput, type Frame } from "react-native-vision-camera";
import { useResizer } from "react-native-vision-camera-resizer";
import { createSynchronizable, scheduleOnRN } from "react-native-worklets";
import type { TfliteModel } from "react-native-fast-tflite";
import type { FaceTarget } from "./depthDistance";
import { loadFullRangeFace } from "./fullRangeModel";
import { fullRangeTarget } from "./fullRangeFace";

const resolution = { width: 1280, height: 960 };
// The one cached interpreter must not be used concurrently across camera remounts.
let inFlight = false;
const release = () => {
  inFlight = false;
};
export function useFullRangeFaces(
  onTarget: (target: FaceTarget | null) => void,
  onFailure: () => void,
) {
  const [model, setModel] = useState<TfliteModel>();
  const live = useMemo(() => createSynchronizable(true), []);
  const pending = useMemo(() => createSynchronizable(false), []);
  const next = useMemo(() => createSynchronizable(0), []);
  const runner = useAsyncRunner();
  const { resizer, error } = useResizer({
    width: 192,
    height: 192,
    channelOrder: "rgb",
    dataType: "float32",
    pixelLayout: "interleaved",
    scaleMode: "contain",
  });
  useLayoutEffect(() => {
    live.setBlocking(true);
    return () => live.setBlocking(false);
  }, [live]);
  const fail = useCallback(
    (reason?: string) => {
      if (!live.getBlocking()) return;
      if (__DEV__ && reason) console.warn("distance-face-error", reason);
      onFailure();
    },
    [live, onFailure],
  );
  useEffect(() => {
    let active = true;
    loadFullRangeFace().then(
      (value) => {
        if (active) setModel(value);
      },
      (error) => {
        if (active) fail(String(error));
      },
    );
    return () => {
      active = false;
    };
  }, [fail]);
  useEffect(() => {
    if (error) fail(String(error));
  }, [error, fail]);
  const report = useCallback(
    (target: FaceTarget | null, count: number, latencyMs: number, at: number) => {
      if (!live.getBlocking()) return;
      // Preserve capture time; queued inference must not make an old target fresh again.
      const accepted = Date.now() - at <= 750 && Date.now() >= at ? target : null;
      onTarget(accepted);
      if (__DEV__ && process.env.EXPO_PUBLIC_LANDMARK_DEBUG === "1")
        console.info("distance-face", { count, hasTarget: !!accepted, latencyMs });
    },
    [live, onTarget],
  );
  const processFrame = useCallback(
    (frame: Frame, at: number) => {
      if (!live.getBlocking() || !model || !resizer || inFlight) {
        frame.dispose();
        pending.setBlocking(false);
        return;
      }
      inFlight = true;
      try {
        const handled = runner.runAsync(() => {
          "worklet";
          try {
            if (!live.getBlocking()) return;
            const started = performance.now(),
              resized = resizer.resize(frame);
            try {
              const result = fullRangeTarget(
                frame,
                new Float32Array(resized.getPixelBuffer()),
                model,
                at,
              );
              const latencyMs = performance.now() - started;
              next.setBlocking(Date.now() + Math.max(300, latencyMs * 2));
              scheduleOnRN(report, result.target, result.count, latencyMs, at);
            } finally {
              resized.dispose();
            }
          } catch (error) {
            scheduleOnRN(fail, String(error));
          } finally {
            frame.dispose();
            pending.setBlocking(false);
            scheduleOnRN(release);
          }
        });
        if (!handled) {
          frame.dispose();
          pending.setBlocking(false);
          release();
        }
      } catch (error) {
        frame.dispose();
        pending.setBlocking(false);
        release();
        fail(String(error));
      }
    },
    [live, model, resizer, runner, pending, next, report, fail],
  );
  const output = useFrameOutput({
    targetResolution: resolution,
    pixelFormat: "yuv",
    enablePhysicalBufferRotation: true,
    enablePreviewSizedOutputBuffers: true,
    dropFramesWhileBusy: true,
    onFrame(frame) {
      "worklet";
      const at = Date.now();
      if (
        !live.getBlocking() ||
        !model ||
        !resizer ||
        pending.getBlocking() ||
        at < next.getBlocking()
      ) {
        frame.dispose();
        return;
      }
      pending.setBlocking(true);
      next.setBlocking(at + 300);
      try {
        scheduleOnRN(processFrame, frame, at);
      } catch {
        frame.dispose();
        pending.setBlocking(false);
        scheduleOnRN(fail);
      }
    },
  });
  return output;
}
