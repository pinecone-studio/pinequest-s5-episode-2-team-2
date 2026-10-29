import Ionicons from "@expo/vector-icons/Ionicons";
import { useAudioPlayer } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import chime from "../../../assets/sounds/correct.wav";
import { Button, Screen, Text } from "../../components/ui";
import { theme } from "../../theme";
import { addStar, starSummary, type StarSummary } from "../../storage/play";
import { useActiveChildId } from "../children/useActiveChildId";
import { EyeHero } from "../scaffold/EyeHero";
import { exercises, eyeRestCopy as copy, type Exercise } from "./content";
import { QuizGame } from "./QuizGame";
import { quizCopy } from "./quiz";
import { stepAt, totalSeconds } from "./steps";

type Running = { key: string; startedAt: number };
type Card = Pick<Exercise, "key" | "title" | "summary" | "tag" | "tint"> & {
  icon: Exercise["icon"] | "star";
  source?: Exercise["source"];
};

const DAILY_GOAL = 3;
const QUIZ_CARD: Card = {
  key: quizCopy.key,
  title: quizCopy.title,
  summary: quizCopy.summary,
  tag: quizCopy.tag,
  icon: "star",
  tint: { background: "#FFF3D6", foreground: "#B7791F" },
};
// The mockup's order: outdoor hunt, a quick rest, the habit quiz; blinking stays as a bonus.
const CARDS: Card[] = [exercises[0]!, exercises[1]!, QUIZ_CARD, ...exercises.slice(2)];

/** #143 eye-rest breaks, now as small games that earn one star each per day. */
export default function EyeRestScreen() {
  const db = useSQLiteContext();
  const childId = useActiveChildId();
  const [running, setRunning] = useState<Running | null>(null);
  const [quiz, setQuiz] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [stars, setStars] = useState<StarSummary | null>(null);
  const [newStar, setNewStar] = useState(false);

  const reload = useCallback(async () => {
    if (!childId) return setStars(null);
    setStars(await starSummary(db, childId));
  }, [db, childId]);

  useEffect(() => {
    void reload().catch(() => setStars(null));
  }, [reload]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const start = (key: string) => {
    setNewStar(false);
    if (key === quizCopy.key) return setQuiz(true);
    const at = Date.now();
    setNow(at);
    setRunning({ key, startedAt: at });
  };
  const exit = () => {
    setRunning(null);
    setQuiz(false);
  };

  // Stars need a child profile; without one the games still work, nothing is saved.
  const award = useCallback(
    (game: string) => {
      if (!childId) return;
      addStar(db, childId, game)
        .then(async (added) => {
          setNewStar(added);
          await reload();
        })
        .catch(() => setNewStar(false));
    },
    [db, childId, reload],
  );
  const finishQuiz = useCallback(() => award(quizCopy.key), [award]);

  if (quiz) {
    return (
      <Screen>
        <QuizGame onFinish={finishQuiz} onExit={exit} />
        {newStar && <StarEarned />}
      </Screen>
    );
  }

  // #235: a running exercise gets the whole screen, so the child only sees the current step.
  const active = running && exercises.find((exercise) => exercise.key === running.key);
  if (running && active) {
    return (
      <Screen>
        <RunningExercise
          exercise={active}
          elapsedMs={now - running.startedAt}
          onFinish={() => award(active.key)}
          onStop={exit}
          onAgain={() => start(active.key)}
        />
        {newStar && <StarEarned />}
      </Screen>
    );
  }

  const today = Math.min(stars?.today.length ?? 0, DAILY_GOAL);
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header" style={styles.flex}>
          {copy.screenTitle}
        </Text>
        {stars && (
          <View style={styles.badge} accessible accessibilityLabel={copy.stars(stars.total)}>
            <Ionicons name="star" size={18} color="#F5B82E" />
            <Text style={styles.badgeText}>{copy.stars(stars.total)}</Text>
          </View>
        )}
      </View>
      <Hero />
      <View style={styles.daily}>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{copy.dailyTitle}</Text>
          <Text style={styles.cardSummary}>{childId ? copy.dailyBody : copy.dailyNoChild}</Text>
        </View>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={copy.dailyProgress(today, DAILY_GOAL)}
        >
          {Array.from({ length: DAILY_GOAL }, (_, i) => (
            <View key={i} style={[styles.dot, i < today && styles.dotDone]}>
              {i < today && <Ionicons name="star" size={16} color="#FFFFFF" />}
            </View>
          ))}
        </View>
      </View>
      <Text variant="caption" accessibilityRole="header" style={styles.section}>
        {copy.section.toUpperCase()}
      </Text>
      {CARDS.map((card) => (
        <ExerciseCard
          key={card.key}
          card={card}
          done={stars?.today.includes(card.key) ?? false}
          onStart={() => start(card.key)}
        />
      ))}
      <Text variant="caption" style={styles.notice}>
        {copy.notice}
      </Text>
    </Screen>
  );
}

function StarEarned() {
  return (
    <View style={styles.earned} accessibilityLiveRegion="polite">
      <Ionicons name="star" size={22} color="#F5B82E" />
      <Text style={styles.badgeText}>{copy.starEarned}</Text>
    </View>
  );
}

/** Playful banner with the brand eye, so the tab feels like a game rather than a checklist. */
function Hero() {
  return (
    <LinearGradient
      colors={["#7B5BD6", "#A27FDC", "#D3A3E4"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.heroText}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.heroTitle}>
          {copy.heroTitle}
        </Text>
        <Text style={styles.heroSubtitle}>{copy.heroSubtitle}</Text>
      </View>
      <EyeHero size={110} />
    </LinearGradient>
  );
}

function ExerciseCard({ card, done, onStart }: { card: Card; done: boolean; onStart: () => void }) {
  const source = card.source;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${card.title}. ${card.summary}${done ? `. ${copy.doneToday}` : ""}`}
        accessibilityHint={copy.start}
        onPress={onStart}
        style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
      >
        <View
          style={[styles.tile, { backgroundColor: card.tint.background }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons name={card.icon} size={40} color={card.tint.foreground} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{card.title}</Text>
          <Text style={styles.cardSummary}>{card.summary}</Text>
          <Text variant="caption" style={styles.tag}>
            {card.tag}
          </Text>
        </View>
        <Ionicons
          name={done ? "star" : "chevron-forward"}
          size={22}
          color={done ? "#F5B82E" : theme.colors.muted}
        />
      </Pressable>
      {source && (
        <Pressable
          accessibilityRole="link"
          accessibilityHint={source.url}
          onPress={() => void Linking.openURL(source.url)}
          style={styles.source}
        >
          <Text variant="caption" style={styles.sourceText}>
            {copy.sourcePrefix} {source.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function RunningExercise({
  exercise,
  elapsedMs,
  onFinish,
  onStop,
  onAgain,
}: {
  exercise: Exercise;
  elapsedMs: number;
  onFinish: () => void;
  onStop: () => void;
  onAgain: () => void;
}) {
  const state = stepAt(exercise, elapsedMs);
  const cue = useAudioPlayer(chime);

  // A chime on every new step and at the end, so the child can look away from the screen.
  const position = state.done ? "done" : `${state.round}-${state.stepIndex}`;
  const last = useRef(position);
  useEffect(() => {
    if (last.current === position) return;
    last.current = position;
    void cue.seekTo(0);
    cue.play();
    if (position === "done") onFinish();
  }, [position, cue, onFinish]);

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
        style={[styles.circle, { borderColor: exercise.tint.background }]}
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
      {exercise.rounds > 1 || exercise.steps.length > 1 ? (
        <Text variant="caption" style={[styles.unit, styles.center]}>
          {exercise.rounds > 1
            ? copy.round(state.round, exercise.rounds)
            : copy.step(state.stepIndex + 1, exercise.steps.length)}
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
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.shadow,
  },
  badgeText: { fontWeight: "800" },
  daily: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    ...theme.shadow,
  },
  dots: { flexDirection: "row", gap: 6 },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: "#F6E3B4",
    alignItems: "center",
    justifyContent: "center",
  },
  dotDone: { backgroundColor: "#F5B82E", borderColor: "#F5B82E" },
  earned: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF3D6",
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    overflow: "hidden",
  },
  heroText: { flex: 1, gap: theme.spacing.sm },
  heroTitle: { color: "#FFFFFF", fontSize: 28, lineHeight: 34, fontWeight: "900" },
  heroSubtitle: { color: "#FFFFFF", opacity: 0.92 },
  section: { color: "#6A4BC4", letterSpacing: 1, marginTop: theme.spacing.sm },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
    ...theme.shadow,
  },
  cardMain: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  pressed: { opacity: 0.7 },
  tile: {
    width: 76,
    height: 76,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1, gap: theme.spacing.xs },
  cardTitle: { fontSize: 19, lineHeight: 24, fontWeight: "800" },
  cardSummary: { color: theme.colors.muted },
  tag: {
    alignSelf: "flex-start",
    color: "#6A4BC4",
    backgroundColor: "#F0EAFF",
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    overflow: "hidden",
  },
  source: { minHeight: 32, justifyContent: "center" },
  sourceText: { color: theme.colors.muted, textDecorationLine: "underline", fontWeight: "500" },
  notice: { color: theme.colors.muted },
  running: { gap: theme.spacing.md, paddingTop: theme.spacing.lg },
  center: { textAlign: "center" },
  circle: {
    alignSelf: "center",
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 10,
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
