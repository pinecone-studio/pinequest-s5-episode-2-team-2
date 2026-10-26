import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useIsFocused } from "expo-router";
import { useCameraDevice, useCameraPermission } from "react-native-vision-camera";
import { mockScanResult } from "@app/core";
import { Button, Card, Screen, Text } from "../../components/ui";
import { theme } from "../../theme";
import { useScanResult } from "./ScanResultContext";
import { ScanCamera } from "./ScanCamera";
import { initialScanState, SCAN_DURATION_MS, scanReducer, torchEnabled } from "./state";

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
  const { setResult } = useScanResult();
  const active = focused && appState === "active";
  const showCamera =
    active && hasPermission && !!device && ["idle", "aligning", "scanning"].includes(state.status);

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
    if (state.status !== "processing" || !active) return;
    let cancelled = false;
    Promise.resolve()
      .then(() =>
        mockScanResult("RETAKE", {
          id: `mock-${Date.now()}`,
          createdAt: new Date().toISOString(),
          childId: null,
          durationMs: SCAN_DURATION_MS,
        }),
      )
      .then((result) => {
        if (!cancelled) dispatch({ type: "RESOLVE", result });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "FAIL" });
      });
    return () => {
      cancelled = true;
    };
  }, [state.status, active]);

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
      <Text>
        TODO(copy): Туршилтын горим. Нүүрний байрлал илрүүлнэ. Үр дүн нь жишээ. Зураг хадгалахгүй.
      </Text>
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
                disabled={!active || !ready || !device.hasTorch}
                onPress={() => dispatch({ type: "START", nowMs: performance.now() })}
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
              <Text accessibilityLiveRegion="polite">TODO(copy): Жишээ үр дүн бэлтгэж байна.</Text>
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
