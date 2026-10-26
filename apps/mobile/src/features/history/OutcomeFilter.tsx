import type { Outcome, ScanResult } from "@app/core";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../components/ui";
import { theme } from "../../theme";
import { outcomeCopy } from "../scan/resultCopy";
import { historyCopy as copy } from "./copy";
import { summarizeHistory } from "./format";

const OUTCOMES: Outcome[] = ["REFER", "RETAKE", "NOT_ASSESSED", "NO_VISIBLE_SIGN"];

/** Sessions with the chosen outcome; all of them when `outcome` is null. */
export function filterSessions(
  sessions: readonly ScanResult[],
  outcome: Outcome | null,
): ScanResult[] {
  return outcome === null ? [...sessions] : sessions.filter((s) => s.outcome === outcome);
}

/** "All" plus one chip per outcome that occurs, each with its count. */
export function OutcomeFilter({
  sessions,
  selected,
  onSelect,
}: {
  sessions: readonly ScanResult[];
  selected: Outcome | null;
  onSelect: (outcome: Outcome | null) => void;
}) {
  const { counts, total } = summarizeHistory(sessions);
  const chips: { outcome: Outcome | null; label: string }[] = [
    { outcome: null, label: copy.all(total) },
    ...OUTCOMES.filter((o) => counts[o] > 0).map((o) => ({
      outcome: o,
      label: `${outcomeCopy[o].icon} ${counts[o]}`,
    })),
  ];
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {chips.map(({ outcome, label }) => {
        const active = outcome === selected;
        return (
          <Pressable
            key={outcome ?? "all"}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={
              outcome ? `${outcomeCopy[outcome].title}: ${counts[outcome]}` : label
            }
            onPress={() => onSelect(outcome)}
            style={[
              styles.chip,
              outcome && { backgroundColor: outcomeCopy[outcome].background },
              active && styles.active,
            ]}
          >
            <Text
              variant="caption"
              style={outcome ? { color: outcomeCopy[outcome].color } : undefined}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  active: { borderColor: theme.colors.primary, borderWidth: 2 },
});
