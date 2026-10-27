import { router } from "expo-router";
import { useState } from "react";
import { PixelRatio, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Button, Card, Screen, Text } from "../../components/ui";
import { theme } from "../../theme";
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
const ARROWS: { direction: Direction; glyph: string; label: string }[] = [
  { direction: 270, glyph: "↑", label: copy.up },
  { direction: 180, glyph: "←", label: copy.left },
  { direction: 0, glyph: "→", label: copy.right },
  { direction: 90, glyph: "↓", label: copy.down },
];

/** Tumbling-E vision check at 3 m (#139). A parent taps the direction the child shows. */
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
        <Text style={styles.label}>{copy.who}</Text>
        {GROUPS.map((group) => (
          <Button
            key={group}
            label={copy.groups[group]}
            onPress={() =>
              setSession(startSession(group, fittingLevels(maxPoints, pointsPerMm), Math.random))
            }
          />
        ))}
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
          <Text>{copy.cover(session.eye)}</Text>
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
          <Text style={styles.label}>{refer ? copy.refer : copy.noSign}</Text>
          <Text variant="caption" style={styles.muted}>
            {copy.notice}
          </Text>
        </Card>
        <SaveAcuityButton check={{ group: session.group, right, left, refer }} />
        <Button label={copy.again} onPress={() => setSession(null)} />
        <Button label={copy.done} onPress={() => router.back()} />
      </Screen>
    );
  }

  const letter = optotypeSize(session.levels[session.test.level]!, pointsPerMm);
  const crowded = (letter * CROWDED_UNITS) / 5 <= maxPoints;
  const answer = (shown: Direction | null) => setSession(respond(session, shown, Math.random));
  return (
    <View style={styles.test}>
      <Text variant="caption" style={styles.muted}>
        {copy.eyeLabel(session.eye)} ·{" "}
        {copy.progress(session.test.level + 1, session.levels.length)}
      </Text>
      <View style={styles.letter}>
        <Optotype size={letter} direction={session.direction} crowded={crowded} />
      </View>
      <View style={styles.arrows}>
        {ARROWS.map(({ direction, glyph, label }) => (
          <Pressable
            key={direction}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => answer(direction)}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          >
            <Text style={styles.glyph}>{glyph}</Text>
          </Pressable>
        ))}
      </View>
      <Button label={copy.cantSee} onPress={() => answer(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: "700" },
  muted: { color: theme.colors.muted },
  row: { flexDirection: "row", justifyContent: "space-between" },
  value: { fontWeight: "700" },
  // Plain white, no other content near the letter, as for a printed chart.
  test: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: theme.spacing.lg,
    paddingTop: 60,
    gap: theme.spacing.md,
  },
  letter: { flex: 1, alignItems: "center", justifyContent: "center" },
  arrows: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.sm },
  arrow: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
  },
  pressed: { opacity: 0.6 },
  glyph: { fontSize: 28, fontWeight: "700", color: theme.colors.primary },
});
