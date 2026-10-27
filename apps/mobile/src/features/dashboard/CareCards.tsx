import { router } from "expo-router";
import { View } from "react-native";
import { Text } from "../../components/ui";
import { WeekBars } from "../treatment/WeekBars";
import { theme } from "../../theme";
import { DashboardCard } from "./DashboardCard";
import { dashboardCopy as copy } from "./copy";
import type { DashboardDetails } from "./data";

type Details = Pick<DashboardDetails, "childId" | "patch" | "glasses" | "habits">;
export function CareCards({ details }: { details: Details }) {
  const open = (pathname: "/treatment" | "/habits") =>
    router.push({ pathname, params: { childId: details.childId } });
  const { outdoor, screen_break: breaks } = details.habits;
  return (
    <>
      <DashboardCard title={copy.treatment} onPress={() => open("/treatment")}>
        {(["patch", "glasses"] as const).map((kind) => (
          <View key={kind} style={{ gap: theme.spacing.sm }}>
            <Text style={{ fontWeight: "600" }}>{copy.kinds[kind]}</Text>
            {details[kind].hasLogs ? (
              <>
                <WeekBars week={details[kind].week} goal={details[kind].goal} />
                {details[kind].goal === null && <Text variant="caption">{copy.noGoal}</Text>}
              </>
            ) : (
              <Text>{copy.noTreatment}</Text>
            )}
          </View>
        ))}
      </DashboardCard>
      <DashboardCard title={copy.habits} onPress={() => open("/habits")}>
        {outdoor === 0 && breaks === 0 ? (
          <Text>{copy.noHabits}</Text>
        ) : (
          <>
            <Text>{copy.outdoor(outdoor)}</Text>
            <Text>{copy.breaks(breaks)}</Text>
          </>
        )}
      </DashboardCard>
    </>
  );
}
