import { router } from "expo-router";
import { Button, Card, Screen, Text } from "../../src/components/ui";

export default function ProfileScreen() {
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        TODO(copy): Profile
      </Text>
      <Card>
        <Text>TODO(copy): Profile placeholder</Text>
      </Card>
      {/* Entry point for #33; keep it when child profiles (#23) replace this placeholder. */}
      <Button label="TODO(copy): Settings" onPress={() => router.push("/settings")} />
    </Screen>
  );
}
