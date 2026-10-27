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
      <Button label={dashboardCopy.settings} onPress={() => router.push("/settings")} />
      {__DEV__ && (
        <Card>
          <Text>TODO(copy): Хөгжүүлэгчийн тохиргоо</Text>
          <Button
            label="TODO(copy): Бичлэг дахин тоглуулах"
            onPress={() => router.push("/scan/replay")}
          />
        </Card>
      )}
    </Screen>
  );
}
