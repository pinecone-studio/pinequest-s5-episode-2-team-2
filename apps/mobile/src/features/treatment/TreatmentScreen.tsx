import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Button, Card, Screen, Text } from "../../components/ui";
import { useActiveChildId } from "../children/useActiveChildId";
import {
  getGoal,
  logsForDay,
  setGoal,
  startTimer,
  stopTimer,
  type TreatmentLog,
} from "../../storage/treatment";
import { theme } from "../../theme";
import { treatmentCopy as copy } from "./copy";
import { formatElapsed, newLogId, parseGoalMinutes } from "./format";
import { goalProgress, minutesOnDay, type TreatmentKind } from "./progress";

const KINDS: TreatmentKind[] = ["patch", "glasses"];

export default function TreatmentScreen() {
  const db = useSQLiteContext();
  const childId = useActiveChildId();
  const [kind, setKind] = useState<TreatmentKind>("patch");
  const [goal, setGoalState] = useState<number | null>(null);
  const [goalInput, setGoalInput] = useState("");
  const [logs, setLogs] = useState<TreatmentLog[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!childId) return;
    const [savedGoal, todayLogs] = await Promise.all([
      getGoal(db, childId, kind),
      logsForDay(db, childId, kind, new Date()),
    ]);
    setGoalState(savedGoal);
    setGoalInput(savedGoal ? String(savedGoal) : "");
    setLogs(todayLogs);
    setNow(new Date());
  }, [db, childId, kind]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const running = logs.find((log) => log.endedAt === null) ?? null;

  // Tick once a second only while a timer runs; the stored start time is the source of truth.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [running]);

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await reload();
    } catch {
      setError(copy.failed);
    }
  }

  function saveGoal() {
    const minutes = parseGoalMinutes(goalInput);
    if (minutes === null || !childId) return setError(copy.invalidGoal);
    void act(() => setGoal(db, childId, kind, minutes));
  }

  if (childId === undefined) return null;
  if (childId === null) {
    return (
      <Screen>
        <Text variant="title">{copy.title}</Text>
        <Card>
          <Text>{copy.noChild}</Text>
        </Card>
      </Screen>
    );
  }

  const minutes = minutesOnDay(logs, now, now);
  const progress = goalProgress(minutes, goal);

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {copy.title}
      </Text>

      <View style={styles.kinds} accessibilityRole="tablist">
        {KINDS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: k === kind }}
            onPress={() => setKind(k)}
            style={[styles.kind, k === kind && styles.kindSelected]}
          >
            <Text style={k === kind ? styles.kindSelectedText : undefined}>{copy.kinds[k]}</Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <Text variant="caption">{copy.today}</Text>
        <Text variant="title">
          {copy.minutes(minutes)}
          {goal ? ` / ${goal}` : ""}
        </Text>
        {progress === null ? (
          <Text variant="caption">{copy.noGoal}</Text>
        ) : (
          <View style={styles.track} accessibilityValue={{ min: 0, max: 100, now: progress * 100 }}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
        )}
        {running && (
          <Text accessibilityLiveRegion="polite">
            {copy.running} {formatElapsed(now.getTime() - Date.parse(running.startedAt))}
          </Text>
        )}
        <Button
          label={running ? copy.stop : copy.start}
          onPress={() =>
            void act(() =>
              running ? stopTimer(db, childId, kind) : startTimer(db, newLogId(), childId, kind),
            )
          }
        />
      </Card>

      <Card>
        <Text variant="caption">{copy.goal}</Text>
        <TextInput
          value={goalInput}
          onChangeText={setGoalInput}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={4}
          accessibilityLabel={copy.goal}
          style={styles.input}
        />
        <Button label={copy.saveGoal} onPress={saveGoal} />
      </Card>

      {error && <Text accessibilityRole="alert">{error}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kinds: { flexDirection: "row", gap: theme.spacing.sm },
  kind: {
    flex: 1,
    alignItems: "center",
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  kindSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  kindSelectedText: { color: theme.colors.onPrimary },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.border,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: theme.colors.primary },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    fontSize: 18,
    color: theme.colors.text,
  },
});
