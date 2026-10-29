import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { mascotCopy } from "./mascotCopy";
import { useReduceMotion } from "./useReduceMotion";
import { mascotSources, type MascotVariant } from "./mascots";

export type MascotMotion = "none" | "float" | "pop";

type Props = {
  variant: MascotVariant;
  /** Largest width in points; on narrow phones it shrinks to `maxScreenShare` of the screen. */
  size?: number;
  maxScreenShare?: number;
  /** Decorative (default) hides it from screen readers; otherwise it is read as "Нүдхэн". */
  decorative?: boolean;
  /**
   * Soft motion for welcome, home and completion screens only. Never animate during the camera
   * capture or the E chart test. Reduce Motion turns every motion off.
   */
  motion?: MascotMotion;
  /** A pastel disc behind the mascot. */
  halo?: string;
};

export { useReduceMotion };

export function Mascot({
  variant,
  size = 200,
  maxScreenShare = 0.6,
  decorative = true,
  motion = "none",
  halo,
}: Props) {
  const { width } = useWindowDimensions();
  const side = Math.round(Math.min(size, width * maxScreenShare));
  const reduceMotion = useReduceMotion();
  const animate = motion !== "none" && !reduceMotion;
  // Starts fully shown, so the mascot is never hidden while Reduce Motion is still being read.
  const enter = useRef(new Animated.Value(1)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      enter.setValue(1);
      bob.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    if (motion === "pop") enter.setValue(0);
    const intro =
      motion === "pop"
        ? Animated.spring(enter, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true })
        : null;
    if (intro) intro.start(() => loop.start());
    else loop.start();
    return () => {
      intro?.stop();
      loop.stop();
    };
  }, [animate, motion, enter, bob]);

  const transform = [
    { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -side * 0.04] }) },
    { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
  ];

  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : "image"}
      accessibilityLabel={decorative ? undefined : mascotCopy.label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "yes"}
      style={[styles.wrap, { width: side, height: side }]}
    >
      {halo && (
        <View
          style={[
            styles.halo,
            { width: side * 0.9, height: side * 0.9, borderRadius: side, backgroundColor: halo },
          ]}
        />
      )}
      <Animated.Image
        testID={`mascot-${variant}`}
        source={mascotSources[variant]}
        resizeMode="contain"
        accessible={false}
        style={{ width: side * 0.86, height: side * 0.86, opacity: enter, transform }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", alignSelf: "center" },
  halo: { position: "absolute" },
});
