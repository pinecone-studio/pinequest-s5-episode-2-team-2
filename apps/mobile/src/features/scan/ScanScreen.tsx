import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { useCameraDevice, useCameraPermission } from "react-native-vision-camera";
import { useSQLiteContext } from "expo-sqlite";
import { Button, Card, Screen, Text } from "../../components/ui";
import { theme } from "../../theme";
import { useScanResult } from "./ScanResultContext";
import { ScanCamera } from "./ScanCamera";
import { initialScanState, SCAN_DURATION_MS, scanReducer, torchEnabled } from "./state";
import { useActiveChildId } from "../children/useActiveChildId";
import type { LandmarkFrame } from "../vision/facePipeline";
import { saveSession } from "../../storage/sessions";
import { emptyRecording, finishScan, recordFrame } from "./recorder";
import type { ScanMeta, ScanRecording } from "./recorder";
import { SCAN_POLICY, SCAN_POLICY_VERSION } from "./scanPolicy";
import { resultCopy } from "./resultCopy";

export default function ScanScreen() {
  const [state, dispatch] = useReducer(scanReducer, initialScanState);
  const [appState, setAppState] = useState(AppState.currentState);
  const [ready, setReady] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const permissionPending = useRef(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const focused = useIsFocused();
  const { hasPermission, canRequestPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");
  const { setResult, setEyes } = useScanResult();
  const db = useSQLiteContext();
  const childId = useActiveChildId();
  const scan = useRef<{
    recording: ScanRecording;
    meta: ScanMeta;
    endsAtMs: number;
  } | null>(null);
  const active = focused && appState === "active";
  const showCamera =
    active && hasPermission && !!device && ["idle", "aligning", "scanning"].includes(state.status);

  useLayoutEffect(() => {
    if (
      !active ||
      !hasPermission ||
      !device ||
      !["scanning", "processing"].includes(state.status)
    ) {
      scan.current = null;
    }
  }, [active, hasPermission, device?.id, state.status]);
  useLayoutEffect(
    () => () => {
      scan.current = null;
    },
    [],
  );

  const record = useCallback((frame: LandmarkFrame) => {
    const current = scan.current;
    if (current && performance.now() < current.endsAtMs) {
      current.recording = recordFrame(current.recording, frame);
    }
  }, []);

  function beginScan() {
    if (scan.current || childId === undefined || !active || !ready) return;
    const nowMs = performance.now();
    scan.current = {
      recording: emptyRecording(),
      endsAtMs: nowMs + SCAN_DURATION_MS,
      meta: {
        id: `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
        childId,
        durationMs: SCAN_DURATION_MS,
        modelVersion: "keypoints-local-unversioned",
        policyVersion: SCAN_POLICY_VERSION,
      },
    };
    dispatch({ type: "START", nowMs });
  }

  useFocusEffect(
    useCallback(
      () => () => {
        dispatch({ type: "CANCEL" });
        setReady(false);
      },
      [],
    ),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      setAppState(next);
      if (next !== "active") {
        dispatch({ type: "CANCEL" });
        setReady(false);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    dispatch({ type: "CANCEL" });
    setReady(false);
  }, [hasPermission, device?.id]);

  useEffect(() => {
    if (state.status !== "scanning") return;
    const timer = setInterval(() => dispatch({ type: "TICK", nowMs: performance.now() }), 100);
    return () => clearInterval(timer);
  }, [state.status]);

  useEffect(() => {
    const current = scan.current;
    if (state.status !== "processing" || !active || !current) return;
    let cancelled = false;
    Promise.resolve()
      .then(async () => {
        if (cancelled || scan.current !== current) return;
        const { result, eyes } = finishScan(current.recording, current.meta, SCAN_POLICY);
        await saveSession(db, result);
        if (!cancelled && scan.current === current) {
          setEyes(eyes);
          dispatch({ type: "RESOLVE", result });
        }
      })
      .catch(() => {
        if (!cancelled && scan.current === current) dispatch({ type: "FAIL" });
      });
    return () => {
      cancelled = true;
    };
  }, [state.status, active, db, setEyes]);

  useEffect(() => {
    if (state.status !== "done" || !active) return;
    setResult(state.result);
    router.push("/scan/result");
  }, [state, active, setResult]);

  async function allowCamera() {
    if (permissionPending.current) return;
    permissionPending.current = true;
    setRequestingPermission(true);
    setPermissionError(false);
    try {
      if (canRequestPermission) await requestPermission();
      else await Linking.openSettings();
    } catch {
      setPermissionError(true);
    } finally {
      permissionPending.current = false;
      setRequestingPermission(false);
    }
  }

  const busy = state.status === "scanning" || state.status === "processing";
  const progress =
    state.status === "scanning" ? Math.floor((state.elapsedMs / SCAN_DURATION_MS) * 100) : 0;
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        TODO(copy): Нүдний шалгалт
      </Text>
      <Text>{resultCopy.demo}</Text>
      {!hasPermission ? (
        <Card>
          <Text>TODO(copy): Камер ашиглах зөвшөөрөл шаардлагатай.</Text>
          <Button
            label={
              canRequestPermission
                ? "TODO(copy): Камерын зөвшөөрөл өгөх"
                : "TODO(copy): Тохиргоо нээх"
            }
            onPress={() => void allowCamera()}
            disabled={requestingPermission}
          />
          {permissionError && (
            <Text accessibilityRole="alert">
              TODO(copy): Зөвшөөрөл нээж чадсангүй. Дахин оролдоно уу.
            </Text>
          )}
        </Card>
      ) : !device ? (
        <Text>TODO(copy): Арын камер олдсонгүй.</Text>
      ) : (
        <>
          <View style={styles.preview}>
            {showCamera && (
              <ScanCamera
                key={device.id}
                device={device}
                onFrame={record}
                torchOn={torchEnabled(state, active, device.hasTorch)}
                onReady={() => setReady(true)}
                onFailure={() => {
                  setReady(false);
                  dispatch({ type: "FAIL" });
                }}
              />
            )}
            <View
              pointerEvents="none"
              style={styles.guide}
              accessible
              accessibilityLabel="TODO(copy): Нүүрээ хүрээнд байрлуулна уу"
            />
          </View>
          {!device.hasTorch && (
            <Text>TODO(copy): Энэ камер гэрэлгүй тул шалгалт эхлүүлэх боломжгүй.</Text>
          )}
          {state.status === "idle" && (
            <Button
              label="TODO(copy): Бэлтгэх"
              disabled={!active || !ready || !device.hasTorch}
              onPress={() => {
                setResult(null);
                dispatch({ type: "ALIGN" });
              }}
            />
          )}
          {state.status === "aligning" && (
            <>
              <Text>TODO(copy): Нүүрээ хүрээнд байрлуулаад камераа хөдөлгөөнгүй барина уу.</Text>
              <Button
                label="TODO(copy): 3 секунд шалгах"
                disabled={!active || !ready || !device.hasTorch || childId === undefined}
                onPress={beginScan}
              />
            </>
          )}
          {state.status === "scanning" && (
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: progress }}
              accessibilityLabel="TODO(copy): Шалгалтын явц"
            >
              <Text>TODO(copy): Шалгаж байна — {progress}%</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${progress}%` }]} />
              </View>
            </View>
          )}
          {state.status === "processing" && (
            <>
              <ActivityIndicator />
              <Text accessibilityLiveRegion="polite">
                TODO(copy): Үр дүнг боловсруулж, хадгалж байна.
              </Text>
            </>
          )}
          {state.status === "failed" && (
            <>
              <Text accessibilityRole="alert">
                TODO(copy): Шалгалт тасалдлаа. Дахин оролдоно уу.
              </Text>
              <Button
                label="TODO(copy): Дахин оролдох"
                onPress={() => {
                  setReady(false);
                  dispatch({ type: "RETRY" });
                }}
              />
            </>
          )}
          {(busy || state.status === "aligning") && (
            <Button label="TODO(copy): Цуцлах" onPress={() => dispatch({ type: "CANCEL" })} />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: {
    height: 320,
    overflow: "hidden",
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  guide: {
    width: "68%",
    height: "80%",
    borderWidth: 3,
    borderColor: theme.colors.onPrimary,
    borderRadius: 120,
  },
  track: {
    height: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.border,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: theme.colors.primary },
});
