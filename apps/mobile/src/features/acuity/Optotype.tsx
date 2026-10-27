import { StyleSheet, View } from "react-native";
import type { Direction } from "./acuity";

/** Width of the crowded letter in E strokes: the E (5) plus a bar and a gap on each side. */
export const CROWDED_UNITS = 12;
const INK = "#000000";

/**
 * Tumbling E, `size` points tall (5 strokes), opening towards `direction` (0 = right).
 * With `crowded`, bars surround the letter as in the web demo's crowded optotype.
 */
export function Optotype({
  size,
  direction,
  crowded,
}: {
  size: number;
  direction: Direction;
  crowded: boolean;
}) {
  const unit = size / 5;
  const box = crowded ? unit * CROWDED_UNITS : size;
  const offset = crowded ? unit * 3.5 : 0;
  const bar = (left: number, top: number, width: number, height: number) => ({
    left: offset + left * unit,
    top: offset + top * unit,
    width: width * unit,
    height: height * unit,
  });
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: box, height: box, transform: [{ rotate: `${direction}deg` }] }}
    >
      {/* E: three horizontal strokes joined by the left stroke. */}
      <View style={[styles.ink, bar(0, 0, 5, 1)]} />
      <View style={[styles.ink, bar(0, 2, 5, 1)]} />
      <View style={[styles.ink, bar(0, 4, 5, 1)]} />
      <View style={[styles.ink, bar(0, 0, 1, 5)]} />
      {crowded && (
        <>
          <View style={[styles.ink, bar(0, -3.5, 5, 1)]} />
          <View style={[styles.ink, bar(0, 7.5, 5, 1)]} />
          <View style={[styles.ink, bar(-3.5, 0, 1, 5)]} />
          <View style={[styles.ink, bar(7.5, 0, 1, 5)]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ ink: { position: "absolute", backgroundColor: INK } });
