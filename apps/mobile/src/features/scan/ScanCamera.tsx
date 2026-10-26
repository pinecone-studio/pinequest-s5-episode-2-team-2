import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { Camera } from "react-native-vision-camera";
import type { CameraDevice } from "react-native-vision-camera";
import { useLandmarks } from "../vision/useLandmarks";
import { LandmarkOverlay } from "../vision/LandmarkOverlay";
import type { LandmarkFrame } from "../vision/facePipeline";

export function ScanCamera({
  device,
  torchOn,
  onReady,
  onFailure,
}: {
  device: CameraDevice;
  torchOn: boolean;
  onReady: () => void;
  onFailure: () => void;
}) {
  const live = useRef(true);
  const [frame, setFrame] = useState<LandmarkFrame | null>(null);
  const [started, setStarted] = useState(false);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  // Native events can arrive after this session has been torn down.
  const fail = useCallback(() => {
    if (live.current) onFailure();
  }, [onFailure]);
  const report = useCallback((result: LandmarkFrame) => {
    if (!live.current) return;
    setFrame(result);
    if (__DEV__ && process.env.EXPO_PUBLIC_LANDMARK_DEBUG === "1") {
      console.info("face-frame", {
        latencyMs: result.latencyMs,
        width: result.frameSize.width,
        height: result.frameSize.height,
        faceCount: result.faceCount,
      });
    }
  }, []);
  const { output, ready } = useLandmarks(report, fail);
  useEffect(() => {
    if (started && ready && live.current) onReady();
  }, [started, ready, onReady]);
  return (
    <>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        outputs={[output]}
        torchMode={torchOn ? "on" : "off"}
        onStarted={() => {
          if (live.current) setStarted(true);
        }}
        onStopped={fail}
        onPreviewStopped={fail}
        onError={fail}
        onInterruptionStarted={fail}
      />
      {__DEV__ && process.env.EXPO_PUBLIC_LANDMARK_DEBUG === "1" && (
        <LandmarkOverlay frame={frame} />
      )}
    </>
  );
}
