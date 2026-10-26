import type { ScanResult } from "@app/core";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Text } from "../../components/ui";
import { getChild } from "../../storage/children";
import { listSessions } from "../../storage/sessions";
import { theme } from "../../theme";
import { useActiveChildId } from "../children/useActiveChildId";
import { outcomeCopy } from "../scan/resultCopy";
import { daysSince } from "./daysSince";

// Placeholders until the team writes the final Mongolian copy (CONTRIBUTING.md "App copy").
const copy = {
  noScan: "TODO(copy): No scan yet",
  lastScan: (days: number) =>
    days === 0 ? "TODO(copy): Last scan today" : `TODO(copy): Last scan ${days} days ago`,
  history: "TODO(copy): Open history",
} as const;

/** The selected child's most recent scan on the Home screen; nothing without a profile. */
export function LatestScanCard() {
  const db = useSQLiteContext();
  const childId = useActiveChildId();
  const [state, setState] = useState<{ name: string; latest: ScanResult | null } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!childId) return setState(null);
      let active = true;
      Promise.all([getChild(db, childId), listSessions(db, childId)]).then(
        ([child, sessions]) =>
          active && setState(child && { name: child.name, latest: sessions[0] ?? null }),
        () => active && setState(null),
      );
      return () => {
        active = false;
      };
    }, [db, childId]),
  );

  if (!state) return null;
  const { name, latest } = state;
  const outcome = latest && outcomeCopy[latest.outcome];
  const days = latest && daysSince(latest.createdAt);
  return (
    <Card>
      <Text style={styles.name}>{name}</Text>
      {!latest || !outcome ? (
        <Text>{copy.noScan}</Text>
      ) : (
        <>
          <View style={[styles.outcome, { backgroundColor: outcome.background }]}>
            <Text style={[styles.outcomeText, { color: outcome.color }]}>
              {outcome.icon} {outcome.title}
            </Text>
          </View>
          {days !== null && (
            <Text variant="caption" style={styles.muted}>
              {copy.lastScan(days)}
            </Text>
          )}
          <Button label={copy.history} onPress={() => router.navigate("/history")} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  name: { fontWeight: "700" },
  muted: { color: theme.colors.muted },
  outcome: { borderRadius: theme.radius.sm, padding: theme.spacing.md },
  outcomeText: { fontWeight: "600" },
});
