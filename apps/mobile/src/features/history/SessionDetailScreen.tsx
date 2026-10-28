import type { ScanResult } from "@app/core";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Button, Card, Screen, Text } from "../../components/ui";
import { deleteSession, getSession } from "../../storage/sessions";
import { theme } from "../../theme";
import { outcomeCopy, reasonCopy, resultCopy } from "../scan/resultCopy";
import { isUnvalidatedPolicy } from "../scan/scanPolicy";
import { historyCopy } from "./copy";
import { formatScanTime } from "./format";

const copy = historyCopy.detail;

export default function SessionDetailScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined while loading, null when the scan does not exist.
  const [session, setSession] = useState<ScanResult | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getSession(db, id).then(
      (row) => active && setSession(row),
      () => active && setSession(null),
    );
    return () => {
      active = false;
    };
  }, [db, id]);

  async function remove() {
    setError(null);
    try {
      await deleteSession(db, id);
      router.back();
    } catch {
      setError(copy.deleteFailed);
    }
  }

  function confirmDelete() {
    Alert.alert(copy.confirmTitle, copy.confirmBody, [
      { text: copy.cancel, style: "cancel" },
      { text: copy.delete, style: "destructive", onPress: () => void remove() },
    ]);
  }

  if (session === undefined) return null;
  const outcome = session && outcomeCopy[session.outcome];
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {copy.title}
      </Text>
      {!session || !outcome ? (
        <Card>
          <Text>{copy.missing}</Text>
        </Card>
      ) : (
        <>
          {isUnvalidatedPolicy(session.policyVersion) && (
            <Text accessibilityRole="alert">{resultCopy.demo}</Text>
          )}
          <Text variant="caption" style={styles.muted}>
            {formatScanTime(session.createdAt)}
          </Text>
          <View style={[styles.outcome, { backgroundColor: outcome.background }]}>
            <Text style={[styles.outcomeTitle, { color: outcome.color }]}>
              {outcome.icon} {outcome.title}
            </Text>
            <Text>{outcome.explanation}</Text>
          </View>
          {session.reasons.length > 0 && (
            <Card>
              <Text style={styles.heading}>{resultCopy.reasons}</Text>
              {session.reasons.map((reason) => (
                <Text key={reason}>• {reasonCopy[reason]}</Text>
              ))}
            </Card>
          )}
          <Card>
            <Text>{copy.frames(session.summary.framesUsed, session.summary.framesTotal)}</Text>
            {session.summary.asymmetryScore !== null && (
              <Text>
                {copy.score}: {session.summary.asymmetryScore.toFixed(3)}
              </Text>
            )}
          </Card>
          <Text variant="caption" style={styles.muted}>
            {resultCopy.notice}
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <Button label={copy.delete} onPress={confirmDelete} variant="danger" />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: theme.colors.muted },
  outcome: { borderRadius: theme.radius.md, padding: theme.spacing.lg, gap: theme.spacing.sm },
  outcomeTitle: { fontSize: 20, fontWeight: "700" },
  heading: { fontWeight: "600" },
  error: { color: theme.colors.text, fontWeight: "600" },
});
