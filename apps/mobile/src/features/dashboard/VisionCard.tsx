import { router } from "expo-router";
import { Text, Verdict } from "../../components/ui";
import { DashboardCard } from "./DashboardCard";
import { dashboardCopy as copy } from "./copy";
import type { DashboardDetails } from "./data";
import { acuityCopy } from "../acuity/copy";
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
      {result ? (
        <>
          <Verdict
            outcome={result.refer ? "REFER" : "NO_VISIBLE_SIGN"}
            title={result.refer ? copy.visionRefer : acuityCopy.noSign.title}
            icon={result.refer ? "!" : "✓"}
          />
          <VisionSummary result={result} showRecommendation={false} />
        </>
      ) : (
        <Text>{copy.noVision}</Text>
      )}
    </DashboardCard>
  );
}
