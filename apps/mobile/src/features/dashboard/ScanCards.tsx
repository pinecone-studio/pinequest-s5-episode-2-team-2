import { router } from "expo-router";
import { Text, Verdict } from "../../components/ui";
import { formatScanTime } from "../history/format";
import { ProgressChart } from "../progress/ProgressChart";
import { outcomeCopy, resultCopy } from "../scan/resultCopy";
import { theme } from "../../theme";
import { dashboardCopy as copy } from "./copy";
import { DashboardCard } from "./DashboardCard";
import type { DashboardDetails } from "./data";

export function ScanCards({
  details,
}: {
  details: Pick<DashboardDetails, "childId" | "latestScan" | "sessions">;
}) {
  const latest = details.latestScan;
  const outcome = latest && outcomeCopy[latest.outcome];
  return (
    <>
      <DashboardCard
        title={copy.scan}
        icon="scan-outline"
        onPress={() =>
          latest
            ? router.push({ pathname: "/session/[id]", params: { id: latest.id } })
            : router.push({ pathname: "/tests", params: { childId: details.childId } })
        }
      >
        {latest && outcome ? (
          <>
            <Verdict outcome={latest.outcome} title={outcome.title} icon={outcome.icon} />
            <Text variant="caption">{formatScanTime(latest.createdAt)}</Text>
          </>
        ) : (
          <Text>{copy.noScan}</Text>
        )}
        <Text variant="caption" style={{ color: theme.colors.muted }}>
          {resultCopy.notice}
        </Text>
      </DashboardCard>
      <DashboardCard
        title={copy.progress}
        icon="stats-chart-outline"
        onPress={() => router.push({ pathname: "/history", params: { childId: details.childId } })}
      >
        <ProgressChart sessions={details.sessions} showTitle={false} />
      </DashboardCard>
    </>
  );
}
