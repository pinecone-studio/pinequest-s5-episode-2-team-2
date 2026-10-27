import { Pressable, ScrollView, StyleSheet, Text as NativeText, View } from "react-native";
import type { PressableProps, TextProps, ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Outcome } from "@app/core";
import type { ReactNode } from "react";
import { fonts, outcomeColors, theme } from "../theme";

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

export type ButtonVariant = "primary" | "secondary" | "outline" | "link";

export function Button({
  label,
  disabled,
  style,
  variant = "primary",
  ...props
}: PressableProps & { label: string; variant?: ButtonVariant }) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ ...props.accessibilityState, disabled: !!disabled }}
      style={(state) => [
        styles.button,
        styles[variant],
        variant === "primary" && state.pressed && styles.primaryPressed,
        variant !== "primary" && state.pressed && styles.pressed,
        disabled && styles.disabled,
        typeof style === "function" ? style(state) : style,
      ]}
    >
      <Text style={[styles.buttonLabel, variant === "primary" && styles.onPrimary]}>{label}</Text>
    </Pressable>
  );
}

// The web demo's verdict borders; retake and not-assessed share the amber one.
const VERDICT_BORDER: Record<Outcome, string> = {
  REFER: "#F2C4C1",
  RETAKE: "#F3DFB0",
  NOT_ASSESSED: "#F3DFB0",
  NO_VISIBLE_SIGN: "#BFE8D3",
};

/**
 * The web demo's verdict card: a coloured badge (with an optional icon), a coloured border, a
 * bold title and the explanation. Colour never carries the outcome alone; the title does.
 */
export function Verdict({
  outcome,
  title,
  icon,
  children,
}: {
  outcome: Outcome;
  title: string;
  icon?: string;
  children?: ReactNode;
}) {
  const colors = outcomeColors[outcome];
  return (
    <Card
      style={[
        styles.verdict,
        { borderColor: VERDICT_BORDER[outcome] },
        outcome === "REFER" && { backgroundColor: colors.background },
      ]}
    >
      <View style={[icon ? styles.badge : styles.dot, { backgroundColor: colors.foreground }]}>
        {icon && (
          <Text accessible={false} style={styles.badgeIcon}>
            {icon}
          </Text>
        )}
      </View>
      <View style={styles.verdictBody}>
        <Text accessibilityRole="header" style={styles.verdictTitle}>
          {title}
        </Text>
        {children}
      </View>
    </Card>
  );
}

/** The demo's amber notice box, e.g. for the not-a-diagnosis line. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, padding: theme.spacing.lg },
  stack: { gap: theme.spacing.md },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.shadow,
  },
  // Pill buttons as in the web demo: 56 points tall, extra-bold 17 pt label.
  button: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
  },
  primary: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryPressed: { backgroundColor: theme.colors.primaryPressed },
  secondary: {
    backgroundColor: theme.colors.surface,
    shadowColor: "#1F55C4",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  outline: { borderWidth: 2, borderColor: theme.colors.primary },
  link: { minHeight: 44 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5, shadowOpacity: 0 },
  buttonLabel: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    color: theme.colors.primary,
  },
  onPrimary: { color: theme.colors.onPrimary },
  verdict: { flexDirection: "row", gap: 14, borderWidth: 2, padding: 18 },
  dot: { width: 18, height: 18, borderRadius: 9, marginTop: 5 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeIcon: {
    fontFamily: fonts.black,
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 22,
    color: "#FFFFFF",
  },
  verdictBody: { flex: 1, gap: theme.spacing.sm },
  verdictTitle: { fontFamily: fonts.black, fontWeight: "900", fontSize: 20, lineHeight: 26 },
  notice: {
    backgroundColor: theme.colors.notice,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeText: {
    fontFamily: fonts.bold,
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.onNotice,
  },
});
