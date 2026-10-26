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
      {/* Entry point for #31 until child profiles (#23) link each child to its treatment. */}
      <Button label="TODO(copy): Treatment" onPress={() => router.push("/treatment")} />
      <Button label="TODO(copy): Settings" onPress={() => router.push("/settings")} />
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
