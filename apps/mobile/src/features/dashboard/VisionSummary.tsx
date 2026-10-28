import { Text } from "../../components/ui";
import type { AcuityResult } from "../../storage/acuity";
import { decimalAcuity } from "../acuity/acuity";
import { formatScanTime } from "../history/format";
import { resultCopy } from "../scan/resultCopy";
import { dashboardCopy as copy } from "./copy";

/** Render the recorded values; do not recalculate a diagnosis or replace null with zero. */
export function VisionSummary({
  result,
  showRecommendation = true,
}: {
  result: AcuityResult;
  showRecommendation?: boolean;
}) {
  return (
    <>
      <Text variant="caption">{formatScanTime(result.createdAt)}</Text>
      {(["right", "left"] as const).map((eye) => (
        <Text key={eye}>
          {copy.eyes[eye]}: {result[eye] === null ? copy.belowChart : decimalAcuity(result[eye])}
        </Text>
      ))}
      {showRecommendation && result.refer && <Text>{copy.visionRefer}</Text>}
      <Text variant="caption">{resultCopy.notice}</Text>
    </>
  );
}
