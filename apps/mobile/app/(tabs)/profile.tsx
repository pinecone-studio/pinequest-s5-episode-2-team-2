import { router } from "expo-router";
import { Button, Card, Screen, Text } from "../../src/components/ui";
import { ProfileDashboard } from "../../src/features/dashboard/ProfileDashboard";
import { dashboardCopy } from "../../src/features/dashboard/copy";

export default function ProfileScreen() {
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {dashboardCopy.title}
      </Text>
      <ProfileDashboard />
      {/* History left the tab bar for eye-rest exercises, so Profile is its entry point. */}
      <Button
        label={dashboardCopy.history}
        variant="secondary"
        onPress={() => router.push("/history")}
      />
      <Button label={dashboardCopy.settings} onPress={() => router.push("/settings")} />
      {__DEV__ && (
        <Card>
          <Text>Хөгжүүлэгчийн тохиргоо</Text>
          <Button label="Бичлэг дахин тоглуулах" onPress={() => router.push("/scan/replay")} />
        </Card>
      )}
    </Screen>
  );
}
