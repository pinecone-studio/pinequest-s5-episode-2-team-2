import type { EyeMeasure } from "@app/core";
import { StyleSheet, View } from "react-native";
import { Text } from "../../components/ui";
import { theme } from "../../theme";
import { eyeViewCopy as copy } from "./copy";
import { eyeDiagrams, type EyeDiagram } from "./diagram";

const SIZE = 120;
const REFLEX = 10;

/** Both measured eyes drawn as iris circle and reflex dot; no camera image is shown or kept. */
export function EyeDiagramView({ eyes }: { eyes: readonly [EyeMeasure, EyeMeasure] }) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{copy.title}</Text>
      <View style={styles.row}>
        {eyeDiagrams(eyes, SIZE).map((d) => (
          <EyeBox key={d.side} diagram={d} />
        ))}
      </View>
      <Text variant="caption" style={styles.muted}>
        {copy.legend}
      </Text>
    </View>
  );
}

function EyeBox({ diagram: d }: { diagram: EyeDiagram }) {
  const label = `${copy.sides[d.side]}: ${
    d.offset ? copy.reflexAt(d.offset.x, d.offset.y) : copy.noReflex
  }`;
  return (
    <View style={styles.eye} accessible accessibilityLabel={label}>
      <View style={styles.box}>
        <View
          style={[
            styles.iris,
            {
              width: d.irisRadius * 2,
              height: d.irisRadius * 2,
              borderRadius: d.irisRadius,
              left: d.center.x - d.irisRadius,
              top: d.center.y - d.irisRadius,
            },
          ]}
        />
        <View style={[styles.cross, { left: d.center.x - 4, top: d.center.y }]} />
        {d.reflex && (
          <View
            style={[styles.reflex, { left: d.reflex.x - REFLEX / 2, top: d.reflex.y - REFLEX / 2 }]}
          />
        )}
      </View>
      <Text variant="caption">{copy.sides[d.side]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  heading: { fontWeight: "600" },
  muted: { color: theme.colors.muted },
  row: { flexDirection: "row", justifyContent: "space-around" },
  eye: { alignItems: "center", gap: theme.spacing.xs },
  box: {
    width: SIZE,
    height: SIZE,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    overflow: "hidden",
  },
  iris: { position: "absolute", backgroundColor: theme.colors.text },
  cross: { position: "absolute", width: 8, height: 1, backgroundColor: theme.colors.border },
  reflex: {
    position: "absolute",
    width: REFLEX,
    height: REFLEX,
    borderRadius: REFLEX / 2,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
});
