import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Text } from "../../components/ui";
import { fonts, theme } from "../../theme";
import type { AdviceId } from "../tips/advice";
import { adviceCopy } from "../tips/adviceCopy";
import { AdviceCarousel } from "../tips/AdviceCarousel";
import { DailyAdviceCard } from "../tips/DailyAdviceCard";
import { useDailyAdvice } from "../tips/useDailyAdvice";
import { Mascot } from "../../components/Mascot";

// The web demo's start-screen copy (demo/web-poc, apps/web-demo/src/strings.ts), a team draft.
// Home title and mascot follow the team's merged #281 branding.
const copy = {
  badge: "Туршилтын хувилбар",
  title: "Нүдхэн",
  tagline: "Хүүхэд, том хүний нүдний гэрлийн тусгалыг 3 секундэд шалгана",
  start: "Шалгаж эхлэх",
  footnote: "Зураг утаснаас гарахгүй · Онош биш",
} as const;

/** Keep the brand header; local advice is the focus of Home after #263. */
export default function HomeScreen() {
  const dailyAdvice = useDailyAdvice();
  function openAdvice(id: AdviceId) {
    router.push({ pathname: "/tips", params: { topic: id } });
  }
  return (
    <LinearGradient
      // Darker top than the web demo so the white text reaches WCAG contrast (#238).
      colors={[theme.colors.primary, theme.colors.heroMid, theme.colors.heroEnd]}
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
            <Mascot variant="wave" size={192} motion="float" />
          </View>
          <View style={styles.actions}>
            <Button label={`${copy.start}  ›`} onPress={() => router.navigate("/tests")} />
            <Text variant="caption" style={styles.footnote}>
              {copy.footnote}
            </Text>
          </View>
          <DailyAdviceCard advice={dailyAdvice} onOpen={openAdvice} />
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {adviceCopy.topics}
          </Text>
          <AdviceCarousel onOpen={openAdvice} />
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
  hero: { alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  sectionTitle: { fontWeight: "800", fontSize: 22, lineHeight: 30 },
  actions: { gap: 10 },
  footnote: { color: "#3E5A86", textAlign: "center" },
});
