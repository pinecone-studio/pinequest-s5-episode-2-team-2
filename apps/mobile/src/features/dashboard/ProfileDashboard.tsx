import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Text } from "../../components/ui";
import { theme } from "../../theme";
import { ChildrenList } from "../children/ChildrenList";
import { ageThisYear } from "../children/form";
import { dashboardCopy as copy } from "./copy";
import { loadDashboard, type Dashboard } from "./data";
import { ScanCards } from "./ScanCards";
import { CareCards } from "./CareCards";
import { VisionCard } from "./VisionCard";

type State = { status: "loading" } | { status: "failed" } | { status: "ready"; data: Dashboard };

/** One snapshot for all cards. A newer request or leaving the tab invalidates old reads. */
export function ProfileDashboard() {
  const db = useSQLiteContext();
  const [state, setState] = useState<State>({ status: "loading" });
  const [choosing, setChoosing] = useState(false);
  const request = useRef(0);
  const reload = useCallback(() => {
    const current = ++request.current;
    setState({ status: "loading" });
    loadDashboard(db).then(
      (data) => current === request.current && setState({ status: "ready", data }),
      () => current === request.current && setState({ status: "failed" }),
    );
  }, [db]);
  useFocusEffect(
    useCallback(() => {
      reload();
      return () => {
        request.current++;
      };
    }, [reload]),
  );

  if (state.status === "loading")
    return <Text accessibilityLiveRegion="polite">{copy.loading}</Text>;
  if (state.status === "failed")
    return (
      <Card>
        <Text accessibilityRole="alert">{copy.failed}</Text>
        <Button label={copy.retry} onPress={reload} />
      </Card>
    );

  const { child, details } = state.data;
  const age = child && ageThisYear(child.birthYear);
  return (
    <>
      <Card>
        {child ? (
          <View style={styles.row}>
            <View style={styles.avatar} accessible={false}>
              <Text variant="title">{[...child.name][0]}</Text>
            </View>
            <View style={styles.name}>
              <Text style={styles.heading} accessibilityRole="header">
                {child.name}
              </Text>
              {age !== null && <Text variant="caption">{copy.age(age)}</Text>}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.switchChild}
              accessibilityState={{ expanded: choosing }}
              onPress={() => setChoosing(!choosing)}
              style={styles.switch}
            >
              <Text style={styles.link}>{copy.switchChild} ▾</Text>
            </Pressable>
          </View>
        ) : (
          <Text>{copy.noChild}</Text>
        )}
      </Card>
      {(choosing || !child) && (
        <ChildrenList
          onSelect={() => {
            setChoosing(false);
            reload();
          }}
        />
      )}
      {details && (
        <>
          <VisionCard details={details} />
          <ScanCards details={details} />
          <CareCards details={details} />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.spacing.sm },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E5F1FF",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { flex: 1, minWidth: 110 },
  heading: { fontSize: 20, fontWeight: "700" },
  switch: { minHeight: 48, justifyContent: "center" },
  link: { color: theme.colors.primary, fontWeight: "600" },
});
