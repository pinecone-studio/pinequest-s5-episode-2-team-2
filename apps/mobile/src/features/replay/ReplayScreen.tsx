import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import { Directory, File } from "expo-file-system";
import { Button, Card, Screen, Text } from "../../components/ui";
import { guidanceForFrame } from "../scan/guidance";
import type { LandmarkFrame } from "../vision/facePipeline";
import { parseRecording, replayRecording } from "./replay";
import type { Recording } from "./replay";
import { useReplayAnalysis } from "./useReplayAnalysis";

export default function ReplayScreen() {
  return __DEV__ ? <DeveloperReplay /> : <Redirect href="/scan" />;
}

function DeveloperReplay() {
  const [selected, setSelected] = useState<{ directory: Directory; recording: Recording } | null>(
    null,
  );
  const [busy, setBusy] = useState(false),
    [picking, setPicking] = useState(false);
  const [message, setMessage] = useState("");
  const [latest, setLatest] = useState<LandmarkFrame | null>(null);
  const [count, setCount] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const pickPending = useRef(false);
  const analysis = useReplayAnalysis();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useFocusEffect(useCallback(() => () => controller.current?.abort(), []));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") controller.current?.abort();
    });
    return () => subscription.remove();
  }, []);

  async function choose() {
    if (pickPending.current || controller.current) return;
    pickPending.current = true;
    setPicking(true);
    setMessage("");
    try {
      const directory = await Directory.pickDirectoryAsync();
      const manifest = new File(directory, "scan.json");
      if (!manifest.exists || manifest.size > 32000) throw new Error("Invalid recording manifest");
      const recording = parseRecording(JSON.parse(await manifest.text()));
      if (mounted.current) {
        setSelected({ directory, recording });
        setCount(0);
        setLatest(null);
      }
    } catch {
      if (mounted.current) setMessage("Хавтас сонгоогүй эсвэл бичлэгийн формат тохирохгүй байна.");
    } finally {
      pickPending.current = false;
      if (mounted.current) setPicking(false);
    }
  }

  async function start() {
    if (!selected || controller.current) return;
    if (analysis.isBusy()) {
      setMessage("Түр хүлээгээд дахин оролдоно уу.");
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setMessage("");
    setLatest(null);
    setCount(0);
    try {
      const { recording, directory } = selected;
      await replayRecording(
        recording,
        async (name) => {
          const file = new File(directory, name);
          const expected = recording.width * recording.height * 3;
          if (!file.exists || file.size !== expected) throw new Error("Invalid frame byte count");
          const rgb = await file.bytes();
          if (rgb.length !== expected) throw new Error("Truncated frame");
          return {
            format: "rgb",
            width: recording.width,
            height: recording.height,
            stride: recording.width * 3,
            rgb,
          };
        },
        analysis.analyze,
        (frame, used) => {
          if (mounted.current) {
            setLatest(frame);
            setCount(used);
          }
        },
        abort.signal,
      );
      if (mounted.current && !abort.signal.aborted) setMessage("Дахин тоглуулж дууслаа.");
    } catch {
      if (mounted.current && !abort.signal.aborted)
        setMessage("Бичлэгийг боловсруулж чадсангүй. Дахин оролдоно уу.");
    } finally {
      if (controller.current === abort) controller.current = null;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <Screen>
      <Text variant="title">Бичлэг дахин тоглуулах</Text>
      <Text>Хөгжүүлэгчийн туршилт. Зураг илгээхгүй, хадгалахгүй. Нүдний үзлэгийг орлохгүй.</Text>
      <Button
        label="Бичлэгийн хавтас сонгох"
        disabled={busy || picking}
        onPress={() => void choose()}
      />
      {selected && (
        <Card>
          <Text>
            Кадр: {count} / {selected.recording.frames.length}
          </Text>
          <Text accessibilityLiveRegion="polite">{guidanceForFrame(latest)}</Text>
          <Text>Боловсруулалт: {latest ? latest.latencyMs.toFixed(1) : "—"} ms</Text>
          <Button
            label="Дахин тоглуулах"
            disabled={busy || !analysis.ready}
            onPress={() => void start()}
          />
        </Card>
      )}
      {analysis.error && <Text accessibilityRole="alert">Туршилтын модель ачаалагдсангүй.</Text>}
      {busy && (
        <Button
          label="Цуцлах"
          onPress={() => {
            controller.current?.abort();
            setMessage("Цуцалж байна.");
          }}
        />
      )}
      {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
      <Button label="Буцах" onPress={() => router.back()} />
    </Screen>
  );
}
