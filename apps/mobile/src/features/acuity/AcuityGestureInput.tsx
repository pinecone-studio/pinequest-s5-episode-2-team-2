import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router";
import { AppState, Linking, StyleSheet, View } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  type CameraDevice,
} from "react-native-vision-camera";
import { Button, Text } from "../../components/ui";
import type { Eye } from "./acuity";
import { acuityCopy as copy } from "./copy";
import { coverOk, emptyCover, readCover, UNCOVERED_GRACE_MS, type CoverState } from "./cover";
import { fist, openPalm, pointing, thumbsUp } from "./gestures";
import { emptyHold, holdGesture, type Gesture, type GestureAnswer } from "./gestureHold";
import { useGestureFrames, type GestureFrame } from "./useGestureFrames";

const ARROW = { 0: "→", 90: "↓", 180: "←", 270: "↑" } as const;

/** What the camera sees, for the cover status, the pause note and the arrow highlight. */
export interface GestureStatus {
  cover: CoverState;
  paused: boolean;
  detected: GestureAnswer | null;
}
interface Props {
  round: string;
  /** The cover screen, where a thumbs-up means ready. */
  cover: boolean;
  /** The eye being tested, whose other eye must be covered; null in practice. */
  eye: Eye | null;
  onAnswer: (answer: GestureAnswer) => void;
  onStatus?: (status: GestureStatus | null) => void;
}
/** The person answers with the front camera; the screen's buttons keep working, as in the web demo. */
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
      {running && device && <GestureCamera {...props} device={device} onFailure={fail} />}
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
  eye,
  onAnswer,
  onStatus,
  onFailure,
}: Props & { device: CameraDevice; onFailure: () => void }) {
  const [started, setStarted] = useState(false),
    [preview, setPreview] = useState(false);
  // The last hold, for the hint, and a short "✓" after each answer, as in the web demo.
  const [shown, setShown] = useState<{
    armed: boolean;
    candidate: GestureAnswer | null;
    paused: boolean;
  }>({ armed: false, candidate: null, paused: false });
  const [recorded, setRecorded] = useState(false);
  const accepting = useRef(false);
  const live = useRef(true),
    hold = useRef(emptyHold()),
    listener = useRef(onAnswer),
    statusListener = useRef(onStatus),
    status = useRef<GestureStatus | null>(null);
  // The other eye's cover, smoothed over readings, and since when it has been open.
  const covered = useRef(emptyCover()),
    uncoveredSince = useRef<number | null>(null);
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      statusListener.current?.(null);
    };
  }, []);
  useLayoutEffect(() => {
    hold.current = emptyHold();
    setShown({ armed: false, candidate: null, paused: false });
  }, [round]);
  useLayoutEffect(() => {
    covered.current = emptyCover();
    uncoveredSince.current = null;
  }, [eye, cover]);
  useEffect(() => {
    if (!recorded) return;
    const timer = setTimeout(() => setRecorded(false), 500);
    return () => clearTimeout(timer);
  }, [recorded]);
  useLayoutEffect(() => {
    listener.current = onAnswer;
    statusListener.current = onStatus;
  }, [onAnswer, onStatus]);
  const fail = useCallback(() => {
    if (live.current) onFailure();
  }, [onFailure]);
  const report = useCallback(
    (frame: GestureFrame) => {
      if (!live.current || !accepting.current) return;
      const now = frame.timestampMs;
      if (eye && frame.cover) covered.current = readCover(covered.current, frame.cover);
      const coverShown = eye ? covered.current.shown : "noBody";
      const ok = coverOk(coverShown);
      // As in the web demo, the thumbs-up only counts with the other eye covered, and during the
      // test an eye open for over a second pauses answers.
      uncoveredSince.current = ok ? null : (uncoveredSince.current ?? now);
      const paused =
        !cover &&
        uncoveredSince.current !== null &&
        now - uncoveredSince.current >= UNCOVERED_GRACE_MS;
      const hand = cover && !ok ? [] : frame.hand;
      // As in the web demo: an open palm is "can't see", a fist arms the next answer.
      const value: Gesture = !hand.length
        ? frame.body
          ? "none"
          : "noBody"
        : cover
          ? thumbsUp(hand, 256, 256)
            ? "ready"
            : "other"
          : openPalm(hand, 256, 256)
            ? "palm"
            : fist(hand, 256, 256)
              ? "fist"
              : (pointing(hand, 256, 256) ?? "other");
      const step = holdGesture(hold.current, value, now, cover, paused);
      hold.current = step.hold;
      setShown({ armed: step.hold.armed, candidate: step.hold.candidate, paused });
      const next = { cover: coverShown, paused, detected: step.hold.candidate };
      const last = status.current;
      if (
        !last ||
        last.cover !== next.cover ||
        last.paused !== next.paused ||
        last.detected !== next.detected
      ) {
        status.current = next;
        statusListener.current?.(next);
      }
      if (step.answer !== null) {
        setRecorded(true);
        listener.current(step.answer);
      }
      if (__DEV__ && process.env.EXPO_PUBLIC_LANDMARK_DEBUG === "1")
        console.info("gesture-frame", {
          timestampMs: frame.timestampMs,
          latencyMs: frame.latencyMs,
          body: frame.body,
          handPoints: hand.length,
          gesture: value,
          cover: frame.cover,
          paused,
          armed: step.hold.armed,
          answer: step.answer,
          ...frame.diagnostics,
        });
    },
    [cover, eye],
  );
  const { output, ready } = useGestureFrames(round, report, fail, eye);
  useLayoutEffect(() => {
    accepting.current = started && preview && ready;
  }, [started, preview, ready]);
  const loading = !started || !preview || !ready;
  // The web demo's feedback: ⏸ while paused, ✊ to arm, 👉 to point, the arrow while holding,
  // ✓ when recorded.
  const [icon, hint] = loading
    ? ["·", copy.gesture.loading]
    : recorded
      ? ["✓", copy.gesture.done]
      : cover
        ? ["👍", copy.gesture.thumb]
        : shown.paused
          ? ["⏸", copy.gesture.cover]
          : !shown.armed
            ? ["✊", copy.gesture.fist]
            : shown.candidate === "cant"
              ? ["✋", copy.gesture.cant]
              : typeof shown.candidate === "number"
                ? [ARROW[shown.candidate], copy.gesture.hold]
                : ["👉", copy.gesture.point];
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
        <Text style={styles.hintText}>{hint}</Text>
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
  // Big enough to read from 3 m, like the web demo's feedback.
  hintText: { fontSize: 20, lineHeight: 26, fontWeight: "800", textAlign: "center" },
});
