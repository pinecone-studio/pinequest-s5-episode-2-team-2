import { Redirect, Tabs, useSegments } from "expo-router";
import { tabIcon } from "../../src/components/tabIcon";
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
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Нүүр", tabBarIcon: tabIcon("home") }} />
      <Tabs.Screen name="(check)" options={{ title: "Шалгах", tabBarIcon: tabIcon("eye") }} />
      <Tabs.Screen name="eye-rest" options={{ title: "Дасгал", tabBarIcon: tabIcon("fitness") }} />
      <Tabs.Screen name="profile" options={{ title: "Профайл", tabBarIcon: tabIcon("person") }} />
    </Tabs>
  );
}
