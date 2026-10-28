import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "../../theme";

/** Keep the camera and face guide in the same coordinate space. */
export function ScanPreview({ children }: { children?: ReactNode }) {
  return (
    <View style={styles.preview}>
      {children}
      <View
        pointerEvents="none"
        style={styles.guide}
        accessible
        accessibilityLabel="Нүүрээ хүрээнд байрлуулна уу"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    height: 320,
    overflow: "hidden",
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  guide: {
    width: "68%",
    height: "80%",
    borderWidth: 3,
    borderColor: theme.colors.onPrimary,
    borderRadius: 120,
  },
});
