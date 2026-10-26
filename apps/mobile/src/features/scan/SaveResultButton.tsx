import type { ScanResult } from "@app/core";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Text } from "../../components/ui";
import { saveSession } from "../../storage/sessions";
import { useActiveChildId } from "../children/useActiveChildId";
import { resultCopy } from "./resultCopy";

// Placeholders until the team writes the final Mongolian copy (CONTRIBUTING.md "App copy").
const copy = {
  saved: "TODO(copy): Saved to history",
  failed: "TODO(copy): Could not save. Try again.",
  noChild: "TODO(copy): Add a child profile to save results",
  mock: "TODO(copy): Example results are not saved",
} as const;

type Status = "idle" | "saving" | "saved" | "failed";

/** Saves the result to the selected child's history. Mock results are never saved. */
export function SaveResultButton({ result }: { result: ScanResult }) {
  const db = useSQLiteContext();
  const childId = useActiveChildId();
  const [status, setStatus] = useState<Status>("idle");
  const mock = result.modelVersion === "mock";
  const disabled = mock || !childId || status === "saving" || status === "saved";

  async function save() {
    if (disabled) return;
    setStatus("saving");
    try {
      await saveSession(db, { ...result, childId });
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  }

  const note = mock
    ? copy.mock
    : childId === null
      ? copy.noChild
      : status === "saved"
        ? copy.saved
        : status === "failed"
          ? copy.failed
          : null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={resultCopy.save}
        disabled={disabled}
        accessibilityState={{ disabled, busy: status === "saving" }}
        onPress={() => void save()}
        style={[styles.button, disabled && styles.disabled]}
      >
        <Text style={styles.label}>{resultCopy.save}</Text>
      </Pressable>
      {note && (
        <Text accessibilityLiveRegion="polite" style={styles.note}>
          {note}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // Same outline button as the result screen's other secondary actions.
  button: {
    borderColor: "#137BFA",
    borderWidth: 1,
    borderRadius: 24,
    minHeight: 48,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.5 },
  label: { fontSize: 15, lineHeight: 22, fontWeight: "700", color: "#153C80" },
  note: { fontSize: 14, lineHeight: 20, textAlign: "center", color: "#526574" },
});
