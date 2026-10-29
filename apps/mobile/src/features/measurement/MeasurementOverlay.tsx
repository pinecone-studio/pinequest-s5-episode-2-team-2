import type { EyeMeasure } from "@app/core";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { coverTransform, debugLines, eyeMarks } from "./overlay";
import type { Size } from "./overlay";

// The web demo's colours: teal iris, amber reflex.
const IRIS = "#14B8A6";
const REFLEX = "#F59E0B";
const DOT = 6;

export interface MeasurementOverlayProps {
  frameSize: Size;
  eyes: readonly EyeMeasure[] | null;
  latencyMs: number | null;
  /** Why there are no eyes this frame, e.g. MODEL_UNAVAILABLE. */
  failure: string | null;
  /** Show the per-frame values; off when the marks are shown to parents. */
  values?: boolean;
}

/**
 * Iris circle and centre plus the reflex, drawn over the live preview like the web demo (#274),
 * and for tuning on device (#20) the per-frame values underneath.
 */
export function MeasurementOverlay({
  frameSize,
  eyes,
  latencyMs,
  failure,
  values = true,
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
      {values && (
        <View style={styles.panel}>
          {debugLines(eyes, latencyMs, failure).map((line) => (
            <Text key={line} style={styles.line}>
              {line}
            </Text>
          ))}
        </View>
      )}
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
