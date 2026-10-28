import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Button, Card, Screen, Text } from "../../components/ui";
import { listAcuityResults, type AcuityResult } from "../../storage/acuity";
import { dashboardCopy as copy } from "./copy";
import { VisionSummary } from "./VisionSummary";

type State = { key: string; result: AcuityResult | null; failed: boolean };
/** A read-only saved check, scoped to the child carried by the dashboard link. */
export default function SavedVisionScreen() {
  const db = useSQLiteContext();
  const { id, childId } = useLocalSearchParams<{ id?: string; childId?: string }>();
  const key = JSON.stringify([childId, id]);
  const [state, setState] = useState<State | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setState(null);
      if (!id || !childId) {
        setState({ key, result: null, failed: false });
        return;
      }
      listAcuityResults(db, childId).then(
        (rows) =>
          active &&
          setState({
            key,
            result: rows.find((r) => r.id === id && r.childId === childId) ?? null,
            failed: false,
          }),
        () => active && setState({ key, result: null, failed: true }),
      );
      return () => {
        active = false;
      };
    }, [db, id, childId, key, retry]),
  );

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {copy.vision}
      </Text>
      {!state || state.key !== key ? (
        <Text>{copy.loading}</Text>
      ) : state.failed ? (
        <Card>
          <Text accessibilityRole="alert">{copy.failed}</Text>
          <Button label={copy.retry} onPress={() => setRetry((n) => n + 1)} />
        </Card>
      ) : (
        <Card>
          {state.result ? (
            <VisionSummary result={state.result} />
          ) : (
            <Text>{copy.missingVision}</Text>
          )}
        </Card>
      )}
    </Screen>
  );
}
