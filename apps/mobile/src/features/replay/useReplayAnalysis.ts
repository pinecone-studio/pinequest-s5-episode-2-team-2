import { useTensorflowModel } from "react-native-fast-tflite";
import { useAsyncRunner } from "react-native-vision-camera";
import { scheduleOnRN } from "react-native-worklets";
import detectorAsset from "../../../assets/models/face_detector.tflite";
import meshAsset from "../../../assets/models/face_landmarks_detector.tflite";
import { useEyeModel } from "../vision/useEyeModel";
import type { PixelSource } from "../vision/pixels";
import type { LandmarkFrame } from "../vision/facePipeline";
import { analyzeRecordedPixels } from "./replay";
import { withFrameQuality } from "../vision/frameQuality";

export function useReplayAnalysis() {
  const detector = useTensorflowModel(detectorAsset, []);
  const mesh = useTensorflowModel(meshAsset, []);
  // Load after the face models; see useLandmarks.
  const { model: eyeModel, error: eyeModelError } = useEyeModel(
    detector.state === "loaded" && mesh.state === "loaded"
      ? process.env.EXPO_PUBLIC_KEYPOINT_MODEL_URI
      : undefined,
  );
  const runner = useAsyncRunner();
  const detectorModel = detector.model,
    meshModel = mesh.model;
  function analyze(source: PixelSource, timestampMs: number): Promise<LandmarkFrame> {
    return new Promise<LandmarkFrame>((resolve, reject) => {
      if (!detectorModel || !meshModel) {
        reject(new Error("Models not ready"));
        return;
      }
      try {
        const accepted = runner.runAsync(() => {
          "worklet";
          try {
            const result = analyzeRecordedPixels(
              source,
              timestampMs,
              detectorModel,
              meshModel,
              eyeModel,
            );
            if (eyeModelError && result.faceCount === 1) result.eyeFailure = "MODEL_ERROR";
            scheduleOnRN(resolve, result);
          } catch {
            scheduleOnRN(reject, "MODEL_ERROR");
          }
        });
        if (!accepted) reject(new Error("Analyzer busy"));
      } catch {
        reject(new Error("Analysis scheduling failed"));
      }
    }).then(withFrameQuality);
  }
  return {
    analyze,
    isBusy: () => runner.isBusy(),
    ready: !!detectorModel && !!meshModel,
    error: detector.state === "error" || mesh.state === "error",
  };
}
