import { Redirect, Tabs, useSegments } from "expo-router";
import { useConsentStatus } from "../../src/features/onboarding/useConsentStatus";
import { fonts, theme } from "../../src/theme";

export default function TabLayout() {
  // No tab (including Scan) is reachable until the current consent is stored (#30).
  const consent = useConsentStatus();
  const segments = useSegments();
  if (consent === "loading") return null;
  if (consent === "missing") return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: segments.at(-1) === "result" ? { display: "none" } : undefined,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarIcon: () => null,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 14 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Нүүр" }} />
      <Tabs.Screen name="scan" options={{ title: "Шалгах" }} />
      <Tabs.Screen name="history" options={{ title: "Түүх" }} />
      <Tabs.Screen name="profile" options={{ title: "Профайл" }} />
    </Tabs>
  );
}
