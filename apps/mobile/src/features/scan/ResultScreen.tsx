import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button, Card, Notice, Text, Verdict } from "../../components/ui";
import { fonts, theme } from "../../theme";
import { EyeDiagramView } from "../eyeView/EyeDiagramView";
import { tipsCopy } from "../tips/content";
import { SaveResultButton } from "./SaveResultButton";
import { useScanResult } from "./ScanResultContext";
import { outcomeCopy, reasonCopy, resultCopy as copy } from "./resultCopy";
import { SCAN_POLICY_VERSION } from "./scanPolicy";

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
        {result?.policyVersion === SCAN_POLICY_VERSION && (
          <Notice>
            <Text accessibilityRole="alert" style={styles.alert}>
              {copy.demo}
            </Text>
          </Notice>
        )}
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
            <Verdict outcome={result.outcome} title={outcome.title} icon={outcome.icon}>
              <Text style={styles.body}>{outcome.explanation}</Text>
            </Verdict>
            {result.reasons.length > 0 && (
              <Card>
                <Text style={styles.heading}>{copy.reasons}</Text>
                {[...new Set(result.reasons)].map((reason) => (
                  <Text key={reason} style={styles.body}>
                    • {reasonCopy[reason]}
                  </Text>
                ))}
              </Card>
            )}
            <Card>
              <Text style={styles.heading}>{copy.next}</Text>
              <Text style={styles.body}>{outcome.next}</Text>
            </Card>
          </>
        ) : (
          <Text style={styles.body}>{copy.empty}</Text>
        )}
        <Notice>{copy.notice}</Notice>
        <Button label={copy.retry} onPress={retry} />
        <Button
          label={tipsCopy.openTips}
          variant="secondary"
          onPress={() => router.push("/tips")}
        />
        {result &&
          (result.policyVersion === SCAN_POLICY_VERSION ? (
            <Text accessibilityLiveRegion="polite">{copy.saved}</Text>
          ) : (
            <SaveResultButton result={result} />
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// Styled like the web demo's result page (#152): page title, verdict card, white section
// cards, amber notices and pill buttons from the shared components.
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    gap: 14,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  back: { minHeight: 44, minWidth: 44, justifyContent: "center", alignSelf: "flex-start" },
  arrow: { fontFamily: fonts.bold, fontSize: 32, color: theme.colors.text },
  title: {
    fontFamily: fonts.black,
    fontWeight: "900",
    fontSize: 26,
    lineHeight: 32,
    color: theme.colors.text,
  },
  alert: { color: theme.colors.onNotice, fontFamily: fonts.bold, fontWeight: "700", fontSize: 13 },
  preview: {
    height: 120,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.md,
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
    borderColor: theme.colors.primary,
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
    backgroundColor: "#14B8A6",
    left: "50%",
  },
  heading: { fontFamily: fonts.black, fontWeight: "900", fontSize: 17, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22, color: theme.colors.muted },
  muted: { color: theme.colors.muted },
});
