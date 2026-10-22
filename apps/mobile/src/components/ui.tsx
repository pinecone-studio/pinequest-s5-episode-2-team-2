import { Pressable, ScrollView, StyleSheet, Text as NativeText, View } from "react-native";
import type { PressableProps, TextProps, ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../theme";

export function Text({
  variant = "body",
  style,
  ...props
}: TextProps & { variant?: keyof typeof theme.typography }) {
  return (
    <NativeText
      {...props}
      style={[{ color: theme.colors.text }, theme.typography[variant], style]}
    />
  );
}

export function Screen({ children, style, ...props }: ViewProps) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View {...props} style={[styles.stack, style]}>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

export function Button({ label, disabled, style, ...props }: PressableProps & { label: string }) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ ...props.accessibilityState, disabled: !!disabled }}
      style={(state) => [
        styles.button,
        { opacity: disabled ? 0.5 : state.pressed ? 0.8 : 1 },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, padding: theme.spacing.lg },
  stack: { gap: theme.spacing.lg },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
  },
  buttonLabel: { color: theme.colors.onPrimary, fontWeight: "600" },
});
