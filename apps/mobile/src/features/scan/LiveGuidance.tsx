import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Card, Text } from "../../components/ui";
import type { LandmarkFrame } from "../vision/facePipeline";
import { guidanceForFrame } from "./guidance";
import { initialSteady, nextSteady } from "./steadyGuidance";

export function LiveGuidance({ frame }: { frame: LandmarkFrame | null }) {
  const steady = useRef(initialSteady);
  const lastFrame = useRef<LandmarkFrame | null | undefined>(undefined);
  // Feed each frame once, even if the component re-renders for another reason.
  if (lastFrame.current !== frame) {
    lastFrame.current = frame;
    steady.current = nextSteady(steady.current, guidanceForFrame(frame));
  }
  return (
    <View pointerEvents="none" style={styles.position}>
      <Card>
        <Text accessibilityLiveRegion="polite">{steady.current.shown}</Text>
      </Card>
    </View>
  );
}
const styles = StyleSheet.create({
  position: { position: "absolute", bottom: 8, left: 8, right: 8 },
});
