import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Card, Text } from "../../components/ui";
import { theme } from "../../theme";
import { dashboardCopy as copy } from "./copy";

export function DashboardCard({
  title,
  children,
  onPress,
}: {
  title: string;
  children: ReactNode;
  onPress: () => void;
}) {
  return (
    <Card>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {children}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${copy.open}`}
        onPress={onPress}
        style={styles.link}
      >
        <Text style={styles.linkText}>{copy.open} ›</Text>
      </Pressable>
    </Card>
  );
}
const styles = StyleSheet.create({
  title: { fontWeight: "700", fontSize: 18 },
  link: {
    minHeight: 48,
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  linkText: { color: theme.colors.primary, fontWeight: "600" },
});
