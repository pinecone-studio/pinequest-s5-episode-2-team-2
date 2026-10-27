import type { ScanResult } from "@app/core";
import { useSQLiteContext } from "expo-sqlite";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Text } from "../../components/ui";
import { fonts, theme } from "../../theme";
import { saveSession } from "../../storage/sessions";
import { useActiveChildId } from "../children/useActiveChildId";
import { resultCopy } from "./resultCopy";

// Mongolian app copy, approved by the team lead (CONTRIBUTING.md "App copy").
const copy = {
  saved: "Түүхэнд хадгалагдлаа",
  failed: "Хадгалж чадсангүй. Дахин оролдоно уу.",
  noChild: "Үр дүнг хадгалахын тулд хүүхдийн профайл нэмнэ үү",
  mock: "Жишээ үр дүнг хадгалахгүй",
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
  // The shared secondary pill button (#152): white, 56 pt, extra-bold blue label.
  button: {
    minHeight: 56,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    shadowColor: "#1F55C4",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  disabled: { opacity: 0.5, shadowOpacity: 0 },
  label: {
    fontFamily: fonts.extraBold,
    fontWeight: "800",
    fontSize: 17,
    lineHeight: 22,
    color: theme.colors.primary,
  },
  note: { fontSize: 14, lineHeight: 20, textAlign: "center", color: theme.colors.muted },
});
