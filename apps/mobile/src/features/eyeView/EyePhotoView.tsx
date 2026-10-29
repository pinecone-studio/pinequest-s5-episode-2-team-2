import type { EyeMeasure, Point } from "@app/core";
import { useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Text } from "../../components/ui";
import { theme } from "../../theme";
import { eyeViewCopy as copy } from "./copy";
import { rgbPngUri } from "./png";

const SIZE = 140;
const REFLEX = 12;
// The web demo's marks: teal iris, amber reflex.
const IRIS_COLOR = "#14B8A6";
const REFLEX_COLOR = "#F59E0B";

/** One eye crop as measured: the frame square it covers and its 128 × 128 RGB pixels. */
export interface EyePhoto {
  crop: { x: number; y: number; size: number };
  pixels: Uint8Array;
}
export type ResultPhotos = readonly [EyePhoto, EyePhoto];

/** Where a frame point falls in a size × size box showing `crop`. */
export function photoPoint(p: Point, crop: EyePhoto["crop"], size: number): Point {
  return { x: ((p.x - crop.x) / crop.size) * size, y: ((p.y - crop.y) / crop.size) * size };
}

/**
 * Both measured eyes as the camera saw them, with the iris circle and reflex drawn on, like
 * the web demo's result (#274). The crops come from memory and are never saved.
 */
export function EyePhotoView({
  eyes,
  photos,
}: {
  eyes: readonly [EyeMeasure, EyeMeasure];
  photos: ResultPhotos;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{copy.title}</Text>
      <View style={styles.row}>
        {eyes.map((eye, i) => (
          <EyePhotoBox key={eye.side} eye={eye} photo={photos[i]!} />
        ))}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { borderColor: IRIS_COLOR }]} />
          <Text variant="caption">{copy.photo.iris}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: REFLEX_COLOR }]} />
          <Text variant="caption">{copy.photo.reflex}</Text>
        </View>
      </View>
      <Text variant="caption" style={styles.muted}>
        {copy.photo.notSaved}
      </Text>
    </View>
  );
}

function EyePhotoBox({ eye, photo }: { eye: EyeMeasure; photo: EyePhoto }) {
  const uri = useMemo(() => rgbPngUri(128, 128, photo.pixels), [photo.pixels]);
  const center = photoPoint(eye.irisCenter, photo.crop, SIZE);
  const radius = (eye.irisRadius / photo.crop.size) * SIZE;
  const reflex = eye.reflex && photoPoint(eye.reflex, photo.crop, SIZE);
  const offset = eye.reflexOffset;
  const label = `${copy.sides[eye.side]}: ${
    offset ? copy.reflexAt(offset.x, offset.y) : copy.noReflex
  }`;
  return (
    <View style={styles.eye} accessible accessibilityLabel={label}>
      <View style={styles.box}>
        <Image source={{ uri }} style={styles.image} accessibilityIgnoresInvertColors />
        <View
          testID="photo-iris"
          style={[
            styles.iris,
            {
              left: center.x - radius,
              top: center.y - radius,
              width: radius * 2,
              height: radius * 2,
              borderRadius: radius,
            },
          ]}
        />
        {reflex && (
          <View
            testID="photo-reflex"
            style={[styles.reflex, { left: reflex.x - REFLEX / 2, top: reflex.y - REFLEX / 2 }]}
          />
        )}
      </View>
      <Text variant="caption">{copy.sides[eye.side]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  heading: { fontWeight: "600" },
  muted: { color: theme.colors.muted },
  row: { flexDirection: "row", justifyContent: "space-around" },
  eye: { alignItems: "center", gap: theme.spacing.xs },
  box: {
    width: SIZE,
    height: SIZE,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.text,
    overflow: "hidden",
  },
  image: { width: SIZE, height: SIZE },
  iris: { position: "absolute", borderWidth: 2, borderColor: IRIS_COLOR },
  reflex: {
    position: "absolute",
    width: REFLEX,
    height: REFLEX,
    borderRadius: REFLEX / 2,
    borderWidth: 2,
    borderColor: REFLEX_COLOR,
  },
  legend: { flexDirection: "row", justifyContent: "center", gap: theme.spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: REFLEX_COLOR },
});
