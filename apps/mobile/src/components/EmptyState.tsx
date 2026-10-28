import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { theme } from "../theme";
import { Button, Card, Text } from "./ui";

type IconName = keyof typeof Ionicons.glyphMap;

/** Nothing to show yet (#237): an icon, one sentence and, when there is one, the next step. */
export function EmptyState({
  icon,
  message,
  action,
}: {
  icon: IconName;
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.badge} accessible={false}>
        <Ionicons name={icon} size={32} color={theme.colors.primary} />
      </View>
      <Text style={styles.message}>{message}</Text>
      {action && <Button label={action.label} onPress={action.onPress} style={styles.action} />}
    </Card>
  );
}

/** Spinner while a screen reads its data; VoiceOver reads the label. */
export function Loading({ label }: { label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={styles.loading}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", paddingVertical: theme.spacing.xl },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primarySoft,
  },
  message: { textAlign: "center" },
  action: { alignSelf: "stretch" },
  loading: { paddingVertical: theme.spacing.xl, alignItems: "center" },
});
