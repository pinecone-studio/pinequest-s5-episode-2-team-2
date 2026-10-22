import { Card, Screen, Text } from "../../components/ui";

export function PlaceholderScreen({ title, description }: { title: string; description: string }) {
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      <Card>
        <Text>{description}</Text>
      </Card>
    </Screen>
  );
}
