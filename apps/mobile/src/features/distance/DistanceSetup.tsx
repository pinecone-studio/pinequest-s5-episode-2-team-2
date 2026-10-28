import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useIsFocused } from "expo-router";
import { AppState, Linking, Platform, StyleSheet, View } from "react-native";
import {
  Camera,
  useCameraDevices,
  useCameraPermission,
  useDepthOutput,
  useObjectOutput,
  type CameraDevice,
  type ScannedObject,
  type ScannedObjectType,
} from "react-native-vision-camera";
import { createSynchronizable, scheduleOnRN } from "react-native-worklets";
import { Button, Notice, Screen, Text } from "../../components/ui";
import { distanceCopy as copy } from "./copy";
import { personMetres, singleFace, type FaceTarget } from "./depthDistance";

const resolution = { width: 640, height: 480 };
const faceTypes: ScannedObjectType[] = ["face"];

export function DistanceSetup({ onContinue }: { onContinue: () => void }) {
  const [enabled, setEnabled] = useState(false),
    [failed, setFailed] = useState(false),
    [back, setBack] = useState(false);
  const [state, setState] = useState(AppState.currentState);
  const [reading, setReading] = useState<{ value: number | null; at: number }>();
  const [now, setNow] = useState(Date.now());
  const devices = useCameraDevices();
  const front =
    devices.find((d) => d.position === "front" && d.type === "true-depth") ??
    devices.find((d) => d.position === "front");
  const rear =
    devices.find((d) => d.type === "lidar-depth") ?? devices.find((d) => d.position === "back");
  const device = back ? rear : front;
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const focused = useIsFocused();
  const active =
    enabled &&
    !failed &&
    focused &&
    state === "active" &&
    hasPermission &&
    !!device &&
    Platform.OS === "ios";
  useEffect(() => {
    const listener = AppState.addEventListener("change", (nextState) => {
      setReading(undefined);
      setNow(Date.now());
      setState(nextState);
    });
    return () => listener.remove();
  }, []);
  useLayoutEffect(() => {
    if (!focused) setReading(undefined);
  }, [focused]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    const timeout = setTimeout(() => setFailed(true), 30_000);
    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [active, device?.id]);
  const fail = useCallback(() => {
    setFailed(true);
    setReading(undefined);
  }, []);
  const report = useCallback((value: number | null) => {
    const at = Date.now();
    setReading({ value, at });
    setNow(at);
  }, []);
  async function toggle() {
    setReading(undefined);
    setFailed(false);
    if (enabled && !failed && hasPermission) {
      setEnabled(false);
      return;
    }
    setEnabled(true);
    try {
      if (!hasPermission) {
        if (canRequestPermission) await requestPermission();
        else await Linking.openSettings();
      }
    } catch {
      fail();
    }
  }
  const value =
    active && reading && now >= reading.at && now - reading.at <= 750 ? reading.value : null;
  return (
    <Screen>
      <Text variant="title">{copy.title}</Text>
      <Text>{copy.help}</Text>
      <View style={styles.preview}>
        {active && device && (
          <DepthCamera key={device.id} device={device} onReading={report} onFailure={fail} />
        )}
      </View>
      <Text style={styles.metres} accessibilityLiveRegion="polite">
        {value === null ? "—" : copy.metres(value)}
      </Text>
      <Text>
        {enabled && (!active || failed)
          ? copy.unavailable
          : value === null
            ? copy.unknown
            : copy.approximate}
      </Text>
      <Button
        label={enabled && !failed && hasPermission ? copy.close : copy.open}
        onPress={() => void toggle()}
      />
      {!!front && !!rear && (
        <Button
          label={copy.swap}
          variant="link"
          onPress={() => {
            setReading(undefined);
            setFailed(false);
            setBack((v) => !v);
          }}
        />
      )}
      <Notice>{copy.privacy}</Notice>
      <Button label={copy.proceed} onPress={onContinue} />
    </Screen>
  );
}

function DepthCamera({
  device,
  onReading,
  onFailure,
}: {
  device: CameraDevice;
  onReading: (value: number | null) => void;
  onFailure: () => void;
}) {
  const live = useMemo(() => createSynchronizable(true), []);
  const target = useMemo(() => createSynchronizable<FaceTarget | null>(null), []);
  const next = useMemo(() => createSynchronizable(0), []);
  const alive = useRef(true);
  useLayoutEffect(() => {
    alive.current = true;
    live.setBlocking(true);
    return () => {
      alive.current = false;
      live.setBlocking(false);
      target.setBlocking(null);
    };
  }, [live, target]);
  const fail = useCallback(() => {
    if (alive.current) onFailure();
  }, [onFailure]);
  const report = useCallback(
    (value: number | null, accuracy?: string, quality?: string, hasFace?: boolean) => {
      if (alive.current) onReading(value);
      if (alive.current && __DEV__ && process.env.EXPO_PUBLIC_LANDMARK_DEBUG === "1")
        console.info("distance-reading", { metres: value, accuracy, quality, hasFace });
    },
    [onReading],
  );
  const objects = useCallback(
    (values: ScannedObject[]) => {
      try {
        if (alive.current) target.setBlocking(singleFace(values, Date.now()));
      } catch {
        target.setBlocking(null);
      } finally {
        values.forEach((value) => value.dispose());
      }
    },
    [target],
  );
  const face = useObjectOutput({ types: faceTypes, onObjectsScanned: objects });
  const depth = useDepthOutput({
    targetResolution: resolution,
    enableFiltering: true,
    dropFramesWhileBusy: true,
    onDepth(frame) {
      "worklet";
      try {
        const now = Date.now();
        if (!live.getBlocking() || now < next.getBlocking()) return;
        next.setBlocking(now + 200);
        const faceTarget = target.getBlocking();
        const metres = personMetres(frame, faceTarget, now);
        scheduleOnRN(report, metres, frame.depthDataAccuracy, frame.depthDataQuality, !!faceTarget);
      } catch {
        scheduleOnRN(report, null);
      } finally {
        frame.dispose();
      }
    },
  });
  const supported = useMemo(() => {
    try {
      return device.supportsOutput(depth) && device.supportsOutput(face);
    } catch {
      return false;
    }
  }, [device, depth, face]);
  useEffect(() => {
    if (!supported) fail();
  }, [supported, fail]);
  return supported ? (
    <Camera
      style={[StyleSheet.absoluteFill, device.position === "front" && styles.mirrorPreview]}
      device={device}
      isActive
      mirrorMode="off"
      outputs={[depth, face]}
      onError={fail}
      onStopped={fail}
      onPreviewStopped={fail}
      onInterruptionStarted={fail}
    />
  ) : null;
}
const styles = StyleSheet.create({
  mirrorPreview: { transform: [{ scaleX: -1 }] },
  preview: { height: 240, borderRadius: 16, overflow: "hidden", backgroundColor: "#111" },
  metres: { fontSize: 48, fontWeight: "900", textAlign: "center" },
});
