import { Tabs } from "expo-router";
import { theme } from "../../src/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarIcon: () => null,
        tabBarLabelStyle: { fontSize: 14 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "TODO(copy): Home" }} />
      <Tabs.Screen name="scan" options={{ title: "TODO(copy): Scan" }} />
      <Tabs.Screen name="history" options={{ title: "TODO(copy): History" }} />
      <Tabs.Screen name="profile" options={{ title: "TODO(copy): Profile" }} />
    </Tabs>
  );
}
