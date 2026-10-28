import type { Outcome, ScanResult } from "@app/core";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { EmptyState } from "../../components/EmptyState";
import { Button, Card, Screen, Text } from "../../components/ui";
import { listSessions } from "../../storage/sessions";
import { theme } from "../../theme";
import { childrenCopy } from "../children/copy";
import { useActiveChildId } from "../children/useActiveChildId";
import { ProgressChart } from "../progress/ProgressChart";
import { outcomeCopy } from "../scan/resultCopy";
import { historyCopy as copy } from "./copy";
import { formatScanTime, groupByDay } from "./format";
import { filterSessions, OutcomeFilter } from "./OutcomeFilter";

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const childId = useActiveChildId();
  const [loaded, setLoaded] = useState<{
    childId: string | null;
    sessions: ScanResult[];
  } | null>(null);
  const sessions = loaded && loaded.childId === childId ? loaded.sessions : null;
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (childId === undefined) return;
    let active = true;
    setFailed(false);
    listSessions(db, childId).then(
      (rows) => active && setLoaded({ childId, sessions: rows }),
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, [db, childId]);
  // Reload whenever the tab gains focus, so a scan saved a moment ago appears.
  useFocusEffect(load);

  if (childId === undefined) return null;
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {copy.title}
      </Text>
      {failed ? (
        <Card>
          <Text>{copy.failed}</Text>
          <Button label={copy.retry} onPress={load} />
        </Card>
      ) : sessions === null ? null : sessions.length === 0 ? (
        childId === null ? (
          <EmptyState
            icon="person-add-outline"
            message={copy.noChild}
            action={{
              label: childrenCopy.add,
              onPress: () => router.push({ pathname: "/child/[id]", params: { id: "new" } }),
            }}
          />
        ) : (
          <EmptyState
            icon="time-outline"
            message={copy.empty}
            action={{ label: copy.startScan, onPress: () => router.push("/scan") }}
          />
        )
      ) : (
        <>
          {childId === null ? (
            <Card>
              <Text>{copy.unassigned}</Text>
            </Card>
          ) : (
            <Card>
              <ProgressChart sessions={sessions} />
            </Card>
          )}
          <OutcomeFilter sessions={sessions} selected={outcome} onSelect={setOutcome} />
          {filterSessions(sessions, outcome).length === 0 && (
            <Text style={styles.muted}>{copy.noneWithOutcome}</Text>
          )}
          {groupByDay(filterSessions(sessions, outcome)).map((section) => (
            <View key={section.day} style={styles.section}>
              <Text variant="caption" accessibilityRole="header" style={styles.muted}>
                {section.day.replaceAll("-", ".")}
              </Text>
              {section.sessions.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

function SessionRow({ session }: { session: ScanResult }) {
  const outcome = outcomeCopy[session.outcome];
  const time = formatScanTime(session.createdAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${outcome.title}, ${time}`}
      accessibilityHint={copy.open}
      onPress={() => router.push({ pathname: "/session/[id]", params: { id: session.id } })}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: outcome.background, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text accessible={false} style={[styles.icon, { color: outcome.color }]}>
        {outcome.icon}
      </Text>
      <View style={styles.rowText}>
        <Text style={[styles.outcome, { color: outcome.color }]}>{outcome.title}</Text>
        <Text variant="caption" style={styles.muted}>
          {time.slice(-5)}
        </Text>
      </View>
      <Text accessible={false} style={styles.muted}>
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  muted: { color: theme.colors.muted },
  section: { gap: theme.spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    minHeight: 56,
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
  },
  icon: { fontSize: 20, fontWeight: "700", width: 24, textAlign: "center" },
  rowText: { flex: 1 },
  outcome: { fontWeight: "600" },
});
