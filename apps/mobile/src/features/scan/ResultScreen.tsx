import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button, Text } from "../../components/ui";
import { EyeDiagramView } from "../eyeView/EyeDiagramView";
import { SaveResultButton } from "./SaveResultButton";
import { useScanResult } from "./ScanResultContext";
import { outcomeCopy, reasonCopy, resultCopy as copy } from "./resultCopy";

export default function ResultScreen() {
  const { result, setResult, eyes } = useScanResult();
  const outcome = result ? outcomeCopy[result.outcome] : null;
  const retry = () => {
    setResult(null);
    router.dismissTo("/scan");
  };
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          onPress={retry}
          style={styles.back}
        >
          <Text style={styles.arrow}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {copy.title}
        </Text>
        {result && outcome ? (
          <>
            {eyes ? (
              <EyeDiagramView eyes={eyes} />
            ) : (
              <>
                <View style={styles.preview} accessible accessibilityLabel={copy.illustration}>
                  {[0, 1].map((eye) => (
                    <View key={eye} style={styles.eye}>
                      <View style={styles.iris}>
                        <View style={styles.glint} />
                      </View>
                    </View>
                  ))}
                  <View style={styles.guide} />
                </View>
                <Text variant="caption" style={styles.muted}>
                  {result.modelVersion === "mock" ? copy.mock : copy.illustration}
                </Text>
              </>
            )}
            <View style={[styles.card, { backgroundColor: outcome.background }]}>
              <View style={styles.row}>
                <Text accessible={false} style={[styles.icon, { color: outcome.color }]}>
                  {outcome.icon}
                </Text>
                <Text accessibilityRole="header" style={[styles.outcome, { color: outcome.color }]}>
                  {outcome.title}
                </Text>
              </View>
              <Text style={styles.body}>{outcome.explanation}</Text>
            </View>
            {result.reasons.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.heading}>{copy.reasons}</Text>
                {[...new Set(result.reasons)].map((reason) => (
                  <Text key={reason} style={styles.body}>
                    • {reasonCopy[reason]}
                  </Text>
                ))}
              </View>
            )}
            <View style={styles.section}>
              <Text style={styles.heading}>{copy.next}</Text>
              <Text style={styles.body}>{outcome.next}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.body}>{copy.empty}</Text>
        )}
        <Text style={[styles.body, styles.notice]}>{copy.notice}</Text>
        <Button label={copy.retry} onPress={retry} style={styles.primary} />
        {result && <SaveResultButton result={result} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FBFF" },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  back: { minHeight: 44, minWidth: 44, justifyContent: "center", alignSelf: "flex-start" },
  arrow: { fontSize: 32, color: "#153C80" },
  title: { fontSize: 23, lineHeight: 30, fontWeight: "700", color: "#153C80", marginBottom: 4 },
  preview: {
    height: 120,
    backgroundColor: "#E7F0FF",
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    overflow: "hidden",
  },
  eye: {
    width: 90,
    height: 46,
    borderRadius: 45,
    borderWidth: 1,
    borderColor: "#7190B5",
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  iris: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 9,
    borderColor: "#5C8CAA",
    backgroundColor: "#19344B",
  },
  glint: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "white",
    position: "absolute",
    top: -2,
    left: -2,
  },
  guide: {
    position: "absolute",
    height: "100%",
    width: 1,
    backgroundColor: "#3CC4B3",
    left: "50%",
  },
  card: { padding: 16, borderRadius: 18, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { fontSize: 26, fontWeight: "700", width: 32, textAlign: "center" },
  outcome: { flex: 1, fontSize: 18, lineHeight: 25, fontWeight: "700" },
  section: { gap: 5 },
  heading: { fontSize: 15, lineHeight: 22, fontWeight: "700", color: "#153C80" },
  body: { fontSize: 14, lineHeight: 21, color: "#31547E" },
  muted: { fontSize: 12, lineHeight: 18, color: "#536C8B" },
  notice: { padding: 12, borderRadius: 12, backgroundColor: "#EDF3FF" },
  primary: { backgroundColor: "#137BFA", borderRadius: 24, minHeight: 48 },
});
