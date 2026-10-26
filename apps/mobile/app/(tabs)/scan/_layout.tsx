import { Stack } from "expo-router";
import { ScanResultProvider } from "../../../src/features/scan/ScanResultContext";

export default function ScanLayout() {
  return (
    <ScanResultProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ScanResultProvider>
  );
}
