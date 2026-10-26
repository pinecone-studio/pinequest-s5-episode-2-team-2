import { StyleSheet, View } from "react-native";
import { Card, Text } from "../../components/ui";
import type { LandmarkFrame } from "../vision/facePipeline";
import { guidanceForFrame } from "./guidance";

export function LiveGuidance({ frame }: { frame: LandmarkFrame | null }) {
  return (
    <View pointerEvents="none" style={styles.position}>
      <Card>
        <Text accessibilityLiveRegion="polite">{guidanceForFrame(frame)}</Text>
      </Card>
    </View>
  );
}
const styles = StyleSheet.create({
  position: { position: "absolute", bottom: 8, left: 8, right: 8 },
});
