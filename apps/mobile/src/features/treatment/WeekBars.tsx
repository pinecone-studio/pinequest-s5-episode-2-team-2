import { StyleSheet, View } from "react-native";
import { Text } from "../../components/ui";
import { theme } from "../../theme";
import { treatmentCopy as copy } from "./copy";
import { goalStreak, type DaySummary } from "./progress";

const HEIGHT = 96;

/** Minutes per day for the last week as bars, with the goal line and the current streak. */
export function WeekBars({ week, goal }: { week: DaySummary[]; goal: number | null }) {
  const top = Math.max(goal ?? 0, ...week.map((d) => d.minutes), 1);
  const streak = goalStreak(week);
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{copy.week}</Text>
      <View style={styles.plot}>
        {goal !== null && (
          <View
            accessible={false}
            style={[styles.goal, { bottom: (Math.min(goal, top) / top) * HEIGHT }]}
          />
        )}
        {week.map((d) => (
          <View
            key={d.day.toISOString()}
            style={styles.column}
            accessible
            accessibilityLabel={copy.dayLabel(d.day, d.minutes, d.metGoal)}
          >
            <View style={styles.barArea}>
              <View
                style={[
                  styles.bar,
                  {
                    height: (d.minutes / top) * HEIGHT,
                    backgroundColor: d.metGoal ? theme.colors.primary : theme.colors.muted,
                  },
                ]}
              />
            </View>
            <Text variant="caption" style={styles.muted}>
              {copy.weekday(d.day)}
            </Text>
          </View>
        ))}
      </View>
      {goal !== null && (
        <Text variant="caption" style={styles.muted}>
          {copy.streak(streak)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  heading: { fontWeight: "600" },
  muted: { color: theme.colors.muted },
  plot: { flexDirection: "row", gap: theme.spacing.xs, alignItems: "flex-end" },
  goal: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    marginBottom: 20,
    backgroundColor: theme.colors.border,
  },
  column: { flex: 1, alignItems: "center", gap: theme.spacing.xs },
  barArea: { height: HEIGHT, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 4, minHeight: 2 },
});
