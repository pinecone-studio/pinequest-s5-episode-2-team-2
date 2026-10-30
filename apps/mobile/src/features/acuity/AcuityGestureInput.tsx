import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useIsFocused } from "expo-router";
import { AppState, Linking, StyleSheet, View } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  type CameraDevice,
} from "react-native-vision-camera";
import { Button, Text } from "../../components/ui";
import { acuityCopy as copy } from "./copy";
import { openPalm, pointing, thumbsUp } from "./gestures";
import { emptyHold, holdGesture, type Gesture, type GestureAnswer } from "./gestureHold";
import { useGestureFrames, type GestureFrame } from "./useGestureFrames";

interface Props {
  round: string;
  cover: boolean;
  onAnswer: (answer: GestureAnswer) => void;
  /** Shown only when the camera cannot answer: no permission, no camera, a failure or a pause. */
  manual: ReactNode;
  /** Answers for both ways, e.g. "can't see": right below the camera or the arrows. */
  actions?: ReactNode;
}
/** The child answers with the front camera; touch is the fallback when it cannot run. */
export function AcuityGestureInput(props: Props) {
  const [state, setState] = useState(AppState.currentState);
  const [failed, setFailed] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [asked, setAsked] = useState(false);
  const focused = useIsFocused();
  const device = useCameraDevice("front");
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const running = focused && state === "active" && hasPermission && !!device && !failed;
  useEffect(() => {
    const listener = AppState.addEventListener("change", setState);
    return () => listener.remove();
  }, []);
  // Avoid unattended inference when a hand is not being recognised. Each answer renews it.
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setFailed(true), 30_000);
    return () => clearTimeout(timer);
  }, [running, props.round]);
  const fail = useCallback(() => setFailed(true), []);
  async function enable() {
    if (requesting) return;
    setRequesting(true);
    setAsked(true);
    setFailed(false);
    try {
      if (!hasPermission) {
        if (canRequestPermission) await requestPermission();
        else await Linking.openSettings();
      }
    } catch {
      setFailed(true);
    } finally {
      setRequesting(false);
    }
  }
  // The camera is the way to answer, so ask for it as soon as the test opens.
  useEffect(() => {
    if (!hasPermission && canRequestPermission && !asked) void enable();
  });
  const blocked =
    failed || !device || (!hasPermission && !requesting && (asked || !canRequestPermission));
  return (
    <View style={styles.input}>
      {running && device ? (
        <GestureCamera {...props} device={device} onFailure={fail} />
      ) : (
        props.manual
      )}
      {props.actions}
      {blocked && <Text>{copy.gesture.unavailable}</Text>}
      {blocked && (
        <Button
          label={copy.gesture.retry}
          variant="outline"
          onPress={() => void enable()}
          disabled={requesting}
        />
      )}
    </View>
  );
}

function GestureCamera({
  device,
  round,
  cover,
  onAnswer,
  onFailure,
}: Props & { device: CameraDevice; onFailure: () => void }) {
  const [started, setStarted] = useState(false),
    [preview, setPreview] = useState(false);
  const [gesture, setGesture] = useState<Gesture>("noBody");
  const accepting = useRef(false);
  const live = useRef(true),
    hold = useRef(emptyHold()),
    listener = useRef(onAnswer);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    hold.current = emptyHold();
    setGesture("noBody");
  }, [round]);
  useLayoutEffect(() => {
    listener.current = onAnswer;
  }, [onAnswer]);
  const fail = useCallback(() => {
    if (live.current) onFailure();
  }, [onFailure]);
  const report = useCallback(
    (frame: GestureFrame) => {
      if (!live.current || !accepting.current) return;
      const hand = frame.hand;
      const value: Gesture = !frame.body
        ? "noBody"
        : !hand.length
          ? "none"
          : cover
            ? thumbsUp(hand, 256, 256)
              ? "ready"
              : "none"
            : openPalm(hand, 256, 256)
              ? "palm"
              : (pointing(hand, 256, 256) ?? "other");
      setGesture(value);
      const step = holdGesture(hold.current, value, frame.timestampMs, cover);
      hold.current = step.hold;
      if (step.answer !== null) listener.current(step.answer);
      if (__DEV__ && process.env.EXPO_PUBLIC_LANDMARK_DEBUG === "1")
        console.info("gesture-frame", {
          timestampMs: frame.timestampMs,
          latencyMs: frame.latencyMs,
          body: frame.body,
          handPoints: hand.length,
          gesture: value,
          armed: step.hold.armed,
          answer: step.answer,
          ...frame.diagnostics,
        });
    },
    [cover],
  );
  const { output, ready } = useGestureFrames(round, report, fail);
  useLayoutEffect(() => {
    accepting.current = started && preview && ready;
  }, [started, preview, ready]);
  const icon =
    !cover && !hold.current.armed
      ? "✋"
      : typeof gesture === "number"
        ? ({ 0: "→", 90: "↓", 180: "←", 270: "↑" } as const)[gesture]
        : gesture === "ready"
          ? "👍"
          : gesture === "palm"
            ? "✋"
            : "·";
  return (
    <View style={styles.panel}>
      <View style={styles.preview}>
        <Camera
          style={[StyleSheet.absoluteFill, styles.mirrorPreview]}
          device={device}
          isActive
          mirrorMode="off"
          outputs={[output]}
          onStarted={() => {
            if (live.current) setStarted(true);
          }}
          onPreviewStarted={() => {
            if (live.current) setPreview(true);
          }}
          onStopped={fail}
          onPreviewStopped={fail}
          onError={fail}
          onInterruptionStarted={fail}
        />
      </View>
      <View style={styles.hint}>
        <Text accessibilityLiveRegion="polite" style={styles.icon}>
          {icon}
        </Text>
        <Text>
          {!started || !preview || !ready
            ? copy.gesture.loading
            : gesture === "noBody"
              ? copy.gesture.noBody
              : cover
                ? copy.gesture.thumb
                : copy.gesture.point}
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  mirrorPreview: { transform: [{ scaleX: -1 }] },
  input: { gap: 8 },
  panel: { flexDirection: "row", gap: 12, alignItems: "center" },
  preview: { width: 72, height: 96, overflow: "hidden", borderRadius: 12, backgroundColor: "#111" },
  hint: { flex: 1 },
  icon: { fontSize: 38, textAlign: "center" },
});
