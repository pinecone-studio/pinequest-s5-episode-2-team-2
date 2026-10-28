import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Card, Text } from "../../components/ui";
import { theme } from "../../theme";
import { dashboardCopy as copy } from "./copy";

export function DashboardCard({
  title,
  icon,
  children,
  onPress,
}: {
  title: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  children: ReactNode;
  onPress: () => void;
}) {
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${copy.open}`}
        onPress={onPress}
        style={styles.header}
      >
        <View
          style={styles.icon}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons name={icon} size={24} color={theme.colors.primary} />
        </View>
        <Text variant="title" style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text variant="caption" style={styles.linkText}>
          {copy.open} ›
        </Text>
      </Pressable>
      {children}
    </Card>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontWeight: "700", fontSize: 18, lineHeight: 24 },
  linkText: { color: theme.colors.primary, flexShrink: 1, textAlign: "right" },
});
