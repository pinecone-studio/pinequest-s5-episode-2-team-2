import { router } from "expo-router";
import { useState } from "react";
import { PixelRatio, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Notice, Screen, Text, Verdict } from "../../components/ui";
import { fonts, theme } from "../../theme";
import {
  decimalAcuity,
  fittingLevels,
  iPhonePointsPerMm,
  needsReferral,
  optotypeSize,
  type AgeGroup,
  type Direction,
} from "./acuity";
import { acuityCopy as copy } from "./copy";
import { CROWDED_UNITS, Optotype } from "./Optotype";
import { SaveAcuityButton } from "./SaveAcuityButton";
import { beginEye, respond, startSession, type Session } from "./session";

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

/** Tumbling-E vision check at 3 m (#139), styled like the web demo (#152). */
export default function AcuityScreen() {
  const { width, height } = useWindowDimensions();
  const pointsPerMm = iPhonePointsPerMm(PixelRatio.get());
  const maxPoints = Math.min(width - 40, height * 0.5);
  const [session, setSession] = useState<Session | null>(null);

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
              onPress={() =>
                setSession(startSession(group, fittingLevels(maxPoints, pointsPerMm), Math.random))
              }
              style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
            >
              <Text style={styles.choiceLabel}>{copy.groups[group]}</Text>
            </Pressable>
          ))}
        </View>
      </Screen>
    );
  }

  if (session.stage === "cover") {
    return (
      <Screen>
        <Text variant="title" accessibilityRole="header">
          {copy.title}
        </Text>
        <Card>
          <Text style={styles.coverText}>{copy.cover(session.eye)}</Text>
          <Button label={copy.ready} onPress={() => setSession(beginEye(session))} />
        </Card>
      </Screen>
    );
  }

  if (session.stage === "result") {
    const right = session.results.right ?? null;
    const left = session.results.left ?? null;
    const refer = needsReferral({ right, left }, session.group);
    return (
      <Screen>
        <Text variant="title" accessibilityRole="header">
          {copy.resultTitle}
        </Text>
        <Verdict
          outcome={refer ? "REFER" : "NO_VISIBLE_SIGN"}
          title={refer ? copy.refer : copy.noSign}
        />
        <Card>
          {(["right", "left"] as const).map((eye) => {
            const v = session.results[eye];
            return (
              <View key={eye} style={styles.row}>
                <Text>{copy.eyeLabel(eye)}</Text>
                <Text style={styles.value}>
                  {v === null || v === undefined ? copy.belowChart : decimalAcuity(v)}
                </Text>
              </View>
            );
          })}
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
      <View style={styles.pad}>
        {ARROWS.map(({ direction, glyph, label, row, col }) => (
          <Pressable
            key={direction}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => answer(direction)}
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
      <Button label={copy.cantSee} variant="outline" onPress={() => answer(null)} />
    </SafeAreaView>
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
  row: { flexDirection: "row", justifyContent: "space-between" },
  value: { fontFamily: fonts.black, fontWeight: "900" },
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
