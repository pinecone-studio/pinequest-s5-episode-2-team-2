import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button, Card, Screen, Text } from "../../components/ui";
import { listAcuityResults } from "../../storage/acuity";
import { listSessions } from "../../storage/sessions";
import { fonts, theme } from "../../theme";
import { useActiveChildId } from "../children/useActiveChildId";
import { CHECKS, latestAcuityLine, latestScanLine, type CheckId } from "./checks";
import { testsCopy as copy } from "./copy";
import { ACCENT, CheckPicture } from "./pictures";

/** One place to choose a check: the strabismus scan or the vision check (#140). */
export default function TestsScreen() {
  const db = useSQLiteContext();
  const childId = useActiveChildId();
  // null until the latest results are read, so the cards show a spinner instead of nothing (#264).
  const [latest, setLatest] = useState<Partial<Record<CheckId, string>> | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (childId === undefined) return;
      if (childId === null) return setLatest({});
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
            <CheckPicture id={id} distance={check.mark} />
            <Text style={styles.name}>{check.title}</Text>
            <Text>{check.what}</Text>
            <View style={styles.needs}>
              <Need icon="time-outline" label={check.time} />
              <Need icon="resize-outline" label={check.distance} />
              {"light" in check && <Need icon="flashlight-outline" label={check.light} />}
            </View>
            {latest === null ? (
              <View accessible accessibilityLabel={copy.loading} style={styles.latest}>
                <ActivityIndicator size="small" color={ACCENT[id].color} />
              </View>
            ) : (
              latest[id] && (
                <View style={styles.latest}>
                  <View style={[styles.dot, { backgroundColor: ACCENT[id].color }]} />
                  <Text variant="caption" style={styles.muted}>
                    {latest[id]}
                  </Text>
                </View>
              )
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

/** What a check needs, as an icon and a few words. */
function Need({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.need}>
      <Ionicons name={icon} size={16} color={theme.colors.muted} />
      <Text variant="caption" style={styles.muted}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.black, fontWeight: "900", fontSize: 18, lineHeight: 24 },
  muted: { color: theme.colors.muted },
  needs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  need: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.background,
  },
  // The dot stays on the first line when large text wraps the line (#238).
  latest: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
});
