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
      {/* #31 and #32 entry points until child profiles (#23) link each child to them. */}
      <Button label="TODO(copy): Treatment" onPress={() => router.push("/treatment")} />
      <Button label="TODO(copy): Habits" onPress={() => router.push("/habits")} />
      {/* #33 entry point; keep it when child profiles (#23) replace this placeholder. */}
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
