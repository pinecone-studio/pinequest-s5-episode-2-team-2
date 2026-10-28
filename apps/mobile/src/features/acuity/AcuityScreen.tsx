import { useAudioPlayer } from "expo-audio";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { PixelRatio, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Notice, Screen, Text, Verdict } from "../../components/ui";
import { fonts, theme } from "../../theme";
import correctSound from "../../../assets/sounds/correct.wav";
import wrongSound from "../../../assets/sounds/wrong.wav";
import {
  decimalAcuity,
  fittingLevels,
  iPhonePointsPerMm,
  LEVELS,
  minusRange,
  needsReferral,
  optotypeSize,
  PASS_LINE,
  type AgeGroup,
  type Direction,
} from "./acuity";
import { acuityCopy as copy } from "./copy";
import { CROWDED_UNITS, Optotype } from "./Optotype";
import { AcuityGestureInput } from "./AcuityGestureInput";
import { SaveAcuityButton } from "./SaveAcuityButton";
import {
  beginEye,
  endPractice,
  practise,
  PRACTICE_CORRECT,
  respond,
  startSession,
  type Session,
} from "./session";

const GROUPS: AgeGroup[] = ["child3", "child4", "child5", "adult"];
// Arrow pad laid out as a cross, as in the web demo: up on top, left and right, down below.
const ARROWS: { direction: Direction; glyph: string; label: string; row: number; col: number }[] = [
  { direction: 270, glyph: "↑", label: copy.up, row: 0, col: 1 },
  { direction: 180, glyph: "←", label: copy.left, row: 1, col: 0 },
  { direction: 0, glyph: "→", label: copy.right, row: 1, col: 2 },
  { direction: 90, glyph: "↓", label: copy.down, row: 2, col: 1 },
];
const KEY = 72;
const GAP = 6;

/** Tumbling-E vision check at 3 m (#139), following the web demo's flow and wording (#152). */
export default function AcuityScreen() {
  const { width, height } = useWindowDimensions();
  const pointsPerMm = iPhonePointsPerMm(PixelRatio.get());
  const maxPoints = Math.min(width - 40, height * 0.5);
  const [session, setSession] = useState<Session | null>(null);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  // As in the web demo: a high tone for a correct practice answer, a low one for a wrong one.
  // The test itself stays silent, so it does not tell the child which answers were right.
  const correctTone = useAudioPlayer(correctSound);
  const wrongTone = useAudioPlayer(wrongSound);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const play = (tone: typeof correctTone) => {
    void tone.seekTo(0);
    tone.play();
  };

  const practiceAnswer = (shown: Direction | null) => {
    if (!session || session.stage !== "practice" || session.practiceCorrect >= PRACTICE_CORRECT)
      return;
    const next = practise(session, shown, Math.random);
    if (shown === session.direction) {
      play(correctTone);
      if (next.practiceCorrect >= PRACTICE_CORRECT) {
        setFeedback(copy.practice.great);
        later(() => {
          setFeedback(null);
          setSession((current) =>
            current?.stage === "practice" && current.practiceCorrect >= PRACTICE_CORRECT
              ? endPractice(current)
              : current,
          );
        }, 1500);
      } else {
        setFeedback(copy.practice.correct);
      }
    } else {
      play(wrongTone);
      setFeedback(copy.practice.wrong);
    }
    setSession(next);
  };
  const input = (manual: React.ReactNode) =>
    session && (
      <AcuityGestureInput
        round={`${session.stage}:${session.eye}:${session.direction}:${session.practiceCorrect}:${session.test.level}:${session.test.shown}`}
        cover={session.stage === "cover"}
        enabled={gestureEnabled}
        setEnabled={setGestureEnabled}
        onAnswer={(shown) => {
          if (shown === "ready") setSession((current) => (current ? beginEye(current) : current));
          else if (session.stage === "practice") practiceAnswer(shown);
          else setSession((current) => (current ? respond(current, shown, Math.random) : current));
        }}
        manual={manual}
      />
    );

  if (!session) {
    return (
      <Screen>
        <Text variant="title" accessibilityRole="header">
          {copy.title}
        </Text>
        <Text>{copy.setup}</Text>
        <Text style={styles.section}>{copy.who}</Text>
        <View style={styles.choices}>
          {GROUPS.map((group) => (
            <Pressable
              key={group}
              accessibilityRole="button"
              accessibilityLabel={copy.groups[group]}
              onPress={() => {
                setFeedback(null);
                setSession(startSession(group, fittingLevels(maxPoints, pointsPerMm), Math.random));
              }}
              style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
            >
              <Text style={styles.choiceLabel}>{copy.groups[group]}</Text>
            </Pressable>
          ))}
        </View>
        <Notice>{copy.under3}</Notice>
      </Screen>
    );
  }

  if (session.stage === "practice") {
    // The largest letter that fits; practice is about answering, not the size.
    const size = Math.min(width - 40, height * 0.3, optotypeSize(LEVELS[0], pointsPerMm));

    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.test}>
        <View style={styles.top}>
          <Text style={styles.topText}>{copy.practice.title}</Text>
        </View>
        <Text>{copy.practice.intro}</Text>
        <View style={styles.letter}>
          <Optotype size={size} direction={session.direction} crowded={false} />
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.feedback}>
          {feedback ?? " "}
        </Text>
        {input(<ArrowPad onAnswer={practiceAnswer} />)}
        <Button
          label={copy.practice.skip}
          variant="link"
          onPress={() => {
            setFeedback(null);
            setSession(endPractice(session));
          }}
        />
      </SafeAreaView>
    );
  }

  if (session.stage === "cover") {
    return (
      <Screen>
        <Text variant="title" accessibilityRole="header">
          {copy.eyeLabel(session.eye)}
        </Text>
        <Card>
          <Text style={styles.coverText}>{copy.cover(session.eye)}</Text>
          <Text>{copy.coverHow}</Text>
          {input(<Button label={copy.ready} onPress={() => setSession(beginEye(session))} />)}
        </Card>
      </Screen>
    );
  }

  if (session.stage === "result") {
    const right = session.results.right ?? null;
    const left = session.results.left ?? null;
    const refer = needsReferral({ right, left }, session.group);
    const verdict = refer ? copy.refer : copy.noSign;
    const anyMinus = minusRange(right) !== null || minusRange(left) !== null;
    return (
      <Screen>
        <Text variant="title" accessibilityRole="header">
          {copy.resultTitle}
        </Text>
        <Verdict outcome={refer ? "REFER" : "NO_VISIBLE_SIGN"} title={verdict.title}>
          <Text>{verdict.body}</Text>
        </Verdict>
        <Card>
          {(["right", "left"] as const).map((eye) => {
            const v = session.results[eye] ?? null;
            const minus = minusRange(v);
            return (
              <View key={eye} style={styles.row}>
                <Text>{copy.eyeLabel(eye)}</Text>
                <View style={styles.rowValue}>
                  <Text style={styles.value}>
                    {v === null ? copy.belowChart : decimalAcuity(v)}
                  </Text>
                  {minus && (
                    <Text variant="caption" style={styles.minus}>
                      {copy.minusPrefix} {minus === "below" ? copy.minusBelow : minus}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
          <Text variant="caption">{copy.scaleHint}</Text>
          {anyMinus && <Text variant="caption">{copy.minusNote}</Text>}
        </Card>
        <Card>
          <Text style={styles.section}>{copy.whatNext}</Text>
          {verdict.next.map((line) => (
            <Text key={line}>• {line}</Text>
          ))}
        </Card>
        <Card>
          <Text style={styles.section}>{copy.details}</Text>
          <Text variant="caption">{copy.method(decimalAcuity(PASS_LINE[session.group]))}</Text>
        </Card>
        <Notice>{copy.notice}</Notice>
        <SaveAcuityButton check={{ group: session.group, right, left, refer }} />
        <Button label={copy.again} variant="outline" onPress={() => setSession(null)} />
        <Button label={copy.done} variant="link" onPress={() => router.back()} />
      </Screen>
    );
  }

  const letter = optotypeSize(session.levels[session.test.level]!, pointsPerMm);
  const crowded = (letter * CROWDED_UNITS) / 5 <= maxPoints;
  const answer = (shown: Direction | null) => setSession(respond(session, shown, Math.random));
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.test}>
      <View style={styles.top}>
        <Text style={styles.topText}>{copy.eyeLabel(session.eye)}</Text>
        <Text style={styles.topText}>
          {copy.progress(session.test.level + 1, session.levels.length)}
        </Text>
      </View>
      <View style={styles.letter}>
        <Optotype size={letter} direction={session.direction} crowded={crowded} />
      </View>
      {input(<ArrowPad onAnswer={answer} />)}
      <Button label={copy.cantSee} variant="outline" onPress={() => answer(null)} />
    </SafeAreaView>
  );
}

function ArrowPad({ onAnswer }: { onAnswer: (direction: Direction) => void }) {
  return (
    <View style={styles.pad}>
      {ARROWS.map(({ direction, glyph, label, row, col }) => (
        <Pressable
          key={direction}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => onAnswer(direction)}
          style={({ pressed }) => [
            styles.arrow,
            { top: row * (KEY + GAP), left: col * (KEY + GAP) },
            pressed && styles.arrowPressed,
          ]}
        >
          <Text style={styles.glyph}>{glyph}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fonts.black, fontWeight: "900", fontSize: 16 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  choice: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
  },
  choicePressed: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  choiceLabel: {
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
  },
  coverText: { fontFamily: fonts.bold, fontWeight: "700", fontSize: 17, lineHeight: 24 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.sm },
  rowValue: { alignItems: "flex-end", flexShrink: 1 },
  value: { fontFamily: fonts.black, fontWeight: "900", textAlign: "right" },
  minus: { color: theme.colors.muted, textAlign: "right" },
  // Large enough to read from 3 m, as the web demo's feedback line.
  feedback: {
    fontFamily: fonts.black,
    fontWeight: "900",
    fontSize: 28,
    textAlign: "center",
    color: theme.colors.primary,
  },
  // Plain white, no other content near the letter, as for a printed chart.
  test: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
    alignItems: "stretch",
  },
  top: { flexDirection: "row", justifyContent: "space-between", paddingTop: theme.spacing.sm },
  topText: { fontFamily: fonts.extraBold, fontWeight: "800", color: theme.colors.muted },
  letter: { flex: 1, alignItems: "center", justifyContent: "center" },
  pad: { alignSelf: "center", width: 3 * KEY + 2 * GAP, height: 3 * KEY + 2 * GAP },
  arrow: {
    position: "absolute",
    width: KEY,
    height: KEY,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
  },
  arrowPressed: { backgroundColor: theme.colors.border },
  glyph: { fontFamily: fonts.black, fontWeight: "900", fontSize: 32, color: theme.colors.primary },
});
