import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Screen, Text } from "../../components/ui";
import { theme } from "../../theme";
import { exercises, eyeRestCopy as copy, type Exercise } from "./content";
import { stepAt, totalSeconds } from "./steps";

type Running = { key: string; startedAt: number };

/** #143: short eye-rest breaks with a step-by-step countdown. Nothing is saved. */
export default function EyeRestScreen() {
  const [running, setRunning] = useState<Running | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const start = (key: string) => {
    const at = Date.now();
    setNow(at);
    setRunning({ key, startedAt: at });
  };

  // #235: a running exercise gets the whole screen, so the child only sees the current step.
  const active = running && exercises.find((exercise) => exercise.key === running.key);
  if (running && active) {
    return (
      <Screen>
        <RunningExercise
          exercise={active}
          elapsedMs={now - running.startedAt}
          onStop={() => setRunning(null)}
          onAgain={() => start(active.key)}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {copy.title}
      </Text>
      {exercises.map((exercise) => (
        <Card key={exercise.key}>
          <Text variant="caption" accessibilityRole="header" style={styles.heading}>
            {exercise.title}
          </Text>
          <Text>{exercise.summary}</Text>
          <Button label={copy.start} variant="secondary" onPress={() => start(exercise.key)} />
          <Pressable
            accessibilityRole="link"
            accessibilityHint={exercise.source.url}
            onPress={() => void Linking.openURL(exercise.source.url)}
            style={styles.source}
          >
            <Text variant="caption" style={styles.sourceText}>
              {copy.sourcePrefix} {exercise.source.label}
            </Text>
          </Pressable>
        </Card>
      ))}
      <Text variant="caption" style={styles.notice}>
        {copy.notice}
      </Text>
    </Screen>
  );
}

function RunningExercise({
  exercise,
  elapsedMs,
  onStop,
  onAgain,
}: {
  exercise: Exercise;
  elapsedMs: number;
  onStop: () => void;
  onAgain: () => void;
}) {
  const state = stepAt(exercise, elapsedMs);

  if (state.done) {
    return (
      <View style={styles.running}>
        <Text variant="title" accessibilityRole="header" style={styles.center}>
          {exercise.title}
        </Text>
        <Text accessibilityLiveRegion="polite" style={[styles.instruction, styles.center]}>
          {copy.done}
        </Text>
        <Button label={copy.again} onPress={onAgain} />
        <Button label={copy.back} variant="outline" onPress={onStop} />
      </View>
    );
  }

  const step = exercise.steps[state.stepIndex];
  const total = totalSeconds(exercise);
  const percent = Math.min(100, Math.round((elapsedMs / 1000 / total) * 100));

  return (
    <View style={styles.running}>
      <Text variant="title" accessibilityRole="header" style={styles.center}>
        {exercise.title}
      </Text>

      {/* Big number in a soft circle: readable from arm's length while the child looks away. */}
      <View
        style={styles.circle}
        accessible
        accessibilityLabel={copy.secondsLeft(state.secondsLeft)}
      >
        <Text variant="title" style={styles.bigNumber}>
          {state.secondsLeft}
        </Text>
        <Text variant="caption" style={styles.unit}>
          {copy.secondsUnit}
        </Text>
      </View>

      <Text accessibilityLiveRegion="polite" style={[styles.instruction, styles.center]}>
        {step?.text}
      </Text>
      {exercise.rounds > 1 ? (
        <Text variant="caption" style={[styles.unit, styles.center]}>
          {copy.round(state.round, exercise.rounds)}
        </Text>
      ) : null}

      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel={copy.progress}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
      >
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>

      <Button label={copy.stop} onPress={onStop} />
    </View>
  );
}

const CIRCLE = 180;

const styles = StyleSheet.create({
  heading: { fontWeight: "700", color: theme.colors.text },
  source: { minHeight: 44, justifyContent: "center" },
  sourceText: { color: theme.colors.primary, textDecorationLine: "underline" },
  notice: { color: theme.colors.muted },
  running: { gap: theme.spacing.md, paddingTop: theme.spacing.lg },
  center: { textAlign: "center" },
  circle: {
    alignSelf: "center",
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 10,
    borderColor: theme.colors.primarySoft,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: theme.spacing.md,
  },
  bigNumber: { fontSize: 64, lineHeight: 72, color: theme.colors.primary },
  unit: { color: theme.colors.muted },
  instruction: { fontSize: 20, lineHeight: 28, fontWeight: "700" },
  track: {
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: theme.colors.primary },
});
