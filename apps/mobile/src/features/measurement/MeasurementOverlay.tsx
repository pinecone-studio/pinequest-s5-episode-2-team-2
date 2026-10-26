import type { EyeMeasure } from "@app/core";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { coverTransform, debugLines, eyeMarks } from "./overlay";
import type { Size } from "./overlay";

const IRIS = "#00ff80";
const REFLEX = "#ff3b30";
const DOT = 6;

export interface MeasurementOverlayProps {
  frameSize: Size;
  eyes: readonly EyeMeasure[] | null;
  latencyMs: number | null;
  /** Why there are no eyes this frame, e.g. MODEL_UNAVAILABLE. */
  failure: string | null;
}

/**
 * Developer-only overlay for tuning the measurement on device (#20): iris circle and centre
 * plus the reflex, drawn over the live preview, and the per-frame values underneath.
 */
export function MeasurementOverlay({
  frameSize,
  eyes,
  latencyMs,
  failure,
}: MeasurementOverlayProps) {
  const [view, setView] = useState<Size>({ width: 0, height: 0 });
  const t = coverTransform(frameSize, view);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setView(event.nativeEvent.layout)}
    >
      {t &&
        eyes?.map((eye) => {
          const m = eyeMarks(eye, t);
          return (
            <View key={m.side} testID={`eye-${m.side}`} style={StyleSheet.absoluteFill}>
              <View
                testID="iris-circle"
                style={[
                  styles.ring,
                  {
                    left: m.center.x - m.radius,
                    top: m.center.y - m.radius,
                    width: m.radius * 2,
                    height: m.radius * 2,
                    borderRadius: m.radius,
                  },
                ]}
              />
              <View
                testID="iris-center"
                style={[styles.dot, { left: m.center.x - DOT / 2, top: m.center.y - DOT / 2 }]}
              />
              {m.reflex && (
                <View
                  testID="reflex"
                  style={[
                    styles.dot,
                    styles.reflex,
                    { left: m.reflex.x - DOT / 2, top: m.reflex.y - DOT / 2 },
                  ]}
                />
              )}
            </View>
          );
        })}
      <View style={styles.panel}>
        {debugLines(eyes, latencyMs, failure).map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: "absolute", borderWidth: 1, borderColor: IRIS },
  dot: {
    position: "absolute",
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: IRIS,
  },
  reflex: { backgroundColor: REFLEX },
  panel: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    padding: 6,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  line: { color: "#ffffff", fontFamily: "Menlo", fontSize: 11 },
});
