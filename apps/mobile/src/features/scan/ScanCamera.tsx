import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { Camera } from "react-native-vision-camera";
import type { CameraDevice } from "react-native-vision-camera";
import { useLandmarks } from "../vision/useLandmarks";
import { LandmarkOverlay } from "../vision/LandmarkOverlay";
import { MeasurementOverlay } from "../measurement/MeasurementOverlay";
import { measurementDebugEnabled, measurementOverlayProps } from "../measurement/debug";
import type { LandmarkFrame } from "../vision/facePipeline";
import { LiveGuidance } from "./LiveGuidance";
import { ScanPreview } from "./ScanPreview";

export function ScanCamera({
  device,
  torchOn,
  onReady,
  onFailure,
  onFrame,
}: {
  device: CameraDevice;
  torchOn: boolean;
  onReady: () => void;
  onFailure: () => void;
  /** Every analysed frame, with quality, for recording the scan. */
  onFrame?: ((frame: LandmarkFrame) => void) | undefined;
}) {
  const live = useRef(true);
  const [frame, setFrame] = useState<LandmarkFrame | null>(null);
  const [started, setStarted] = useState(false);
  const [previewStarted, setPreviewStarted] = useState(false);
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
  // A ref keeps `report` stable, so a new callback does not restart frame processing.
  const frameListener = useRef(onFrame);
  useLayoutEffect(() => {
    frameListener.current = onFrame;
  }, [onFrame]);
  const report = useCallback((result: LandmarkFrame) => {
    if (!live.current) return;
    setFrame(result);
    frameListener.current?.(result);
    if (__DEV__ && process.env.EXPO_PUBLIC_LANDMARK_DEBUG === "1") {
      console.info("face-frame", {
        timestampMs: result.timestampMs,
        latencyMs: result.latencyMs,
        width: result.frameSize.width,
        height: result.frameSize.height,
        faceCount: result.faceCount,
      });
    }
  }, []);
  const { output, ready } = useLandmarks(report, fail);
  useEffect(() => {
    if (started && previewStarted && ready && live.current) onReady();
  }, [started, previewStarted, ready, onReady]);
  return (
    <ScanPreview guidance={<LiveGuidance frame={frame} />}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        outputs={[output]}
        onPreviewStarted={() => {
          if (live.current) setPreviewStarted(true);
        }}
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
      {measurementDebugEnabled() && frame && (
        <MeasurementOverlay {...measurementOverlayProps(frame)} />
      )}
    </ScanPreview>
  );
}
