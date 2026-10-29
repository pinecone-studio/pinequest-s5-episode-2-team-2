/* eslint-disable @typescript-eslint/no-require-imports -- Metro requires literal local asset paths. */
import type { ImageSourcePropType } from "react-native";
import type { AdviceId } from "./advice";

/** Bundled offline portraits; source and owner permission: assets/illustrations/README.md. */
export const adviceImages: Record<AdviceId, ImageSourcePropType> = {
  "early-checks": require("../../../assets/illustrations/early-checks.png"),
  "screen-time": require("../../../assets/illustrations/screen-time.png"),
  "outdoor-time": require("../../../assets/illustrations/outdoor-time.png"),
  "doctor-signs": require("../../../assets/illustrations/doctor-signs.png"),
};
