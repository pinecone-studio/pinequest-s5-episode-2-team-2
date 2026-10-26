import { useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { Platform } from "react-native";
import { useTensorflowModel } from "react-native-fast-tflite";
import { useAsyncRunner, useFrameOutput } from "react-native-vision-camera";
import { useResizer } from "react-native-vision-camera-resizer";
import { createSynchronizable, scheduleOnRN } from "react-native-worklets";
import detectorAsset from "../../../assets/models/face_detector.tflite";
import meshAsset from "../../../assets/models/face_landmarks_detector.tflite";
import { inferLandmarks } from "./facePipeline";
import type { LandmarkFrame } from "./facePipeline";

const resolution = { width: 3840, height: 2160 };

export function useLandmarks(onResult: (result: LandmarkFrame) => void, onError: () => void) {
  const timestampScale = Platform.OS === "android" ? 1 / 1_000_000 : 1000;
  const detector = useTensorflowModel(detectorAsset, []);
  const mesh = useTensorflowModel(meshAsset, []);
  const { resizer, error } = useResizer({
    width: 512,
    height: 512,
    channelOrder: "rgb",
    dataType: "float32",
    pixelLayout: "interleaved",
    scaleMode: "contain",
  });
  const runner = useAsyncRunner();
  const live = useMemo(() => createSynchronizable(true), []);
  const timing = useMemo(() => createSynchronizable({ next: 0, interval: 100 }), []);
  const detectorModel = detector.model,
    meshModel = mesh.model;
  useLayoutEffect(() => {
    live.setBlocking(true);
    return () => live.setBlocking(false);
  }, [live]);
  const report = useCallback(
    (result: LandmarkFrame) => {
      if (live.getBlocking()) onResult(result);
    },
    [live, onResult],
  );
  const fail = useCallback(() => {
    if (live.getBlocking()) onError();
  }, [live, onError]);
  useEffect(() => {
    if (error || detector.state === "error" || mesh.state === "error") fail();
  }, [error, detector.state, mesh.state, fail]);

  const output = useFrameOutput({
    targetResolution: resolution,
    pixelFormat: "yuv",
    enablePhysicalBufferRotation: true,
    dropFramesWhileBusy: true,
    onFrame(frame) {
      "worklet";
      // V5.2.3 native timestamps are seconds on iOS and nanoseconds on Android.
      const timestampMs = frame.timestamp * timestampScale;
      const previous = timing.getBlocking();
      if (
        !live.getBlocking() ||
        !resizer ||
        !detectorModel ||
        !meshModel ||
        timestampMs < previous.next
      ) {
        frame.dispose();
        return;
      }
      timing.setBlocking({ next: timestampMs + previous.interval, interval: previous.interval });
      try {
        const handled = runner.runAsync(() => {
          "worklet";
          try {
            if (!live.getBlocking()) return;
            if (frame.orientation !== "up" || frame.isMirrored || !Number.isFinite(timestampMs)) {
              throw new Error("Unsupported frame orientation");
            }
            const started = performance.now();
            const resized = resizer.resize(frame);
            try {
              const result = inferLandmarks(
                new Float32Array(resized.getPixelBuffer()),
                detectorModel,
                meshModel,
                frame.width,
                frame.height,
              );
              const latencyMs = performance.now() - started;
              // Back off with measured processing cost rather than building a queue of stale frames.
              const interval = Math.max(100, latencyMs * 2);
              timing.setBlocking({ next: timestampMs + interval, interval });
              scheduleOnRN(report, {
                ...result,
                timestampMs,
                latencyMs,
                frameSize: { width: frame.width, height: frame.height },
              });
            } finally {
              resized.dispose();
            }
          } catch {
            scheduleOnRN(fail);
          } finally {
            frame.dispose();
          }
        });
        if (!handled) frame.dispose();
      } catch {
        frame.dispose();
        scheduleOnRN(fail);
      }
    },
  });
  return { output, ready: !!resizer && !!detectorModel && !!meshModel };
}
