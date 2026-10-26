import { useLayoutEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { Camera } from "react-native-vision-camera";
import type { CameraDevice } from "react-native-vision-camera";

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
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  // Native events can arrive after this session has been torn down.
  const fail = () => {
    if (live.current) onFailure();
  };
  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive
      torchMode={torchOn ? "on" : "off"}
      onStarted={() => {
        if (live.current) onReady();
      }}
      onStopped={fail}
      onPreviewStopped={fail}
      onError={fail}
      onInterruptionStarted={fail}
    />
  );
}
