import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAudioPlayer } from "expo-audio";
import correctSound from "../../../assets/sounds/correct.wav";
import { emptyDistance, stabilizeDistance } from "./stability";
import { router, useIsFocused } from "expo-router";
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Camera,
  useCameraDevices,
  useCameraPermission,
  useDepthOutput,
  type CameraDevice,
} from "react-native-vision-camera";
import { createSynchronizable, scheduleOnRN } from "react-native-worklets";
import { Text } from "../../components/ui";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts } from "../../theme";
import { useFullRangeFaces } from "./useFullRangeFaces";
import { distanceCopy as copy } from "./copy";
import { distanceGuidance, personMetres, type FaceTarget } from "./depthDistance";

const resolution = { width: 640, height: 480 };

export function DistanceSetup({ onContinue }: { onContinue: () => void }) {
  const [enabled, setEnabled] = useState(true),
    [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { width, height } = useWindowDimensions();
  const [state, setState] = useState(AppState.currentState);
  const [reading, setReading] = useState<{ value: number | null; at: number; ready: boolean }>();
  const filter = useRef(emptyDistance());
  const lastKnown = useRef(Date.now());
  const played = useRef(false);
  const cue = useAudioPlayer(correctSound);
  const clear = useCallback(() => {
    filter.current = emptyDistance();
    lastKnown.current = Date.now();
    setReading(undefined);
  }, []);
  const [now, setNow] = useState(Date.now());
  const devices = useCameraDevices();
  const front =
    devices.find((d) => d.position === "front" && d.type === "true-depth") ??
    devices.find((d) => d.position === "front");
  const device = front;
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
      clear();
      setNow(Date.now());
      setState(nextState);
    });
    return () => listener.remove();
  }, [clear]);
  useLayoutEffect(() => {
    if (!active) clear();
  }, [active, clear]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    const timeout = setTimeout(() => setFailed(true), 30_000);
    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [active, device?.id, attempt]);
  const fail = useCallback(() => {
    setFailed(true);
    clear();
  }, [clear]);
  const report = useCallback((value: number | null, at: number) => {
    const now = Date.now();
    const next = stabilizeDistance(filter.current, value, at, now);
    if (
      __DEV__ &&
      process.env.EXPO_PUBLIC_LANDMARK_DEBUG === "1" &&
      (next.value !== filter.current.value || next.ready !== filter.current.ready)
    )
      console.info("distance-display", { metres: next.value, ready: next.ready });
    filter.current = next;
    if (next.value !== null) lastKnown.current = now;
    setReading({ value: filter.current.value, ready: filter.current.ready, at });
    setNow(now);
  }, []);
  async function restart() {
    clear();
    played.current = false;
    setFailed(false);
    setEnabled(true);
    setAttempt((value) => value + 1);
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
  const ready = value !== null && !!reading?.ready;
  useEffect(() => {
    if (!ready || !active || played.current) return;
    let cancelled = false;
    void cue
      .seekTo(0)
      .then(() => {
        if (!cancelled) {
          played.current = true;
          cue.play();
        }
      })
      .catch(() => {
        /* Audio failure must not block the manual controls. */
      });
    return () => {
      cancelled = true;
      cue.pause();
    };
  }, [ready, active, cue]);
  const guidance = distanceGuidance(value);
  const headline =
    enabled && (!active || failed)
      ? copy.unavailable
      : guidance === "farther"
        ? copy.farther
        : guidance === "closer"
          ? copy.closer
          : ready
            ? copy.ready
            : value === null && now - lastKnown.current >= 3000
              ? copy.notMeasured
              : copy.measuring;
  const tone = ready ? "#16835E" : guidance === "unknown" ? "#1E293B" : "#CA8A04";
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.top, { height: Math.min(124, height * 0.18) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.back}
            onPress={() => router.back()}
            style={styles.back}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={[styles.preview, { height: Math.min(116, height * 0.17) }]}>
            {active && device && (
              <DepthCamera
                key={`${device.id}:${attempt}`}
                device={device}
                onReading={report}
                onFailure={fail}
              />
            )}
          </View>
        </View>
        <View testID="distance-status" style={[styles.status, { backgroundColor: tone }]}>
          <Text
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            style={[styles.headline, { fontSize: Math.min(52, Math.max(28, width * 0.08)) }]}
          >
            {headline}
          </Text>
          <Text style={styles.metres}>{value === null ? "—" : copy.metres(value)}</Text>
        </View>
        <Text style={styles.help}>{copy.help}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.proceed}
          onPress={onContinue}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>{copy.proceed}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.retry}
          onPress={() => void restart()}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>{copy.retry}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function DepthCamera({
  device,
  onReading,
  onFailure,
}: {
  device: CameraDevice;
  onReading: (value: number | null, at: number) => void;
  onFailure: () => void;
}) {
  const live = useMemo(() => createSynchronizable(true), []);
  const target = useMemo(() => createSynchronizable<FaceTarget | null>(null), []);
  const next = useMemo(() => createSynchronizable(0), []);
  const epoch = useMemo(() => createSynchronizable(0), []);
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
    (
      value: number | null,
      at: number,
      generation: number,
      accuracy?: string,
      quality?: string,
      hasFace?: boolean,
    ) => {
      if (!alive.current || generation !== epoch.getBlocking()) return;
      onReading(value, at);
      if (alive.current && __DEV__ && process.env.EXPO_PUBLIC_LANDMARK_DEBUG === "1")
        console.info("distance-reading", { metres: value, accuracy, quality, hasFace });
    },
    [onReading, epoch],
  );
  const updateTarget = useCallback(
    (face: FaceTarget | null) => {
      if (!alive.current) return;
      const previous = target.getBlocking();
      if (!!face !== !!previous) epoch.setBlocking(epoch.getBlocking() + 1);
      target.setBlocking(face);
      if (!face && previous) onReading(null, Date.now());
    },
    [target, epoch, onReading],
  );
  const face = useFullRangeFaces(updateTarget, fail);
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
        const generation = epoch.getBlocking();
        const faceTarget = target.getBlocking();
        const metres = personMetres(frame, faceTarget, now);
        scheduleOnRN(
          report,
          metres,
          now,
          generation,
          frame.depthDataAccuracy,
          frame.depthDataQuality,
          !!faceTarget,
        );
      } catch {
        scheduleOnRN(report, null, Date.now(), epoch.getBlocking());
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
  screen: { flex: 1, backgroundColor: "#0F1B2D" },
  content: { flexGrow: 1, padding: 16, gap: 12 },
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  back: { minWidth: 44, minHeight: 44, alignItems: "center" },
  backText: { color: "#FFFFFF", fontSize: 36 },
  preview: { width: 88, borderRadius: 16, overflow: "hidden", backgroundColor: "#1E293B" },
  mirrorPreview: { transform: [{ scaleX: -1 }] },
  status: {
    flex: 1,
    minHeight: 160,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  headline: {
    color: "#FFFFFF",
    fontFamily: fonts.black,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: undefined,
  },
  metres: { color: "#FFFFFF", fontFamily: fonts.extraBold, fontSize: 22, textAlign: "center" },
  help: { color: "#CBD5E1", fontSize: 13, lineHeight: 19, textAlign: "center" },
  primary: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: "#2F6FED",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  primaryText: {
    color: "#FFFFFF",
    fontFamily: fonts.black,
    fontWeight: "900",
    textAlign: "center",
  },
  secondary: { minHeight: 44, alignItems: "center", justifyContent: "center", padding: 8 },
  secondaryText: { color: "#D5E2F7", fontFamily: fonts.extraBold, textAlign: "center" },
});
