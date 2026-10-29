import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Mascot } from "../../components/Mascot";
import type { MascotVariant } from "../../components/mascots";
import { Button, Text } from "../../components/ui";
import { fonts, theme } from "../../theme";
import { saveConsent } from "./consent";
import { onboardingCopy as copy, onboardingPages as pages } from "./copy";

const icons = [
  "eye-outline",
  "information-circle-outline",
  "shield-checkmark-outline",
  "camera-outline",
] as const;

/** One mascot per page where it helps; the privacy page keeps its plain shield icon. */
const mascots: Partial<Record<(typeof pages)[number]["key"], MascotVariant>> = {
  purpose: "idle_happy",
  limits: "guide",
  how: "camera",
};

export default function OnboardingScreen() {
  const compact = useWindowDimensions().height < 700;
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
    <LinearGradient
      colors={[theme.colors.primary, theme.colors.heroMid, theme.colors.heroEnd]}
      locations={[0, 0.55, 1]}
      style={styles.fill}
    >
      <SafeAreaView style={styles.fill}>
        <ScrollView contentContainerStyle={[styles.content, compact && styles.compactContent]}>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 1,
              max: pages.length,
              now: index + 1,
              text: copy.step(index + 1, pages.length),
            }}
            style={styles.dots}
          >
            {pages.map((item, position) => (
              <View key={item.key} style={[styles.dot, position === index && styles.activeDot]} />
            ))}
          </View>
          <View style={styles.intro}>
            {mascots[page.key] ? (
              <Mascot
                key={page.key}
                variant={mascots[page.key]!}
                size={compact ? 170 : 240}
                // Only the welcome page moves; the other pages stay calm to read.
                motion={index === 0 ? "pop" : "none"}
                halo="rgba(255,255,255,0.22)"
              />
            ) : (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.hero, compact && styles.compactHero]}
              >
                <Ionicons name={icons[index]} size={compact ? 80 : 112} color="#FFFFFF" />
              </View>
            )}
            <Text variant="title" accessibilityRole="header" style={styles.title}>
              {page.title}
            </Text>
            <Text style={styles.body}>{page.body}</Text>
          </View>
          <View style={styles.actions}>
            {isLast && (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed, disabled: saving }}
                disabled={saving}
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
              <Button
                label={copy.back}
                variant="secondary"
                disabled={saving}
                onPress={() => setIndex(index - 1)}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, padding: theme.spacing.lg, gap: 24 },
  compactContent: { gap: 12 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.45)" },
  activeDot: { width: 24, backgroundColor: "#FFFFFF" },
  intro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  hero: {
    width: 208,
    height: 208,
    borderRadius: 104,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  compactHero: { width: 144, height: 144, borderRadius: 72 },
  title: {
    fontFamily: fonts.black,
    fontWeight: "900",
    fontSize: 32,
    lineHeight: 40,
    color: theme.colors.text,
    textAlign: "center",
  },
  body: {
    textAlign: "center",
    color: theme.colors.text,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: theme.radius.md,
    padding: 20,
    alignSelf: "stretch",
  },
  actions: { gap: 12 },
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
});
