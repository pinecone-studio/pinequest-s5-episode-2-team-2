import { router, useLocalSearchParams } from "expo-router";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Screen, Text } from "../../components/ui";
import { theme } from "../../theme";
import { EmptyState } from "../../components/EmptyState";
import { eyeRestCopy } from "../eyeRest/content";
import { tipSections, tipsCopy as copy } from "./content";
import { findAdvice } from "./advice";
import { adviceCopy } from "./adviceCopy";

/** #144: why early checks matter, eye-friendly habits and when to see an eye doctor. */
export default function TipsScreen() {
  const { topic } = useLocalSearchParams<{ topic?: string | string[] }>();
  const selected = findAdvice(typeof topic === "string" ? topic : undefined);
  const missing = topic !== undefined && !selected;
  const sections = selected
    ? [{ key: selected.id, title: selected.title, tips: selected.tips }]
    : tipSections;
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {selected?.title ?? copy.title}
      </Text>
      {missing ? (
        <EmptyState
          icon="information-circle-outline"
          message={adviceCopy.missing}
          action={{ label: adviceCopy.browse, onPress: () => router.replace("/tips") }}
        />
      ) : sections.map((section) => (
        <Card key={section.key}>
          <Text variant="caption" accessibilityRole="header" style={styles.heading}>
            {section.title}
          </Text>
          {section.tips.map((tip) => (
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
          ))}
        </Card>
      ))}
      <Button
        label={eyeRestCopy.openFromTips}
        variant="secondary"
        // Eye rest is a tab (#263): go back to the tabs, a push would stack a second tab bar.
        onPress={() => router.dismissTo("/eye-rest")}
      />
      <Text variant="caption" style={styles.notice}>
        {copy.notice}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontWeight: "700", color: theme.colors.text },
  tip: { gap: theme.spacing.xs },
  source: { minHeight: 44, justifyContent: "center" },
  sourceText: { color: theme.colors.primary, textDecorationLine: "underline" },
  notice: { color: theme.colors.muted },
});
