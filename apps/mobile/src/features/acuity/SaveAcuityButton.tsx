import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { Button, Text } from "../../components/ui";
import { acuityResultId, saveAcuityResult, type AcuityResult } from "../../storage/acuity";
import { theme } from "../../theme";
import { useActiveChildId } from "../children/useActiveChildId";
import { acuityCopy as copy } from "./copy";

type Status = "idle" | "saving" | "saved" | "failed";

/** Saves the finished check to the selected child's history (#139), once. */
export function SaveAcuityButton({
  check,
}: {
  check: Omit<AcuityResult, "id" | "childId" | "createdAt">;
}) {
  const db = useSQLiteContext();
  const childId = useActiveChildId();
  // One ID and time per finished check, so saving twice keeps one row.
  const [{ id, createdAt }] = useState(() => ({
    id: acuityResultId(),
    createdAt: new Date().toISOString(),
  }));
  const [status, setStatus] = useState<Status>("idle");
  const disabled = !childId || status === "saving" || status === "saved";

  async function save() {
    if (disabled) return;
    setStatus("saving");
    try {
      await saveAcuityResult(db, { ...check, id, createdAt, childId });
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  }

  const note =
    childId === null
      ? copy.noChild
      : status === "saved"
        ? copy.saved
        : status === "failed"
          ? copy.failed
          : null;
  return (
    <>
      <Button
        label={copy.save}
        variant="secondary"
        disabled={disabled}
        onPress={() => void save()}
      />
      {note && (
        <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.muted }}>
          {note}
        </Text>
      )}
    </>
  );
}
