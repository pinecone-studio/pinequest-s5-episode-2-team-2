import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../components/ui";
import { theme } from "../../theme";
import { adviceCopy } from "./adviceCopy";
import { tipsCopy, type Tip } from "./content";

/** Keep every medical statement beside its original source, including in topic details. */
export function TipSources({ tips }: { tips: readonly Tip[] }) {
  const [failed, setFailed] = useState(false);
  async function openSource(url: string) {
    setFailed(false);
    try {
      await Linking.openURL(url);
    } catch {
      setFailed(true);
    }
  }
  return (
    <View style={styles.list}>
      {tips.map((tip) => (
        <View key={tip.text} style={styles.tip}>
          <Text>{tip.text}</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityHint={tip.source.url}
            onPress={() => void openSource(tip.source.url)}
            style={styles.source}
          >
            <Text variant="caption" style={styles.sourceText}>
              {tipsCopy.sourcePrefix} {tip.source.label}
            </Text>
          </Pressable>
        </View>
      ))}
      {failed && <Text accessibilityRole="alert">{adviceCopy.sourceFailed}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing.md },
  tip: { gap: theme.spacing.xs },
  source: { minHeight: 44, justifyContent: "center" },
  sourceText: { color: theme.colors.primary, textDecorationLine: "underline" },
});
