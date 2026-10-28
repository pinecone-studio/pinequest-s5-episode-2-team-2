import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text } from "../../components/ui";
import { fonts, theme } from "../../theme";
import { LatestScanCard } from "../history/LatestScanCard";
import { tipsCopy } from "../tips/content";
import { EyeHero } from "./EyeHero";

// The web demo's start-screen copy (demo/web-poc, apps/web-demo/src/strings.ts), a team draft.
// Approved by the team lead; the app name is decided in #142.
const copy = {
  badge: "Туршилтын хувилбар",
  title: "Нүдний гэрэл",
  tagline: "Хүүхэд, том хүний нүдний гэрлийн тусгалыг 3 секундэд шалгана",
  start: "Шалгаж эхлэх",
  vision: "Хараа шалгах",
  footnote: "Зураг утаснаас гарахгүй · Онош биш",
} as const;

/** Start screen in the web demo's style (#152): gradient, title, illustration, actions. */
export default function HomeScreen() {
  return (
    <LinearGradient
      // Darker top than the web demo so the white text reaches WCAG contrast (#238).
      colors={[theme.colors.primary, "#5F97F5", "#DCEBFF"]}
      locations={[0, 0.55, 1]}
      style={styles.fill}
    >
      <SafeAreaView edges={["top", "left", "right"]} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.head}>
            <Text style={styles.badge}>{copy.badge.toUpperCase()}</Text>
            <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} style={styles.title}>
              {copy.title}
            </Text>
            <Text style={styles.tagline}>{copy.tagline}</Text>
          </View>
          <View style={styles.hero}>
            <EyeHero />
          </View>
          <View style={styles.actions}>
            <Button label={`${copy.start}  ›`} onPress={() => router.navigate("/tests")} />
            <Button
              label={copy.vision}
              variant="secondary"
              onPress={() => router.navigate("/acuity")}
            />
            <Button
              label={tipsCopy.openTips}
              variant="secondary"
              onPress={() => router.navigate("/tips")}
            />
            <Text variant="caption" style={styles.footnote}>
              {copy.footnote}
            </Text>
          </View>
          <LatestScanCard />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, padding: 20, gap: 16 },
  head: { alignItems: "center", gap: 10, marginTop: 24 },
  badge: {
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1,
    color: "#FFFFFF",
    backgroundColor: "rgba(29,43,79,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  title: {
    fontFamily: fonts.black,
    fontWeight: "900",
    fontSize: 40,
    lineHeight: 46,
    color: "#FFFFFF",
    textAlign: "center",
    textShadowColor: "rgba(31,85,196,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  tagline: {
    fontFamily: fonts.bold,
    fontWeight: "700",
    fontSize: 17,
    lineHeight: 23,
    color: "#FFFFFF",
    textAlign: "center",
    maxWidth: 300,
  },
  hero: { flex: 1, minHeight: 240, alignItems: "center", justifyContent: "center" },
  actions: { gap: 10 },
  footnote: { color: "#3E5A86", textAlign: "center" },
});
