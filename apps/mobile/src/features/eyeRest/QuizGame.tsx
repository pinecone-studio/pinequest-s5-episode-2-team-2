import Ionicons from "@expo/vector-icons/Ionicons";
import { useAudioPlayer } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import correctSound from "../../../assets/sounds/correct.wav";
import wrongSound from "../../../assets/sounds/wrong.wav";
import { Button, Text } from "../../components/ui";
import { theme } from "../../theme";
import { eyeRestCopy } from "./content";
import { quizCopy as copy, quizQuestions, type QuizChoice } from "./quiz";

type Answer = "right" | "wrong" | null;

/** "Зөв зуршил сонгоё": pick the eye-friendly habit of two. Nothing is saved but the star. */
export function QuizGame({ onFinish, onExit }: { onFinish: () => void; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer>(null);
  const correctTone = useAudioPlayer(correctSound);
  const wrongTone = useAudioPlayer(wrongSound);

  const done = index >= quizQuestions.length;
  const finished = useRef(false);
  useEffect(() => {
    if (done && !finished.current) {
      finished.current = true;
      onFinish();
    }
  }, [done, onFinish]);

  const pick = (choice: QuizChoice) => {
    if (answer === "right") return;
    const tone = choice.good ? correctTone : wrongTone;
    void tone.seekTo(0);
    tone.play();
    setAnswer(choice.good ? "right" : "wrong");
  };

  const restart = () => {
    finished.current = false;
    setAnswer(null);
    setIndex(0);
  };

  if (done) {
    return (
      <View style={styles.wrap}>
        <Ionicons name="star" size={72} color="#F5B82E" style={styles.center} />
        <Text variant="title" accessibilityLiveRegion="polite" style={styles.centerText}>
          {copy.done}
        </Text>
        <Button label={copy.again} onPress={restart} />
        <Button label={eyeRestCopy.back} variant="outline" onPress={onExit} />
      </View>
    );
  }

  const question = quizQuestions[index]!;
  return (
    <View style={styles.wrap}>
      <Text variant="caption" style={styles.centerText}>
        {copy.question(index + 1, quizQuestions.length)}
      </Text>
      <Text variant="title" accessibilityRole="header" style={styles.centerText}>
        {copy.prompt}
      </Text>
      <View style={styles.choices}>
        {question.choices.map((choice) => {
          const chosenRight = answer === "right" && choice.good;
          return (
            <Pressable
              key={choice.text}
              accessibilityRole="button"
              accessibilityLabel={choice.text}
              accessibilityState={{ selected: chosenRight }}
              onPress={() => pick(choice)}
              style={({ pressed }) => [
                styles.choice,
                chosenRight && styles.choiceRight,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name={choice.icon} size={48} color={theme.colors.primary} />
              <Text style={styles.choiceText}>{choice.text}</Text>
            </Pressable>
          );
        })}
      </View>

      {answer && (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.feedback, answer === "right" ? styles.right : styles.wrong]}
        >
          {answer === "right" ? copy.right : copy.wrong}
        </Text>
      )}
      {answer === "right" && (
        <>
          <Text style={styles.centerText}>{question.why}</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityHint={question.source.url}
            onPress={() => void Linking.openURL(question.source.url)}
          >
            <Text variant="caption" style={styles.source}>
              {eyeRestCopy.sourcePrefix} {question.source.label}
            </Text>
          </Pressable>
          <Button
            label={copy.next}
            onPress={() => {
              setAnswer(null);
              setIndex((i) => i + 1);
            }}
          />
        </>
      )}
      <Button label={eyeRestCopy.stop} variant="outline" onPress={onExit} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing.md, paddingTop: theme.spacing.lg },
  center: { alignSelf: "center" },
  centerText: { textAlign: "center" },
  choices: { flexDirection: "row", gap: theme.spacing.md },
  choice: {
    flex: 1,
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 3,
    borderColor: "transparent",
    backgroundColor: theme.colors.surface,
    ...theme.shadow,
  },
  choiceRight: { borderColor: "#2E9E5B", backgroundColor: "#EEFAF4" },
  pressed: { opacity: 0.7 },
  choiceText: { textAlign: "center", fontWeight: "700" },
  feedback: { textAlign: "center", fontSize: 20, lineHeight: 28, fontWeight: "800" },
  right: { color: "#17734B" },
  wrong: { color: "#B23A35" },
  source: { textAlign: "center", color: theme.colors.muted, textDecorationLine: "underline" },
});
