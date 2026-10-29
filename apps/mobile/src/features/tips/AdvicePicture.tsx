import { useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { EmptyState, Loading } from "../../components/EmptyState";
import { adviceCopy } from "./adviceCopy";

/** Preserve the complete owner-provided portrait; the card text supplies its meaning. */
export function AdvicePicture({ source }: { source: ImageSourcePropType }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.frame}
    >
      {state === "failed" ? (
        <EmptyState icon="image-outline" message={adviceCopy.imageUnavailable} />
      ) : (
        <>
          <Image
            source={source}
            resizeMode="contain"
            accessible={false}
            style={StyleSheet.absoluteFill}
            onLoad={() => setState("ready")}
            onError={() => setState("failed")}
          />
          {state === "loading" && (
            <View style={styles.loading}>
              <Loading label={adviceCopy.loading} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    aspectRatio: 9 / 16,
    borderRadius: 20,
    overflow: "hidden",
    justifyContent: "center",
    backgroundColor: "#F3F7FF",
  },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
});
