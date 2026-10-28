import { router } from "expo-router";
import { Text } from "../../components/ui";
import { DashboardCard } from "./DashboardCard";
import { dashboardCopy as copy } from "./copy";
import type { DashboardDetails } from "./data";
import { VisionSummary } from "./VisionSummary";

export function VisionCard({
  details,
}: {
  details: Pick<DashboardDetails, "childId" | "latestVision">;
}) {
  const result = details.latestVision;
  return (
    <DashboardCard
      title={copy.vision}
      icon="eye-outline"
      onPress={() =>
        result
          ? router.push({
              pathname: "/vision-result",
              params: { id: result.id, childId: details.childId },
            })
          : router.push({ pathname: "/acuity", params: { childId: details.childId } })
      }
    >
      {result ? <VisionSummary result={result} /> : <Text>{copy.noVision}</Text>}
    </DashboardCard>
  );
}
