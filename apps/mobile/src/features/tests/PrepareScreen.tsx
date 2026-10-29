import { router } from "expo-router";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Screen, Text } from "../../components/ui";
import { fonts, theme } from "../../theme";
import { testsCopy } from "./copy";
import { StepPicture } from "./pictures";

const copy = testsCopy.prepare;
type Step = keyof typeof copy.steps;

const PICTURES: Record<Step, ComponentProps<typeof StepPicture>> = {
  distance: {
    from: "phone-portrait-outline",
    to: "happy-outline",
    label: testsCopy.checks.strabismus.mark,
  },
  light: { from: "moon-outline", to: "flashlight-outline" },
  look: { from: "eye-outline", to: "camera-outline" },
};
const STEPS = Object.keys(copy.steps) as Step[];

/** Three pictured steps before the strabismus camera opens from the Шалгах tab (#264). */
export default function PrepareScreen() {
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {copy.title}
      </Text>
      <Text style={styles.muted}>{copy.intro}</Text>
      {STEPS.map((step, i) => (
        <Card key={step}>
          <StepPicture {...PICTURES[step]} />
          <View style={styles.row}>
            <View style={styles.number}>
              <Text maxFontSizeMultiplier={1} style={styles.numberText}>
                {i + 1}
              </Text>
            </View>
            <Text style={styles.text}>{copy.steps[step]}</Text>
          </View>
        </Card>
      ))}
      {/* Replace, so the camera's back button returns to the chooser, not to these steps. */}
      <Button label={copy.continue} onPress={() => router.replace("/scan")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: theme.colors.muted },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  numberText: { color: theme.colors.onPrimary, fontFamily: fonts.black, fontWeight: "900" },
  text: { flex: 1 },
});
