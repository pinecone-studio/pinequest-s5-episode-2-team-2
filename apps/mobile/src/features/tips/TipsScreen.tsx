import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Card, Screen, Text } from "../../components/ui";
import { theme } from "../../theme";
import { tipSections, tipsCopy as copy } from "./content";

/** #144: why early checks matter, eye-friendly habits and when to see an eye doctor. */
export default function TipsScreen() {
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {copy.title}
      </Text>
      {tipSections.map((section) => (
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
