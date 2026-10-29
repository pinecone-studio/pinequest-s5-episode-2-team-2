import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { EmptyState } from "../../components/EmptyState";
import { Text } from "../../components/ui";
import { theme } from "../../theme";
import type { AdviceCard, AdviceId } from "./advice";
import { adviceCopy } from "./adviceCopy";
import { adviceImages } from "./adviceImages";
import { AdvicePicture } from "./AdvicePicture";

export function DailyAdviceCard({
  advice,
  onOpen,
}: {
  advice: AdviceCard | undefined;
  onOpen: (id: AdviceId) => void;
}) {
  const largeText = useWindowDimensions().fontScale > 1.4;
  if (!advice) return <EmptyState icon="information-circle-outline" message={adviceCopy.missing} />;
  return (
    <Pressable
      style={[styles.card, largeText && styles.column]}
      accessibilityRole="button"
      accessibilityLabel={`${adviceCopy.daily}. ${advice.title}. ${advice.summary}`}
      accessibilityHint={adviceCopy.openHint}
      onPress={() => onOpen(advice.id)}
    >
      <View style={styles.picture}>
        <AdvicePicture key={advice.id} source={adviceImages[advice.id]} />
      </View>
      <View style={styles.body}>
        <Text variant="caption" style={styles.label}>
          {adviceCopy.daily}
        </Text>
        <Text style={styles.title}>{advice.title}</Text>
        <Text variant="caption" numberOfLines={largeText ? undefined : 2}>
          {advice.summary}
        </Text>
        <Text variant="caption" style={styles.label}>
          {adviceCopy.details} ›
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 14,
    borderRadius: theme.radius.md,
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  column: { flexDirection: "column" },
  picture: { width: 84, flexShrink: 0 },
  body: { flex: 1, gap: 8 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: "800" },
  label: { color: theme.colors.primary, fontWeight: "700" },
});
