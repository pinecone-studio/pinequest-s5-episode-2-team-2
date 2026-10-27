import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { StyleSheet } from "react-native";
import { Button, Card, Screen, Text } from "../../components/ui";
import { listSessions } from "../../storage/sessions";
import { theme } from "../../theme";
import { useActiveChildId } from "../children/useActiveChildId";
import { CHECKS, latestScanLine, type CheckId } from "./checks";
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
      listSessions(db, childId).then(
        (sessions) => active && setLatest({ strabismus: latestScanLine(sessions) }),
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
            <Text style={styles.name}>{check.title}</Text>
            <Text>{check.what}</Text>
            <Text variant="caption" style={styles.muted}>
              {check.time} · {check.needs}
            </Text>
            {latest[id] && (
              <Text variant="caption" style={styles.muted}>
                {latest[id]}
              </Text>
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

const styles = StyleSheet.create({
  name: { fontWeight: "700" },
  muted: { color: theme.colors.muted },
});
