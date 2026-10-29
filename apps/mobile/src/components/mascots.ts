/* eslint-disable @typescript-eslint/no-require-imports -- Metro needs static asset references. */
import type { ImageSourcePropType } from "react-native";

/**
 * The seven Нүдхэн mascot poses (team artwork, see assets/mascots/README.md).
 * Each one has a single job so a screen shows at most one mascot:
 * - idle_happy: splash and the onboarding welcome
 * - wave: the Home greeting
 * - thinking: preparation tips and "please retake" explanations
 * - camera: the strabismus check card and the camera onboarding step (never over the live preview)
 * - search: the "processing the photos" state
 * - celebrate: finishing a check; it thanks the child for taking part and never grades the result
 * - guide: parent tips and help
 */
export const mascotSources = {
  idle_happy: require("../../assets/mascots/idle_happy.png"),
  wave: require("../../assets/mascots/wave.png"),
  thinking: require("../../assets/mascots/thinking.png"),
  camera: require("../../assets/mascots/camera.png"),
  search: require("../../assets/mascots/search.png"),
  celebrate: require("../../assets/mascots/celebrate.png"),
  guide: require("../../assets/mascots/guide.png"),
} satisfies Record<string, ImageSourcePropType>;

export type MascotVariant = keyof typeof mascotSources;
