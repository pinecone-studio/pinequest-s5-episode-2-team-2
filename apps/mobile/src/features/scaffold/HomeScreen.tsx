import { router } from "expo-router";
import { Button, Card, Screen, Text } from "../../components/ui";
import { LatestScanCard } from "../history/LatestScanCard";

export default function HomeScreen() {
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        TODO(copy): Home
      </Text>
      <Card>
        <Text>TODO(copy): App title</Text>
        <Text>TODO(copy): Eye examination notice</Text>
        <Button label="TODO(copy): Open checks" onPress={() => router.navigate("/tests")} />
      </Card>
      <LatestScanCard />
    </Screen>
  );
}
