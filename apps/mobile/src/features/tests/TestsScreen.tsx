import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Screen, Text } from "../../components/ui";
import { listAcuityResults } from "../../storage/acuity";
import { listSessions } from "../../storage/sessions";
import { fonts, theme } from "../../theme";
import { useActiveChildId } from "../children/useActiveChildId";
import { CHECKS, latestAcuityLine, latestScanLine, type CheckId } from "./checks";
import { testsCopy as copy } from "./copy";

/** One place to choose a check: the strabismus scan or the vision check (#140). */
export default function TestsScreen() {
  const db = useSQLiteContext();
  const childId = useActiveChildId();
  const [latest, setLatest] = useState<Partial<Record<CheckId, string>>>({});

  useFocusEffect(
    useCallback(() => {
      if (!childId) return setLatest({});
      let active = true;
      Promise.all([listSessions(db, childId), listAcuityResults(db, childId)]).then(
        ([sessions, acuity]) =>
          active &&
          setLatest({ strabismus: latestScanLine(sessions), vision: latestAcuityLine(acuity) }),
        () => active && setLatest({}),
      );
      return () => {
        active = false;
      };
    }, [db, childId]),
  );

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {copy.title}
      </Text>
      <Text style={styles.muted}>{copy.intro}</Text>
      {CHECKS.map(({ id, route }) => {
        const check = copy.checks[id];
        return (
          <Card key={id}>
            <View style={styles.head}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.icon, { backgroundColor: ICON[id].background }]}
              >
                <Text
                  maxFontSizeMultiplier={1}
                  style={[styles.iconGlyph, { color: ICON[id].color }]}
                >
                  {ICON[id].glyph}
                </Text>
              </View>
              <View style={styles.headText}>
                <Text style={styles.name}>{check.title}</Text>
                <Text variant="caption" style={styles.muted}>
                  {check.time} · {check.needs}
                </Text>
              </View>
            </View>
            <Text>{check.what}</Text>
            {latest[id] && (
              <View style={styles.latest}>
                <View style={styles.dot} />
                <Text variant="caption" style={styles.muted}>
                  {latest[id]}
                </Text>
              </View>
            )}
            <Button
              label={route ? copy.start : copy.comingSoon}
              disabled={!route}
              onPress={() => route && router.navigate(route)}
            />
          </Card>
        );
      })}
    </Screen>
  );
}

// Decorative icon per check, in the demo's teal and blue accents.
const ICON: Record<CheckId, { glyph: string; color: string; background: string }> = {
  strabismus: { glyph: "◉", color: theme.colors.primary, background: theme.colors.primarySoft },
  vision: { glyph: "E", color: "#0F8F82", background: "#DDF7F3" },
};

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  iconGlyph: { fontFamily: fonts.black, fontWeight: "900", fontSize: 24 },
  headText: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.black, fontWeight: "900", fontSize: 18, lineHeight: 24 },
  muted: { color: theme.colors.muted },
  latest: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
});
