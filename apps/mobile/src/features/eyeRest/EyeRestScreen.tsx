import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Screen, Text } from "../../components/ui";
import { theme } from "../../theme";
import { exercises, eyeRestCopy as copy, type Exercise } from "./content";
import { stepAt } from "./steps";

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
          {running?.key === exercise.key ? (
            <Countdown
              exercise={exercise}
              elapsedMs={now - running.startedAt}
              onStop={() => setRunning(null)}
              onAgain={() => start(exercise.key)}
            />
          ) : (
            <Button label={copy.start} variant="secondary" onPress={() => start(exercise.key)} />
          )}
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

function Countdown({
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
      <View style={styles.countdown}>
        <Text accessibilityLiveRegion="polite">{copy.done}</Text>
        <Button label={copy.again} variant="outline" onPress={onAgain} />
      </View>
    );
  }
  const step = exercise.steps[state.stepIndex];
  return (
    <View style={styles.countdown}>
      {exercise.rounds > 1 ? (
        <Text variant="caption">{copy.round(state.round, exercise.rounds)}</Text>
      ) : null}
      <Text accessibilityLiveRegion="polite" style={styles.step}>
        {step?.text}
      </Text>
      <Text variant="title">{copy.secondsLeft(state.secondsLeft)}</Text>
      <Button label={copy.stop} variant="outline" onPress={onStop} />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontWeight: "700", color: theme.colors.text },
  countdown: { gap: theme.spacing.xs, alignItems: "stretch" },
  step: { fontWeight: "700" },
  source: { minHeight: 44, justifyContent: "center" },
  sourceText: { color: theme.colors.primary, textDecorationLine: "underline" },
  notice: { color: theme.colors.muted },
});
