import { StyleSheet, View } from "react-native";
import { theme } from "../../theme";

/**
 * Home illustration (#152): an eye with the torch's light reflex, drawn with plain views so
 * no artwork licence is needed. Decorative only.
 */
export function EyeHero({ size = 240 }: { size?: number }) {
  const eyeWidth = size * 0.78;
  const eyeHeight = size * 0.42;
  const iris = eyeHeight * 0.92;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.glow, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <View style={[styles.halo, { width: size * 0.8, height: size * 0.8, borderRadius: size }]} />
      <View
        style={[
          styles.eye,
          { width: eyeWidth, height: eyeHeight, borderRadius: eyeHeight, borderWidth: size / 60 },
        ]}
      >
        <View style={[styles.iris, { width: iris, height: iris, borderRadius: iris / 2 }]}>
          <View
            style={[
              styles.pupil,
              { width: iris * 0.46, height: iris * 0.46, borderRadius: iris * 0.23 },
            ]}
          />
          <View
            style={[
              styles.reflex,
              {
                width: iris * 0.16,
                height: iris * 0.16,
                borderRadius: iris * 0.08,
                top: iris * 0.26,
                left: iris * 0.56,
              },
            ]}
          />
        </View>
      </View>
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
  eye: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#1D2B4F",
    overflow: "hidden",
  },
  iris: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    borderWidth: 3,
    borderColor: "#1F55C4",
  },
  pupil: { backgroundColor: "#0F1B2D" },
  reflex: { position: "absolute", backgroundColor: "#FFFFFF" },
});
