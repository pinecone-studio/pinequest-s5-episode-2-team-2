import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { LandmarkFrame } from "./facePipeline";

export function LandmarkOverlay({ frame }: { frame: LandmarkFrame | null }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const scale = frame
    ? Math.max(size.width / frame.frameSize.width, size.height / frame.frameSize.height)
    : 0;
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessible={false}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
    >
      {frame?.landmarks.slice(468, 478).map((point, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: "#00ff80",
            left: point.x * scale + (size.width - frame.frameSize.width * scale) / 2 - 2,
            top: point.y * scale + (size.height - frame.frameSize.height * scale) / 2 - 2,
          }}
        />
      ))}
    </View>
  );
}
