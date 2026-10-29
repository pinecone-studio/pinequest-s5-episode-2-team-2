import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { Text } from "../../components/ui";
import { theme } from "../../theme";
import type { LandmarkFrame } from "../vision/facePipeline";
import { withWebDemoQuality } from "../vision/frameQuality";

/**
 * The web demo's live checks for the latest frame (demo/web-poc, #274), with its labels: one
 * face, both eyes, a reflex in each. A scan only counts frames where all three pass.
 */
export function scanChecks(frame: LandmarkFrame | null): { label: string; ok: boolean }[] {
  return [
    { label: "Нүүр олдлоо", ok: frame?.faceCount === 1 },
    { label: "Хоёр нүд олдлоо", ok: !!frame && frame.faceCount === 1 && !!frame.eyes },
    { label: "Тусгал харагдаж байна", ok: !!frame && withWebDemoQuality(frame).quality!.ok },
  ];
}

export function ScanChecks({ frame }: { frame: LandmarkFrame | null }) {
  return (
    <View style={styles.row} pointerEvents="none">
      {scanChecks(frame).map(({ label, ok }) => (
        <View
          key={label}
          style={[styles.chip, ok && styles.ok]}
          accessible
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ok }}
          accessibilityLabel={label}
        >
          <Ionicons
            name={ok ? "checkmark-circle" : "ellipse-outline"}
            size={16}
            color={ok ? theme.colors.onPrimary : theme.colors.muted}
          />
          <Text variant="caption" style={ok ? styles.okText : styles.text}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  ok: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  text: { color: theme.colors.muted },
  okText: { color: theme.colors.onPrimary },
});
