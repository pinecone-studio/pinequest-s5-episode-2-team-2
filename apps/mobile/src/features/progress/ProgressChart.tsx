import type { ScanResult } from "@app/core";
import { useLayoutEffect, useRef, useState } from "react";
import type { ComponentRef } from "react";
import { StyleSheet, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import { Text } from "../../components/ui";
import { theme } from "../../theme";
import { formatDay } from "../history/format";
import { outcomeCopy } from "../scan/resultCopy";
import { progressCopy as copy } from "./copy";
import { segments } from "./segments";
import { chartPoints, progressSeries } from "./series";

const HEIGHT = 160;
const DOT = 12;

/** Asymmetry score over time with outcome-coloured markers; plain views, no chart library. */
export function ProgressChart({
  sessions,
  showTitle = true,
}: {
  sessions: readonly ScanResult[];
  showTitle?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const series = progressSeries(sessions);
  // First and last scan day under the time axis; one centred date when they match (#236).
  const days = [
    ...new Set([series[0], series.at(-1)].flatMap((p) => (p ? [formatDay(p.time)] : []))),
  ];
  const inner = Math.max(0, width - DOT);
  const { points, top } = chartPoints(series, inner, HEIGHT - DOT);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  // The plot usually mounts after the sessions load, and iOS then never sends it an onLayout
  // event, which left every dot at the left edge. Measure it once it exists.
  const plot = useRef<ComponentRef<typeof View>>(null);
  const hasPlot = series.length >= 2;
  useLayoutEffect(() => {
    if (hasPlot) plot.current?.measure((_x, _y, measured) => setWidth(measured));
  }, [hasPlot]);

  return (
    <View style={styles.container}>
      {showTitle && <Text style={styles.heading}>{copy.title}</Text>}
      {series.length < 2 ? (
        <Text variant="caption" style={styles.muted}>
          {copy.notEnough}
        </Text>
      ) : (
        <View
          ref={plot}
          onLayout={onLayout}
          style={styles.plot}
          accessible
          accessibilityLabel={copy.summary(series.length, top)}
        >
          {segments(points).map((s, i) => (
            <View
              key={i}
              style={[
                styles.line,
                {
                  width: s.length,
                  left: s.cx - s.length / 2 + DOT / 2,
                  top: s.cy + DOT / 2 - 1,
                  transform: [{ rotate: `${s.angleDeg}deg` }],
                },
              ]}
            />
          ))}
          {points.map((p) => (
            <View
              key={p.id}
              style={[
                styles.dot,
                { left: p.x, top: p.y, backgroundColor: outcomeCopy[p.outcome].color },
              ]}
            />
          ))}
        </View>
      )}
      {series.length >= 2 && (
        <View style={[styles.days, days.length === 1 && styles.oneDay]}>
          {days.map((day) => (
            <Text key={day} variant="caption" style={styles.muted}>
              {day}
            </Text>
          ))}
        </View>
      )}
      <Text variant="caption" style={styles.muted}>
        {copy.notice}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  heading: { fontWeight: "600" },
  muted: { color: theme.colors.muted },
  plot: {
    height: HEIGHT,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  days: { flexDirection: "row", justifyContent: "space-between" },
  oneDay: { justifyContent: "center" },
  line: { position: "absolute", height: 2, backgroundColor: theme.colors.border },
  dot: { position: "absolute", width: DOT, height: DOT, borderRadius: DOT / 2 },
});
