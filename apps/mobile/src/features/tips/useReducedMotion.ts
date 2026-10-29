import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Default to still content until the device preference is known. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => active && setReduced(value),
      () => undefined,
    );
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  return reduced;
}
