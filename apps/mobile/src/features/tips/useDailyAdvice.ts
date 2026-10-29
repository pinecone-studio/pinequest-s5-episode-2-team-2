import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { getDailyAdvice, millisecondsUntilMidnight } from "./dailyAdvice";

/** Refresh at local midnight, on foregrounding and when returning to Home. */
export function useDailyAdvice() {
  const [advice, setAdvice] = useState(getDailyAdvice);
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout>;
      function refresh() {
        clearTimeout(timer);
        const now = new Date();
        setAdvice(getDailyAdvice(now));
        timer = setTimeout(refresh, millisecondsUntilMidnight(now));
      }
      refresh();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      return () => {
        clearTimeout(timer);
        subscription.remove();
      };
    }, []),
  );
  return advice;
}
