import { useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { Platform } from "react-native";
import { useTensorflowModel } from "react-native-fast-tflite";
import { useAsyncRunner, useFrameOutput } from "react-native-vision-camera";
import type { Frame } from "react-native-vision-camera";
import { useResizer } from "react-native-vision-camera-resizer";
import { createSynchronizable, scheduleOnRN } from "react-native-worklets";
import detectorAsset from "../../../assets/models/face_detector.tflite";
import meshAsset from "../../../assets/models/face_landmarks_detector.tflite";
import { inferLandmarks } from "./facePipeline";
import type { LandmarkFrame } from "./facePipeline";
import { analyzeEyes } from "./eyeFrame";
import { useEyeModel } from "./useEyeModel";
import { withFrameQuality } from "./frameQuality";

const resolution = { width: 3840, height: 2160 };

export function useLandmarks(onResult: (result: LandmarkFrame) => void, onError: () => void) {
  const timestampScale = Platform.OS === "android" ? 1 / 1_000_000 : 1000;
  const detector = useTensorflowModel(detectorAsset, []);
  const mesh = useTensorflowModel(meshAsset, []);
  // Concurrent fast-tflite loads were seen on iPhone to hand one model's bytes to another.
  const { model: eyeModel, error: eyeModelError } = useEyeModel(
    detector.state === "loaded" && mesh.state === "loaded"
      ? process.env.EXPO_PUBLIC_KEYPOINT_MODEL_URI
      : undefined,
  );
  // A configured model that has not loaded yet keeps frames unmeasured, so a scan never mixes
  // the model with the heuristic used when no model is installed (#274).
  const eyeModelPending = !!process.env.EXPO_PUBLIC_KEYPOINT_MODEL_URI && !eyeModel;
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
  const pending = useMemo(() => createSynchronizable(false), []);
  const timing = useMemo(() => createSynchronizable({ next: 0, interval: 100 }), []);
  const detectorModel = detector.model,
    meshModel = mesh.model;
  useLayoutEffect(() => {
    live.setBlocking(true);
    return () => live.setBlocking(false);
  }, [live]);
  const report = useCallback(
    (result: LandmarkFrame) => {
      if (live.getBlocking()) onResult(withFrameQuality(result));
    },
    [live, onResult],
  );
  const fail = useCallback(() => {
    if (live.getBlocking()) onError();
  }, [live, onError]);
  useEffect(() => {
    if (error || detector.state === "error" || mesh.state === "error") fail();
  }, [error, detector.state, mesh.state, fail]);

  // Create the worker closure on RN. Re-capturing imported worklets in a camera
  // worklet and then a second runtime turns them into remote function objects.
  const processFrame = useCallback(
    (frame: Frame, timestampMs: number) => {
      if (!live.getBlocking() || !resizer || !detectorModel || !meshModel) {
        frame.dispose();
        pending.setBlocking(false);
        return;
      }
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
              const eyeResult = eyeModelError
                ? { eyes: null, eyeFailure: "MODEL_ERROR" as const }
                : eyeModelPending
                  ? { eyes: null, eyeFailure: "MODEL_UNAVAILABLE" as const }
                  : analyzeEyes(frame, result.landmarks, eyeModel);
              const latencyMs = performance.now() - started;
              // Like the web demo, take the next frame as soon as this one is done: a 3 s scan
              // only gets a handful of frames on a phone (#274).
              const interval = Math.max(100, latencyMs);
              timing.setBlocking({ next: timestampMs + interval, interval });
              scheduleOnRN(report, {
                ...result,
                ...eyeResult,
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
            pending.setBlocking(false);
          }
        });
        if (!handled) {
          frame.dispose();
          pending.setBlocking(false);
        }
      } catch {
        frame.dispose();
        pending.setBlocking(false);
        fail();
      }
    },
    [
      live,
      resizer,
      detectorModel,
      meshModel,
      runner,
      eyeModelError,
      eyeModelPending,
      eyeModel,
      timing,
      report,
      fail,
      pending,
    ],
  );

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
        pending.getBlocking() ||
        timestampMs < previous.next
      ) {
        frame.dispose();
        return;
      }
      pending.setBlocking(true);
      timing.setBlocking({ next: timestampMs + previous.interval, interval: previous.interval });
      try {
        // Only one native Frame can wait for RN; busy camera frames are disposed.
        scheduleOnRN(processFrame, frame, timestampMs);
      } catch {
        frame.dispose();
        pending.setBlocking(false);
        scheduleOnRN(fail);
      }
    },
  });
  return { output, ready: !!resizer && !!detectorModel && !!meshModel };
}
