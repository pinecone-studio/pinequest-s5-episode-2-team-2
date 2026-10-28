import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState, type ComponentProps } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Screen, Text } from "../../components/ui";
import { theme } from "../../theme";
import { eyeRestCopy } from "../eyeRest/content";
import { tipSections, tipsCopy as copy, type TipSection } from "./content";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** #234: one icon per section, so parents can find a section before reading it. */
const SECTION_ICONS: Record<string, IconName> = {
  why: "bulb-outline",
  habits: "sunny-outline",
  signs: "medkit-outline",
};

/** #144: why early checks matter, eye-friendly habits and when to see an eye doctor. */
export default function TipsScreen() {
  // #234: sections open and close; only the first one starts open.
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(tipSections.slice(0, 1).map((section) => section.key)),
  );
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {copy.title}
      </Text>
      {tipSections.map((section) => (
        <TipCard
          key={section.key}
          section={section}
          expanded={open.has(section.key)}
          onToggle={() => toggle(section.key)}
        />
      ))}
      <Button
        label={eyeRestCopy.openFromTips}
        variant="secondary"
        onPress={() => router.push("/eye-rest")}
      />
      <Text variant="caption" style={styles.notice}>
        {copy.notice}
      </Text>
    </Screen>
  );
}

function TipCard({
  section,
  expanded,
  onToggle,
}: {
  section: TipSection;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={section.title}
        // VoiceOver reads "expanded" / "collapsed" from this state.
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.header}
      >
        <View
          style={styles.icon}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons
            name={SECTION_ICONS[section.key] ?? "information-circle-outline"}
            size={22}
            color={theme.colors.primary}
          />
        </View>
        <Text style={styles.title}>{section.title}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.colors.muted}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </Pressable>
      {expanded
        ? section.tips.map((tip) => (
            <View key={tip.text} style={styles.tip}>
              <Text>{tip.text}</Text>
              <Pressable
                accessibilityRole="link"
                accessibilityHint={tip.source.url}
                onPress={() => void Linking.openURL(tip.source.url)}
                style={styles.source}
              >
                <Text variant="caption" style={styles.sourceText}>
                  {copy.sourcePrefix} {tip.source.label}
                </Text>
              </Pressable>
            </View>
          ))
        : null}
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
  title: { flex: 1, fontWeight: "700", fontSize: 17, lineHeight: 24 },
  tip: { gap: theme.spacing.xs },
  source: { minHeight: 44, justifyContent: "center" },
  sourceText: { color: theme.colors.primary, textDecorationLine: "underline" },
  notice: { color: theme.colors.muted },
});
