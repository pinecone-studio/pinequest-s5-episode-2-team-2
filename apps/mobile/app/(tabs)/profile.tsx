import { router } from "expo-router";
import { Button, Card, Screen, Text } from "../../src/components/ui";
import { ProfileDashboard } from "../../src/features/dashboard/ProfileDashboard";
import { dashboardCopy } from "../../src/features/dashboard/copy";
import { historyCopy } from "../../src/features/history/copy";

export default function ProfileScreen() {
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {dashboardCopy.title}
      </Text>
      <ProfileDashboard />
      {/* History moved here from its own tab (#263); it also lists scans saved without a profile. */}
      <Button label={historyCopy.title} onPress={() => router.push("/history")} />
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
