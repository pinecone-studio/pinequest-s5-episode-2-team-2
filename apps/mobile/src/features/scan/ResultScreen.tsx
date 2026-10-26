import { router } from "expo-router";
import { Button, Card, Screen, Text } from "../../components/ui";
import { outcomeColors } from "../../theme";
import { useScanResult } from "./ScanResultContext";

export default function ResultScreen() {
  const { result } = useScanResult();
  return (
    <Screen>
      <Text variant="title" accessibilityRole="header">
        TODO(copy): Туршилтын үр дүн
      </Text>
      <Text>TODO(copy): Энэ нь жишээ үр дүн. Камерын зурагт шинжилгээ хийгээгүй.</Text>
      <Card style={result ? { backgroundColor: outcomeColors[result.outcome].background } : {}}>
        <Text>
          {result
            ? "TODO(copy): Дахин зураг авах — жишээ"
            : "TODO(copy): Үр дүн алга. Шалгалт эхлүүлнэ үү."}
        </Text>
      </Card>
      <Text>TODO(copy): Энэ апп онош тавихгүй, нүдний эмчийн үзлэгийг орлохгүй.</Text>
      <Button label="TODO(copy): Шалгалт руу буцах" onPress={() => router.dismissTo("/scan")} />
    </Screen>
  );
}
