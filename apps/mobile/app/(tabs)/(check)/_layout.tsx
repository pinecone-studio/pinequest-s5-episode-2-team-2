import { Stack, useSegments } from "expo-router";
import { stackHeader } from "../../../src/components/stackHeader";

// The Шалгах tab (#263) opens on the test chooser; the scan is pushed on top of it, so it has a way back.
export const unstable_settings = { initialRouteName: "tests" };

export default function CheckLayout() {
  const segments = useSegments();
  return (
    <Stack screenOptions={stackHeader}>
      <Stack.Screen name="tests" options={{ headerShown: false }} />
      {/* The result screen has its own buttons and safe area, as before. */}
      <Stack.Screen name="scan" options={{ headerShown: segments.at(-1) !== "result" }} />
    </Stack>
  );
}
