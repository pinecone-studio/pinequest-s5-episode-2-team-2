import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Screen, Text } from "../../components/ui";
import { theme } from "../../theme";
import { saveConsent } from "./consent";
import { onboardingCopy as copy, onboardingPages as pages } from "./copy";

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const [index, setIndex] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const page = pages[index] ?? pages[0];
  const isLast = index === pages.length - 1;

  async function accept() {
    setSaving(true);
    setFailed(false);
    try {
      await saveConsent(db);
      router.replace("/");
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text variant="caption" style={styles.step}>
        {copy.step(index + 1, pages.length)}
      </Text>
      <Text variant="title" accessibilityRole="header">
        {page.title}
      </Text>
      <Card>
        <Text>{page.body}</Text>
      </Card>

      {isLast && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          onPress={() => setAgreed((value) => !value)}
          style={styles.checkRow}
        >
          <View style={[styles.box, agreed && styles.boxChecked]}>
            {agreed && <Text style={styles.tick}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>{copy.consent}</Text>
        </Pressable>
      )}

      {failed && <Text accessibilityRole="alert">{copy.saveError}</Text>}

      {isLast ? (
        <Button label={copy.accept} disabled={!agreed || saving} onPress={accept} />
      ) : (
        <Button label={copy.next} onPress={() => setIndex(index + 1)} />
      )}
      {index > 0 && (
        <Pressable accessibilityRole="button" onPress={() => setIndex(index - 1)}>
          <Text style={styles.back}>{copy.back}</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { color: theme.colors.muted },
  checkRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  box: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: theme.colors.primary },
  tick: { color: theme.colors.onPrimary, fontWeight: "700" },
  checkLabel: { flex: 1 },
  back: { color: theme.colors.primary, textAlign: "center", padding: theme.spacing.sm },
});
