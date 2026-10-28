import { Image, StyleSheet, View } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro needs a static asset reference.
const eyeMark = require("../../../assets/splash-icon.png");

/**
 * Share the original MIT-licensed eye mark used by the native splash (#142).
 * Source and licence: assets/branding/README.md. Decorative only.
 */
export function EyeHero({ size = 240 }: { size?: number }) {
  // The transparent asset margins keep the visible eye near the original 78% width.
  const markSize = size * 1.1;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.glow, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <View style={[styles.halo, { width: size * 0.8, height: size * 0.8, borderRadius: size }]} />
      <Image
        source={eyeMark}
        resizeMode="contain"
        accessible={false}
        style={{ width: markSize, height: markSize }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  halo: { position: "absolute", backgroundColor: "rgba(255,255,255,0.45)" },
});
