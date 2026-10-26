import { router } from "expo-router";
import { Button, Card, Screen, Text } from "../../src/components/ui";
import { ChildrenList } from "../../src/features/children/ChildrenList";

export default function ProfileScreen() {
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        TODO(copy): Profile
      </Text>
      <ChildrenList />
      {/* Treatment and habits work on the selected child. */}
      <Button label="TODO(copy): Treatment" onPress={() => router.push("/treatment")} />
      <Button label="TODO(copy): Habits" onPress={() => router.push("/habits")} />
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
