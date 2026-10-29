import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { Text } from "../../components/ui";
import { fonts, theme } from "../../theme";
import type { CheckId } from "./checks";

type IconName = keyof typeof Ionicons.glyphMap;

// Each check keeps its accent from the Tests screen (#140): blue for the scan, teal for vision.
export const ACCENT: Record<CheckId, { color: string; soft: string }> = {
  strabismus: { color: theme.colors.primary, soft: theme.colors.primarySoft },
  vision: { color: "#0F8F82", soft: "#DDF7F3" },
};

// Pictures are drawn from shapes and icons, so they need no image files and stay sharp (#264).
// They only repeat what the text says, so VoiceOver skips them.
const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const;

/** How a check is done: the phone, the distance and the child. */
export function CheckPicture({ id, distance }: { id: CheckId; distance: string }) {
  const { color, soft } = ACCENT[id];
  return (
    <LinearGradient
      {...hidden}
      colors={[soft, theme.colors.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.panel}
    >
      <View style={[styles.phone, { borderColor: color }]}>
        {id === "vision" ? (
          <Text maxFontSizeMultiplier={1} style={[styles.letter, { color }]}>
            E
          </Text>
        ) : (
          <Ionicons name="flashlight" size={22} color={color} />
        )}
      </View>
      <Gap distance={distance} color={color} />
      <View style={styles.child}>
        <Ionicons name="happy" size={48} color={color} />
      </View>
    </LinearGradient>
  );
}

/** One preparation step: what to do (left) and what it is for (right). */
export function StepPicture({ from, to, label }: { from: IconName; to: IconName; label?: string }) {
  const { color, soft } = ACCENT.strabismus;
  return (
    <View {...hidden} style={[styles.step, { backgroundColor: soft }]}>
      <Ionicons name={from} size={30} color={color} />
      {label ? (
        <Gap distance={label} color={color} />
      ) : (
        <Ionicons name="arrow-forward" size={20} color={color} />
      )}
      <Ionicons name={to} size={30} color={color} />
    </View>
  );
}

function Gap({ distance, color }: { distance: string; color: string }) {
  return (
    <View style={styles.gap}>
      <Text maxFontSizeMultiplier={1} style={[styles.distance, { color }]}>
        {distance}
      </Text>
      <View style={styles.dots}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: color }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  phone: {
    width: 44,
    height: 72,
    borderRadius: 12,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  letter: { fontFamily: fonts.black, fontWeight: "900", fontSize: 26, lineHeight: 34 },
  child: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  gap: { flex: 1, alignItems: "center", gap: 6, paddingHorizontal: theme.spacing.sm },
  distance: { fontFamily: fonts.black, fontWeight: "900", fontSize: 15 },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  step: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
});
