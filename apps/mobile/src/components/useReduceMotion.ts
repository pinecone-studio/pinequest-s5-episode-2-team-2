import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Follows the system Reduce Motion setting. */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => active && setReduce(value),
      () => active && setReduce(false),
    );
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}
